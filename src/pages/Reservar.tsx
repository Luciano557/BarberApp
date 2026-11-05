import { useState } from "react";
import { useParams } from "react-router-dom";
import { usePortalRead } from "@/components/reservar/hooks/usePortalRead";
import { InlineReadError } from "@/components/ui/InlineReadError";
import { BookingLanding, PortalDataView } from "@/components/reservar/BookingLanding";
import { BookingStepper } from "@/components/reservar/BookingStepper";
import { Skeleton } from "@/components/ui/skeleton";
import { getPortalThemeStyle } from "@/components/reservar/lib/portalTheme";
import { CookieConsentBanner } from "@/components/consent/CookieConsentBanner";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { PortalIdentity } from "@/components/reservar/PortalIdentity";
import { VittroSignature } from "@/components/reservar/VittroSignature";

export interface OrgPublicData {
  organization: { id: string; name: string; logo_url: string | null; timezone: string | null };
  sucursales: { id: string; nombre: string }[];
  barberos: { id: string; nombre: string; apellido: string; sucursal_id: string }[];
  servicios: { id: string; nombre: string; precio: number; duracion_min: number; sucursal_id: string }[];
  portal: PortalDataView | null;
}

const Reservar = () => {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { data: orgData, loading, refetch } = usePortalRead<OrgPublicData>(
    "get-org-public", { org_slug: orgSlug }, "No pudimos actualizar el portal.", !!orgSlug,
  );
  const [mode, setMode] = useState<"landing" | "book" | "manage">("landing");

  useMetaPixel(orgData?.portal?.meta_pixel_id);

  // Espacio reservado para que el banner de cookies (fixed, bottom) nunca
  // tape contenido en el borde inferior — la altura real la publica
  // CookieConsentBanner en esta variable (0px cuando está oculto).
  const bannerPadding = { paddingBottom: 'calc(var(--consent-banner-h, 0px) + 16px)' };

  if (loading) {
    return (
      <div className="portal portal-page min-h-screen bg-background" style={bannerPadding} role="status" aria-label="Cargando portal de reservas">
        <div className="portal-shell">
          <div className="portal-landing">
            <Skeleton className="portal-landing__visual" />
            <div className="portal-landing__content space-y-6">
              <Skeleton className="h-[72px] w-[72px] rounded-full" />
              <Skeleton className="h-14 w-3/4" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-[54px] w-full" />
              <Skeleton className="h-[54px] w-full" />
            </div>
          </div>
        </div>
        <CookieConsentBanner />
      </div>
    );
  }

  if (!orgData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4" style={bannerPadding}>
        <InlineReadError message="No pudimos cargar el portal de esta barbería." onRetry={refetch} bordered={false} />
        <CookieConsentBanner />
      </div>
    );
  }

  const themeStyle = getPortalThemeStyle(orgData.portal?.primary_color);
  const sinReservables = orgData.sucursales.length === 0 || orgData.servicios.length === 0;

  return (
    <div style={{ ...themeStyle, ...bannerPadding }} className="portal portal-page min-h-screen bg-background">
      <main className="portal-shell">
        {mode === "landing" ? (
              <BookingLanding
                orgName={orgData.organization.name}
                fallbackLogo={orgData.organization.logo_url}
                portal={orgData.portal}
                onStart={sinReservables ? undefined : () => setMode("book")}
                onManage={() => setMode("manage")}
                emptyMessage={sinReservables ? "No hay servicios disponibles para reservar en este momento." : undefined}
              />
        ) : (
          <>
          <PortalIdentity orgName={orgData.organization.name} logo={orgData.portal?.logo_url || orgData.organization.logo_url} />
          <BookingStepper
            key={orgData.organization.id}
            orgData={orgData}
            mode={mode}
            onBackToLanding={() => setMode("landing")}
            onBookNew={() => setMode("book")}
          />
          <footer className="portal-footer"><VittroSignature /></footer>
          </>
        )}
      </main>
      <CookieConsentBanner />
    </div>
  );
};

export default Reservar;
