import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Form, FormField, FormItem, FormControl, FormMessage } from '@/components/ui/form';
import { Copy, ExternalLink, Download, Upload, Trash2, Save, Link as LinkIcon, QrCode, Palette, Type, Globe, ChevronDown, Image as ImageIcon, UserRound, BarChart3, Info } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  usePortalConfig,
  isValidHex,
  getLogoPublicUrl,
  getCoverPublicUrl,
  type PortalLink,
} from '@/hooks/usePortalConfig';
import { usePortalHasServices } from '@/hooks/usePortalHasServices';
import { PortalLinksEditor } from './PortalLinksEditor';
import { PortalPreview } from './PortalPreview';
import { PortalColorPalette } from './PortalColorPalette';
import { PortalCoverUploader } from './PortalCoverUploader';
import { PortalCoverPositionDialog } from './PortalCoverPositionDialog';
import { isValidIconKey } from '@/components/reservar/lib/portalIcons';
import { cn } from '@/lib/utils';

const URL_RE = /^https?:\/\//i;

const linkSchema = z.object({
  label: z.string().trim().min(1, 'La etiqueta no puede quedar vacía.').max(80, 'La etiqueta no puede superar los 80 caracteres.'),
  url: z.string(),
  active: z.boolean(),
  sort_order: z.number(),
  icon: z.string().nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.active && (!URL_RE.test(data.url) || data.url.length > 500)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['url'], message: 'Debe empezar con http:// o https://' });
  }
  if (data.icon && !isValidIconKey(data.icon)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['icon'], message: 'Ícono inválido.' });
  }
});

const portalFormSchema = z.object({
  orgName: z.string().trim().min(1, 'El nombre del negocio no puede quedar vacío.').max(80, 'El nombre del negocio supera los 80 caracteres.'),
  description: z.string().max(240, 'La descripción supera 240 caracteres.').optional().default(''),
  primaryColor: z.string().optional().default('').refine((v) => !v || isValidHex(v), 'El color debe tener formato #RRGGBB'),
  links: z.array(linkSchema).max(4, 'Máximo 4 links'),
  metaPixelId: z.string().trim().optional().default('')
    .refine((v) => !v || /^[0-9]{10,20}$/.test(v), 'El ID debe tener solo números, entre 10 y 20 dígitos.'),
});

type PortalFormSchemaValues = z.infer<typeof portalFormSchema>;

// logoPath/coverPath/cover_* viajan en el mismo useForm para participar de
// isDirty y de reset(), pero no tienen regla de validación propia — ya la
// aplica usePortalConfig al momento de subir el archivo. Por eso quedan
// fuera de portalFormSchema y se cargan a mano vía setValue.
type PortalFormValues = PortalFormSchemaValues & {
  logoPath: string | null;
  coverPath: string | null;
  coverPosX: number;
  coverPosY: number;
  coverZoom: number;
};

const emptyValues: PortalFormValues = {
  orgName: '',
  description: '',
  primaryColor: '',
  links: [],
  metaPixelId: '',
  logoPath: null,
  coverPath: null,
  coverPosX: 50,
  coverPosY: 50,
  coverZoom: 1,
};

interface PortalPublicoSectionProps {
  /** Avisa a AgendaManagement.tsx si hay cambios sin guardar, para que pueda
      bloquear el cambio de tab con un aviso de "¿Descartar cambios?". */
  onDirtyChange?: (dirty: boolean) => void;
}

