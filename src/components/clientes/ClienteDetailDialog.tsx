import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useClientes, Cliente, ReservaCliente } from '@/hooks/useClientes';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import { Loader2, Pencil, Save, X, MessageCircle, MapPin, Calendar, AlertCircle } from 'lucide-react';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';

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

export function ClienteDetailDialog({ clienteId, open, onOpenChange }: ClienteDetailDialogProps) {
  const { getClienteById, updateCliente, getSucursalesByCliente, getReservasByCliente } = useClientes();
  const { organization } = useOrganization();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [sucursalesAsociadas, setSucursalesAsociadas] = useState<Array<{ sucursal_id: string; nombre: string }>>([]);
  const [reservas, setReservas] = useState<ReservaCliente[]>([]);
  const [barberosMap, setBarberosMap] = useState<Record<string, string>>({});
  const [serviciosMap, setServiciosMap] = useState<Record<string, string>>({});
  const [sucursalesMap, setSucursalesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const [editingDatos, setEditingDatos] = useState(false);
  const [editingNota, setEditingNota] = useState(false);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [notaInterna, setNotaInterna] = useState('');
  const [saving, setSaving] = useState(false);

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
        if (c) {
          setNombre(c.nombre);
          setApellido(c.apellido);
          setTelefono(c.telefono ?? '');
          setEmail(c.email ?? '');
          setNotaInterna(c.nota_interna ?? '');
        }

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
      setEditingDatos(false);
      setEditingNota(false);
    }
  }, [open]);

  if (!cliente && !loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cliente</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-6 text-center">Cliente no encontrado.</p>
        </DialogContent>
      </Dialog>
    );
  }

  const handleSaveDatos = async () => {
    if (!cliente) return;
    const n = nombre.trim();
    const a = apellido.trim();
    if (!n || !a) {
      toast.error('Nombre y apellido son obligatorios');
      return;
    }
    const e = email.trim();
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      toast.error('Email inválido');
      return;
    }
    setSaving(true);
    const { error } = await updateCliente(cliente.id, {
      nombre: n,
      apellido: a,
      telefono: telefono.trim() || null,
      email: e || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    setCliente({ ...cliente, nombre: n, apellido: a, telefono: telefono.trim() || null, email: e || null });
    setEditingDatos(false);
    toast.success('Cliente actualizado');
  };

  const handleSaveNota = async () => {
    if (!cliente) return;
    setSaving(true);
    const { error } = await updateCliente(cliente.id, { nota_interna: notaInterna.trim() || null });
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    setCliente({ ...cliente, nota_interna: notaInterna.trim() || null });
    setEditingNota(false);
    toast.success('Nota guardada');
  };

  const today = new Date();
  const reservasOrdenadas = [...reservas].sort((a, b) => (a.fecha + a.hora_inicio).localeCompare(b.fecha + b.hora_inicio));
  const ultimaReserva = reservasOrdenadas
    .filter(r => isBefore(parseISO(`${r.fecha}T${r.hora_inicio}`), today))
    .slice(-1)[0];
  const proximaReserva = reservasOrdenadas
    .find(r => isAfter(parseISO(`${r.fecha}T${r.hora_inicio}`), today));

  const datosIncompletos = cliente && (!cliente.telefono || !cliente.email);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 pr-6">
            <span>{cliente ? `${cliente.nombre} ${cliente.apellido}` : 'Cliente'}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast('Próximamente')}
              className="h-8"
            >
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
            {/* Datos */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">Datos</h3>
                {!editingDatos ? (
                  <Button variant="ghost" size="sm" onClick={() => setEditingDatos(true)} className="h-7 text-xs">
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                ) : (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => {
                      setEditingDatos(false);
                      setNombre(cliente.nombre);
                      setApellido(cliente.apellido);
                      setTelefono(cliente.telefono ?? '');
                      setEmail(cliente.email ?? '');
                    }} className="h-7 text-xs" disabled={saving}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" onClick={handleSaveDatos} className="h-7 text-xs" disabled={saving}>
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Guardar
                    </Button>
                  </div>
                )}
              </div>

              {editingDatos ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nombre *</Label>
                      <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Apellido *</Label>
                      <Input value={apellido} onChange={(e) => setApellido(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Teléfono</Label>
                    <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
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
                      {cliente.telefono || 'Sin teléfono'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Email</span>
                    <span className={cliente.email ? 'truncate' : 'text-muted-foreground italic'}>
                      {cliente.email || 'Sin email'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Origen</span>
                    <Badge variant="outline" className="capitalize text-xs">{cliente.origen}</Badge>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Fecha de creación</span>
                    <span>{format(parseISO(cliente.created_at), "d 'de' MMM yyyy", { locale: es })}</span>
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
                <Calendar className="h-4 w-4" />
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
                  <Button variant="ghost" size="sm" onClick={() => setEditingNota(true)} className="h-7 text-xs">
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
