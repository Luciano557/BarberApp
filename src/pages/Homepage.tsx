import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Scissors,
  Calendar,
  TrendingUp,
  Users,
  BarChart3,
  Check,
  ArrowRight,
  AlertCircle,
  HelpCircle,
  Eye,
} from 'lucide-react';

export default function Homepage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Scissors className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold tracking-tight text-foreground">Vittro</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Iniciar sesión
              </Button>
            </Link>
            <Link to="/login?mode=signup" className="hidden sm:block">
              <Button size="sm">Registrar mi barbería</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 0%, hsl(var(--color-100)) 0%, hsl(var(--background)) 70%)',
          }}
        />
        <div className="container mx-auto px-4 sm:px-6 py-16 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-6">
              Sistema de gestión para barberías
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground leading-[1.1]">
              Sabé exactamente cuánto gana tu barbería
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground leading-relaxed">
              Vittro reúne turnos, ingresos y rendimiento de cada barbero en un solo lugar.
              Sin planillas, sin estimaciones, sin perder de vista la plata.
            </p>

            {/* Question pills */}
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {[
                '¿Cuánto ganaste realmente esta semana?',
                '¿Qué barbero te genera más ingresos?',
                '¿Cuál es tu servicio más rentable?',
              ].map((q) => (
                <span
                  key={q}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs sm:text-sm text-muted-foreground shadow-sm"
                >
                  <HelpCircle className="h-3.5 w-3.5 text-primary" />
                  {q}
                </span>
              ))}
            </div>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/login?mode=signup" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto gap-2">
                  Registrar mi barbería
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Iniciar sesión
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Empezás gratis. Sin tarjeta de crédito.
            </p>
          </div>
        </div>
      </section>

      {/* Problema → Solución */}
      <section className="border-t border-border bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
              Si manejás la barbería a ojo, estás perdiendo plata
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Estos son los problemas reales que vemos todos los días
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            {[
              {
                title: 'Turnos desordenados',
                desc: 'Mensajes por WhatsApp, agenda en papel, dobles reservas y clientes que se enojan.',
              },
              {
                title: 'No sabés cuánto ganás',
                desc: 'Cierres de caja a mano, números aproximados y la sensación de que algo no cierra.',
              },
              {
                title: 'Sin control del equipo',
                desc: 'No tenés idea de qué barbero rinde más, ni cuánto le corresponde a cada uno.',
              },
            ].map((p) => (
              <Card key={p.title} className="border-border/60">
                <CardContent className="p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 mb-4">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{p.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-primary/20 bg-card">
            <CardContent className="p-8 text-center">
              <Badge className="mb-4">Vittro</Badge>
              <h3 className="text-2xl sm:text-3xl font-semibold text-foreground">
                Una sola herramienta para ordenar todo
              </h3>
              <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
                Agenda online, registro de cobros, cierre de caja, rendimiento por barbero y
                estadísticas reales. Todo conectado, sin Excel.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Funcionalidades */}
      <section className="border-t border-border">
        <div className="container mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
              Todo lo que necesitás para operar tu barbería
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: Calendar,
                title: 'Gestión de turnos',
                desc: 'Agenda online para tus clientes y vista clara para el equipo.',
              },
              {
                icon: TrendingUp,
                title: 'Control de finanzas',
                desc: 'Ingresos, egresos, deudas e inversiones. Rentabilidad real.',
              },
              {
                icon: Users,
                title: 'Gestión de barberos',
                desc: 'Comisiones, sueldos fijos, bonos y desempeño por persona.',
              },
              {
                icon: BarChart3,
                title: 'Trazabilidad y stats',
                desc: 'Historial de cortes, servicios más vendidos y métricas claras.',
              },
            ].map((f) => (
              <Card key={f.title} className="border-border/60 hover:border-primary/40 transition-colors">
                <CardContent className="p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-4">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Valor diferencial */}
      <section className="border-t border-border bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="secondary" className="mb-4">Por qué Vittro</Badge>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
                No es solo una agenda. Es entender tu negocio.
              </h2>
              <p className="mt-4 text-muted-foreground text-lg">
                La mayoría de las apps te dejan tomar turnos y nada más. Vittro te muestra los
                números detrás de cada corte para que decidas con datos, no con intuición.
              </p>
            </div>
            <div className="space-y-4">
              {[
                {
                  title: 'No es solo una agenda',
                  desc: 'Cada turno se conecta con la caja, el barbero y las estadísticas.',
                },
                {
                  title: 'Entendé tu negocio',
                  desc: 'Sabé qué servicios rinden, qué días facturás más y dónde se va la plata.',
                },
                {
                  title: 'Decidí con datos reales',
                  desc: 'Ajustá precios, comisiones y horarios sobre información concreta.',
                },
              ].map((v) => (
                <div key={v.title} className="flex gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-4 w-4" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{v.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{v.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Planes */}
      <section className="border-t border-border">
        <div className="container mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
              Registrá tu barbería en minutos
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Empezá gratis. Cuando crezcas, escalás de plan.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {[
              {
                name: 'Free',
                price: 'Gratis',
                desc: 'Para arrancar y probar el sistema.',
                features: ['1 sucursal', 'Hasta 3 barberos', 'Agenda online', 'Cierre de caja diario'],
                highlighted: false,
              },
              {
                name: 'Basic',
                price: 'Pago mensual',
                desc: 'Para barberías en crecimiento.',
                features: ['1 sucursal', 'Más barberos y servicios', 'Estadísticas avanzadas', 'Reportes exportables'],
                highlighted: true,
              },
              {
                name: 'Premium',
                price: 'Pago mensual',
                desc: 'Para múltiples sucursales.',
                features: ['Múltiples sucursales', 'Barberos ilimitados', 'Encargados por sede', 'Soporte prioritario'],
                highlighted: false,
              },
            ].map((plan) => (
              <Card
                key={plan.name}
                className={
                  plan.highlighted
                    ? 'border-primary shadow-lg relative'
                    : 'border-border/60'
                }
              >
                {plan.highlighted && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Recomendado</Badge>
                )}
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg text-foreground">{plan.name}</h3>
                  <p className="text-2xl font-semibold text-foreground mt-2">{plan.price}</p>
                  <p className="text-sm text-muted-foreground mt-2 mb-6">{plan.desc}</p>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                        <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/login?mode=signup" className="block">
                    <Button
                      className="w-full"
                      variant={plan.highlighted ? 'default' : 'outline'}
                    >
                      Registrar mi barbería
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="border-t border-border bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <Eye className="h-10 w-10 mx-auto mb-6 opacity-80" />
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight">
            Empezá a tener control real de tu barbería hoy
          </h2>
          <p className="mt-4 text-lg opacity-90 max-w-xl mx-auto">
            Creá tu cuenta gratis y ordená tu negocio en menos de 5 minutos.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/login?mode=signup">
              <Button size="lg" variant="secondary" className="gap-2">
                Crear cuenta
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button
                size="lg"
                variant="ghost"
                className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                Iniciar sesión
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="container mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <Scissors className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">Vittro</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Vittro · Sistema de gestión para barberías
          </p>
        </div>
      </footer>
    </div>
  );
}
