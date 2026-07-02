import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Phone, Calendar, User, Scissors, X, Search, Check, UserPlus, ArrowLeft, Pencil, Clock, CalendarIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Barber } from '@/types/barbershop';
import { Turno, Servicio } from './hooks/useAgendaData';
import { formatHHMM } from './lib/timeUtils';
import { cn } from '@/lib/utils';
import { formatPhoneDisplay } from '@/lib/phone';
import { PhoneInput, type PhoneInputChange } from '@/components/ui/phone-input';
import { callUpdateTurnoInternal, type ConflictTurno } from './lib/updateTurnoInternal';
import { TurnoConflictDialog, type TurnoConflictKind } from './TurnoConflictDialog';


interface AppointmentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  turno: Turno | null;
  organizationId: string;
  sucursalId: string;
  barbers: Barber[];
  servicios: Servicio[];
  onChanged: () => void;
  readOnly?: boolean;
}

interface ClienteLite {
  id: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  email: string | null;
  inSucursal?: boolean;
}

type ClienteEditMode = 'existing' | 'new';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fullName(c: { nombre: string; apellido: string | null }) {
  return `${c.nombre}${c.apellido ? ' ' + c.apellido : ''}`.trim();
}

export function AppointmentDetailDialog({
  open,
  onOpenChange,
  turno,
  organizationId,
  sucursalId,
  barbers,
  servicios,
  onChanged,
  readOnly = false,
}: AppointmentDetailDialogProps) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const [editingCliente, setEditingCliente] = useState(false);
  const [clienteMode, setClienteMode] = useState<ClienteEditMode>('existing');
  const [savingCliente, setSavingCliente] = useState(false);

  const [selectedCliente, setSelectedCliente] = useState<ClienteLite | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClienteLite[]>([]);
  const [searching, setSearching] = useState(false);

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [phoneOut, setPhoneOut] = useState<PhoneInputChange | null>(null);
  const [email, setEmail] = useState('');

  const tokenRef = useRef(0);

  useEffect(() => {
    if (!open) {
      setEditingCliente(false);
      setClienteMode('existing');
      setSelectedCliente(null);
      setSearchOpen(false);
      setQuery('');
      setResults([]);
      setSearching(false);
      setNombre('');
      setApellido('');
      setPhoneOut(null);
      setEmail('');
      setConfirmingCancel(false);
      setMotivo('');
    }
  }, [open]);

  useEffect(() => {
    if (!editingCliente || !searchOpen) return;
    const q = query.trim();
    const myToken = ++tokenRef.current;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        let req = supabase
          .from('clientes')
          .select('id, nombre, apellido, telefono, email')
          .eq('organization_id', organizationId)
          .eq('eliminado', false)
          .order('apellido', { ascending: true })
          .limit(20);
        if (q.length > 0) {
          const safe = q.replace(/[%,]/g, ' ');
          req = req.or(`nombre.ilike.%${safe}%,apellido.ilike.%${safe}%,telefono.ilike.%${safe}%,email.ilike.%${safe}%`);
        }

        const [{ data: cliData }, { data: linkData }] = await Promise.all([
          req,
          supabase
            .from('clientes_sucursales')
            .select('cliente_id')
            .eq('organization_id', organizationId)
            .eq('sucursal_id', sucursalId),
        ]);
        if (myToken !== tokenRef.current) return;
        const localIds = new Set((linkData || []).map((l) => l.cliente_id));
        const list: ClienteLite[] = (cliData || []).map((c) => ({ ...c, inSucursal: localIds.has(c.id) }));
        list.sort((a, b) => Number(b.inSucursal) - Number(a.inSucursal));
        setResults(list);
      } catch {
        if (myToken === tokenRef.current) setResults([]);
      } finally {
        if (myToken === tokenRef.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [editingCliente, searchOpen, query, organizationId, sucursalId]);

  if (!turno) return null;
  const barber = barbers.find((b) => b.id === turno.barbero_id);
  const servicio = servicios.find((s) => s.id === turno.servicio_id);
  const canCancel = !readOnly && ['pendiente', 'confirmado'].includes(turno.estado);
  const canEditCliente = !readOnly && ['pendiente', 'confirmado', 'en_curso'].includes(turno.estado);

  const ensureRelacion = async (clienteId: string) => {
    const { data: existing, error: selErr } = await supabase
      .from('clientes_sucursales')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('cliente_id', clienteId)
      .eq('sucursal_id', sucursalId)
      .maybeSingle();
    if (selErr) throw selErr;
    if (existing) return;
    const { error: insErr } = await supabase
      .from('clientes_sucursales')
      .insert({
        organization_id: organizationId,
        cliente_id: clienteId,
        sucursal_id: sucursalId,
        origen_relacion: 'manual',
      } as any);
    if (insErr) throw insErr;
  };

  const validateNewCliente = (): { ok: boolean; phoneCanonical: string | null } => {
    if (!nombre.trim()) {
      toast.error('Ingresa el nombre');
      return { ok: false, phoneCanonical: null };
    }
    if (!apellido.trim()) {
      toast.error('Ingresa el apellido');
      return { ok: false, phoneCanonical: null };
    }
    if (!phoneOut?.e164 || !phoneOut.isValid) {
      toast.error('Ingresa un telefono valido');
      return { ok: false, phoneCanonical: null };
    }
    if (email.trim() && !EMAIL_RE.test(email.trim())) {
      toast.error('Email invalido');
      return { ok: false, phoneCanonical: null };
    }
    return { ok: true, phoneCanonical: phoneOut.e164 };
  };

  const resetClienteEditor = () => {
    setClienteMode('existing');
    setSelectedCliente(null);
    setSearchOpen(false);
    setQuery('');
    setResults([]);
    setSearching(false);
    setNombre('');
    setApellido('');
    setPhoneOut(null);
    setEmail('');
  };

  const handleCancel = async () => {
    setCancelling(true);
    const { error } = await supabase
      .from('turnos')
      .update({
        estado: 'cancelado',
        cancelado_at: new Date().toISOString(),
        cancelado_motivo: motivo.trim().slice(0, 240) || null,
      })
      .eq('id', turno.id);
    setCancelling(false);
    if (error) {
      toast.error('Error al cancelar');
      return;
    }
    toast.success('Turno cancelado');
    setConfirmingCancel(false);
    setMotivo('');
    onOpenChange(false);
    onChanged();
  };

  const handleSaveCliente = async () => {
    setSavingCliente(true);
    try {
      let clienteId: string | null = null;
      let clienteNombre = '';
      let clienteTelefono: string | null = null;
      let clienteEmail: string | null = null;

      if (clienteMode === 'existing') {
        if (!selectedCliente) {
          toast.error('Selecciona un cliente');
          setSavingCliente(false);
          return;
        }
        clienteId = selectedCliente.id;
        clienteNombre = fullName(selectedCliente).slice(0, 80);
        clienteTelefono = selectedCliente.telefono ? selectedCliente.telefono.slice(0, 80) : null;
        clienteEmail = selectedCliente.email ? selectedCliente.email.slice(0, 120) : null;
        if (!selectedCliente.inSucursal) {
          await ensureRelacion(selectedCliente.id);
        }
      } else {
        const v = validateNewCliente();
        if (!v.ok) {
          setSavingCliente(false);
          return;
        }
        const { data: rpcData, error: rpcErr } = await supabase.rpc('create_cliente_with_sucursal', {
          _nombre: nombre.trim(),
          _apellido: apellido.trim(),
          _sucursal_id: sucursalId,
          _telefono: v.phoneCanonical,
          _email: email.trim() || null,
          _instagram: null,
          _tiktok: null,
          _otra_red_social: null,
          _fecha_nacimiento: null,
          _alergias: null,
          _acepta_marketing: true,
        } as any);
        if (rpcErr) throw rpcErr;
        clienteId = (rpcData as string) || null;
        clienteNombre = `${nombre.trim()} ${apellido.trim()}`.slice(0, 80);
        clienteTelefono = v.phoneCanonical ? v.phoneCanonical.slice(0, 80) : null;
        clienteEmail = email.trim() ? email.trim().slice(0, 120) : null;
      }

      const { error } = await supabase.from('turnos').update({
        cliente_id: clienteId,
        cliente_nombre: clienteNombre,
        cliente_telefono: clienteTelefono,
        cliente_email: clienteEmail,
      }).eq('id', turno.id);

      if (error) throw error;

      toast.success('Cliente asociado al turno');
      setEditingCliente(false);
      resetClienteEditor();
      onChanged();
    } catch (e: any) {
      console.error('Asociar cliente turno error:', e);
      toast.error(e?.message || 'No se pudo actualizar el cliente del turno');
    } finally {
      setSavingCliente(false);
    }
  };

  const renderExistingClientePicker = () => {
    return (
      <div className="space-y-2">
        <Label className="text-xs">Cliente existente</Label>
        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="w-full justify-between font-normal">
              {selectedCliente ? (
                <span className="flex items-center gap-2 truncate">
                  <span className="truncate">{fullName(selectedCliente)}</span>
                  {selectedCliente.telefono && (
                    <span className="text-xs text-muted-foreground truncate">· {formatPhoneDisplay(selectedCliente.telefono)}</span>
                  )}
                </span>
              ) : (
                <span className="text-muted-foreground">Buscar por nombre, apellido, telefono o email</span>
              )}
              {selectedCliente ? (
                <X className="h-4 w-4 opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); setSelectedCliente(null); }} />
              ) : (
                <Search className="h-4 w-4 opacity-60" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre, apellido, telefono o email"
                className="flex h-10 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
                maxLength={80}
              />
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {searching && (
                <div className="px-3 py-3 text-xs text-muted-foreground">Buscando...</div>
              )}
              {!searching && results.length === 0 && (
                <div className="px-3 py-3 text-xs text-muted-foreground">
                  Sin resultados.
                </div>
              )}
              {!searching && results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setSelectedCliente(c); setSearchOpen(false); }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-start gap-2',
                    selectedCliente?.id === c.id && 'bg-accent',
                  )}
                >
                  <Check className={cn('h-4 w-4 mt-0.5 shrink-0', selectedCliente?.id === c.id ? 'opacity-100' : 'opacity-0')} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{fullName(c)}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[c.telefono ? formatPhoneDisplay(c.telefono) : null, c.email].filter(Boolean).join(' · ') || '-'}
                    </div>
                  </div>
                  {!c.inSucursal && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                      Otra sucursal
                    </span>
                  )}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  };

  const renderNewClienteForm = () => {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Nombre *</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Apellido *</Label>
            <Input value={apellido} onChange={(e) => setApellido(e.target.value)} maxLength={80} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Telefono *</Label>
            <PhoneInput
              value={phoneOut?.e164 ?? null}
              onChange={(o) => setPhoneOut(o)}
              defaultCountry="AR"
              allowedCountries={['AR', 'UY', 'CL', 'CO', 'MX', 'ES', 'BR']}
              mode="mobile"
              required
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Email (opcional)</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setConfirmingCancel(false); setMotivo(''); } onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{turno.cliente_nombre || 'Sin nombre'}</DialogTitle>
            <Badge variant="outline" className="text-[10px] h-5 capitalize">{turno.estado}</Badge>
          </div>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{turno.fecha} · {formatHHMM(turno.hora_inicio)} - {formatHHMM(turno.hora_fin)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Scissors className="h-4 w-4" />
            <span>{servicio?.nombre || 'Servicio'}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span>{barber ? `${barber.firstName} ${barber.lastName}` : '-'}</span>
          </div>
          {turno.cliente_telefono && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{turno.cliente_telefono}</span>
            </div>
          )}
          {turno.notas && (
            <div className="text-xs text-muted-foreground border-l-2 border-border pl-3">{turno.notas}</div>
          )}

          {editingCliente && canEditCliente && (
            <div className="space-y-3 pt-3 border-t">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={clienteMode === 'existing' ? 'default' : 'outline'}
                  className="h-8 px-2 text-xs"
                  onClick={() => {
                    setClienteMode('existing');
                    setNombre('');
                    setApellido('');
                    setPhoneOut(null);
                    setEmail('');
                  }}
                >
                  Cliente existente
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={clienteMode === 'new' ? 'default' : 'outline'}
                  className="h-8 px-2 text-xs"
                  onClick={() => {
                    setClienteMode('new');
                    setSelectedCliente(null);
                    setSearchOpen(false);
                    setQuery('');
                    setResults([]);
                  }}
                >
                  <UserPlus className="h-3.5 w-3.5 mr-1" /> Crear cliente
                </Button>
              </div>
              {clienteMode === 'existing' ? renderExistingClientePicker() : renderNewClienteForm()}
            </div>
          )}

          {confirmingCancel && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs text-muted-foreground">Motivo de cancelacion (opcional)</p>
              <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={240} rows={2} />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          {!confirmingCancel ? (
            <>
              {editingCliente ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => { setEditingCliente(false); resetClienteEditor(); }}
                    disabled={savingCliente}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" /> Cancelar
                  </Button>
                  <Button onClick={handleSaveCliente} disabled={savingCliente}>
                    {savingCliente ? 'Guardando...' : 'Guardar cliente'}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
                  {canEditCliente && (
                    <Button variant="outline" onClick={() => setEditingCliente(true)}>
                      Editar cliente
                    </Button>
                  )}
                  {canCancel && (
                    <Button variant="destructive" onClick={() => setConfirmingCancel(true)}>
                      <X className="h-4 w-4" /> Cancelar turno
                    </Button>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setConfirmingCancel(false)} disabled={cancelling}>Volver</Button>
              <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
                {cancelling ? 'Cancelando...' : 'Si, cancelar'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

