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

interface Props {
  onLookup: (telefono: string) => void;
}

export const LookupTelefonoStep = ({ onLookup }: Props) => {
  const [countryCode, setCountryCode] = useState("AR");
  const [phoneLocal, setPhoneLocal] = useState("");

  const country = useMemo(
    () => COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0],
    [countryCode],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phoneLocal.replace(/\D/g, "");
    if (!digits || digits.length < 6) {
      toast.error("Ingresá un teléfono válido");
      return;
    }
    onLookup(buildPhone(country.dial, digits));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Buscar mis turnos</h2>
        <p className="text-sm text-muted-foreground">
          Ingresá el teléfono con el que reservaste.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="lookup-phone">Teléfono</Label>
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
              id="lookup-phone"
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

        <Button type="submit" className="w-full h-12 text-base">
          Buscar mis turnos
        </Button>
      </form>
    </div>
  );
};
