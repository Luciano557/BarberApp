import { Button } from "@/components/ui/button";
import { CalendarPlus, Settings } from "lucide-react";
import { isValidHex } from "@/hooks/usePortalConfig";
import { getPortalIcon } from "./lib/portalIcons";

export interface PortalLandingLink {
  label: string;
  url: string;
  icon?: string | null;
}

export interface PortalDataView {
  logo_url: string | null;
  cover_url?: string | null;
  description: string | null;
  primary_color: string | null;
  links: PortalLandingLink[];
}

interface Props {
  orgName: string;
  fallbackLogo?: string | null;
  portal: PortalDataView | null;
  onStart: () => void;
  onManage: () => void;
}

export const buildDefaultPortalDescription = (orgName: string) =>
  `Bienvenido al portal de reservas de ${orgName}. Reservá tu turno o gestioná tu cita de forma simple.`;

export const BookingLanding = ({ orgName, fallbackLogo, portal, onStart, onManage }: Props) => {
  const logo = portal?.logo_url || fallbackLogo || null;
  const cover = portal?.cover_url || null;
  const description = portal?.description?.trim() || buildDefaultPortalDescription(orgName);
  const links = (portal?.links ?? []).slice(0, 4);

  const primary = isValidHex(portal?.primary_color) ? portal!.primary_color! : null;
  const containerStyle = primary
    ? ({ ['--portal-primary' as any]: primary } as React.CSSProperties)
    : undefined;

  const initials = orgName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || 'V';

  return (
    <div style={containerStyle} className="flex flex-col">
      {/* Cover */}
      {cover && (
        <div className="relative -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 mb-0 h-[140px] overflow-hidden rounded-t-2xl">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${cover})` }}
          />
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-b from-transparent to-card" />
        </div>
      )}

      <div className={`flex flex-col items-center gap-5 text-center ${cover ? 'pt-0' : 'pt-2'}`}>
        {/* Avatar */}
        <div
          className={`h-24 w-24 rounded-full bg-muted overflow-hidden flex items-center justify-center ring-4 ring-card shadow-sm ${cover ? '-mt-12' : ''}`}
        >
          {logo ? (
            <img src={logo} alt={`Logo de ${orgName}`} className="h-full w-full object-cover" />
          ) : (
            <span className="text-3xl font-semibold text-muted-foreground">{initials}</span>
          )}
        </div>

        {/* Title + description */}
        <div className="space-y-1.5 px-2">
          <h1 className="text-2xl font-semibold text-foreground">{orgName}</h1>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto whitespace-pre-line">
            {description}
          </p>
        </div>

        {/* CTAs */}
        <div className="w-full max-w-sm space-y-3">
          <Button
            onClick={onStart}
            className="w-full h-12 text-base font-medium"
            style={primary ? { backgroundColor: 'var(--portal-primary)', color: '#fff', borderColor: 'transparent' } : undefined}
          >
            <CalendarPlus className="h-5 w-5 mr-2" />
            Reservar mi cita
          </Button>

          <Button
            onClick={onManage}
            variant="outline"
            className="w-full h-12 text-base font-medium"
            style={primary ? { borderColor: 'var(--portal-primary)', color: 'var(--portal-primary)' } : undefined}
          >
            <Settings className="h-5 w-5 mr-2" />
            Modificar mi cita
          </Button>
        </div>

        {/* Quick access links */}
        {links.length > 0 && (
          <div className="w-full max-w-sm pt-1">
            <div className="flex items-start justify-center gap-3 flex-wrap">
              {links.map((l, idx) => {
                const Icon = getPortalIcon(l.icon);
                return (
                  <a
                    key={`${l.url}-${idx}`}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col items-center gap-1.5 w-16"
                    title={l.label}
                  >
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors group-hover:border-primary group-hover:text-primary"
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate max-w-full leading-tight">
                      {l.label}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground pt-3">Powered by Vittro</p>
      </div>
    </div>
  );
};
