import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { feedback } from "@/lib/feedback";
import { ReadCancelledError } from "@/lib/readRetry";
import { COUNTRIES, buildPhone } from "./lib/phone";
import { readPortalFunction } from "./lib/portalRequests";
import { UserCheck, Search } from "lucide-react";

export interface ClienteData {
  nombre: string;
  apellido: string;
  telefono: string;
  phone_country: string;
  email: string | null;
  birth_date: string | null;
}
interface Props {
  organizationId: string;
  initial?: Partial<ClienteData>;
  onSubmit: (cliente: ClienteData) => void;
}
interface LookupResult { found: boolean; cliente?: Omit<ClienteData, 'phone_country'> }

export const DatosClienteStep = ({ organizationId, initial, onSubmit }: Props) => {
  const [stage, setStage] = useState<'lookup' | 'matched' | 'register'>(initial?.nombre ? 'register' : 'lookup');
  const [countryCode, setCountryCode] = useState(initial?.phone_country || "AR");
  const [nombre, setNombre] = useState(initial?.nombre || "");
  const [apellido, setApellido] = useState(initial?.apellido || "");
  const [phoneLocal, setPhoneLocal] = useState(() => {
    const phone = initial?.telefono || '';
    if ((initial?.phone_country || 'AR') === 'AR') return phone.replace(/^\+549?/, '');
    const dial = COUNTRIES.find(c => c.code === initial?.phone_country)?.dial || '';
    return phone.startsWith(dial) ? phone.slice(dial.length) : phone;
  });
  const [email, setEmail] = useState(initial?.email || "");
  const [birthDate, setBirthDate] = useState(initial?.birth_date || "");
  const [matched, setMatched] = useState<ClienteData | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState(false);
  const lookupController = useRef<AbortController | null>(null);
  const country = useMemo(() => COUNTRIES.find(c => c.code === countryCode) ?? COUNTRIES[0], [countryCode]);
  useEffect(() => () => lookupController.current?.abort(), []);

  const cancelLookup = () => {
    lookupController.current?.abort();
    lookupController.current = null;
    setLookupLoading(false);
    setLookupError(false);
  };
  const handleLookup = async (event: React.FormEvent) => {
    event.preventDefault();
    const phone = buildPhone(country.dial, phoneLocal);
    if (!phone) return feedback.error(country.code === 'AR' ? 'Teléfono inválido. Ejemplo: 11 2516-2528.' : 'Ingresá un teléfono válido.');
    cancelLookup();
    const controller = new AbortController();
    lookupController.current = controller;
    setLookupLoading(true);
    try {
      const result = await readPortalFunction<LookupResult>('lookup-cliente-by-phone', {
        organization_id: organizationId, telefono: phone,
      }, controller.signal);
      if (controller.signal.aborted) return;
      if (result.found && result.cliente) {
        setMatched({ ...result.cliente, telefono: result.cliente.telefono || phone, phone_country: countryCode });
        setStage('matched');
      } else {
        setStage('register');
      }
    } catch (error) {
      if (!controller.signal.aborted && !(error instanceof ReadCancelledError)) setLookupError(true);
    } finally {
      if (lookupController.current === controller) setLookupLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = nombre.trim();
    const a = apellido.trim();
    const mail = email.trim();

    if (!n) return feedback.error("Ingresá tu nombre");
    if (!a) return feedback.error("Ingresá tu apellido");
    const fullPhone = buildPhone(country.dial, phoneLocal);
    if (!fullPhone) {
      return feedback.error(
        country.code === "AR"
          ? "Teléfono inválido. Ejemplo: 11 2516-2528."
          : "Ingresá un teléfono válido.",
      );
    }
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return feedback.error("Ingresá un email válido");

    onSubmit({
      nombre: n,
      apellido: a,
      telefono: fullPhone,
      phone_country: country.code,
      email: mail ? mail.toLowerCase() : null,
      birth_date: birthDate || null,
    });
  };


  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">Tus datos</h2>
        <p className="text-sm text-muted-foreground">
          {stage === 'register' ? 'Completá tus datos para reservar.' : 'Ingresá tu teléfono para buscar tus datos.'}
        </p>
      </div>

      {stage === 'lookup' && (
        <form onSubmit={handleLookup} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="booking-lookup-phone">Teléfono para buscar tus datos</Label>
            <div className="flex gap-2">
              <Select value={countryCode} onValueChange={value => { cancelLookup(); setCountryCode(value); }}>
                <SelectTrigger aria-label="Código de país para buscar tus datos" className="h-12 w-24 shrink-0 text-base">
                  <SelectValue>{country.dial}</SelectValue>
                </SelectTrigger>
                <SelectContent>{COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name} ({c.dial})</SelectItem>)}</SelectContent>
              </Select>
              <Input id="booking-lookup-phone" type="tel" inputMode="tel" className="h-12 min-w-0 flex-1 text-base"
                value={phoneLocal} onChange={event => { cancelLookup(); setPhoneLocal(event.target.value.replace(/[^\d\s-]/g, '')); }}
                placeholder={country.placeholder} autoComplete="tel-national" maxLength={20} />
            </div>
          </div>
          {lookupError && <p role="alert" className="text-sm text-destructive">No pudimos buscar tus datos. Reintentá o completalos abajo.</p>}
          <Button type="submit" className="h-12 w-full gap-2" disabled={lookupLoading}>
            <Search className="h-4 w-4" />{lookupLoading ? 'Buscando...' : lookupError ? 'Reintentar búsqueda' : 'Buscar mis datos'}
          </Button>
          <Button type="button" variant="ghost" className="h-12 w-full" onClick={() => { cancelLookup(); setStage('register'); }}>
            Completar mis datos
          </Button>
        </form>
      )}

      {stage === 'matched' && matched && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-4">
            <UserCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Encontramos tus datos</p>
              <p className="break-words text-base font-medium">{matched.nombre} {matched.apellido}</p>
            </div>
          </div>
          <Button className="h-12 w-full" onClick={() => onSubmit(matched)}>Sí, soy yo. Continuar</Button>
          <Button variant="ghost" className="h-12 w-full" onClick={() => { setMatched(null); setStage('lookup'); }}>No soy yo</Button>
        </div>
      )}

      {stage === 'register' && <>
        <Button type="button" variant="ghost" className="-ml-2 h-10" onClick={() => setStage('lookup')}>Volver a buscar por teléfono</Button>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-4">
          <div className="space-y-1">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              className="h-12 text-base"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tu nombre"
              autoComplete="given-name"
              maxLength={80}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="apellido">Apellido *</Label>
            <Input
              id="apellido"
              className="h-12 text-base"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              placeholder="Tu apellido"
              autoComplete="family-name"
              maxLength={80}
              required
            />
          </div>
        </div>

        <div className="min-w-0 space-y-1">
          <Label htmlFor="phone">Teléfono *</Label>
          <div className="flex gap-2">
            <Select value={countryCode} onValueChange={setCountryCode}>
              <SelectTrigger aria-label="Código de país del teléfono" className="h-12 w-24 shrink-0 text-base">
                <SelectValue>{country.dial}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name} ({c.dial})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              className="h-12 min-w-0 flex-1 text-base"
              value={phoneLocal}
              onChange={(e) => setPhoneLocal(e.target.value.replace(/[^\d\s-]/g, ""))}
              placeholder={country.placeholder}
              autoComplete="tel-national"
              maxLength={20}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-4">
          <div className="min-w-0 space-y-1">
            <Label htmlFor="email">Email (opcional)</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              className="h-12 text-base"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              autoComplete="email"
              maxLength={120}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="birthDate">Fecha de nacimiento (opcional)</Label>
            <Input
              id="birthDate"
              type="date"
              className="h-12 text-base"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              autoComplete="bday"
            />
          </div>
        </div>

        <Button type="submit" className="mt-2 h-12 w-full text-base">
          Continuar
        </Button>
      </form>
      </>}
    </div>
  );
};
