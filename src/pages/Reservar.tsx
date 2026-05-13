import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BookingLanding, PortalDataView } from "@/components/reservar/BookingLanding";
import { BookingStepper } from "@/components/reservar/BookingStepper";
import { Skeleton } from "@/components/ui/skeleton";

export interface OrgPublicData {
  organization: { id: string; name: string; logo_url: string | null; timezone: string | null };
  sucursales: { id: string; nombre: string }[];
  barberos: { id: string; nombre: string; apellido: string; sucursal_id: string }[];
  servicios: { id: string; nombre: string; precio: number; duracion_min: number; sucursal_id: string }[];
  portal: PortalDataView | null;
}

const Reservar = () => {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [orgData, setOrgData] = useState<OrgPublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"landing" | "book" | "manage">("landing");

  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("get-org-public", {
          body: { org_slug: orgSlug },
        });
        if (fnError || data?.error) {
          setError(data?.error || "No se encontró la organización");
          return;
        }
        setOrgData(data);
      } catch {
        setError("Error de conexión");
      } finally {
        setLoading(false);
      }
    };
    if (orgSlug) fetchOrg();
  }, [orgSlug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-full max-w-md px-4">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error || !orgData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold text-foreground">No encontrado</h1>
          <p className="text-muted-foreground">{error || "No se pudo cargar la información"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-6 sm:px-6 sm:py-8">
        {mode === "landing" ? (
          <BookingLanding
            orgName={orgData.organization.name}
            fallbackLogo={orgData.organization.logo_url}
            portal={orgData.portal}
            onStart={() => setMode("book")}
            onManage={() => setMode("manage")}
          />
        ) : (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-foreground">{orgData.organization.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">Reserva tu turno</p>
            </div>
            <BookingStepper
              orgData={orgData}
              mode={mode}
              onBackToLanding={() => setMode("landing")}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default Reservar;
