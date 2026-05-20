import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useClientes, Cliente, ReservaCliente, ClienteUpdate } from '@/hooks/useClientes';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSucursal } from '@/contexts/SucursalContext';
import { useRequirePinForAction } from '@/components/ActionPinGate';
import { toast } from 'sonner';
import {
  Loader2, Pencil, Save, X, MessageCircle, MapPin, Calendar as CalendarLucide,
  CalendarIcon, AlertCircle, ShieldAlert, ShieldOff, Trash2, Lock,
} from 'lucide-react';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { PhoneInput, type PhoneInputChange } from '@/components/ui/phone-input';
import { formatPhoneDisplay } from '@/lib/phone';

interface ClienteDetailDialogProps {
  clienteId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const estadoLabel: Record<string, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

type EditingSection = null | 'contacto' | 'redes' | 'personal';

export function ClienteDetailDialog({ clienteId, open, onOpenChange }: ClienteDetailDialogProps) {
  const {
    getClienteById, updateCliente, getSucursalesByCliente, getReservasByCliente,
    blockCliente, unblockCliente, deleteCliente,
  } = useClientes();
  const { organization } = useOrganization();
  const { currentSucursal } = useSucursal();
  const requirePinForAction = useRequirePinForAction();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [sucursalesAsociadas, setSucursalesAsociadas] = useState<Array<{ sucursal_id: string; nombre: string }>>([]);
  const [reservas, setReservas] = useState<ReservaCliente[]>([]);
  const [barberosMap, setBarberosMap] = useState<Record<string, string>>({});
  const [serviciosMap, setServiciosMap] = useState<Record<string, string>>({});
  const [sucursalesMap, setSucursalesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const [editing, setEditing] = useState<EditingSection>(null);
  const [editingNota, setEditingNota] = useState(false);
  const [saving, setSaving] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Acciones sensibles
  const [blockOpen, setBlockOpen] = useState(false);
  const [unblockOpen, setUnblockOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [motivoInput, setMotivoInput] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  // Form fields
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [phoneOut, setPhoneOut] = useState<PhoneInputChange | null>(null);
  const [email, setEmail] = useState('');
  const [instagram, setInstagram] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [otraRed, setOtraRed] = useState('');
  const [fechaNac, setFechaNac] = useState<string | null>(null);
  const [alergias, setAlergias] = useState('');
  const [aceptaMarketing, setAceptaMarketing] = useState(true);
  const [notaInterna, setNotaInterna] = useState('');

  const hydrateFromCliente = (c: Cliente) => {
    setNombre(c.nombre);
    setApellido(c.apellido);
    setTelefono(c.telefono ?? '');
    setPhoneOut(null);
    setEmail(c.email ?? '');
    setInstagram(c.instagram ?? '');
    setTiktok(c.tiktok ?? '');
    setOtraRed(c.otra_red_social ?? '');
    setFechaNac(c.fecha_nacimiento ?? null);
    setAlergias(c.alergias ?? '');
    setAceptaMarketing(c.acepta_marketing);
    setNotaInterna(c.nota_interna ?? '');
  };

  useEffect(() => {
    if (!open || !clienteId || !organization?.id) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [c, sucs, res] = await Promise.all([
          getClienteById(clienteId),
          getSucursalesByCliente(clienteId),
          getReservasByCliente(clienteId),
        ]);
        if (cancelled) return;
        setCliente(c);
        setSucursalesAsociadas(sucs);
        setReservas(res);
        if (c) hydrateFromCliente(c);

        const barberoIds = Array.from(new Set(res.map(r => r.barbero_id)));
        const servicioIds = Array.from(new Set(res.map(r => r.servicio_id)));
        const sucIds = Array.from(new Set(res.map(r => r.sucursal_id)));

        const [bRes, sRes, suRes] = await Promise.all([
          barberoIds.length
            ? supabase.from('barberos').select('id, nombre, apellido').in('id', barberoIds)
            : Promise.resolve({ data: [] as any[] }),
          servicioIds.length
            ? supabase.from('servicios').select('id, nombre').in('id', servicioIds)
            : Promise.resolve({ data: [] as any[] }),
          sucIds.length
            ? supabase.from('sucursales').select('id, nombre').in('id', sucIds)
            : Promise.resolve({ data: [] as any[] }),
        ]);

        if (cancelled) return;
        const bMap: Record<string, string> = {};
        (bRes.data || []).forEach((b: any) => { bMap[b.id] = `${b.nombre} ${b.apellido}`.trim(); });
        const sMap: Record<string, string> = {};
        (sRes.data || []).forEach((s: any) => { sMap[s.id] = s.nombre; });
        const suMap: Record<string, string> = {};
        (suRes.data || []).forEach((s: any) => { suMap[s.id] = s.nombre; });
        setBarberosMap(bMap);
        setServiciosMap(sMap);
        setSucursalesMap(suMap);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [open, clienteId, organization?.id, getClienteById, getSucursalesByCliente, getReservasByCliente]);

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setEditingNota(false);
      setBlockOpen(false);
      setUnblockOpen(false);
      setDeleteOpen(false);
      setMotivoInput('');
    }
  }, [open]);

  const cancelEdit = () => {
    if (cliente) hydrateFromCliente(cliente);
    setEditing(null);
  };

  const persist = async (patch: ClienteUpdate, successMsg: string) => {
    if (!cliente) return;
    setSaving(true);
    const { error } = await updateCliente(cliente.id, patch);
    setSaving(false);
    if (error) { toast.error(error); return; }
    setCliente({ ...cliente, ...patch } as Cliente);
    setEditing(null);
    toast.success(successMsg);
  };

  const handleSaveContacto = async () => {
    const n = nombre.trim();
    const a = apellido.trim();
    if (!n) { toast.error('El nombre es obligatorio'); return; }
    const e = email.trim();
    // Si el usuario editó el teléfono, usar phoneOut; si no tocó, mantener el valor actual.
    const editedPhone = phoneOut !== null;
    if (editedPhone && phoneOut && !phoneOut.isValid && phoneOut.reason !== 'empty') {
      toast.error('Revisá el teléfono antes de guardar.');
      return;
    }
    const t = editedPhone ? (phoneOut?.e164 ?? '') : telefono.trim();
    if (!t && !e) { toast.error('Ingresá teléfono o email'); return; }
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { toast.error('Email inválido'); return; }
    const patch: ClienteUpdate = { nombre: n, apellido: a, email: e || null };
    if (editedPhone) (patch as any).telefono = t || null;
    await persist(patch, 'Datos de contacto actualizados');
  };

  const handleSaveRedes = () => persist({
    instagram: instagram.trim() || null,
    tiktok: tiktok.trim() || null,
    otra_red_social: otraRed.trim() || null,
  }, 'Redes sociales actualizadas');

  const handleSavePersonal = () => persist({
    fecha_nacimiento: fechaNac,
    alergias: alergias.trim() || null,
    acepta_marketing: aceptaMarketing,
  }, 'Información personal actualizada');

  const handleSaveNota = async () => {
    if (!cliente) return;
    setSaving(true);
    const { error } = await updateCliente(cliente.id, { nota_interna: notaInterna.trim() || null });
    setSaving(false);
    if (error) { toast.error(error); return; }
    setCliente({ ...cliente, nota_interna: notaInterna.trim() || null });
    setEditingNota(false);
    toast.success('Nota guardada');
  };

  const handleConfirmBlock = async () => {
    if (!cliente) return;
    const motivo = motivoInput.trim();
    if (!motivo) { toast.error('El motivo es obligatorio'); return; }
    const gate = await requirePinForAction('bloquear_cliente', currentSucursal?.id ?? null);
    if (!gate.ok) return;
    setActionBusy(true);
    const { error } = await blockCliente(cliente.id, motivo);
    setActionBusy(false);
    if (error) { toast.error(error); return; }
    setCliente({ ...cliente, bloqueado: true, motivo_bloqueo: motivo });
    setBlockOpen(false);
    setMotivoInput('');
    toast.success('Cliente bloqueado');
  };

  const handleConfirmUnblock = async () => {
    if (!cliente) return;
    setActionBusy(true);
    const { error } = await unblockCliente(cliente.id);
    setActionBusy(false);
    if (error) { toast.error(error); return; }
    setCliente({ ...cliente, bloqueado: false, motivo_bloqueo: null });
    setUnblockOpen(false);
    toast.success('Cliente desbloqueado');
  };

  const handleConfirmDelete = async () => {
    if (!cliente) return;
    setActionBusy(true);
    const { error } = await deleteCliente(cliente.id);
    setActionBusy(false);
    if (error) { toast.error(error); return; }
    setDeleteOpen(false);
    toast.success('Cliente eliminado');
    onOpenChange(false);
  };

  if (!cliente && !loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Cliente</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-6 text-center">Cliente no encontrado.</p>
        </DialogContent>
      </Dialog>
    );
  }

