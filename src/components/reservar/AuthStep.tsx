import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  onAuthenticated: () => void;
}

export const AuthStep = ({ onAuthenticated }: Props) => {
  const [isLogin, setIsLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    birthDate: "",
    password: "",
  });

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
          return;
        }
        onAuthenticated();
      } else {
        if (!form.fullName || !form.email || !form.password) {
          toast.error("Completá todos los campos obligatorios");
          return;
        }
        const { error } = await supabase.auth.signUp({
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
          return;
        }
        toast.success("¡Cuenta creada! Revisá tu email para verificar.");
        onAuthenticated();
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
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
          : "Necesitamos algunos datos para confirmar tu turno"}
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        {!isLogin && (
          <>
            <div className="space-y-1">
              <Label htmlFor="fullName">Nombre completo *</Label>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(e) => update("fullName", e.target.value)}
                placeholder="Tu nombre"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="+54 11 1234-5678"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="birthDate">Fecha de nacimiento</Label>
              <Input
                id="birthDate"
                type="date"
                value={form.birthDate}
                onChange={(e) => update("birthDate", e.target.value)}
              />
            </div>
          </>
        )}

        <div className="space-y-1">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="tu@email.com"
            required
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="password">Contraseña *</Label>
          <Input
            id="password"
            type="password"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Procesando..." : isLogin ? "Iniciar sesión" : "Crear cuenta"}
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
