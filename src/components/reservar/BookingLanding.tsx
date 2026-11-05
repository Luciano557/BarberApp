import { Button } from "@/components/ui/button";
import { CalendarPlus, Settings } from "lucide-react";
import { getPortalIcon } from "./lib/portalIcons";
import { getPortalThemeStyle } from "./lib/portalTheme";
import { PortalAvatar, PortalCover } from "./PortalIdentity";
import { VittroSignature } from "./VittroSignature";
import "./portal.css";

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
  meta_pixel_id: string | null;
}

interface Props {
  orgName: string;
  fallbackLogo?: string | null;
  portal: PortalDataView | null;
  onStart?: () => void;
  onManage: () => void;
  emptyMessage?: string;
  headingLevel?: "h1" | "h2";
}

export const buildDefaultPortalDescription = (orgName: string) =>
  `Bienvenido al portal de reservas de ${orgName}. Reservá tu turno o gestioná tu cita de forma simple.`;

export const BookingLanding = ({ orgName, fallbackLogo, portal, onStart, onManage, emptyMessage, headingLevel = "h1" }: Props) => {
  const NameHeading = headingLevel;
  const logo = portal?.logo_url || fallbackLogo || null;
  const links = (portal?.links ?? []).slice(0, 4);

  return (
    <div className={`portal portal-landing${headingLevel === "h2" ? " portal-preview" : ""}`} style={getPortalThemeStyle(portal?.primary_color)}>
      <div className="portal-landing__visual">
        {portal?.cover_url ? <PortalCover portal={portal} /> : (
          <div className="portal-landing__monogram" aria-hidden="true">
            <PortalAvatar orgName={orgName} logo={logo} />
          </div>
        )}
      </div>
      <div className="portal-landing__content">
        <div className="portal-landing__identity">
          <PortalAvatar orgName={orgName} logo={logo} />
          <NameHeading className="portal-landing__name">{orgName}</NameHeading>
          <p className="portal-landing__description">
            {portal?.description?.trim() || buildDefaultPortalDescription(orgName)}
          </p>
        </div>

        <div className="portal-landing__actions">
          {emptyMessage ? (
            <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            <Button onClick={onStart} className="portal-landing__primary w-full gap-3 text-base">
              <CalendarPlus className="h-5 w-5" aria-hidden="true" /> Reservar mi cita
            </Button>
          )}
          <Button onClick={onManage} variant="outline" className="w-full gap-3 text-base">
            <Settings className="h-5 w-5" aria-hidden="true" /> Modificar mi cita
          </Button>
        </div>

        {links.length > 0 && (
          <nav aria-label={`Redes y contacto de ${orgName}`} className="portal-landing__links">
            {links.map((link, index) => {
              const Icon = getPortalIcon(link.icon);
              return (
                <a key={`${link.url}-${index}`} href={link.url} target="_blank" rel="noopener noreferrer">
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{link.label}</span>
                </a>
              );
            })}
          </nav>
        )}
        <VittroSignature />
      </div>
    </div>
  );
};
