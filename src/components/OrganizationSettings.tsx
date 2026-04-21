import { useState } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Phone, MapPin, Crown, Sparkles, Zap, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { COUNTRIES, COUNTRY_TIMEZONES } from '@/lib/dateUtils';
import { PaymentMethodsConfig } from './config/PaymentMethodsConfig';

export function OrganizationSettings() {
  const { organization, planFeatures, updateOrganization } = useOrganization();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Find country code from current timezone
  const getCurrentCountryCode = () => {
    if (!organization?.timezone) return 'AR';
    const entry = Object.entries(COUNTRY_TIMEZONES).find(([, tz]) => tz === organization.timezone);
    return entry ? entry[0] : 'AR';
  };
  
  const [formData, setFormData] = useState({
    name: organization?.name || '',
    phone: organization?.phone || '',
    address: organization?.address || '',
    country: getCurrentCountryCode(),
  });

  if (!organization) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center">Cargando información del negocio...</p>
        </CardContent>
      </Card>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    const newTimezone = COUNTRY_TIMEZONES[formData.country as keyof typeof COUNTRY_TIMEZONES];
    const { error } = await updateOrganization({
      name: formData.name,
      phone: formData.phone || null,
      address: formData.address || null,
      timezone: newTimezone,
    });

    if (error) {
      toast.error('Error al guardar', { description: error.message });
    } else {
      toast.success('Datos actualizados');
      setIsEditing(false);
    }
    setIsSaving(false);
  };

  const handleCancel = () => {
    setFormData({
      name: organization.name,
      phone: organization.phone || '',
      address: organization.address || '',
      country: getCurrentCountryCode(),
    });
    setIsEditing(false);
  };

  const getPlanIcon = () => {
    switch (organization.plan) {
      case 'premium': return <Crown className="w-4 h-4" />;
      case 'basic': return <Sparkles className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  const getPlanColor = () => {
    switch (organization.plan) {
      case 'premium': return 'bg-status-warning-bg text-status-warning-foreground border-status-warning';
      case 'basic': return 'bg-status-info-bg text-status-info-foreground border-status-info';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Organization Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Mi Negocio</CardTitle>
                <CardDescription>Información de tu barbería</CardDescription>
              </div>
            </div>
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                Editar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="org-name">Nombre del negocio</Label>
                <Input
                  id="org-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Mi Barbería"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-phone">Teléfono</Label>
                <Input
                  id="org-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+54 11 1234-5678"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-address">Dirección</Label>
                <Input
                  id="org-address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Av. Corrientes 1234, CABA"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-country">País / Zona Horaria</Label>
                <Select
                  value={formData.country}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, country: value }))}
                >
                  <SelectTrigger id="org-country">
                    <SelectValue placeholder="Seleccionar país" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.flag} {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Esto determina la zona horaria para los cierres de caja
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={handleCancel} disabled={isSaving}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{organization.name}</span>
              </div>
              {organization.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{organization.phone}</span>
                </div>
              )}
              {organization.address && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{organization.address}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span>
                  {COUNTRIES.find(c => COUNTRY_TIMEZONES[c.code as keyof typeof COUNTRY_TIMEZONES] === organization.timezone)?.flag}{' '}
                  {COUNTRIES.find(c => COUNTRY_TIMEZONES[c.code as keyof typeof COUNTRY_TIMEZONES] === organization.timezone)?.name || 'Argentina'}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Plan Actual</CardTitle>
              <CardDescription>Características de tu suscripción</CardDescription>
            </div>
            <Badge variant="outline" className={getPlanColor()}>
              {getPlanIcon()}
              <span className="ml-1 capitalize">{organization.plan}</span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {planFeatures && (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Barberos</p>
                <p className="text-xl font-semibold">
                  {planFeatures.max_barbers >= 999 ? '∞' : planFeatures.max_barbers}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Servicios</p>
                <p className="text-xl font-semibold">
                  {planFeatures.max_services >= 999 ? '∞' : planFeatures.max_services}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Reportes</p>
                <p className="text-xl font-semibold">
                  {planFeatures.can_export_reports ? '✓' : '✗'}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Analytics</p>
                <p className="text-xl font-semibold">
                  {planFeatures.can_view_analytics ? '✓' : '✗'}
                </p>
              </div>
            </div>
          )}
          {organization.plan === 'free' && (
            <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm font-medium text-primary">¿Necesitás más?</p>
              <p className="text-sm text-muted-foreground mt-1">
                Actualizá a Basic o Premium para desbloquear más funciones.
              </p>
              <Button size="sm" className="mt-3">
                Ver planes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Métodos de pago y recargos — configuración general */}
      <PaymentMethodsConfig sucursalId={null} />
    </div>
  );
}