  const today = new Date();
  const reservasOrdenadas = [...reservas].sort((a, b) => (a.fecha + a.hora_inicio).localeCompare(b.fecha + b.hora_inicio));
  const ultimaReserva = reservasOrdenadas
    .filter(r => isBefore(parseISO(`${r.fecha}T${r.hora_inicio}`), today))
    .slice(-1)[0];
  const proximaReserva = reservasOrdenadas
    .find(r => isAfter(parseISO(`${r.fecha}T${r.hora_inicio}`), today));

  const datosIncompletos = cliente && (!cliente.telefono || !cliente.email);

  const SectionHeader = ({ title, section }: { title: string; section: EditingSection }) => (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {editing === section ? (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={cancelEdit} className="h-7 text-xs" disabled={saving}>
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={saving}
            onClick={() => {
              if (section === 'contacto') handleSaveContacto();
              else if (section === 'redes') handleSaveRedes();
              else if (section === 'personal') handleSavePersonal();
            }}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Guardar
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { if (cliente) hydrateFromCliente(cliente); setEditing(section); }}
          className="h-7 text-xs"
          disabled={editing !== null}
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </Button>
      )}
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3 pr-6">
              <span className="flex items-center gap-2">
                {cliente ? [cliente.nombre, cliente.apellido].filter(Boolean).join(' ') : 'Cliente'}
                {cliente?.bloqueado && (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <ShieldAlert className="h-3 w-3" />
                    Bloqueado
                  </Badge>
                )}
              </span>
              <Button variant="outline" size="sm" onClick={() => toast('Próximamente')} className="h-8">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </Button>
            </DialogTitle>
          </DialogHeader>

