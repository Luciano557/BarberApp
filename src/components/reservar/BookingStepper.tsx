import { useState, useEffect, useRef } from "react";
import type { OrgPublicData } from "@/pages/Reservar";
import { SucursalStep } from "./SucursalStep";
import { ServicioStep } from "./ServicioStep";
import { BarberoStep } from "./BarberoStep";
import { FechaHorarioStep } from "./FechaHorarioStep";
import { DatosClienteStep, type ClienteData } from "./DatosClienteStep";
import { ConfirmacionStep } from "./ConfirmacionStep";
import { LookupTelefonoStep } from "./LookupTelefonoStep";
import { MisTurnosStep, type Turno } from "./MisTurnosStep";
import { RescheduleFlow } from "./RescheduleFlow";
import { BookingSummary } from "./BookingSummary";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Check, CalendarPlus, ArrowLeft, MapPin, Scissors, User } from "lucide-react";
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
  eligioBarbero: boolean;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  cliente: ClienteData | null;
}

const STEP_LABELS = ["Sucursal", "Servicio", "Barbero", "Fecha y horario", "Datos", "Confirmar"];

interface Props {
  orgData: OrgPublicData;
  mode: "book" | "manage";
  onBackToLanding: () => void;
  onBookNew: () => void;
}

const cardClasses = "portal-manage";

