import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { COUNTRIES, buildPhone } from "./lib/phone";

export interface ClienteData {
  nombre: string;
  apellido: string;
  telefono: string; // already normalized like +54..
  phone_country: string;
  email: string | null;
  birth_date: string | null;
}

interface Props {
  initial?: Partial<ClienteData>;
  onSubmit: (cliente: ClienteData) => void;
}

export const DatosClienteStep = ({ initial, onSubmit }: Props) => {
  const [countryCode, setCountryCode] = useState(initial?.phone_country || "AR");
  const [nombre, setNombre] = useState(initial?.nombre || "");
  const [apellido, setApellido] = useState(initial?.apellido || "");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [email, setEmail] = useState(initial?.email || "");
  const [birthDate, setBirthDate] = useState(initial?.birth_date || "");

  const country = useMemo(
    () => COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0],
    [countryCode],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = nombre.trim();
    const a = apellido.trim();
    const phoneDigits = phoneLocal.replace(/[\s-]/g, "").replace(/\D/g, "");
    const mail = email.trim();

    if (!n) return toast.error("Ingresá tu nombre");
    if (!a) return toast.error("Ingresá tu apellido");
    if (!phoneDigits || phoneDigits.length < 6) return toast.error("Ingresá un teléfono válido");
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return toast.error("Ingresá un email válido");

    onSubmit({
      nombre: n,
      apellido: a,
      telefono: buildPhone(country.dial, phoneDigits),
      phone_country: country.code,
      email: mail ? mail.toLowerCase() : null,
      birth_date: birthDate || null,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Tus datos</h2>
        <p className="text-sm text-muted-foreground">
          Completá tus datos para reservar el turno.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
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

        <div className="space-y-1">
          <Label htmlFor="phone">Teléfono *</Label>
          <div className="flex gap-2">
            <Select value={countryCode} onValueChange={setCountryCode}>
              <SelectTrigger className="h-12 w-[110px] text-base">
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
              className="h-12 text-base flex-1"
              value={phoneLocal}
              onChange={(e) => setPhoneLocal(e.target.value.replace(/[^\d\s-]/g, ""))}
              placeholder={country.placeholder}
              autoComplete="tel-national"
              maxLength={20}
              required
            />
          </div>
        </div>

        <div className="space-y-1">
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

        <Button type="submit" className="w-full h-12 text-base">
          Continuar
        </Button>
      </form>
    </div>
  );
};
