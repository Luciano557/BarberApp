import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { OrgPublicData } from "@/pages/Reservar";
import { SucursalStep } from "./SucursalStep";
import { ServicioStep } from "./ServicioStep";
import { BarberoStep } from "./BarberoStep";
import { FechaHorarioStep } from "./FechaHorarioStep";
import { AuthStep } from "./AuthStep";
import { ConfirmacionStep } from "./ConfirmacionStep";
import { MisTurnosStep } from "./MisTurnosStep";
import { RescheduleFlow } from "./RescheduleFlow";
import { BookingSummary } from "./BookingSummary";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Check, CalendarPlus, ArrowLeft, MapPin, Scissors, User, CalendarDays, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatFechaLegible, buildGoogleCalendarUrl } from "@/lib/dateUtils";

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

const STEP_LABELS = ["Sucursal", "Servicio", "Barbero", "Fecha y horario", "Datos", "Confirmar"];

interface Props {
  orgData: OrgPublicData;
  mode: "book" | "manage";
  onBackToLanding: () => void;
}

const cardClasses =
  "rounded-2xl border border-border/60 bg-card p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)]";

export const BookingStepper = ({ orgData, mode, onBackToLanding }: Props) => {
  const [step, setStep] = useState(0);
  const [booking, setBooking] = useState<BookingState>({
    sucursalId: null,
    sucursalNombre: "",
    servicioId: null,
    servicioNombre: "",
    servicioPrecio: 0,
    barberoId: null,
    barberoNombre: "",
    fecha: "",
    horaInicio: "",
    horaFin: "",
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Manage mode state
  const [manageAuthDone, setManageAuthDone] = useState(false);
  const [rescheduleTurno, setRescheduleTurno] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const authed = !!data.session;
      setIsAuthenticated(authed);
      if (mode === "manage" && authed) setManageAuthDone(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const authed = !!session;
      setIsAuthenticated(authed);
      if (mode === "manage" && authed) setManageAuthDone(true);
    });
    return () => subscription.unsubscribe();
  }, [mode]);

  useEffect(() => {
    if (mode === "book" && step === 0 && orgData.sucursales.length === 1) {
      const s = orgData.sucursales[0];
      setBooking((b) => ({ ...b, sucursalId: s.id, sucursalNombre: s.nombre }));
      setStep(1);
    }
  }, [step, orgData.sucursales, mode]);

  // === MANAGE MODE ===
  if (mode === "manage") {
    if (rescheduleTurno) {
      return (
        <div className={`mx-auto max-w-2xl ${cardClasses}`}>
          <RescheduleFlow
            turno={rescheduleTurno}
            onDone={() => setRescheduleTurno(null)}
            onBack={() => setRescheduleTurno(null)}
          />
        </div>
      );
    }

    if (!manageAuthDone) {
      return (
        <div className={`mx-auto max-w-md ${cardClasses}`}>
          <Button variant="ghost" size="sm" onClick={onBackToLanding} className="mb-3 -ml-2 gap-1">
            <ChevronLeft className="h-4 w-4" /> Volver
          </Button>
          <AuthStep onAuthenticated={() => setManageAuthDone(true)} />
        </div>
      );
    }

    return (
      <div className={`mx-auto max-w-2xl ${cardClasses}`}>
        <Button variant="ghost" size="sm" onClick={onBackToLanding} className="mb-3 -ml-2 gap-1">
          <ChevronLeft className="h-4 w-4" /> Volver
        </Button>
        <MisTurnosStep
          organizationId={orgData.organization.id}
          onReschedule={(turno) => setRescheduleTurno(turno)}
          onBookNew={() => onBackToLanding()}
        />
      </div>
    );
  }

  // === BOOK MODE ===
  const totalSteps = isAuthenticated ? 5 : 6;
  const progress = ((step + 1) / totalSteps) * 100;

  const resetFieldsFromStep = (fromStep: number) => {
    setBooking((b) => {
      const updated = { ...b };
      if (fromStep <= 0) { updated.sucursalId = null; updated.sucursalNombre = ""; }
      if (fromStep <= 1) { updated.servicioId = null; updated.servicioNombre = ""; updated.servicioPrecio = 0; }
      if (fromStep <= 2) { updated.barberoId = null; updated.barberoNombre = ""; }
      if (fromStep <= 3) { updated.fecha = ""; updated.horaInicio = ""; updated.horaFin = ""; }
      return updated;
    });
  };

  const goBack = () => {
    if (step === 1 && orgData.sucursales.length === 1) {
      resetFieldsFromStep(0);
      onBackToLanding();
    } else if (step > 0) {
      const newStep = step - 1;
      resetFieldsFromStep(newStep);
      setStep(newStep);
    } else {
      onBackToLanding();
    }
  };

  const getActualStep = () => {
    if (step <= 3) return step;
    if (isAuthenticated) return step === 4 ? 5 : step;
    return step;
  };

  const actualStep = getActualStep();
  const stepLabel = STEP_LABELS[actualStep] || STEP_LABELS[STEP_LABELS.length - 1];

  if (confirmed) {
    const calendarUrl = buildGoogleCalendarUrl({
      title: `Turno en ${orgData.organization.name}`,
      description: `${booking.servicioNombre} con ${booking.barberoNombre}`,
      location: booking.sucursalNombre,
      fecha: booking.fecha,
      horaInicio: booking.horaInicio,
      horaFin: booking.horaFin,
      timezone: orgData.organization.timezone || null,
    });

    return (
      <div className={`mx-auto max-w-md ${cardClasses}`}>
        <div className="text-center space-y-5 py-2 animate-in fade-in zoom-in-95 duration-300">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Check className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">¡Turno confirmado!</h2>
            <p className="text-sm text-muted-foreground">Te esperamos.</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/40 p-4 text-left space-y-3">
            <DetailRow icon={<MapPin className="h-4 w-4" />} value={booking.sucursalNombre} />
            <DetailRow icon={<Scissors className="h-4 w-4" />} value={booking.servicioNombre} />
            <DetailRow icon={<User className="h-4 w-4" />} value={booking.barberoNombre} />
            <DetailRow icon={<CalendarDays className="h-4 w-4" />} value={formatFechaLegible(booking.fecha)} />
            <DetailRow icon={<Clock className="h-4 w-4" />} value={`${booking.horaInicio} - ${booking.horaFin}`} />
          </div>

          <div className="space-y-2">
            <Button className="w-full h-12 gap-2" asChild>
              <a href={calendarUrl} target="_blank" rel="noopener noreferrer">
                <CalendarPlus className="h-4 w-4" />
                Agregar al calendario
              </a>
            </Button>
            <Button variant="outline" className="w-full h-12 gap-2" onClick={onBackToLanding}>
              <ArrowLeft className="h-4 w-4" />
              Volver al inicio
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className={cardClasses}>
        {/* Header */}
        <div className="mb-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {orgData.organization.name}
              </h1>
              <p className="text-xs text-muted-foreground">Reservá tu turno</p>
            </div>
            <span className="rounded-full border border-border/60 bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              Paso {Math.min(actualStep + 1, totalSteps)} de {totalSteps}
            </span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={goBack} className="-ml-2 gap-1 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" /> Volver
          </Button>
        </div>

        {/* Mobile resumen compacto */}
        <div className="mb-5 lg:hidden">
          <BookingSummary booking={booking} stepLabel={stepLabel} />
        </div>

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
            barberos={orgData.barberos.filter((b) => b.sucursal_id === booking.sucursalId)}
            onSelect={(id, nombre) => {
              setBooking((b) => ({ ...b, barberoId: id, barberoNombre: nombre || "Cualquiera disponible" }));
              setStep(3);
            }}
          />
        )}
        {actualStep === 3 && (
          <FechaHorarioStep
            organizationId={orgData.organization.id}
            sucursalId={booking.sucursalId!}
            servicioId={booking.servicioId!}
            barberoId={booking.barberoId}
            onSelect={(horaInicio, horaFin, fecha, barberoId, barberoNombre) => {
              setBooking((b) => ({
                ...b,
                horaInicio,
                horaFin,
                fecha,
                barberoId: barberoId || b.barberoId,
                barberoNombre: barberoNombre || b.barberoNombre,
              }));
              setStep(4);
            }}
            onChangeBarbero={() => {
              resetFieldsFromStep(2);
              setStep(2);
            }}
          />
        )}
        {actualStep === 4 && !isAuthenticated && (
          <AuthStep onAuthenticated={() => setStep(5)} />
        )}
        {(actualStep === 5 || (actualStep === 4 && isAuthenticated)) && (
          <ConfirmacionStep
            booking={booking}
            orgData={orgData}
            onConfirmed={() => setConfirmed(true)}
            onSlotTaken={() => {
              resetFieldsFromStep(3);
              setStep(3);
            }}
          />
        )}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <div className="sticky top-6">
          <BookingSummary booking={booking} stepLabel={stepLabel} />
          <p className="mt-3 text-center text-[11px] text-muted-foreground">Powered by Vittro</p>
        </div>
      </div>
    </div>
  );
};

const DetailRow = ({ icon, value }: { icon: React.ReactNode; value: string }) => (
  <div className="flex items-center gap-3">
    <span className="text-muted-foreground shrink-0">{icon}</span>
    <span className="text-sm text-foreground">{value}</span>
  </div>
);
