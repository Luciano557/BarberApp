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
  cover_position_x?: number | null;
  cover_position_y?: number | null;
  cover_zoom?: number | null;
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

const clampPos = (n: number | null | undefined) => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, n));
};

export const BookingLanding = ({ orgName, fallbackLogo, portal, onStart, onManage }: Props) => {
  const logo = portal?.logo_url || fallbackLogo || null;
  const cover = portal?.cover_url || null;
  const description = portal?.description?.trim() || buildDefaultPortalDescription(orgName);
  const links = (portal?.links ?? []).slice(0, 4);
  const posX = clampPos(portal?.cover_position_x);
  const posY = clampPos(portal?.cover_position_y);

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

  const Avatar = ({ className = '' }: { className?: string }) => (
    <div
      className={`h-24 w-24 rounded-full bg-card overflow-hidden flex items-center justify-center ring-4 ring-card shadow-md ${className}`}
    >
      {logo ? (
        <img src={logo} alt={`Logo de ${orgName}`} className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-muted flex items-center justify-center">
          <span className="text-3xl font-semibold text-muted-foreground">{initials}</span>
        </div>
      )}
    </div>
  );

  return (
    <div style={containerStyle} className="flex flex-col">
      {cover ? (
        <>
          {/* Cover header — capa con portada y degradado */}
          <div className="relative -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 h-[140px]">
            {/* z-0: foto */}
            <div
              className="absolute inset-0 z-0 bg-cover"
              style={{
                backgroundImage: `url(${cover})`,
                backgroundPosition: `${posX}% ${posY}%`,
              }}
            />
            {/* z-10: degradado inferior */}
            <div className="absolute inset-x-0 bottom-0 z-10 h-2/3 bg-gradient-to-b from-transparent to-card" />
            {/* z-20: avatar superpuesto, anclado al borde inferior */}
            <div className="absolute left-1/2 bottom-0 z-20 -translate-x-1/2 translate-y-1/2">
              <Avatar />
            </div>
          </div>

          {/* Cuerpo */}
          <div className="flex flex-col items-center gap-5 text-center pt-14">
            <div className="space-y-1.5 px-2">
              <h1 className="text-2xl font-semibold text-foreground">{orgName}</h1>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto whitespace-pre-line">
                {description}
              </p>
            </div>
            <Actions
              primary={primary}
              onStart={onStart}
              onManage={onManage}
              links={links}
            />
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-5 text-center pt-2">
          <Avatar />
          <div className="space-y-1.5 px-2">
            <h1 className="text-2xl font-semibold text-foreground">{orgName}</h1>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto whitespace-pre-line">
              {description}
            </p>
          </div>
          <Actions
            primary={primary}
            onStart={onStart}
            onManage={onManage}
            links={links}
          />
        </div>
      )}
    </div>
  );
};

function Actions({
  primary,
  onStart,
  onManage,
  links,
}: {
  primary: string | null;
  onStart: () => void;
  onManage: () => void;
  links: PortalLandingLink[];
}) {
  return (
    <>
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
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors group-hover:border-primary group-hover:text-primary">
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
    </>
  );
}
