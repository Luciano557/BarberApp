import { useMemo, useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Copy, ExternalLink, Download, Upload, Trash2, Save, Link as LinkIcon, QrCode, Image as ImageIcon, Palette, Type, Settings2 } from 'lucide-react';
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
import { PortalLinksEditor } from './PortalLinksEditor';
import { PortalPreview } from './PortalPreview';
import { PortalColorPalette } from './PortalColorPalette';
import { PortalCoverUploader } from './PortalCoverUploader';
import { PortalCoverPositionDialog } from './PortalCoverPositionDialog';
import { isValidIconKey } from '@/components/reservar/lib/portalIcons';

const URL_RE = /^https?:\/\//i;

export function PortalPublicoSection() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const {
    config, loading, saving, save,
    uploadLogo, removeLogo,
    uploadCover, removeCover,
  } = usePortalConfig(orgId);

  const [description, setDescription] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [links, setLinks] = useState<PortalLink[]>([]);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [coverPosX, setCoverPosX] = useState<number>(50);
  const [coverPosY, setCoverPosY] = useState<number>(50);
  const [coverZoom, setCoverZoom] = useState<number>(1);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (config) {
      setDescription(config.description ?? '');
      setPrimaryColor(config.primary_color ?? '');
      setLinks(config.links ?? []);
      setLogoPath(config.logo_path);
      setCoverPath(config.cover_path);
      setCoverPosX(config.cover_position_x ?? 50);
      setCoverPosY(config.cover_position_y ?? 50);
      setCoverZoom(config.cover_zoom ?? 1);
    }
  }, [config]);

  const publicUrl = useMemo(() => {
    if (!organization?.slug) return '';
    return `${window.location.origin}/${organization.slug}/reservar`;
  }, [organization?.slug]);

  const logoUrl = useMemo(() => getLogoPublicUrl(logoPath), [logoPath]);
  const coverUrl = useMemo(() => getCoverPublicUrl(coverPath), [coverPath]);

  const previewPortal = useMemo(() => ({
    logo_url: logoUrl || organization?.logo_url || null,
    cover_url: coverUrl || null,
    cover_position_x: coverPosX,
    cover_position_y: coverPosY,
    cover_zoom: coverZoom,
    description: description.trim() || null,
    primary_color: isValidHex(primaryColor) ? primaryColor : null,
    links: links
      .filter((l) => l.active && l.label.trim() && URL_RE.test(l.url))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((l) => ({ label: l.label, url: l.url, icon: l.icon ?? null })),
  }), [logoUrl, coverUrl, coverPosX, coverPosY, coverZoom, organization?.logo_url, description, primaryColor, links]);

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
      setLogoPath(path);
      const { error: e } = await save({ logo_path: path });
      if (e) toast.error('No se pudo guardar el logo');
      else toast.success('Logo actualizado');
    }
  };

  const handleRemoveLogo = async () => {
    setLogoPath(null);
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
      setCoverPath(path);
      setCoverPosX(50);
      setCoverPosY(50);
      setCoverZoom(1);
      const { error: e } = await save({ cover_path: path, cover_position_x: 50, cover_position_y: 50, cover_zoom: 1 });
      if (e) toast.error('No se pudo guardar la portada');
      else toast.success('Portada actualizada');
    }
  };

  const handleRemoveCover = async () => {
    setCoverPath(null);
    setCoverPosX(50);
    setCoverPosY(50);
    setCoverZoom(1);
    const { error } = await removeCover();
    if (error) toast.error('No se pudo quitar la portada');
    else toast.success('Portada quitada');
  };

  const handleSaveCoverPosition = async (x: number, y: number, zoom: number) => {
    setCoverPosX(x);
    setCoverPosY(y);
    setCoverZoom(zoom);
    const { error } = await save({ cover_position_x: x, cover_position_y: y, cover_zoom: zoom });
    if (error) toast.error('No se pudo guardar el encuadre');
    else toast.success('Encuadre guardado');
  };

  const handleColorPreset = async (hex: string) => {
    setPrimaryColor(hex);
  };

  const handleSave = async () => {
    if (description.length > 240) return toast.error('La descripción supera 240 caracteres');
    if (primaryColor && !isValidHex(primaryColor)) return toast.error('El color debe tener formato #RRGGBB');
    if (links.length > 4) return toast.error('Máximo 4 links');
    for (const l of links) {
      if (!l.label.trim() || l.label.length > 80) return toast.error('Cada link necesita una etiqueta de 1 a 80 caracteres');
      if (l.active) {
        if (!URL_RE.test(l.url) || l.url.length > 500) return toast.error('Cada link activo necesita una URL http/https válida');
      }
      if (l.icon && !isValidIconKey(l.icon)) return toast.error('Ícono inválido en algún link');
    }
    const normalized = links.map((l, i) => ({
      ...l,
      label: l.label.trim(),
      sort_order: i,
      icon: isValidIconKey(l.icon) ? l.icon : null,
    }));
    const { error } = await save({
      description: description.trim() || null,
      primary_color: primaryColor || null,
      links: normalized,
    });
    if (error) toast.error(`No se pudo guardar: ${error.message}`);
    else toast.success('Cambios guardados');
  };

  if (!orgId) return null;

  const orgName = organization?.name || 'Mi Barbería';
  const descPlaceholder = `Bienvenido al portal de reservas de ${orgName}. Reservá tu turno o gestioná tu cita de forma simple.`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* === Columna config === */}
      <div className="space-y-6 min-w-0">
        {/* A — Link público */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              Link público del portal
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Compartilo con tus clientes para que reserven o gestionen su cita.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input value={publicUrl} readOnly className="font-mono text-xs" />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="h-4 w-4 mr-1" /> Copiar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => publicUrl && window.open(publicUrl, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="h-4 w-4 mr-1" /> Ver portal
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* B — Identidad visual */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="h-4 w-4" /> Identidad visual
            </CardTitle>
            <p className="text-sm text-muted-foreground">Foto de portada, logo y nombre del negocio.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Cover */}
            <div className="space-y-2">
              <Label className="text-xs">Foto de portada</Label>
              <PortalCoverUploader
                coverUrl={coverUrl}
                coverPositionX={coverPosX}
                coverPositionY={coverPosY}
                coverZoom={coverZoom}
                uploading={uploadingCover}
                disabled={saving}
                onUpload={handleCoverFile}
                onRemove={handleRemoveCover}
                onAdjust={() => setAdjustOpen(true)}
              />
            </div>

            {/* Logo */}
            <div className="space-y-2">
              <Label className="text-xs">Logo</Label>
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
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadingLogo || saving}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    {uploadingLogo ? 'Subiendo...' : logoPath ? 'Cambiar logo' : 'Subir logo'}
                  </Button>
                  {logoPath && (
                    <Button variant="outline" size="sm" onClick={handleRemoveLogo} disabled={saving}>
                      <Trash2 className="h-4 w-4 mr-1" /> Quitar
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">PNG, JPG o WEBP. Máximo 1 MB.</p>
            </div>

            {/* Nombre */}
            <div className="space-y-2">
              <Label className="text-xs">Nombre del negocio</Label>
              <Input value={orgName} readOnly className="bg-muted/40" />
              <p className="text-xs text-muted-foreground">
                Se muestra en el portal público. Editalo desde la configuración del negocio.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* C — Color principal */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-4 w-4" /> Color principal
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Elegí un color de la paleta. Se aplica a botones y elementos destacados del portal.
            </p>
          </CardHeader>
          <CardContent>
            <PortalColorPalette value={primaryColor} onChange={handleColorPreset} />
          </CardContent>
        </Card>

        {/* D — Descripción */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Type className="h-4 w-4" /> Descripción corta
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Si la dejás vacía, mostramos un mensaje de bienvenida automático.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={240}
              rows={3}
              placeholder={descPlaceholder}
            />
            <p className="text-xs text-muted-foreground text-right">{description.length}/240</p>
          </CardContent>
        </Card>

        {/* E — Links */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <LinkIcon className="h-4 w-4" /> Links personalizados
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Hasta 4 accesos directos (Instagram, WhatsApp, ubicación, etc.).
            </p>
          </CardHeader>
          <CardContent>
            <PortalLinksEditor links={links} onChange={setLinks} />
          </CardContent>
        </Card>

        {/* F — Avanzado */}
        <Card>
          <CardContent className="pt-4">
            <Accordion type="single" collapsible>
              <AccordionItem value="advanced" className="border-none">
                <AccordionTrigger className="py-2 hover:no-underline">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Settings2 className="h-4 w-4" /> Configuración avanzada
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pt-4 space-y-6">
                  {/* QR */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <QrCode className="h-4 w-4" /> QR de reserva
                    </h4>
                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                      <div ref={qrRef} className="p-3 bg-white rounded-lg border border-border inline-block">
                        {publicUrl && <QRCodeCanvas value={publicUrl} size={140} includeMargin={false} />}
                      </div>
                      <div className="space-y-2 flex-1">
                        <p className="text-sm text-muted-foreground">
                          Imprimilo o compartilo digitalmente para que tus clientes accedan al portal.
                        </p>
                        <Button variant="outline" size="sm" onClick={handleDownloadQR}>
                          <Download className="h-4 w-4 mr-1" /> Descargar QR
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* HEX */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Palette className="h-4 w-4" /> Color por código HEX
                    </h4>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={isValidHex(primaryColor) ? primaryColor : '#000000'}
                        onChange={(e) => setPrimaryColor(e.target.value.toUpperCase())}
                        className="h-9 w-14 rounded border border-border cursor-pointer bg-transparent"
                      />
                      <Input
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        placeholder="#000000"
                        maxLength={7}
                        className="font-mono w-32"
                      />
                      {primaryColor && (
                        <Button variant="ghost" size="sm" onClick={() => setPrimaryColor('')}>
                          Quitar
                        </Button>
                      )}
                    </div>
                    {primaryColor && !isValidHex(primaryColor) && (
                      <p className="text-xs text-destructive">Formato inválido. Usá #RRGGBB.</p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving || loading} size="lg">
            <Save className="h-4 w-4 mr-1" />
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </div>

      {/* === Columna preview === */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">Vista previa</h3>
          <PortalPreview
            orgName={orgName}
            fallbackLogo={organization?.logo_url || null}
            portal={previewPortal}
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
        initialX={coverPosX}
        initialY={coverPosY}
        initialZoom={coverZoom}
        saving={saving}
        onSave={handleSaveCoverPosition}
      />
    </div>
  );
}
