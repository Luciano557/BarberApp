import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSucursal } from '@/contexts/SucursalContext';
import { useClientes } from '@/hooks/useClientes';
import { toast } from 'sonner';
import { Loader2, ChevronDown, CalendarIcon, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { PhoneInput, type PhoneInputChange } from '@/components/ui/phone-input';

interface NuevoClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

export function NuevoClienteDialog({ open, onOpenChange, onCreated }: NuevoClienteDialogProps) {
  const { sucursales, currentSucursal, isAllMode } = useSucursal();
  const { createCliente } = useClientes();

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [phoneOut, setPhoneOut] = useState<PhoneInputChange | null>(null);
  const [email, setEmail] = useState('');
  const [fechaNac, setFechaNac] = useState<string | null>(null);
  const [sucursalId, setSucursalId] = useState<string>('');

  // Más datos
  const [showMore, setShowMore] = useState(false);
  const [instagram, setInstagram] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [otraRed, setOtraRed] = useState('');
  const [alergias, setAlergias] = useState('');
  const [aceptaMarketing, setAceptaMarketing] = useState(true);

  const [saving, setSaving] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setNombre('');
      setApellido('');
      setTelefono('');
      setPhoneOut(null);
      setEmail('');
      setFechaNac(null);
      setSucursalId(currentSucursal?.id ?? '');
      setShowMore(false);
      setInstagram('');
      setTiktok('');
      setOtraRed('');
      setAlergias('');
      setAceptaMarketing(true);
    }
  }, [open, currentSucursal?.id]);

  const needsSucursalPicker = isAllMode || !currentSucursal;
  const noBranchAvailable = needsSucursalPicker && sucursales.length === 0;

  const handleSubmit = async () => {
    const n = nombre.trim();
    const a = apellido.trim();
    const t = telefono.trim();
    const e = email.trim();

    if (!n) { toast.error('El nombre es obligatorio'); return; }
    if (!t && !e) { toast.error('Ingresá teléfono o email'); return; }
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      toast.error('Email inválido');
      return;
    }
    const targetSucursalId = needsSucursalPicker ? sucursalId : currentSucursal!.id;
    if (!targetSucursalId) {
      toast.error('Seleccioná una sucursal antes de crear el cliente');
      return;
    }

    setSaving(true);
    const { id, error } = await createCliente({
      nombre: n,
      apellido: a || '',
      sucursalId: targetSucursalId,
      telefono: t || null,
      email: e || null,
      fecha_nacimiento: fechaNac,
      instagram: instagram.trim() || null,
      tiktok: tiktok.trim() || null,
      otra_red_social: otraRed.trim() || null,
      alergias: alergias.trim() || null,
      acepta_marketing: aceptaMarketing,
    });
    setSaving(false);

    if (error || !id) {
      toast.error(error || 'No se pudo crear el cliente');
      return;
    }
    toast.success('Cliente creado');
    onCreated?.(id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
          <DialogDescription>
            Cargá los datos básicos. Podés completar más información desde el perfil del cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Datos principales */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Juan" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apellido">Apellido</Label>
              <Input id="apellido" value={apellido} onChange={(e) => setApellido(e.target.value)} placeholder="Pérez" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="telefono">Teléfono</Label>
            <Input
              id="telefono"
              type="tel"
              inputMode="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Ejemplo: 11 2516-2528"
              maxLength={40}
            />
            <p className="text-xs text-muted-foreground">
              Ingresá código de área sin 0 y número sin 15.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" />
          </div>

          <div className="space-y-1.5">
            <Label>Fecha de nacimiento</Label>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !fechaNac && "text-muted-foreground")}
                >
                  <CalendarIcon className="h-4 w-4" />
                  {fechaNac ? format(parseISO(fechaNac), "d 'de' MMMM yyyy", { locale: es }) : 'Seleccionar fecha'}
                  {fechaNac && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(ev) => { ev.stopPropagation(); setFechaNac(null); }}
                      onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.stopPropagation(); setFechaNac(null); } }}
                      className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded hover:bg-accent"
                      aria-label="Limpiar fecha"
                    >
                      <X className="h-3.5 w-3.5" />
                    </span>
                  )}
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setFechaNac(null); setDatePickerOpen(false); }}
                  >
                    Limpiar
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {needsSucursalPicker && (
            <div className="space-y-1.5">
              <Label htmlFor="sucursal">Sucursal *</Label>
              {noBranchAvailable ? (
                <p className="text-sm text-muted-foreground">
                  No hay sucursales disponibles. Creá una sucursal antes de cargar clientes.
                </p>
              ) : (
                <Select value={sucursalId} onValueChange={setSucursalId}>
                  <SelectTrigger id="sucursal">
                    <SelectValue placeholder="Seleccioná una sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    {sucursales.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Más datos */}
          <Collapsible open={showMore} onOpenChange={setShowMore}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="w-full justify-between px-2 -mx-2 text-sm font-medium">
                Más datos
                <ChevronDown className={cn("h-4 w-4 transition-transform", showMore && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="instagram">Instagram</Label>
                <Input id="instagram" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@usuario" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tiktok">TikTok</Label>
                <Input id="tiktok" value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="@usuario" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="otra_red">Otra red social</Label>
                <Input id="otra_red" value={otraRed} onChange={(e) => setOtraRed(e.target.value)} placeholder="Ej: Twitter @usuario" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="alergias">Alergias</Label>
                <Textarea
                  id="alergias"
                  value={alergias}
                  onChange={(e) => setAlergias(e.target.value)}
                  placeholder="Ej: alergia a tintes, productos con amoníaco..."
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                <div className="space-y-0.5">
                  <Label htmlFor="acepta_marketing" className="text-sm">Acepta marketing</Label>
                  <p className="text-xs text-muted-foreground">Promociones y novedades por mensajes.</p>
                </div>
                <Switch id="acepta_marketing" checked={aceptaMarketing} onCheckedChange={setAceptaMarketing} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving || noBranchAvailable}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Crear cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