export function PortalPublicoSection({ onDirtyChange }: PortalPublicoSectionProps) {
  const { organization, isLoading: orgLoading, updateOrganization } = useOrganization();
  const orgId = organization?.id;
  const {
    config, loading, saving, save,
    uploadLogo, removeLogo,
    uploadCover, removeCover,
  } = usePortalConfig(orgId);
  const hasServices = usePortalHasServices(orgId);

  const [savingAll, setSavingAll] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [customColorOpen, setCustomColorOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const hasSeededRef = useRef(false);

  const form = useForm<PortalFormValues>({
    resolver: zodResolver(portalFormSchema) as unknown as Resolver<PortalFormValues>,
    defaultValues: emptyValues,
  });
  const { control, handleSubmit, watch, setValue, getValues, reset, formState } = form;
  const { isDirty, errors } = formState;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Nombre (organizations) y el resto (portal_config) son dos fetches
  // independientes con timings distintos — el reset inicial espera a que
  // ambos resuelvan, una sola vez, para no pisar texto que el usuario ya
  // empezó a escribir con un reset tardío.
  useEffect(() => {
    if (hasSeededRef.current) return;
    if (orgLoading || loading || !organization || !config) return;
    hasSeededRef.current = true;
    reset({
      orgName: organization.name ?? '',
      description: config.description ?? '',
      primaryColor: config.primary_color ?? '',
      links: config.links ?? [],
      metaPixelId: config.meta_pixel_id ?? '',
      logoPath: config.logo_path,
      coverPath: config.cover_path,
      coverPosX: config.cover_position_x ?? 50,
      coverPosY: config.cover_position_y ?? 50,
      coverZoom: config.cover_zoom ?? 1,
    });
  }, [orgLoading, loading, organization, config, reset]);

  const watchedDescription = watch('description');
  const watchedPrimaryColor = watch('primaryColor');
  const watchedLinks = watch('links');
  const watchedLogoPath = watch('logoPath');
  const watchedCoverPath = watch('coverPath');
  const watchedCoverPosX = watch('coverPosX');
  const watchedCoverPosY = watch('coverPosY');
  const watchedCoverZoom = watch('coverZoom');
  const watchedOrgName = watch('orgName');

  const publicUrl = useMemo(() => {
    if (!organization?.slug) return '';
    return `${window.location.origin}/${organization.slug}/reservar`;
  }, [organization?.slug]);

  const logoUrl = useMemo(() => getLogoPublicUrl(watchedLogoPath), [watchedLogoPath]);
  const coverUrl = useMemo(() => getCoverPublicUrl(watchedCoverPath), [watchedCoverPath]);

  const previewPortal = useMemo(() => ({
    logo_url: logoUrl || organization?.logo_url || null,
    cover_url: coverUrl || null,
    cover_position_x: watchedCoverPosX,
    cover_position_y: watchedCoverPosY,
    cover_zoom: watchedCoverZoom,
    description: watchedDescription.trim() || null,
    primary_color: isValidHex(watchedPrimaryColor) ? watchedPrimaryColor : null,
    links: watchedLinks
      .filter((l) => l.active && l.label.trim() && URL_RE.test(l.url))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((l) => ({ label: l.label, url: l.url, icon: l.icon ?? null })),
  }), [logoUrl, coverUrl, watchedCoverPosX, watchedCoverPosY, watchedCoverZoom, organization?.logo_url, watchedDescription, watchedPrimaryColor, watchedLinks]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCopy = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    toast.success('Link copiado');
  };

  const handleDownloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `vittro-portal-${organization?.slug || 'qr'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleLogoFile = async (file: File) => {
    setUploadingLogo(true);
    const { error, path } = await uploadLogo(file);
    setUploadingLogo(false);
    if (error) return toast.error(error.message);
    if (path) {
      setValue('logoPath', path, { shouldDirty: false });
      const { error: e } = await save({ logo_path: path });
      if (e) toast.error('No se pudo guardar el logo');
      else toast.success('Logo actualizado');
    }
  };

  const handleRemoveLogo = async () => {
    setValue('logoPath', null, { shouldDirty: false });
    const { error } = await removeLogo();
    if (error) toast.error('No se pudo quitar el logo');
    else toast.success('Logo quitado');
  };

  const handleCoverFile = async (file: File) => {
    setUploadingCover(true);
    const { error, path } = await uploadCover(file);
    setUploadingCover(false);
    if (error) return toast.error(error.message);
    if (path) {
      setValue('coverPath', path, { shouldDirty: false });
      setValue('coverPosX', 50, { shouldDirty: false });
      setValue('coverPosY', 50, { shouldDirty: false });
      setValue('coverZoom', 1, { shouldDirty: false });
      const { error: e } = await save({ cover_path: path, cover_position_x: 50, cover_position_y: 50, cover_zoom: 1 });
      if (e) toast.error('No se pudo guardar la portada');
      else toast.success('Portada actualizada');
    }
  };

  const handleRemoveCover = async () => {
    setValue('coverPath', null, { shouldDirty: false });
    setValue('coverPosX', 50, { shouldDirty: false });
    setValue('coverPosY', 50, { shouldDirty: false });
    setValue('coverZoom', 1, { shouldDirty: false });
    const { error } = await removeCover();
    if (error) toast.error('No se pudo quitar la portada');
    else toast.success('Portada quitada');
  };

  const handleSaveCoverPosition = async (x: number, y: number, zoom: number) => {
    setValue('coverPosX', x, { shouldDirty: false });
    setValue('coverPosY', y, { shouldDirty: false });
    setValue('coverZoom', zoom, { shouldDirty: false });
    const { error } = await save({ cover_position_x: x, cover_position_y: y, cover_zoom: zoom });
    if (error) toast.error('No se pudo guardar el encuadre');
    else toast.success('Encuadre guardado');
  };

  const handleColorPreset = (hex: string) => {
    setValue('primaryColor', hex, { shouldDirty: true, shouldValidate: true });
  };

  const handleLinksChange = (next: PortalLink[]) => {
    setValue('links', next, { shouldDirty: true, shouldValidate: true });
  };

  const onSubmit = async (values: PortalFormSchemaValues) => {
    setSavingAll(true);

    const normalizedLinks: PortalLink[] = values.links.map((l, i) => ({
      ...l,
      label: l.label.trim(),
      url: l.url ?? '',
      active: l.active ?? true,
      sort_order: i,
      icon: isValidIconKey(l.icon) ? l.icon : null,
    })) as PortalLink[];

    // 1. organizations.name — solo si cambió. Si falla, abortamos sin tocar
    //    portal_config para no dejar los datos a medio guardar.
    const nameChanged = values.orgName !== (organization?.name ?? '');
    if (nameChanged) {
      const { error: orgError } = await updateOrganization({ name: values.orgName });
      if (orgError) {
        setSavingAll(false);
        toast.error(`No se pudo actualizar el nombre del negocio: ${orgError.message}`);
        return;
      }
    }

    // 2. portal_config — el nombre ya quedó guardado, así que un fallo acá
    //    no puede reportarse como "no se guardó nada".
    const { error } = await save({
      description: values.description.trim() || null,
      primary_color: values.primaryColor || null,
      links: normalizedLinks,
      meta_pixel_id: values.metaPixelId.trim() || null,
    });
    setSavingAll(false);

    if (error) {
      toast.error(
        nameChanged
          ? `El nombre del negocio se guardó, pero no se pudo guardar el resto: ${error.message}`
          : `No se pudo guardar: ${error.message}`,
      );
      return;
    }

    toast.success('Cambios guardados');
    // Limpia isDirty sin pisar logo/portada/encuadre, que no pasaron por
    // este submit y ya están confirmados en servidor por su cuenta.
    reset({
      orgName: values.orgName,
      description: values.description,
      primaryColor: values.primaryColor,
      links: normalizedLinks,
      metaPixelId: values.metaPixelId,
      logoPath: getValues('logoPath'),
      coverPath: getValues('coverPath'),
      coverPosX: getValues('coverPosX'),
      coverPosY: getValues('coverPosY'),
      coverZoom: getValues('coverZoom'),
    });
  };

  if (!orgId) return null;

  if (orgLoading || loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6 min-w-0">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-56 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-[420px] w-full rounded-[2rem] mx-auto max-w-[340px]" />
        </div>
      </div>
    );
  }

  // La preview sigue el borrador en vivo; si el campo queda vacío mientras se
  // edita, cae al nombre ya guardado en vez de mostrar el placeholder genérico.
  const orgName = watchedOrgName.trim() || organization?.name || 'Mi Barbería';
  const descPlaceholder = `Bienvenido al portal de reservas de ${orgName}. Reservá tu turno o gestioná tu cita de forma simple.`;

  const linkErrors = errors.links;
  const linksArrayMessage = linkErrors && !Array.isArray(linkErrors) ? linkErrors.message : undefined;

  return (
    <Form {...form}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* === Columna config === */}
        <form onSubmit={handleSubmit(onSubmit)} className="min-w-0">
          {/* Barra de accesos — solo desktop */}
          <nav className="hidden md:block sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/60 py-2 shadow-sm">
            <div className="flex items-center gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => scrollTo('portal-identidad')}
                className="shrink-0 rounded px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Identidad
              </button>
              <button
                type="button"
                onClick={() => scrollTo('portal-contenido')}
                className="shrink-0 rounded px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Contenido
              </button>
              <button
                type="button"
                onClick={() => scrollTo('portal-compartir')}
                className="shrink-0 rounded px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Compartir
              </button>
              <button
                type="button"
                onClick={() => scrollTo('portal-integraciones')}
                className="shrink-0 rounded px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Integraciones
              </button>
            </div>
          </nav>

          {/* 1 — Identidad visual */}
          <section id="portal-identidad" className="mt-6 scroll-mt-16">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Palette className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold">Identidad visual</h2>
            </div>

            <div className="space-y-4">
              {/* Cover */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" /> Foto de portada (opcional)
                </h4>
                <PortalCoverUploader
                  coverUrl={coverUrl}
                  coverPositionX={watchedCoverPosX}
                  coverPositionY={watchedCoverPosY}
                  coverZoom={watchedCoverZoom}
                  uploading={uploadingCover}
                  disabled={saving}
                  onUpload={handleCoverFile}
                  onRemove={handleRemoveCover}
                  onAdjust={() => setAdjustOpen(true)}
                />
              </div>

              {/* Logo */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <UserRound className="h-4 w-4" /> Logo (opcional)
                </h4>
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 rounded-full overflow-hidden bg-muted border border-border flex items-center justify-center shrink-0">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-semibold text-muted-foreground">
                        {orgName.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) handleLogoFile(f);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploadingLogo || saving}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      {uploadingLogo ? 'Subiendo...' : watchedLogoPath ? 'Cambiar logo' : 'Subir logo'}
                    </Button>
                    {watchedLogoPath && (
                      <Button type="button" variant="outline" size="sm" onClick={handleRemoveLogo} disabled={saving}>
                        <Trash2 className="h-4 w-4 mr-1" /> Quitar
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">PNG, JPG o WEBP. Máximo 1 MB.</p>
              </div>

              {/* Nombre */}
              <div className="space-y-2 pt-2">
                <div>
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Globe className="h-4 w-4" /> Nombre del negocio
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Este es el nombre de tu negocio en toda la aplicación — no solo en el portal.
                  </p>
                </div>
                <FormField
                  control={control}
                  name="orgName"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          id="portal-org-name"
                          {...field}
                          maxLength={80}
                          placeholder="Mi Barbería"
                          disabled={savingAll}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Color principal */}
              <div className="space-y-3 pt-2">
                <div>
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Palette className="h-4 w-4" /> Color principal (opcional)
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Se aplica a botones y elementos destacados del portal.
                  </p>
                </div>

                <PortalColorPalette value={watchedPrimaryColor} onChange={handleColorPreset} />

                <Collapsible open={customColorOpen} onOpenChange={setCustomColorOpen}>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="px-2 h-8 text-xs text-muted-foreground hover:text-foreground">
                      <ChevronDown className={cn('h-3.5 w-3.5 mr-1 transition-transform', customColorOpen && 'rotate-180')} />
                      Usar color personalizado
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="color"
                        value={isValidHex(watchedPrimaryColor) ? watchedPrimaryColor : '#000000'}
                        onChange={(e) => setValue('primaryColor', e.target.value.toUpperCase(), { shouldDirty: true, shouldValidate: true })}
                        className="h-9 w-14 rounded border border-border cursor-pointer bg-transparent"
                      />
                      <Input
                        value={watchedPrimaryColor}
                        onChange={(e) => setValue('primaryColor', e.target.value, { shouldDirty: true, shouldValidate: true })}
                        placeholder="#000000"
                        maxLength={7}
                        className="font-mono w-32"
                      />
                      {watchedPrimaryColor && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setValue('primaryColor', '', { shouldDirty: true, shouldValidate: true })}
                        >
                          Quitar
                        </Button>
                      )}
                    </div>
                    {errors.primaryColor && (
                      <p className="text-xs text-destructive">{errors.primaryColor.message}</p>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>
          </section>

          {/* 2 — Contenido del portal */}
          <section id="portal-contenido" className="border-t pt-6 mt-6 scroll-mt-16">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Type className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold">Contenido del portal</h2>
            </div>

            <div className="space-y-6">
              {/* Descripción corta */}
              <div className="space-y-2">
                <div>
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Type className="h-4 w-4" /> Descripción corta (opcional)
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Si la dejás vacía, mostramos un mensaje de bienvenida automático.
                  </p>
                </div>
                <FormField
                  control={control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea {...field} maxLength={240} rows={3} placeholder={descPlaceholder} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground text-right">{field.value.length}/240</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Links personalizados */}
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" /> Links personalizados (opcional)
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Hasta 4 accesos directos (Instagram, WhatsApp, ubicación, etc.).
                  </p>
                </div>
                <PortalLinksEditor links={(watchedLinks ?? []) as PortalLink[]} onChange={handleLinksChange} />
                {linksArrayMessage && (
                  <p className="text-xs text-destructive">{linksArrayMessage}</p>
                )}
                {Array.isArray(linkErrors) && linkErrors.map((err, idx) => {
                  const msg = err?.label?.message || err?.url?.message || err?.icon?.message;
                  return msg ? (
                    <p key={idx} className="text-xs text-destructive">Link {idx + 1}: {msg}</p>
                  ) : null;
                })}
              </div>
            </div>
          </section>

          {/* 3 — Compartir tu portal */}
          <section id="portal-compartir" className="border-t pt-6 mt-6 scroll-mt-16">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Globe className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold">Compartir tu portal</h2>
            </div>

            <div className="space-y-6">
              {/* Link público */}
              <div className="space-y-2">
                <div>
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" /> Link público del portal
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Compartilo con tus clientes para que reserven o gestionen su cita.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  {/* No es un input: evita el foco y el auto-zoom de iOS, y permite ver la URL completa en 2 lineas */}
                  <div
                    title={publicUrl}
                    className="w-full sm:w-auto rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs min-h-10 flex-1 min-w-0 select-all break-all whitespace-normal"
                  >
                    {publicUrl}
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                      <Copy className="h-4 w-4 mr-1" /> Copiar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => publicUrl && window.open(publicUrl, '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" /> Ver portal
                    </Button>
                  </div>
                </div>
              </div>

              {/* QR */}
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <QrCode className="h-4 w-4" /> QR de reserva
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Imprimilo o compartilo digitalmente para que tus clientes accedan al portal.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div ref={qrRef} className="p-3 bg-white rounded-lg border border-border inline-block">
                    {publicUrl && <QRCodeCanvas value={publicUrl} size={140} includeMargin={false} />}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={handleDownloadQR}>
                    <Download className="h-4 w-4 mr-1" /> Descargar QR
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* 4 — Integraciones */}
          <section id="portal-integraciones" className="border-t pt-6 mt-6 scroll-mt-16">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold">Integraciones</h2>
            </div>

            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> ID de píxel de Meta (opcional)
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Medí las conversiones de tus campañas de Instagram y Facebook Ads a partir de las reservas del portal.
                </p>
              </div>
              <FormField
                control={control}
                name="metaPixelId"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        {...field}
                        maxLength={20}
                        inputMode="numeric"
                        placeholder="1234567890123456"
                        className="font-mono"
                        disabled={savingAll}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>
                  Para conseguir el ID: entrá a Meta Business Manager → Events Manager → seleccioná tu
                  píxel (o creá uno nuevo) → copiá el número que aparece como ID del píxel.
                </span>
              </div>
            </div>
          </section>

          {/* Guardado */}
          <div className="flex justify-end border-t pt-6 mt-6">
            <Button type="submit" disabled={savingAll || saving || loading} size="lg">
              <Save className="h-4 w-4 mr-1" />
              {savingAll ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </form>

        {/* === Columna preview === */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Vista previa</h3>
            <PortalPreview
              orgName={orgName}
              fallbackLogo={organization?.logo_url || null}
              portal={previewPortal}
              emptyMessage={hasServices ? undefined : 'No hay servicios disponibles para reservar en este momento.'}
            />
            <p className="text-xs text-muted-foreground text-center">
              Se actualiza en vivo. Los cambios se aplican al portal público al guardar.
            </p>
          </div>
        </div>

        <PortalCoverPositionDialog
          open={adjustOpen}
          onOpenChange={setAdjustOpen}
          coverUrl={coverUrl}
          logoUrl={logoUrl || organization?.logo_url || null}
          orgName={orgName}
          initialX={watchedCoverPosX}
          initialY={watchedCoverPosY}
          initialZoom={watchedCoverZoom}
          saving={saving}
          onSave={handleSaveCoverPosition}
        />
      </div>
    </Form>
  );
}
