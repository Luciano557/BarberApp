import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PARTNER_TERMS_VERSION } from '../../supabase/functions/_shared/partner-domain';

export default function Partners() {
  return (
    <div className="min-h-[100svh] bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
          <Link to="/" aria-label="Vittro, inicio">
            <img src="/MagotipoAzul.png" alt="Vittro" className="h-9 w-auto" />
          </Link>
          <Button variant="ghost" asChild>
            <Link to="/aliados/panel">
              Mi código <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-12 sm:py-20">
        <Link
          to="/"
          className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Vittro
        </Link>
        <section className="grid items-start gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Tu recomendación hace crecer a las barberías.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Con el Programa de aliados Vittro, tu comunidad obtiene un descuento y vos recibís una
              comisión por cada barbería que empieza a pagar.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/aliados/panel?mode=register">
                  Soy creador <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/aliados/panel">Ya uso Vittro</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Podés empezar sin conectar Instagram. Disponible para aliados de Argentina.
            </p>
          </div>
          <div className="rounded-container border">
            <div className="border-b p-6">
              <h2 className="text-lg font-medium">
                Una recomendación. Un beneficio para cada uno.
              </h2>
            </div>
            <dl className="divide-y">
              <div className="p-6">
                <dt className="text-sm text-muted-foreground">Para la barbería</dt>
                <dd className="mt-2 text-3xl font-semibold tabular-nums">10% de descuento</dd>
                <p className="mt-2 text-sm text-muted-foreground">
                  En el primer mes pagado, después de sus 15 días de prueba.
                </p>
              </div>
              <div className="p-6">
                <dt className="text-sm text-muted-foreground">Para vos</dt>
                <dd className="mt-2 text-3xl font-semibold tabular-nums">Del 10% al 30%</dd>
                <p className="mt-2 text-sm text-muted-foreground">
                  Del primer pago después del descuento. Los convenios personalizados pueden llegar
                  al 100%.
                </p>
              </div>
            </dl>
          </div>
        </section>
        <section className="mt-16 border-t pt-10">
          <h2 className="text-2xl font-semibold">Tu código crece con vos</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Contamos cada barbería que pagó dos meses distintos una sola vez. El progreso es
            acumulativo. También podés alcanzar un nivel por tu audiencia verificada en Instagram.
          </p>
          <div className="mt-6 divide-y border-y">
            {[
              [10, 'Al crear tu código', 'No necesitás una audiencia mínima.'],
              [
                20,
                '5 barberías o 10.000 seguidores',
                'Barberías con dos meses pagados o seguidores verificados.',
              ],
              [30, '20 barberías o 50.000 seguidores', 'El mayor nivel del programa automático.'],
            ].map(([percent, title, text]) => (
              <div key={percent} className="grid gap-2 py-5 sm:grid-cols-[5rem_1fr_1fr]">
                <p className="text-2xl font-semibold tabular-nums">{percent}%</p>
                <h3 className="text-base font-medium">{title}</h3>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>
        <section id="condiciones" className="mt-12 max-w-3xl scroll-mt-6">
          <h2 className="text-2xl font-semibold">Condiciones del programa</h2>
          <ul className="mt-5 list-disc space-y-3 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>
              El código se incorpora únicamente al registrar una barbería nueva. No se aplica a
              altas anteriores ni a tu propia barbería.
            </li>
            <li>
              El descuento es del 10% en la primera mensualidad pagada. Las siguientes se cobran al
              precio vigente del plan.
            </li>
            <li>
              Tu porcentaje se fija al crear el primer checkout y se calcula sobre ese primer pago
              después del descuento, antes de los costos del procesador. No es una comisión
              recurrente.
            </li>
            <li>
              La comisión queda disponible 30 días después del cobro, si no hay devolución,
              contracargo o incidencia pendiente. Las devoluciones posteriores se ajustan en el
              saldo.
            </li>
            <li>
              Los pagos son mensuales, revisados por Vittro y en pesos argentinos a una cuenta de
              titularidad comprobada.
            </li>
            <li>
              Instagram es opcional y requiere verificación oficial vigente para mejorar tu nivel
              por seguidores. El progreso por barberías se conserva salvo fraude o reversión de
              pagos.
            </li>
            <li>
              Los convenios personalizados requieren aprobación de Vittro, con porcentaje y vigencia
              propios.
            </li>
          </ul>
          <p className="mt-5 text-xs text-muted-foreground">Versión {PARTNER_TERMS_VERSION}</p>
        </section>
      </main>
    </div>
  );
}
