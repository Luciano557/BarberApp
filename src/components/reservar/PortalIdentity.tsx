import type { PortalDataView } from "./BookingLanding";

export function PortalAvatar({ orgName, logo }: { orgName: string; logo?: string | null }) {
  const initials = orgName.split(" ").filter(Boolean).slice(0, 2).map(word => word[0]?.toUpperCase()).join("") || "V";
  return (
    <div className="portal-avatar">
      {logo ? <img src={logo} alt={`Logo de ${orgName}`} width={80} height={80} decoding="async" /> : <span aria-hidden="true">{initials}</span>}
    </div>
  );
}

const clamp = (value: number | null | undefined, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;

export function PortalCover({ portal }: { portal: PortalDataView }) {
  const x = clamp(portal.cover_position_x, 0, 100, 50);
  const y = clamp(portal.cover_position_y, 0, 100, 50);
  return (
    <img
      src={portal.cover_url!} alt="" className="portal-cover" decoding="async" {...{ fetchpriority: "high" }}
      style={{ objectPosition: `${x}% ${y}%`, transform: `scale(${clamp(portal.cover_zoom, 1, 3, 1)})`, transformOrigin: `${x}% ${y}%` }}
      draggable={false}
    />
  );
}

export function PortalIdentity({ orgName, logo }: { orgName: string; logo?: string | null }) {
  return (
    <header className="portal-identity">
      <PortalAvatar orgName={orgName} logo={logo} />
      <h1>{orgName}</h1>
    </header>
  );
}
