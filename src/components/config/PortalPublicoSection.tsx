import { useMemo, useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Copy, ExternalLink, Download, Upload, Trash2, Save, Link as LinkIcon, Palette, QrCode } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePortalConfig, isValidHex, getLogoPublicUrl, type PortalLink } from '@/hooks/usePortalConfig';
import { PortalLinksEditor } from './PortalLinksEditor';
import { PortalPreview } from './PortalPreview';

const URL_RE = /^https?:\/\//i;

export function PortalPublicoSection() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const { config, loading, saving, save, uploadLogo, removeLogo } = usePortalConfig(orgId);

  const [description, setDescription] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [links, setLinks] = useState<PortalLink[]>([]);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (config) {
      setDescription(config.description ?? '');
      setPrimaryColor(config.primary_color ?? '');
      setLinks(config.links ?? []);
      setLogoPath(config.logo_path);
    }
  }, [config]);

  const publicUrl = useMemo(() => {
    if (!organization?.slug) return '';
    return `${window.location.origin}/${organization.slug}/reservar`;
  }, [organization?.slug]);

  const logoUrl = useMemo(() => getLogoPublicUrl(logoPath), [logoPath]);

  const previewPortal = useMemo(() => ({
    logo_url: logoUrl || organization?.logo_url || null,
    description: description.trim() || null,
    primary_color: isValidHex(primaryColor) ? primaryColor : null,
    links: links
      .filter((l) => l.active && l.label.trim() && URL_RE.test(l.url))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((l) => ({ label: l.label, url: l.url })),
  }), [logoUrl, organization?.logo_url, description, primaryColor, links]);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    const { error, path } = await uploadLogo(file);
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (path) {
      setLogoPath(path);
      const { error: saveErr } = await save({ logo_path: path });
      if (saveErr) toast.error('No se pudo guardar el logo');
      else toast.success('Logo actualizado');
    }
  };

  const handleRemoveLogo = async () => {
    setLogoPath(null);
    const { error } = await removeLogo();
    if (error) toast.error('No se pudo quitar el logo');
    else toast.success('Logo quitado');
  };

  const handleSave = async () => {
    // Validations mirror DB
    if (description.length > 240) {
      toast.error('La descripción supera 240 caracteres');
      return;
    }
    if (primaryColor && !isValidHex(primaryColor)) {
      toast.error('El color debe tener formato #RRGGBB');
      return;
    }
    if (links.length > 4) {
      toast.error('Máximo 4 links');
      return;
    }
    for (const l of links) {
      if (!l.label.trim() || l.label.length > 80) {
        toast.error('Cada link necesita una etiqueta de 1 a 80 caracteres');
        return;
      }
      if (!URL_RE.test(l.url) || l.url.length > 500) {
        toast.error('Cada link necesita una URL http/https válida');
        return;
      }
    }
    const normalized = links.map((l, i) => ({ ...l, label: l.label.trim(), sort_order: i }));
    const { error } = await save({
      description: description.trim() || null,
      primary_color: primaryColor || null,
      links: normalized,
    });
    if (error) toast.error(`No se pudo guardar: ${error.message}`);
    else toast.success('Cambios guardados');
  };

  if (!orgId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <LinkIcon className="h-4 w-4" />
          Portal público de reservas
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Convertí tu link de reservas en una mini-landing con tu logo, color y links destacados.
        </p>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* A — Link público */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <QrCode className="h-4 w-4" /> Link público
          </h3>
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
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div ref={qrRef} className="p-3 bg-white rounded-lg border border-border inline-block">
              {publicUrl && <QRCodeCanvas value={publicUrl} size={160} includeMargin={false} />}
            </div>
            <div className="space-y-2 flex-1">
              <p className="text-sm text-muted-foreground">
                Compartí este link o QR para que tus clientes puedan reservar, modificar su cita y acceder a tus links personalizados.
              </p>
              <Button variant="outline" size="sm" onClick={handleDownloadQR}>
                <Download className="h-4 w-4 mr-1" /> Descargar QR
              </Button>
            </div>
          </div>
        </section>

        {/* B — Personalización */}
        <section className="space-y-4">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Palette className="h-4 w-4" /> Personalización
          </h3>

          {/* Logo */}
          <div className="space-y-2">
            <Label className="text-xs">Logo del portal</Label>
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-full overflow-hidden bg-muted border border-border flex items-center justify-center shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-muted-foreground">Sin logo</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || saving}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  {uploading ? 'Subiendo...' : 'Subir logo'}
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

          {/* Color */}
          <div className="space-y-2">
            <Label className="text-xs">Color principal</Label>
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

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-xs">Descripción corta</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={240}
              rows={3}
              placeholder="Bienvenido a nuestra barbería. Reservá tu turno o gestioná tu cita."
            />
            <p className="text-xs text-muted-foreground text-right">{description.length}/240</p>
          </div>

          {/* Links */}
          <div className="space-y-2">
            <Label className="text-xs">Links personalizados</Label>
            <PortalLinksEditor links={links} onChange={setLinks} />
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving || loading}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </section>

        {/* C — Vista previa */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">Vista previa</h3>
          <PortalPreview
            orgName={organization?.name || 'Mi Barbería'}
            fallbackLogo={organization?.logo_url || null}
            portal={previewPortal}
          />
          <p className="text-xs text-muted-foreground text-center">
            La vista previa se actualiza en tiempo real. Los cambios se aplican al portal público al guardar.
          </p>
        </section>
      </CardContent>
    </Card>
  );
}
