import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
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

interface Props {
  onAuthenticated: () => void;
}

const COUNTRIES = [
  { code: "AR", name: "Argentina", dial: "+54", placeholder: "11 5555 5555" },
  { code: "UY", name: "Uruguay", dial: "+598", placeholder: "9 123 4567" },
  { code: "CL", name: "Chile", dial: "+56", placeholder: "9 1234 5678" },
  { code: "PY", name: "Paraguay", dial: "+595", placeholder: "961 123456" },
  { code: "BR", name: "Brasil", dial: "+55", placeholder: "11 91234 5678" },
  { code: "MX", name: "México", dial: "+52", placeholder: "55 1234 5678" },
  { code: "CO", name: "Colombia", dial: "+57", placeholder: "300 1234567" },
  { code: "PE", name: "Perú", dial: "+51", placeholder: "987 654 321" },
  { code: "ES", name: "España", dial: "+34", placeholder: "612 34 56 78" },
  { code: "US", name: "Estados Unidos", dial: "+1", placeholder: "555 123 4567" },
];

export const AuthStep = ({ onAuthenticated }: Props) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [countryCode, setCountryCode] = useState("AR");
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    phoneLocal: "",
    birthDate: "",
    email: "",
    password: "",
  });

  const country = useMemo(
    () => COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0],
    [countryCode],
  );

  const update = (field: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handlePhoneChange = (value: string) => {
    const cleaned = value.replace(/[^\d\s-]/g, "");
    update("phoneLocal", cleaned);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLogin) {
      const emailLogin = form.email.trim();
      if (!emailLogin) {
        toast.error("Ingresá tu email");
        return;
      }
      if (!form.password) {
        toast.error("Ingresá tu contraseña");
        return;
      }
      setLoading(true);
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailLogin,
          password: form.password,
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        onAuthenticated();
      } catch {
        toast.error("Ocurrió un problema. Probá nuevamente.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // === REGISTER ===
    const nombre = form.nombre.trim();
    const apellido = form.apellido.trim();
    const phoneDigits = form.phoneLocal.replace(/[\s-]/g, "");
    const email = form.email.trim();
    

    // Validate BEFORE setting loading
    if (!nombre) return toast.error("Ingresá tu nombre");
    if (!apellido) return toast.error("Ingresá tu apellido");
    if (!phoneDigits || phoneDigits.length < 6) return toast.error("Ingresá un teléfono válido");
    if (!form.birthDate) return toast.error("Ingresá tu fecha de nacimiento");
    if (!email) return toast.error("Ingresá tu email");
    if (!form.password || form.password.length < 6)
      return toast.error("La contraseña debe tener al menos 6 caracteres");

    const phone = `${country.dial}${phoneDigits}`;
    const fullName = `${nombre} ${apellido}`.trim();

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          data: {
            account_type: "customer",
            nombre,
            apellido,
            full_name: fullName,
            phone,
            phone_country: country.code,
            birth_date: form.birthDate,
          },
          emailRedirectTo: window.location.href,
        },
      });

      if (error) {
        toast.error(error.message || "Error al crear la cuenta. Intentá de nuevo.");
        return;
      }
      if (!data.user) {
        toast.error("No pudimos crear tu cuenta. Intentá nuevamente.");
        return;
      }
      if (data.session) {
        onAuthenticated();
        return;
      }
      // TODO: re-enable email verification (temporal: forzamos sign-in inmediato)
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password: form.password,
      });
      if (signInErr) {
        toast.error("No pudimos iniciar sesión. Intentá de nuevo.");
        return;
      }
      onAuthenticated();
    } catch (err) {
      console.error("Signup error:", err);
      toast.error("Ocurrió un error inesperado. Probá nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">
        {isLogin ? "Iniciá sesión" : "Creá tu cuenta"}
      </h2>
      <p className="text-sm text-muted-foreground">
        {isLogin
          ? "Ingresá con tu email y contraseña"
          : "Completá tus datos para reservar el turno."}
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        {!isLogin && (
          <>
            <div className="space-y-1">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                className="h-12 text-base"
                value={form.nombre}
                onChange={(e) => update("nombre", e.target.value)}
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
                value={form.apellido}
                onChange={(e) => update("apellido", e.target.value)}
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
                  value={form.phoneLocal}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder={country.placeholder}
                  autoComplete="tel-national"
                  maxLength={20}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="birthDate">Fecha de nacimiento *</Label>
              <Input
                id="birthDate"
                type="date"
                className="h-12 text-base"
                value={form.birthDate}
                onChange={(e) => update("birthDate", e.target.value)}
                autoComplete="bday"
                required
              />
            </div>

          </>
        )}

        <div className="space-y-1">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            className="h-12 text-base"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="tu@email.com"
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="password">Contraseña *</Label>
          <Input
            id="password"
            type="password"
            className="h-12 text-base"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            placeholder="••••••••"
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
            minLength={6}
          />
        </div>

        <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
          {loading
            ? "Procesando..."
            : isLogin
              ? "Iniciar sesión"
              : "Crear cuenta y continuar"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setIsLogin(!isLogin)}
        className="text-sm text-primary hover:underline w-full text-center"
      >
        {isLogin ? "No tengo cuenta → Crear una" : "Ya tengo cuenta → Iniciar sesión"}
      </button>
    </div>
  );
};
