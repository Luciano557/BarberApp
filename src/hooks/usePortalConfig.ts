import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PortalLink {
  label: string;
  url: string;
  active: boolean;
  sort_order: number;
  icon?: string | null;
}

export interface PortalConfig {
  organization_id: string;
  logo_path: string | null;
  cover_path: string | null;
  cover_position_x: number;
  cover_position_y: number;
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

export function getCoverPublicUrl(coverPath: string | null): string | null {
  if (!coverPath) return null;
  const { data } = supabase.storage.from('portal-logos').getPublicUrl(coverPath);
  return data?.publicUrl ?? null;
}

const clampPos = (n: any): number => {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 50;
  return Math.max(0, Math.min(100, Math.round(v)));
};

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
      const d: any = data;
      setConfig({
        organization_id: d.organization_id,
        logo_path: d.logo_path,
        cover_path: d.cover_path ?? null,
        cover_position_x: clampPos(d.cover_position_x ?? 50),
        cover_position_y: clampPos(d.cover_position_y ?? 50),
        description: d.description,
        primary_color: d.primary_color,
        links: Array.isArray(d.links) ? (d.links as unknown as PortalLink[]) : [],
      });
    } else {
      setConfig({
        organization_id: organizationId,
        logo_path: null,
        cover_path: null,
        cover_position_x: 50,
        cover_position_y: 50,
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
    const payload: any = {
      organization_id: organizationId,
      logo_path: updates.logo_path !== undefined ? updates.logo_path : config?.logo_path ?? null,
      cover_path: updates.cover_path !== undefined ? updates.cover_path : config?.cover_path ?? null,
      cover_position_x: updates.cover_position_x !== undefined
        ? clampPos(updates.cover_position_x)
        : clampPos(config?.cover_position_x ?? 50),
      cover_position_y: updates.cover_position_y !== undefined
        ? clampPos(updates.cover_position_y)
        : clampPos(config?.cover_position_y ?? 50),
      description: updates.description !== undefined ? updates.description : config?.description ?? null,
      primary_color: updates.primary_color !== undefined ? updates.primary_color : config?.primary_color ?? null,
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

  const uploadCover = useCallback(async (file: File) => {
    if (!organizationId) return { error: new Error('No organization'), path: null as string | null };
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      return { error: new Error('Formato no permitido. Usá PNG, JPG o WEBP.'), path: null };
    }
    if (file.size > 2 * 1048576) {
      return { error: new Error('La portada no puede superar 2 MB.'), path: null };
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `${organizationId}/covers/cover-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('portal-logos')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) return { error, path: null };
    return { error: null, path };
  }, [organizationId]);

  const removeCover = useCallback(async () => {
    if (!config?.cover_path) return { error: null };
    await supabase.storage.from('portal-logos').remove([config.cover_path]);
    return await save({ cover_path: null, cover_position_x: 50, cover_position_y: 50 });
  }, [config, save]);

  return {
    config,
    setConfig,
    loading,
    saving,
    save,
    uploadLogo,
    removeLogo,
    uploadCover,
    removeCover,
    refetch: fetch,
  };
}
