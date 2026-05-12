import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PortalLink {
  label: string;
  url: string;
  active: boolean;
  sort_order: number;
}

export interface PortalConfig {
  organization_id: string;
  logo_path: string | null;
  description: string | null;
  primary_color: string | null;
  links: PortalLink[];
}

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function isValidHex(value: string | null | undefined): boolean {
  return !!value && HEX_RE.test(value);
}

export function getLogoPublicUrl(logoPath: string | null): string | null {
  if (!logoPath) return null;
  const { data } = supabase.storage.from('portal-logos').getPublicUrl(logoPath);
  return data?.publicUrl ?? null;
}

export function usePortalConfig(organizationId: string | undefined) {
  const [config, setConfig] = useState<PortalConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const { data } = await supabase
      .from('portal_config')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (data) {
      setConfig({
        organization_id: data.organization_id,
        logo_path: data.logo_path,
        description: data.description,
        primary_color: data.primary_color,
        links: Array.isArray(data.links) ? (data.links as unknown as PortalLink[]) : [],
      });
    } else {
      setConfig({
        organization_id: organizationId,
        logo_path: null,
        description: null,
        primary_color: null,
        links: [],
      });
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => { fetch(); }, [fetch]);

  const save = useCallback(async (updates: Partial<PortalConfig>) => {
    if (!organizationId) return { error: new Error('No organization') };
    setSaving(true);
    const payload = {
      organization_id: organizationId,
      logo_path: updates.logo_path ?? config?.logo_path ?? null,
      description: updates.description ?? config?.description ?? null,
      primary_color: updates.primary_color ?? config?.primary_color ?? null,
      links: (updates.links ?? config?.links ?? []) as any,
    };
    const { error } = await supabase
      .from('portal_config')
      .upsert(payload, { onConflict: 'organization_id' });
    setSaving(false);
    if (!error) await fetch();
    return { error };
  }, [organizationId, config, fetch]);

  const uploadLogo = useCallback(async (file: File) => {
    if (!organizationId) return { error: new Error('No organization'), path: null as string | null };
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      return { error: new Error('Formato no permitido. Usá PNG, JPG o WEBP.'), path: null };
    }
    if (file.size > 1048576) {
      return { error: new Error('El logo no puede superar 1 MB.'), path: null };
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `${organizationId}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('portal-logos')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) return { error, path: null };
    return { error: null, path };
  }, [organizationId]);

  const removeLogo = useCallback(async () => {
    if (!config?.logo_path) return { error: null };
    await supabase.storage.from('portal-logos').remove([config.logo_path]);
    return await save({ logo_path: null });
  }, [config, save]);

  return { config, setConfig, loading, saving, save, uploadLogo, removeLogo, refetch: fetch };
}
