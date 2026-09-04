import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AdminLoginProps {
  onSignIn: (username: string, password: string) => Promise<void>;
  isSubmitting?: boolean;
  error?: string | null;
}

export default function AdminLogin({ onSignIn, isSubmitting = false, error }: AdminLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setLocalError('Completá usuario y contraseña.');
      return;
    }

    setLocalError(null);
    try {
      await onSignIn(username.trim(), password);
    } catch {
      // El contexto entrega un error genérico; nunca se muestra información de Auth.
    }
  };

  const visibleError = localError ?? error;

  return (
    <main className="grid min-h-[100svh] place-items-center bg-muted/45 px-4 py-8 sm:px-6">
      <section className="grid w-full max-w-3xl overflow-clip rounded-container border bg-card shadow-sm md:grid-cols-[0.8fr_1.2fr]">
        <div className="flex flex-col justify-between bg-primary p-7 text-primary-foreground sm:p-8">
          <div>
            <img src="/LogotipoBlanco.png" alt="Vittro" className="h-12 w-auto object-contain object-left" />
            <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 px-3 py-1.5 text-xs font-medium text-primary-foreground/80">
              <ShieldCheck className="h-3.5 w-3.5" />
              Operación interna
            </div>
          </div>
          <div className="mt-12">
            <h1 className="text-2xl font-semibold tracking-tight">Centro de administración</h1>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-primary-foreground/70">
              Control global de barberías, suscripciones, cobros y cambios auditados de precio.
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-8 md:p-10">
          <div className="mb-7">
            <div className="mb-4 grid h-10 w-10 place-items-center rounded-tile bg-primary/10 text-primary md:hidden">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Acceso protegido</p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">Ingresá a la consola</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Esta sesión es independiente de la cuenta de tu barbería y se cierra tras 30 minutos de inactividad.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="admin-username">Usuario</Label>
              <div className="relative">
                <UserRound aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="admin-username"
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="pl-9"
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password">Contraseña</Label>
              <div className="relative">
                <KeyRound aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="admin-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="px-9"
                  disabled={isSubmitting}
                  required
                  aria-describedby={visibleError ? 'admin-login-error' : undefined}
                  aria-invalid={Boolean(visibleError)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  disabled={isSubmitting}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {visibleError && (
              <p id="admin-login-error" role="alert" className="rounded-lg border border-status-error bg-status-error-bg px-3 py-2.5 text-sm text-status-error-foreground">
                {visibleError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
              {isSubmitting ? 'Verificando…' : 'Ingresar'}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
            El acceso y cada modificación quedan registrados en la auditoría administrativa.
          </p>
        </div>
      </section>
    </main>
  );
}
