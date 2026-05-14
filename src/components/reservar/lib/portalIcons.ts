import {
  Instagram,
  MessageCircle,
  Facebook,
  Music2,
  Youtube,
  MapPin,
  Globe,
  Phone,
  Mail,
  Link2,
  type LucideIcon,
} from 'lucide-react';

export interface PortalIconDef {
  key: string;
  label: string;
  Icon: LucideIcon;
}

export const PORTAL_ICONS: PortalIconDef[] = [
  { key: 'instagram', label: 'Instagram', Icon: Instagram },
  { key: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle },
  { key: 'facebook', label: 'Facebook', Icon: Facebook },
  { key: 'tiktok', label: 'TikTok', Icon: Music2 },
  { key: 'youtube', label: 'YouTube', Icon: Youtube },
  { key: 'map', label: 'Ubicación', Icon: MapPin },
  { key: 'web', label: 'Web', Icon: Globe },
  { key: 'phone', label: 'Teléfono', Icon: Phone },
  { key: 'mail', label: 'Email', Icon: Mail },
  { key: 'link', label: 'Link', Icon: Link2 },
];

export const PORTAL_ICON_KEYS = PORTAL_ICONS.map((i) => i.key);

export function getPortalIcon(key: string | null | undefined): LucideIcon {
  const found = PORTAL_ICONS.find((i) => i.key === key);
  return found?.Icon ?? Link2;
}

export function isValidIconKey(key: unknown): key is string {
  return typeof key === 'string' && PORTAL_ICON_KEYS.includes(key);
}