export const BookingStepper = ({ orgData, mode, onBackToLanding, onBookNew }: Props) => {
  const flowRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [booking, setBooking] = useState<BookingState>({
    sucursalId: null,
    sucursalNombre: "",
    servicioId: null,
    servicioNombre: "",
    servicioPrecio: 0,
    barberoId: null,
    barberoNombre: "",
    eligioBarbero: false,
    fecha: "",
    horaInicio: "",
    horaFin: "",
    cliente: null,
  });
  const [confirmed, setConfirmed] = useState(false);
  const [motionDirection, setMotionDirection] = useState("forward");
  const goToStep = (nextStep: number) => {
    setMotionDirection(nextStep < step ? "back" : "forward");
    setStep(nextStep);
  };

  // Manage mode state
  const [managePhone, setManagePhone] = useState<string | null>(null);
  const [rescheduleTurno, setRescheduleTurno] = useState<Turno | null>(null);

  useEffect(() => {
    if (mode === "book" && step === 0 && orgData.sucursales.length === 1) {
      const s = orgData.sucursales[0];
      setBooking((b) => ({ ...b, sucursalId: s.id, sucursalNombre: s.nombre }));
      setStep(1);
    }
  }, [step, orgData.sucursales, mode]);

  useEffect(() => {
    if (mode === "book") flowRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [step, mode]);

  // === MANAGE MODE ===
  if (mode === "manage") {
    if (rescheduleTurno && managePhone) {
      return (
        <div className={`mx-auto max-w-2xl ${cardClasses}`}>
          <RescheduleFlow
            turno={rescheduleTurno}
            telefono={managePhone}
            onDone={() => setRescheduleTurno(null)}
            onBack={() => setRescheduleTurno(null)}
          />
        </div>
      );
    }

    if (!managePhone) {
      return (
        <div className={`portal-manage--lookup ${cardClasses}`}>
          <Button variant="ghost" size="sm" onClick={onBackToLanding} className="mb-3 -ml-2 h-10 gap-1">
            <ChevronLeft className="h-4 w-4" /> Volver
          </Button>
          <LookupTelefonoStep onLookup={(tel) => setManagePhone(tel)} />
        </div>
      );
    }

    return (
      <div className={`mx-auto max-w-2xl ${cardClasses}`}>
        <Button variant="ghost" size="sm" onClick={onBackToLanding} className="mb-3 -ml-2 h-10 gap-1">
          <ChevronLeft className="h-4 w-4" /> Volver
        </Button>
        <MisTurnosStep
          organizationId={orgData.organization.id}
          telefono={managePhone}
          onReschedule={(turno) => setRescheduleTurno(turno)}
          onBookNew={onBookNew}
        />
      </div>
    );
  }

  // === BOOK MODE ===
  const skippedSteps = orgData.sucursales.length === 1 ? 1 : 0;
  const totalSteps = STEP_LABELS.length - skippedSteps;
  const currentStep = Math.max(1, step + 1 - skippedSteps);
  const progress = (currentStep / totalSteps) * 100;

  const resetFieldsFromStep = (fromStep: number) => {
    setBooking((b) => {
      const updated = { ...b };
      if (fromStep <= 0) { updated.sucursalId = null; updated.sucursalNombre = ""; }
      if (fromStep <= 1) { updated.servicioId = null; updated.servicioNombre = ""; updated.servicioPrecio = 0; }
      if (fromStep <= 2) { updated.barberoId = null; updated.barberoNombre = ""; updated.eligioBarbero = false; }
      if (fromStep <= 3) { updated.fecha = ""; updated.horaInicio = ""; updated.horaFin = ""; }
      return updated;
    });
  };

  const goBack = () => {
    if (step === 1 && orgData.sucursales.length === 1) {
      onBackToLanding();
    } else if (step > 0) {
      const newStep = step - 1;
      goToStep(newStep);
    } else {
      onBackToLanding();
    }
  };

  const stepLabel = STEP_LABELS[step] || STEP_LABELS[STEP_LABELS.length - 1];

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
      <div className="portal-success">
        <div className="text-center space-y-5 py-2">
          <div className="portal-success__mark">
            <Check className="h-8 w-8" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">¡Turno confirmado!</h2>
            <p className="text-sm text-muted-foreground">Te esperamos.</p>
          </div>

          <div className="portal-ticket portal-success__details space-y-3">
            <div className="portal-success__when"><p className="text-sm text-muted-foreground">{formatFechaLegible(booking.fecha)}</p><strong>{booking.horaInicio} <span className="text-base font-normal text-muted-foreground">- {booking.horaFin}</span></strong></div>
            <DetailRow icon={<MapPin className="h-4 w-4" />} value={booking.sucursalNombre} />
            <DetailRow icon={<Scissors className="h-4 w-4" />} value={booking.servicioNombre} />
            <DetailRow icon={<User className="h-4 w-4" />} value={booking.barberoNombre} />
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
    <div className={step < 5 ? "portal-flow" : "portal-flow portal-flow--final"}>
      <div ref={flowRef} className="portal-flow__main">
        <div className="portal-flow__progress">
          <div className="portal-flow__toolbar">
            <Button variant="ghost" size="sm" onClick={goBack} className="-ml-2 h-10 gap-1 text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Volver
            </Button>
            <span className="text-xs font-medium tabular-nums text-muted-foreground">Paso {Math.min(currentStep, totalSteps)} de {totalSteps}</span>
          </div>
          <Progress value={progress} className="portal-progress h-1" aria-label={`Progreso: paso ${currentStep} de ${totalSteps}`} />
        </div>
        {step < 5 && <div className="portal-ticket__mobile"><BookingSummary booking={booking} stepLabel={stepLabel} variant="chip" /></div>}
        <div key={step} className="portal-stage" data-direction={motionDirection}>
        {step === 0 && (
          <SucursalStep
            sucursales={orgData.sucursales}
            onSelect={(id, nombre) => {
              if (id !== booking.sucursalId) resetFieldsFromStep(1);
              setBooking((b) => ({ ...b, sucursalId: id, sucursalNombre: nombre }));
              goToStep(1);
            }}
          />
        )}
        {step === 1 && (
          <ServicioStep
            servicios={orgData.servicios.filter((s) => s.sucursal_id === booking.sucursalId)}
            onSelect={(id, nombre, precio) => {
              if (id !== booking.servicioId) resetFieldsFromStep(2);
              setBooking((b) => ({ ...b, servicioId: id, servicioNombre: nombre, servicioPrecio: precio }));
              goToStep(2);
            }}
          />
        )}
        {step === 2 && (
          <BarberoStep
            barberos={orgData.barberos.filter((b) => b.sucursal_id === booking.sucursalId)}
            onSelect={(id, nombre) => {
              if (id !== (booking.eligioBarbero ? booking.barberoId : null) || !booking.barberoNombre) {
                resetFieldsFromStep(3);
                setBooking((b) => ({ ...b, barberoId: id, barberoNombre: nombre || "Cualquiera disponible", eligioBarbero: id !== null }));
              }
              goToStep(3);
            }}
          />
        )}
        {step === 3 && (
          <FechaHorarioStep
            organizationId={orgData.organization.id}
            sucursalId={booking.sucursalId!}
            servicioId={booking.servicioId!}
            barberoId={booking.eligioBarbero ? booking.barberoId : null}
            initialFecha={booking.fecha}
            onSelect={(horaInicio, horaFin, fecha, barberoId, barberoNombre) => {
              setBooking((b) => ({
                ...b,
                horaInicio,
                horaFin,
                fecha,
                barberoId: barberoId || b.barberoId,
                barberoNombre: barberoNombre || b.barberoNombre,
              }));
              goToStep(4);
            }}
            onChangeBarbero={() => {
              goToStep(2);
            }}
          />
        )}
        </div>
        <div hidden={step !== 4} className="portal-stage" data-direction={motionDirection}>
          <DatosClienteStep
            organizationId={orgData.organization.id}
            initial={booking.cliente ?? undefined}
            onSubmit={(cliente) => {
              setBooking((b) => ({ ...b, cliente }));
              goToStep(5);
            }}
          />
        </div>
        {step === 5 && (
          <div className="portal-stage" data-direction={motionDirection}>
          <ConfirmacionStep
            booking={booking}
            orgData={orgData}
            onConfirmed={() => setConfirmed(true)}
            onSlotTaken={() => {
              resetFieldsFromStep(3);
              goToStep(3);
            }}
          />
          </div>
        )}
      </div>

      {step < 5 && <div className="portal-flow__aside"><BookingSummary booking={booking} stepLabel={stepLabel} /></div>}
    </div>
  );
};

const DetailRow = ({ icon, value }: { icon: React.ReactNode; value: string }) => (
  <div className="flex items-center gap-3">
    <span className="text-muted-foreground shrink-0">{icon}</span>
    <span className="text-sm text-foreground">{value}</span>
  </div>
);
