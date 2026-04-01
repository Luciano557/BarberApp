import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { OrgPublicData } from "@/pages/Reservar";
import { SucursalStep } from "./SucursalStep";
import { ServicioStep } from "./ServicioStep";
import { BarberoStep } from "./BarberoStep";
import { FechaStep } from "./FechaStep";
import { HorarioStep } from "./HorarioStep";
import { AuthStep } from "./AuthStep";
import { ConfirmacionStep } from "./ConfirmacionStep";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export interface BookingState {
  sucursalId: string | null;
  sucursalNombre: string;
  servicioId: string | null;
  servicioNombre: string;
  servicioPrecio: number;
  barberoId: string | null;
  barberoNombre: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

const STEP_LABELS = ["Sucursal", "Servicio", "Barbero", "Fecha", "Horario", "Datos", "Confirmar"];

export const BookingStepper = ({ orgData }: { orgData: OrgPublicData }) => {
  const [step, setStep] = useState(0);
  const [booking, setBooking] = useState<BookingState>({
    sucursalId: null,
    sucursalNombre: "",
    servicioId: null,
    servicioNombre: "",
    servicioPrecio: 0,
    barberoId: null,
    barberoNombre: "",
    fecha: new Date().toISOString().split("T")[0],
    horaInicio: "",
    horaFin: "",
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Check auth on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsAuthenticated(!!data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Auto-skip sucursal if only 1
  useEffect(() => {
    if (step === 0 && orgData.sucursales.length === 1) {
      const s = orgData.sucursales[0];
      setBooking((b) => ({ ...b, sucursalId: s.id, sucursalNombre: s.nombre }));
      setStep(1);
    }
  }, [step, orgData.sucursales]);

  const totalSteps = isAuthenticated ? 6 : 7;
  const progress = ((step + 1) / totalSteps) * 100;

  const goBack = () => {
    if (step > 0) setStep(step - 1);
  };

  // Map logical step to actual step (skip auth if authenticated)
  const getActualStep = () => {
    if (step <= 4) return step;
    if (isAuthenticated) return step === 5 ? 6 : step; // skip auth
    return step;
  };

  const actualStep = getActualStep();

  if (confirmed) {
    return (
      <div className="text-center space-y-4 py-8">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Check className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">¡Turno confirmado!</h2>
        <p className="text-muted-foreground">
          {booking.fecha} a las {booking.horaInicio} con {booking.barberoNombre}
        </p>
        <p className="text-sm text-muted-foreground">{booking.servicioNombre} en {booking.sucursalNombre}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <Progress value={progress} className="h-2" />

      {/* Context chips */}
      <div className="flex flex-wrap gap-2">
        {booking.sucursalNombre && <Badge variant="secondary">{booking.sucursalNombre}</Badge>}
        {booking.servicioNombre && <Badge variant="secondary">{booking.servicioNombre}</Badge>}
        {booking.barberoNombre && <Badge variant="secondary">{booking.barberoNombre}</Badge>}
        {booking.fecha && step > 3 && <Badge variant="secondary">{booking.fecha}</Badge>}
        {booking.horaInicio && step > 4 && <Badge variant="secondary">{booking.horaInicio}</Badge>}
      </div>

      {/* Back button */}
      {step > 0 && (
        <Button variant="ghost" size="sm" onClick={goBack} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Volver
        </Button>
      )}

      {/* Steps */}
      {actualStep === 0 && (
        <SucursalStep
          sucursales={orgData.sucursales}
          onSelect={(id, nombre) => {
            setBooking((b) => ({ ...b, sucursalId: id, sucursalNombre: nombre }));
            setStep(1);
          }}
        />
      )}
      {actualStep === 1 && (
        <ServicioStep
          servicios={orgData.servicios.filter((s) => s.sucursal_id === booking.sucursalId || !s.sucursal_id)}
          onSelect={(id, nombre, precio) => {
            setBooking((b) => ({ ...b, servicioId: id, servicioNombre: nombre, servicioPrecio: precio }));
            setStep(2);
          }}
        />
      )}
      {actualStep === 2 && (
        <BarberoStep
          barberos={orgData.barberos.filter((b) => b.sucursal_id === booking.sucursalId || !b.sucursal_id)}
          onSelect={(id, nombre) => {
            setBooking((b) => ({ ...b, barberoId: id, barberoNombre: nombre || "Cualquiera disponible" }));
            setStep(3);
          }}
        />
      )}
      {actualStep === 3 && (
        <FechaStep
          value={booking.fecha}
          onSelect={(fecha) => {
            setBooking((b) => ({ ...b, fecha }));
            setStep(4);
          }}
        />
      )}
      {actualStep === 4 && (
        <HorarioStep
          organizationId={orgData.organization.id}
          sucursalId={booking.sucursalId!}
          servicioId={booking.servicioId!}
          barberoId={booking.barberoId}
          fecha={booking.fecha}
          onSelect={(horaInicio, horaFin, barberoId, barberoNombre) => {
            setBooking((b) => ({
              ...b,
              horaInicio,
              horaFin,
              barberoId: barberoId || b.barberoId,
              barberoNombre: barberoNombre || b.barberoNombre,
            }));
            setStep(5);
          }}
          onChangeFecha={() => setStep(3)}
          onChangeBarbero={() => setStep(2)}
        />
      )}
      {actualStep === 5 && !isAuthenticated && (
        <AuthStep onAuthenticated={() => setStep(6)} />
      )}
      {(actualStep === 6 || (actualStep === 5 && isAuthenticated)) && (
        <ConfirmacionStep
          booking={booking}
          orgData={orgData}
          onConfirmed={() => setConfirmed(true)}
          onSlotTaken={() => setStep(4)}
        />
      )}
    </div>
  );
};