          {loading || !cliente ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Aviso de cliente bloqueado en la parte superior */}
              {cliente.bloqueado && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 flex items-start gap-3">
                  <ShieldAlert className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-destructive">Cliente bloqueado</p>
                    {cliente.motivo_bloqueo && (
                      <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                        Motivo: {cliente.motivo_bloqueo}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Datos de contacto */}
              <section>
                <SectionHeader title="Datos de contacto" section="contacto" />
                {editing === 'contacto' ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Nombre *</Label>
                        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Apellido</Label>
                        <Input value={apellido} onChange={(e) => setApellido(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Teléfono</Label>
                      <PhoneInput
                        value={phoneOut?.e164 ?? (telefono || null)}
                        onChange={(o) => {
                          setPhoneOut(o);
                          setTelefono(o.e164 ?? '');
                        }}
                        defaultCountry="AR"
                        allowedCountries={['AR']}
                        mode="mobile"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Email</Label>
                      <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Teléfono</span>
                      <span className={cliente.telefono ? '' : 'text-muted-foreground italic'}>
                        {cliente.telefono ? formatPhoneDisplay(cliente.telefono) : 'Sin teléfono'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Email</span>
                      <span className={cliente.email ? 'truncate' : 'text-muted-foreground italic'}>
                        {cliente.email || 'Sin email'}
                      </span>
                    </div>
                    {datosIncompletos && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                        <AlertCircle className="h-3 w-3" />
                        Datos de contacto incompletos.
                      </div>
                    )}
                  </div>
                )}
              </section>

              <Separator />

              {/* Redes sociales */}
              <section>
                <SectionHeader title="Redes sociales" section="redes" />
                {editing === 'redes' ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Instagram</Label>
                      <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@usuario" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">TikTok</Label>
                      <Input value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="@usuario" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Otra red social</Label>
                      <Input value={otraRed} onChange={(e) => setOtraRed(e.target.value)} placeholder="Ej: Twitter @usuario" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Instagram</span>
                      <span className={cliente.instagram ? '' : 'text-muted-foreground italic'}>
                        {cliente.instagram || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">TikTok</span>
                      <span className={cliente.tiktok ? '' : 'text-muted-foreground italic'}>
                        {cliente.tiktok || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Otra red social</span>
                      <span className={cliente.otra_red_social ? '' : 'text-muted-foreground italic'}>
                        {cliente.otra_red_social || '—'}
                      </span>
                    </div>
                  </div>
                )}
              </section>

              <Separator />

              {/* Información personal */}
              <section>
                <SectionHeader title="Información personal" section="personal" />
                {editing === 'personal' ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Fecha de nacimiento</Label>
                      <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn("w-full justify-start text-left font-normal", !fechaNac && "text-muted-foreground")}
                          >
                            <CalendarIcon className="h-4 w-4" />
                            {fechaNac ? format(parseISO(fechaNac), "d 'de' MMMM yyyy", { locale: es }) : 'Seleccionar fecha'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={fechaNac ? parseISO(fechaNac) : undefined}
                            onSelect={(d) => {
                              setFechaNac(d ? format(d, 'yyyy-MM-dd') : null);
                              setDatePickerOpen(false);
                            }}
                            disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                            initialFocus
                            className={cn('p-3 pointer-events-auto')}
                            captionLayout="dropdown-buttons"
                            fromYear={1900}
                            toYear={new Date().getFullYear()}
                          />
                          <div className="border-t p-2 flex justify-end">
                            <Button type="button" variant="ghost" size="sm" onClick={() => { setFechaNac(null); setDatePickerOpen(false); }}>
                              Limpiar
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Alergias</Label>
                      <Textarea value={alergias} onChange={(e) => setAlergias(e.target.value)} rows={2} placeholder="Ej: tintes, amoníaco..." />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                      <div className="space-y-0.5">
                        <Label className="text-sm">Acepta marketing</Label>
                        <p className="text-xs text-muted-foreground">Promociones y novedades por mensajes.</p>
                      </div>
                      <Switch checked={aceptaMarketing} onCheckedChange={setAceptaMarketing} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Fecha de nacimiento</span>
                      <span className={cliente.fecha_nacimiento ? '' : 'text-muted-foreground italic'}>
                        {cliente.fecha_nacimiento
                          ? format(parseISO(cliente.fecha_nacimiento), "d 'de' MMM yyyy", { locale: es })
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Alergias</span>
                      <span className={cn("text-right", cliente.alergias ? '' : 'text-muted-foreground italic')}>
                        {cliente.alergias || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4 items-center">
                      <span className="text-muted-foreground">Acepta marketing</span>
                      <Badge variant={cliente.acepta_marketing ? 'secondary' : 'outline'} className="text-[10px]">
                        {cliente.acepta_marketing ? 'Sí' : 'No'}
                      </Badge>
                    </div>
                  </div>
                )}
              </section>

              <Separator />

              {/* Sucursales */}
              <section>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Sucursales asociadas
                </h3>
                {sucursalesAsociadas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin sucursales asociadas.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {sucursalesAsociadas.map(s => (
                      <Badge key={s.sucursal_id} variant="secondary" className="text-xs">{s.nombre}</Badge>
                    ))}
                  </div>
                )}
              </section>

              <Separator />

              {/* Reservas */}
              <section>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <CalendarLucide className="h-4 w-4" />
                  Reservas
                </h3>
                {reservas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin reservas registradas.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="text-lg font-medium">{reservas.length}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Última</p>
                        <p className="text-xs font-medium mt-1">
                          {ultimaReserva ? format(parseISO(ultimaReserva.fecha), 'd MMM yyyy', { locale: es }) : '—'}
                        </p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Próxima</p>
                        <p className="text-xs font-medium mt-1">
                          {proximaReserva ? format(parseISO(proximaReserva.fecha), 'd MMM yyyy', { locale: es }) : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {[...reservas].reverse().map(r => (
                        <div key={r.id} className="flex items-center justify-between text-xs border rounded-md px-3 py-2">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {format(parseISO(r.fecha), "d MMM yyyy", { locale: es })} · {r.hora_inicio.slice(0, 5)}
                            </span>
                            <span className="text-muted-foreground">
                              {serviciosMap[r.servicio_id] || 'Servicio'} · {barberosMap[r.barbero_id] || 'Barbero'} · {sucursalesMap[r.sucursal_id] || 'Sucursal'}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[10px]">{estadoLabel[r.estado] || r.estado}</Badge>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>

              <Separator />

              {/* Nota interna */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium">Nota interna</h3>
                  {!editingNota ? (
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => { setNotaInterna(cliente.nota_interna ?? ''); setEditingNota(true); }}
                      className="h-7 text-xs"
                      disabled={editing !== null}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {cliente.nota_interna ? 'Editar' : 'Agregar'}
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => {
                        setEditingNota(false);
                        setNotaInterna(cliente.nota_interna ?? '');
                      }} className="h-7 text-xs" disabled={saving}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" onClick={handleSaveNota} className="h-7 text-xs" disabled={saving}>
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Guardar
                      </Button>
                    </div>
                  )}
                </div>
                {editingNota ? (
                  <Textarea
                    value={notaInterna}
                    onChange={(e) => setNotaInterna(e.target.value)}
                    placeholder="Notas internas sobre el cliente..."
                    rows={4}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {cliente.nota_interna || 'Sin notas.'}
                  </p>
                )}
              </section>

              <Separator />

              {/* Acciones sensibles */}
              <section className="space-y-3">
                <h3 className="text-sm font-medium">Acciones</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  {cliente.bloqueado ? (
                    <Button
                      variant="outline"
                      onClick={() => setUnblockOpen(true)}
                      className="sm:flex-1"
                    >
                      <ShieldOff className="h-4 w-4" />
                      Desbloquear cliente
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => { setMotivoInput(''); setBlockOpen(true); }}
                      className="sm:flex-1"
                    >
                      <Lock className="h-4 w-4" />
                      Bloquear cliente
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteOpen(true)}
                    className="sm:flex-1"
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar cliente
                  </Button>
                </div>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Bloquear cliente */}
      <Dialog open={blockOpen} onOpenChange={(o) => { if (!actionBusy) setBlockOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Bloquear cliente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              Indicá el motivo del bloqueo. Quedará registrado en el perfil del cliente.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="motivo_bloqueo">Motivo *</Label>
              <Textarea
                id="motivo_bloqueo"
                value={motivoInput}
                onChange={(e) => setMotivoInput(e.target.value)}
                placeholder="Ej: faltó a varias reservas sin avisar."
                rows={3}
                autoFocus
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setBlockOpen(false)} disabled={actionBusy}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmBlock}
              disabled={actionBusy || motivoInput.trim().length === 0}
            >
              {actionBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              Bloquear
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmación: Desbloquear cliente */}
      <AlertDialog open={unblockOpen} onOpenChange={(o) => { if (!actionBusy) setUnblockOpen(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desbloquear cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Se quitará la marca de bloqueo y el motivo asociado. El cliente volverá a aparecer como disponible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUnblock} disabled={actionBusy}>
              {actionBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              Desbloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmación: Eliminar cliente */}
      <AlertDialog open={deleteOpen} onOpenChange={(o) => { if (!actionBusy) setDeleteOpen(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar cliente</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar a <span className="font-medium text-foreground">{cliente ? [cliente.nombre, cliente.apellido].filter(Boolean).join(' ') : ''}</span>?
              Esta acción ocultará el cliente de la lista. El historial de turnos se conserva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={actionBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
