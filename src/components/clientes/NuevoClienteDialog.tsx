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
import { useClientes, type ClienteMatch } from '@/hooks/useClientes';
import { toast } from 'sonner';
import { Loader2, ChevronDown, CalendarIcon, X, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { PhoneInput, type PhoneInputChange } from '@/components/ui/phone-input';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';


interface NuevoClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

export function NuevoClienteDialog({ open, onOpenChange, onCreated }: NuevoClienteDialogProps) {
  const { sucursales, currentSucursal, isAllMode } = useSucursal();
  const { createCliente, findClienteByPhone, linkClienteToSucursal } = useClientes();


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
  const [checking, setChecking] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Aviso de duplicado potencial
  const [duplicateMatch, setDuplicateMatch] = useState<ClienteMatch | null>(null);
  const [pendingSucursalId, setPendingSucursalId] = useState<string>('');

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
      setDuplicateMatch(null);
      setPendingSucursalId('');
    }
  }, [open, currentSucursal?.id]);

  const needsSucursalPicker = isAllMode || !currentSucursal;
  const noBranchAvailable = needsSucursalPicker && sucursales.length === 0;

  const doCreate = async (targetSucursalId: string, posibleDuplicadoDe: string | null) => {
    const n = nombre.trim();
    const a = apellido.trim();
    const t = (phoneOut?.e164 ?? '').trim();
    const e = email.trim();

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
      posible_duplicado_de: posibleDuplicadoDe,
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

  const handleSubmit = async () => {
    const n = nombre.trim();
    const t = (phoneOut?.e164 ?? '').trim();
    const e = email.trim();

    if (!n) { toast.error('El nombre es obligatorio'); return; }
    if (phoneOut && !phoneOut.isValid && phoneOut.reason !== 'empty') {
      toast.error('Revisá el teléfono antes de guardar.');
      return;
    }
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

    // Detección previa de duplicados por teléfono
    if (t) {
      setChecking(true);
      const { matches, error: matchErr } = await findClienteByPhone(t);
      setChecking(false);
      if (matchErr) {
        // Falla blanda: si no podemos verificar, seguimos flujo normal.
        console.warn('[NuevoClienteDialog] duplicate check failed:', matchErr);
      } else {
        const first = matches.find((m) => !m.eliminado) ?? null;
        if (first) {
          setPendingSucursalId(targetSucursalId);
          setDuplicateMatch(first);
          return;
        }
      }
    }

    await doCreate(targetSucursalId, null);
  };

  const handleLinkExisting = async () => {
    if (!duplicateMatch || !pendingSucursalId) return;
    setSaving(true);
    const { error } = await linkClienteToSucursal(duplicateMatch.cliente_id, pendingSucursalId);
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Cliente vinculado a la sucursal');
    onCreated?.(duplicateMatch.cliente_id);
    setDuplicateMatch(null);
    onOpenChange(false);
  };

  const handleCreateAnyway = async () => {
    if (!duplicateMatch || !pendingSucursalId) return;
    const dupId = duplicateMatch.cliente_id;
    const suc = pendingSucursalId;
    setDuplicateMatch(null);
    await doCreate(suc, dupId);
  };

  const alreadyLinkedHere = !!duplicateMatch && !!pendingSucursalId &&
    duplicateMatch.sucursales.some((s) => s.sucursal_id === pendingSucursalId);


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
            <PhoneInput
              id="telefono"
              value={phoneOut?.e164 ?? null}
              onChange={(o) => {
                setPhoneOut(o);
                setTelefono(o.e164 ?? '');
              }}
              defaultCountry="AR"
              allowedCountries={['AR', 'UY', 'CL', 'CO', 'MX', 'ES', 'BR']}
              mode="mobile"
            />
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || checking}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving || checking || noBranchAvailable}>
            {(saving || checking) && <Loader2 className="h-4 w-4 animate-spin" />}
            {checking ? 'Verificando…' : 'Crear cliente'}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog
        open={!!duplicateMatch}
        onOpenChange={(o) => { if (!o) setDuplicateMatch(null); }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Ya existe un cliente con ese teléfono
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p className="text-foreground">
                  <span className="font-medium">
                    {duplicateMatch?.nombre}{duplicateMatch?.apellido ? ` ${duplicateMatch.apellido}` : ''}
                  </span>{' '}
                  ya está registrado en tu organización con este teléfono.
                </p>
                {duplicateMatch && duplicateMatch.sucursales.length > 0 && (
                  <div className="rounded-md border bg-muted/40 px-3 py-2">
                    <p className="text-xs text-muted-foreground mb-1">Vinculado en:</p>
                    <ul className="text-sm space-y-0.5">
                      {duplicateMatch.sucursales.map((s) => (
                        <li key={s.sucursal_id}>• {s.nombre}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {alreadyLinkedHere && (
                  <p className="text-xs text-muted-foreground">
                    Este cliente ya está vinculado a la sucursal seleccionada.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Recomendamos vincular el cliente existente en lugar de crear uno nuevo.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
            <Button
              variant="ghost"
              onClick={() => setDuplicateMatch(null)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={handleCreateAnyway}
              disabled={saving}
            >
              Crear cliente nuevo igual
            </Button>
            <Button
              variant="default"
              onClick={handleLinkExisting}
              disabled={saving || alreadyLinkedHere}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Vincular a esta sucursal
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

