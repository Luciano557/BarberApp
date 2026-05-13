import { Button } from "@/components/ui/button";
import { CalendarPlus, Settings, ExternalLink } from "lucide-react";
import { isValidHex } from "@/hooks/usePortalConfig";

export interface PortalDataView {
  logo_url: string | null;
  description: string | null;
  primary_color: string | null;
  links: { label: string; url: string }[];
}

interface Props {
  orgName: string;
  fallbackLogo?: string | null;
  portal: PortalDataView | null;
  onStart: () => void;
  onManage: () => void;
}

export const BookingLanding = ({ orgName, fallbackLogo, portal, onStart, onManage }: Props) => {
  const logo = portal?.logo_url || fallbackLogo || null;
  const description = portal?.description?.trim() || null;
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
    <div style={containerStyle} className="flex flex-col items-center gap-6 py-2 text-center">
      <div
        className="h-28 w-28 rounded-full bg-muted overflow-hidden flex items-center justify-center border border-border shadow-sm"
        style={primary ? { borderColor: 'var(--portal-primary)' } : undefined}
      >
        {logo ? (
          <img src={logo} alt={`Logo de ${orgName}`} className="h-full w-full object-cover" />
        ) : (
          <span className="text-3xl font-semibold text-muted-foreground">{initials}</span>
        )}
      </div>

      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold text-foreground">{orgName}</h1>
        {description && (
          <p className="text-sm text-muted-foreground max-w-xs mx-auto whitespace-pre-line">
            {description}
          </p>
        )}
      </div>

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

        {links.length > 0 && (
          <div className="pt-2 space-y-2">
            {links.map((l, idx) => (
              <a
                key={`${l.url}-${idx}`}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                <span className="max-w-[80%] truncate">{l.label}</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground pt-4">Powered by Vittro</p>
    </div>
  );
};
