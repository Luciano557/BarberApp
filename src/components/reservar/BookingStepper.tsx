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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

const STEP_LABELS = ["Sucursal", "Servicio", "Barbero", "Fecha y Horario", "Datos", "Confirmar"];

interface Props {
  orgData: OrgPublicData;
  mode: "book" | "manage";
  onBackToLanding: () => void;
}

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

  // Check auth on mount
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

  // Auto-skip sucursal if only 1 (book mode)
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
        <RescheduleFlow
          turno={rescheduleTurno}
          onDone={() => setRescheduleTurno(null)}
          onBack={() => setRescheduleTurno(null)}
        />
      );
    }

    if (!manageAuthDone) {
      return (
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={onBackToLanding} className="w-full justify-start gap-1 sm:w-auto">
            <ChevronLeft className="h-4 w-4" /> Volver
          </Button>
          <AuthStep onAuthenticated={() => setManageAuthDone(true)} />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBackToLanding} className="w-full justify-start gap-1 sm:w-auto">
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
  // Steps: 0=Sucursal, 1=Servicio, 2=Barbero, 3=Fecha+Horario, 4=Auth(if needed), 5=Confirmar
  const totalSteps = isAuthenticated ? 5 : 6;
  const progress = ((step + 1) / totalSteps) * 100;

  const resetFieldsFromStep = (fromStep: number) => {
    setBooking((b) => {
      const updated = { ...b };
      if (fromStep <= 0) {
        updated.sucursalId = null;
        updated.sucursalNombre = "";
      }
      if (fromStep <= 1) {
        updated.servicioId = null;
        updated.servicioNombre = "";
        updated.servicioPrecio = 0;
      }
      if (fromStep <= 2) {
        updated.barberoId = null;
        updated.barberoNombre = "";
      }
      if (fromStep <= 3) {
        updated.fecha = "";
        updated.horaInicio = "";
        updated.horaFin = "";
      }
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
      <div className="text-center space-y-5 py-8 animate-in fade-in zoom-in-95 duration-300">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Check className="h-10 w-10 text-primary" />
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-foreground">¡Turno confirmado!</h2>
          <p className="text-muted-foreground">Te esperamos</p>
        </div>

        <Card className="text-left">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-foreground">{booking.sucursalNombre}</span>
            </div>
            <div className="flex items-center gap-3">
              <Scissors className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-foreground">{booking.servicioNombre}</span>
            </div>
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-foreground">{booking.barberoNombre}</span>
            </div>
            <div className="flex items-center gap-3">
              <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-foreground">{formatFechaLegible(booking.fecha)}</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-foreground">{booking.horaInicio} - {booking.horaFin}</span>
            </div>
          </CardContent>
        </Card>

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
    );
  }

  return (
    <div className="space-y-4">
      <Progress value={progress} className="h-2" />

      <div className="flex flex-wrap gap-2">
        {booking.sucursalNombre && step > 0 && <Badge variant="secondary">{booking.sucursalNombre}</Badge>}
        {booking.servicioNombre && step > 1 && <Badge variant="secondary">{booking.servicioNombre}</Badge>}
        {booking.barberoNombre && step > 2 && <Badge variant="secondary">{booking.barberoNombre}</Badge>}
        {booking.fecha && step > 3 && <Badge variant="secondary">{formatFechaLegible(booking.fecha)}</Badge>}
        {booking.horaInicio && step > 3 && <Badge variant="secondary">{booking.horaInicio}</Badge>}
      </div>

      <Button variant="ghost" size="sm" onClick={goBack} className="w-full justify-start gap-1 sm:w-auto">
        <ChevronLeft className="h-4 w-4" /> Volver
      </Button>

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
  );
};
