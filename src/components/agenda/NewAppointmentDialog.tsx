import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Barber } from '@/types/barbershop';
import { Servicio } from './hooks/useAgendaData';
import { timeToMinutes, minutesToTime } from './lib/timeUtils';
import { format } from 'date-fns';
import { Search, UserPlus, Zap, ArrowLeft, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { canonicalizePhoneAR, formatPhoneDisplay } from '@/lib/phone';
import { PhoneInput, type PhoneInputChange } from '@/components/ui/phone-input';

interface NewAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  sucursalId: string;
  sucursalTimezone: string;
  barbers: Barber[];
  servicios: Servicio[];
  defaultDate: Date;
  defaultBarberId?: string;
  defaultHoraInicio?: string;
  onCreated: () => void;
}

type Mode = 'existing' | 'new' | 'quick';

interface ClienteLite {
  id: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  email: string | null;
  inSucursal?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fullName(c: { nombre: string; apellido: string | null }) {
  return `${c.nombre}${c.apellido ? ' ' + c.apellido : ''}`.trim();
}

export function NewAppointmentDialog({
  open, onOpenChange, organizationId, sucursalId, sucursalTimezone, barbers, servicios,
  defaultDate, defaultBarberId, defaultHoraInicio, onCreated,
}: NewAppointmentDialogProps) {
  const [mode, setMode] = useState<Mode>('existing');

  // existing
  const [selectedCliente, setSelectedCliente] = useState<ClienteLite | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClienteLite[]>([]);
  const [searching, setSearching] = useState(false);

  // new / quick
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [phoneOut, setPhoneOut] = useState<PhoneInputChange | null>(null);
  const [email, setEmail] = useState('');

  // common
  const [barberoId, setBarberoId] = useState(defaultBarberId || '');
  const [servicioId, setServicioId] = useState('');
  const [fecha, setFecha] = useState(format(defaultDate, 'yyyy-MM-dd'));
  const [horaInicio, setHoraInicio] = useState(defaultHoraInicio || '10:00');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  const activeBarbers = useMemo(() => barbers.filter(b => b.active), [barbers]);

  // sync defaults when dialog opens
  useEffect(() => {
    if (open) {
      setBarberoId(defaultBarberId || '');
      setFecha(format(defaultDate, 'yyyy-MM-dd'));
      setHoraInicio(defaultHoraInicio || '10:00');
    }
  }, [open, defaultBarberId, defaultHoraInicio, defaultDate]);

  const reset = () => {
    setMode('existing');
    setSelectedCliente(null);
    setQuery(''); setResults([]); setSearchOpen(false);
    setNombre(''); setApellido(''); setTelefono(''); setPhoneOut(null); setEmail('');
    setServicioId(''); setNotas('');
  };

  // debounced search
  const tokenRef = useRef(0);
  useEffect(() => {
    if (!searchOpen) return;
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
          req = req.or(
            `nombre.ilike.%${safe}%,apellido.ilike.%${safe}%,telefono.ilike.%${safe}%,email.ilike.%${safe}%`
          );
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
        const localIds = new Set((linkData || []).map(l => l.cliente_id));
        const list: ClienteLite[] = (cliData || []).map(c => ({
          ...c,
          inSucursal: localIds.has(c.id),
        }));
        list.sort((a, b) => Number(b.inSucursal) - Number(a.inSucursal));
        setResults(list);
      } catch (e) {
        if (myToken === tokenRef.current) setResults([]);
      } finally {
        if (myToken === tokenRef.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, searchOpen, organizationId, sucursalId]);

  const validateCommon = () => {
    if (!barberoId) { toast.error('Seleccioná un barbero'); return false; }
    if (!servicioId) { toast.error('Seleccioná un servicio'); return false; }
    if (!fecha) { toast.error('Seleccioná una fecha'); return false; }
    if (!horaInicio) { toast.error('Seleccioná una hora'); return false; }
    return true;
  };

  const validateClienteFields = (): { ok: boolean; phoneCanonical: string | null } => {
    if (!nombre.trim()) { toast.error('Ingresá el nombre'); return { ok: false, phoneCanonical: null }; }
    if (!apellido.trim()) { toast.error('Ingresá el apellido'); return { ok: false, phoneCanonical: null }; }
    if (!phoneOut?.e164 || !phoneOut.isValid) {
      toast.error('Ingresá un teléfono válido. Ejemplo: 11 2516-2528.');
      return { ok: false, phoneCanonical: null };
    }
    if (email.trim() && !EMAIL_RE.test(email.trim())) {
      toast.error('Email inválido');
      return { ok: false, phoneCanonical: null };
    }
    return { ok: true, phoneCanonical: phoneOut.e164 };
  };

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

  const handleSubmit = async () => {
    const servicio = servicios.find(s => s.id === servicioId);

    let telefonoCanonical: string | null = null;
    if (mode === 'existing') {
      if (!selectedCliente) { toast.error('Seleccioná un cliente'); return; }
      if (!validateCommon() || !servicio) return;
    } else {
      const v = validateClienteFields();
      if (!v.ok) return;
      telefonoCanonical = v.phoneCanonical;
      if (!validateCommon() || !servicio) return;
    }

    setSaving(true);
    try {
      let clienteId: string | null = null;
      let snapNombre = '';
      let snapTelefono: string | null = null;
      let snapEmail: string | null = null;

      if (mode === 'existing' && selectedCliente) {
        clienteId = selectedCliente.id;
        snapNombre = fullName(selectedCliente).slice(0, 80);
        snapTelefono = selectedCliente.telefono || null;
        snapEmail = selectedCliente.email || null;
        if (!selectedCliente.inSucursal) {
          await ensureRelacion(selectedCliente.id);
        }
      } else if (mode === 'new') {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('create_cliente_with_sucursal', {
          _nombre: nombre.trim(),
          _apellido: apellido.trim(),
          _sucursal_id: sucursalId,
          _telefono: telefonoCanonical,
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
        snapNombre = `${nombre.trim()} ${apellido.trim()}`.slice(0, 80);
        snapTelefono = telefonoCanonical;
        snapEmail = email.trim() || null;
      } else {
        // quick
        clienteId = null;
        snapNombre = `${nombre.trim()} ${apellido.trim()}`.slice(0, 80);
        snapTelefono = telefonoCanonical;
        snapEmail = email.trim() || null;
      }

      const horaFin = minutesToTime(timeToMinutes(horaInicio) + servicio.duracion_min);
      const { error: turnoErr } = await supabase.from('turnos').insert({
        organization_id: organizationId,
        sucursal_id: sucursalId,
        barbero_id: barberoId,
        servicio_id: servicioId,
        cliente_id: clienteId,
        cliente_nombre: snapNombre,
        cliente_telefono: snapTelefono ? snapTelefono.slice(0, 80) : null,
        cliente_email: snapEmail ? snapEmail.slice(0, 120) : null,
        fecha,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        timezone: sucursalTimezone || 'America/Argentina/Buenos_Aires',
        estado: 'pendiente',
        notas: notas.trim().slice(0, 1500) || null,
      });
      if (turnoErr) throw turnoErr;

      toast.success('Turno creado');
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      console.error('Crear turno error:', e);
      toast.error(e?.message || 'Error al crear el turno');
    } finally {
      setSaving(false);
    }
  };

  const renderClienteBlock = () => {
    if (mode === 'existing') {
      return (
        <div className="space-y-2">
          <Label className="text-xs">Cliente</Label>
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between font-normal"
              >
                {selectedCliente ? (
                  <span className="flex items-center gap-2 truncate">
                    <span className="truncate">{fullName(selectedCliente)}</span>
                    {selectedCliente.telefono && (
                      <span className="text-xs text-muted-foreground truncate">· {selectedCliente.telefono}</span>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Buscar por nombre, apellido, teléfono o email</span>
                )}
                {selectedCliente ? (
                  <X
                    className="h-4 w-4 opacity-60 hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); setSelectedCliente(null); }}
                  />
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
                  placeholder="Buscar por nombre, apellido, teléfono o email"
                  className="flex h-10 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
                  maxLength={80}
                />
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {searching && (
                  <div className="px-3 py-3 text-xs text-muted-foreground">Buscando…</div>
                )}
                {!searching && results.length === 0 && (
                  <div className="px-3 py-3 text-xs text-muted-foreground">
                    Sin resultados. Probá con otro término o creá un cliente nuevo.
                  </div>
                )}
                {!searching && results.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setSelectedCliente(c); setSearchOpen(false); }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-start gap-2",
                      selectedCliente?.id === c.id && "bg-accent"
                    )}
                  >
                    <Check className={cn("h-4 w-4 mt-0.5 shrink-0", selectedCliente?.id === c.id ? "opacity-100" : "opacity-0")} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{fullName(c)}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[c.telefono, c.email].filter(Boolean).join(' · ') || '—'}
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
    }

    // new / quick share fields
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs">
            {mode === 'new' ? 'Datos del nuevo cliente' : 'Datos para la cita rápida'}
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => { setMode('existing'); setNombre(''); setApellido(''); setTelefono(''); setEmail(''); }}
          >
            <ArrowLeft className="h-3 w-3 mr-1" /> Volver
          </Button>
        </div>
        {mode === 'quick' && (
          <p className="text-xs text-muted-foreground -mt-1">
            No se guarda en el listado de clientes.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Nombre *</Label>
            <Input value={nombre} onChange={e => setNombre(e.target.value)} maxLength={80} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Apellido *</Label>
            <Input value={apellido} onChange={e => setApellido(e.target.value)} maxLength={80} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Teléfono *</Label>
            <Input
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              maxLength={40}
              inputMode="tel"
              type="tel"
              placeholder="Ejemplo: 11 2516-2528"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Email (opcional)</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={120} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva cita</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {renderClienteBlock()}

          {mode === 'existing' && (
            <div className="flex flex-wrap gap-2 -mt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => { setMode('new'); setSelectedCliente(null); }}
              >
                <UserPlus className="h-3.5 w-3.5 mr-1" /> Nuevo cliente
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => { setMode('quick'); setSelectedCliente(null); }}
              >
                <Zap className="h-3.5 w-3.5 mr-1" /> Cita rápida sin cliente
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Barbero</Label>
              <Select value={barberoId} onValueChange={setBarberoId}>
                <SelectTrigger><SelectValue placeholder="Elegir" /></SelectTrigger>
                <SelectContent>
                  {activeBarbers.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.firstName} {b.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Servicio</Label>
              <Select value={servicioId} onValueChange={setServicioId}>
                <SelectTrigger><SelectValue placeholder="Elegir" /></SelectTrigger>
                <SelectContent>
                  {servicios.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.nombre} · {s.duracion_min}min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hora inicio</Label>
              <Input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notas (opcional)</Label>
            <Textarea value={notas} onChange={e => setNotas(e.target.value)} maxLength={1500} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Guardando…' : 'Crear cita'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
