import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  onAuthenticated: () => void;
}

export const AuthStep = ({ onAuthenticated }: Props) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [waitingForSession, setWaitingForSession] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    birthDate: "",
    password: "",
  });

  // Listen for auth state changes to detect session after signUp
  useEffect(() => {
    if (!waitingForSession) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setWaitingForSession(false);
        setLoading(false);
        onAuthenticated();
      }
    });

    return () => subscription.unsubscribe();
  }, [waitingForSession, onAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (error) {
          toast.error(error.message);
          setLoading(false);
          return;
        }
        onAuthenticated();
      } else {
        if (!form.fullName || !form.email || !form.password) {
          toast.error("Completá todos los campos obligatorios");
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: {
              full_name: form.fullName,
              phone: form.phone,
              birth_date: form.birthDate,
            },
            emailRedirectTo: window.location.href,
          },
        });
        if (error) {
          toast.error(error.message);
          setLoading(false);
          return;
        }

        // If session is returned immediately (email confirmation disabled), proceed
        if (data.session) {
          onAuthenticated();
          return;
        }

        // Otherwise wait for the auth state change to fire with a session
        setWaitingForSession(true);
        toast.success("¡Cuenta creada! Revisá tu email para verificar.");
      }
    } catch {
      toast.error("Ocurrió un problema. Probá nuevamente.");
      setLoading(false);
    }
  };

  const update = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

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
              <Label htmlFor="fullName">Nombre completo *</Label>
              <Input
                id="fullName"
                className="h-12 text-base"
                value={form.fullName}
                onChange={(e) => update("fullName", e.target.value)}
                placeholder="Tu nombre"
                autoComplete="name"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                className="h-12 text-base"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="+54 11 1234-5678"
                autoComplete="tel"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="birthDate">Fecha de nacimiento</Label>
              <Input
                id="birthDate"
                type="date"
                className="h-12 text-base"
                value={form.birthDate}
                onChange={(e) => update("birthDate", e.target.value)}
                autoComplete="bday"
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
            ? waitingForSession
              ? "Verificando..."
              : "Procesando..."
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
