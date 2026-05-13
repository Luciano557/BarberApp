import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MailCheck, RefreshCw, ArrowLeft, Scissors, Loader2 } from 'lucide-react';

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState<string>('');
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<number | null>(null);

  // Resolver email sin depender de navigation state
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;

      // Si ya está verificado, ir al callback
      if (data.user?.email_confirmed_at) {
        navigate('/auth/callback', { replace: true });
        return;
      }

      const resolved =
        data.user?.email ||
        localStorage.getItem('pending_verification_email') ||
        searchParams.get('email') ||
        '';
      setEmail(resolved);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, searchParams]);

  // Suscripción: si se verifica desde otra pestaña, redirigir
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email_confirmed_at) {
        navigate('/auth/callback', { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    cooldownRef.current = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => {
      if (cooldownRef.current) window.clearTimeout(cooldownRef.current);
    };
  }, [cooldown]);

  const maskedEmail = useMemo(() => email || 'tu correo', [email]);

  const handleAlreadyVerified = async () => {
    setChecking(true);
    try {
      // Hasta 3 reintentos cada 2.5s
      for (let i = 0; i < 3; i++) {
        await supabase.auth.refreshSession();
        const { data } = await supabase.auth.getUser();
        if (data.user?.email_confirmed_at) {
          navigate('/auth/callback', { replace: true });
          return;
        }
        if (i < 2) await new Promise((r) => setTimeout(r, 2500));
      }
      toast.error('Todavía no detectamos la verificación. Probá nuevamente en unos segundos.');
    } catch (err) {
      console.error('VerifyEmail: handleAlreadyVerified error', err);
      toast.error('Ocurrió un error al verificar. Intentá nuevamente.');
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      toast.error('No pudimos detectar tu email. Volvé a registrarte.');
      return;
    }
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      toast.success('Email reenviado correctamente');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: any) {
      console.error('VerifyEmail: resend error', err);
      toast.error('No pudimos reenviar el email. Intentá nuevamente.', {
        description: err?.message,
      });
    } finally {
      setResending(false);
    }
  };

  const handleChangeEmail = () => {
    localStorage.removeItem('pending_verification_email');
    navigate('/login?mode=signup');
  };

  return (
    <div className="flex min-h-screen flex-col bg-white lg:flex-row">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-in { animation: fadeIn 0.4s ease both; }
        .icon-circle {
          width: 64px; height: 64px; border-radius: 999px;
          background: rgba(30,42,74,0.08);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 20px;
          animation: fadeIn 0.5s ease both;
        }
        .primary-btn {
          width: 100%; height: 44px;
          background: #1e2a4a; color: #fff;
          border: none; border-radius: 10px;
          font-size: 14px; font-weight: 500; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          transition: background 0.15s, opacity 0.15s;
        }
        .primary-btn:hover:not(:disabled) { background: #2a3a60; }
        .primary-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .secondary-btn {
          width: 100%; height: 42px;
          background: #fff; color: #1e2a4a;
          border: 1px solid #e2e8f0; border-radius: 10px;
          font-size: 13px; font-weight: 500; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          transition: border-color 0.15s, background 0.15s;
        }
        .secondary-btn:hover:not(:disabled) { background: #f8fafc; border-color: #cbd5e1; }
        .secondary-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .mail-link {
          flex: 1; height: 38px;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid #e2e8f0; border-radius: 8px;
          font-size: 13px; color: #475569; text-decoration: none;
          transition: background 0.15s, border-color 0.15s;
        }
        .mail-link:hover { background: #f8fafc; border-color: #cbd5e1; }
      `}</style>

      {/* Left panel — branding */}
      <div
        className="hidden lg:flex flex-col justify-between w-[480px] flex-shrink-0 p-10"
        style={{ background: '#1e2a4a' }}
      >
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
            <Scissors size={15} className="text-white" />
          </div>
          <span className="text-white font-semibold text-base">Vittro</span>
        </Link>

        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-white/70 text-xs mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Estás a un paso
          </div>
          <h2 className="text-3xl font-semibold text-white leading-tight mb-4 tracking-tight">
            Verificá tu email<br />y empezá a usar Vittro
          </h2>
          <p className="text-white/50 text-sm leading-relaxed">
            Una vez confirmes tu cuenta, vas a poder ingresar a tu panel y configurar tu barbería.
          </p>
        </div>

        <p className="text-white/30 text-xs">© {new Date().getFullYear()} Vittro</p>
      </div>

      {/* Right panel — content */}
      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:p-6">
        <div className="w-full max-w-sm animate-in text-center sm:max-w-md">
          <div className="icon-circle">
            <MailCheck size={28} style={{ color: '#1e2a4a' }} />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mb-2">
            Revisá tu email para verificar tu cuenta
          </h1>
          <p className="text-sm text-slate-500 mb-2">
            Enviamos un email a <span className="font-medium text-slate-700">{maskedEmail}</span>.
            Confirmalo para acceder a tu barbería.
          </p>
          <p className="text-xs text-slate-400 mb-6">
            Puede tardar unos segundos en llegar. Revisá la carpeta de spam o promociones.
          </p>

          <div className="space-y-3 mb-6">
            <button
              type="button"
              className="primary-btn"
              onClick={handleAlreadyVerified}
              disabled={checking}
            >
              {checking ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Verificando...
                </>
              ) : (
                'Ya verifiqué mi cuenta'
              )}
            </button>

            <button
              type="button"
              className="secondary-btn"
              onClick={handleResend}
              disabled={resending || cooldown > 0}
            >
              {resending ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Reenviando...
                </>
              ) : cooldown > 0 ? (
                `Reenviar en ${cooldown}s`
              ) : (
                <>
                  <RefreshCw size={14} /> Reenviar email
                </>
              )}
            </button>
          </div>

          <div className="border-t border-slate-100 pt-5 text-left">
            <p className="text-xs font-medium text-slate-600 mb-3">¿No recibiste el email?</p>
            <p className="text-xs text-slate-400 mb-3">
              Revisá tu carpeta de spam o promociones, o abrí tu correo directo:
            </p>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row">
              <a
                href="https://mail.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="mail-link"
              >
                Abrir Gmail
              </a>
              <a
                href="https://outlook.live.com/mail/"
                target="_blank"
                rel="noopener noreferrer"
                className="mail-link"
              >
                Abrir Outlook
              </a>
            </div>
            <button
              type="button"
              onClick={handleChangeEmail}
              className="text-xs text-slate-500 hover:text-slate-800 transition-colors inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} /> ¿Email equivocado? Cambialo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
