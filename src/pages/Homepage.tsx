import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Scissors, ArrowRight, Check, ChevronRight,
  BarChart3, Calendar, Users, TrendingUp,
  CreditCard, Banknote, Star, Zap
} from 'lucide-react';

// ─── Scroll reveal hook ───────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.unobserve(el); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Dashboard preview screens ────────────────────────────────────────────────
const screens = {
  caja: {
    label: 'Cierre de Caja',
    url: 'app.vittro.com/caja',
    content: (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-1">
          {[
            { label: 'Total General', val: '$358.500', cls: '' },
            { label: 'Efectivo', val: '$173.000', cls: 'text-emerald-600' },
            { label: 'Mercado Pago', val: '$185.500', cls: 'text-slate-400' },
            { label: 'Servicios', val: '19', cls: '' },
          ].map(m => (
            <div key={m.label} className="bg-white border border-slate-100 rounded-lg p-2.5">
              <p className="text-[9px] text-slate-400 mb-1">{m.label}</p>
              <p className={`text-sm font-semibold ${m.cls}`}>{m.val}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] font-medium text-slate-500 flex items-center gap-1.5">
          <Users size={10} /> Cierre por Barbero
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { init: 'S', name: 'Sebastian Tello', svcs: 10, total: '$183.500', com: '$91.750' },
            { init: 'T', name: 'Luciano Garcia', svcs: 9, total: '$175.000', com: '$87.500' },
          ].map(b => (
            <div key={b.name} className="bg-white border border-slate-100 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-semibold text-slate-600">{b.init}</div>
                <span className="text-[10px] font-medium">{b.name}</span>
              </div>
              {[['Servicios', String(b.svcs), ''], ['Total', b.total, 'font-semibold'], ['Comisión 50%', b.com, 'text-slate-500']].map(([l, v, c]) => (
                <div key={l} className="flex justify-between py-1 border-b border-slate-50 last:border-0">
                  <span className="text-[9px] text-slate-400">{l}</span>
                  <span className={`text-[9px] ${c}`}>{v}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
          <span className="text-[9px] text-amber-700">1 barbero sin cierre · Podés cargarlo diferido</span>
          <button className="text-[8px] bg-slate-800 text-white px-2 py-0.5 rounded">Regularizar</button>
        </div>
      </div>
    ),
  },
  cobros: {
    label: 'Cobros',
    url: 'app.vittro.com/cobrar',
    content: (
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold mb-0.5">Nuevo Cobro</p>
          <p className="text-[9px] text-slate-400 mb-2">Ctrl+1-9 para selección rápida</p>
          <div className="flex gap-1 mb-1">
            {[1, 0, 0, 0, 0].map((v, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${v ? 'bg-slate-800' : 'bg-slate-100'}`} />
            ))}
          </div>
          <p className="text-[9px] text-slate-400">Paso 1 de 5</p>
        </div>
        <p className="text-[10px] font-medium text-slate-500">👤 Barbero · Seleccioná quién atendió</p>
        <div className="grid grid-cols-2 gap-2">
          {[{ init: 'S', name: 'Sebastian Tello', selected: true }, { init: 'T', name: 'Luciano Garcia', selected: false }].map(b => (
            <div key={b.name} className={`rounded-lg p-3 text-center border cursor-pointer ${b.selected ? 'border-slate-800 bg-slate-50' : 'border-slate-100 bg-white'}`}>
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600 mx-auto mb-1.5">{b.init}</div>
              <p className="text-[10px] font-medium">{b.name}</p>
            </div>
          ))}
        </div>
        <div className="bg-white border border-slate-100 rounded-lg p-2.5">
          <p className="text-[9px] font-medium text-center text-slate-500 mb-2">📅 Jueves 16 De Abril</p>
          {['09:00 – 09:30', '11:00 – 11:30', '12:00 – 12:30'].map(t => (
            <div key={t} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
              <span className="text-[9px] text-slate-400">{t}</span>
              <span className="text-[9px]">Deluxe Cut</span>
              <span className="text-[8px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">Pendiente</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  stats: {
    label: 'Estadísticas',
    url: 'app.vittro.com/estadisticas',
    content: (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Estadísticas</p>
            <p className="text-[9px] text-slate-400">Análisis y métricas del negocio</p>
          </div>
          <span className="text-[9px] border border-slate-100 rounded px-2 py-1 text-slate-500">Últimos 6 meses ▾</span>
        </div>
        <div className="bg-white border border-slate-100 rounded-lg p-3">
          <p className="text-[10px] font-medium mb-0.5">Servicios</p>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-lg font-semibold">169</span>
            <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full">↗ +13.4%</span>
          </div>
          <div className="flex items-end gap-1 h-12">
            {[75, 100, 98, 78, 60, 52].map((h, i) => (
              <div key={i} className={`flex-1 rounded-sm ${i < 3 ? 'bg-slate-700' : 'bg-slate-200'}`} style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="flex gap-1 mt-1">
            {['nov', 'dic', 'ene', 'feb', 'mar', 'abr'].map(m => (
              <div key={m} className="flex-1 text-center text-[7px] text-slate-300">{m}</div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { title: 'Facturación', val: '$2.912.000', trend: '+20.2%' },
            { title: 'Ticket Promedio', val: '$17.231', trend: '+1.3%' },
          ].map(s => (
            <div key={s.title} className="bg-white border border-slate-100 rounded-lg p-2.5">
              <p className="text-[9px] font-medium mb-0.5">{s.title}</p>
              <p className="text-sm font-semibold">{s.val}</p>
              <p className="text-[9px] text-emerald-500">↗ {s.trend}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  agenda: {
    label: 'Agenda',
    url: 'app.vittro.com/turnos',
    content: (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">Turnos y Agenda</p>
          <span className="text-[9px] border border-slate-100 rounded px-2 py-1 text-slate-400">lun 13 – dom 19/04</span>
        </div>
        {[
          { day: 'Lunes 13/04', count: 0, rows: [] },
          { day: 'Jueves 16/04', count: 5, rows: ['09:00 – Deluxe Cut · Sebastian Tello', '11:00 – Deluxe Cut · Luciano Garcia', '12:00 – Deluxe Cut · Sebastian Tello'] },
        ].map(d => (
          <div key={d.day} className="bg-white border border-slate-100 rounded-lg p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-medium">{d.day}</span>
              <span className="text-[8px] border border-slate-100 rounded-full px-2 py-0.5 text-slate-400">{d.count} turnos</span>
            </div>
            {d.rows.length === 0
              ? <p className="text-[9px] text-slate-300">Sin turnos</p>
              : d.rows.map(r => (
                <div key={r} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                  <span className="text-[9px] text-slate-500">{r}</span>
                  <span className="text-[8px] text-red-400 cursor-pointer">✕</span>
                </div>
              ))
            }
          </div>
        ))}
      </div>
    ),
  },
} as const;

type ScreenKey = keyof typeof screens;

// ─── Feature list ─────────────────────────────────────────────────────────────
const features: { key: ScreenKey; icon: React.ReactNode; title: string; desc: string }[] = [
  { key: 'caja', icon: <Banknote size={16} />, title: 'Cierre de caja diario', desc: 'Cerrá la caja por barbero en segundos. Efectivo, Mercado Pago y comisiones calculadas automáticamente.' },
  { key: 'cobros', icon: <CreditCard size={16} />, title: 'Registro de cobros', desc: 'Registrá cada servicio con atajos de teclado. Vinculado automáticamente a los turnos del día.' },
  { key: 'stats', icon: <BarChart3 size={16} />, title: 'Estadísticas reales', desc: 'Facturación mensual, ticket promedio, servicios más vendidos. Datos para decidir, no para decorar.' },
  { key: 'agenda', icon: <Calendar size={16} />, title: 'Agenda y turnos online', desc: 'Tus clientes reservan solos. El equipo ve los turnos sin depender de WhatsApp.' },
];

// ─── App sidebar ──────────────────────────────────────────────────────────────
const navItems = [
  { key: 'cobrar', label: 'Cobrar', icon: <Scissors size={10} /> },
  { key: 'caja', label: 'Caja', icon: <Banknote size={10} /> },
  { key: 'finanzas', label: 'Finanzas', icon: <TrendingUp size={10} /> },
  { key: 'tareas', label: 'Tareas', icon: <Check size={10} /> },
  { key: 'turnos', label: 'Turnos', icon: <Calendar size={10} /> },
];

function AppWindow({ activeScreen }: { activeScreen: ScreenKey }) {
  const screen = screens[activeScreen];
  const activeNav = activeScreen === 'stats' ? 'finanzas' : activeScreen === 'cobros' ? 'cobrar' : activeScreen === 'agenda' ? 'turnos' : 'caja';

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xl shadow-slate-100">
      {/* Browser bar */}
      <div className="bg-[#ebebea] border-b border-slate-200 px-3 py-2 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex-1 mx-2 bg-white border border-slate-100 rounded px-3 py-1 text-[10px] text-slate-400 text-center transition-all duration-300">
          {screen.url}
        </div>
      </div>
      {/* App shell */}
      <div className="flex bg-slate-50" style={{ minHeight: 380 }}>
        {/* Sidebar */}
        <div className="w-36 flex-shrink-0 bg-white border-r border-slate-100 p-3 flex flex-col">
          <div className="flex items-center gap-1.5 mb-3 pb-3 border-b border-slate-100">
            <div className="w-5 h-5 rounded bg-[#1e2a4a] flex items-center justify-center">
              <Scissors size={9} className="text-white" />
            </div>
            <span className="text-xs font-semibold">Vittro</span>
            <span className="text-[7px] bg-amber-400 text-white px-1 rounded-full ml-auto">PRO</span>
          </div>
          <div className="mb-2">
            <p className="text-[7px] text-slate-300 uppercase tracking-wider mb-1">Sucursal</p>
            <div className="flex items-center gap-1 text-[9px] text-slate-600 pb-2 border-b border-slate-100">
              <div className="w-1.5 h-1.5 rounded-full bg-[#1e2a4a]" />
              Casa Central
            </div>
          </div>
          <div className="mb-3">
            <p className="text-[10px] font-medium">Sebastian Tello</p>
            <span className="text-[7px] bg-[#1e2a4a] text-white px-1.5 py-0.5 rounded-full">● Dueño</span>
          </div>
          <nav className="space-y-0.5 flex-1">
            {navItems.map(item => (
              <div key={item.key} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] transition-colors ${item.key === activeNav ? 'bg-[#eef0f8] text-[#1e2a4a] font-medium' : 'text-slate-400'}`}>
                {item.icon}
                {item.label}
              </div>
            ))}
          </nav>
        </div>
        {/* Main content */}
        <div className="flex-1 p-3 overflow-hidden">
          <div key={activeScreen} style={{ animation: 'fadeSlideIn 0.25s ease' }}>
            {screen.content}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Homepage() {
  const [heroTab, setHeroTab] = useState<ScreenKey>('caja');
  const [featTab, setFeatTab] = useState<ScreenKey>('caja');

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .gradient-text {
          background: linear-gradient(135deg, #1e2a4a 0%, #3a5298 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero-glow {
          background: radial-gradient(ellipse 80% 50% at 50% -10%, rgba(30,42,74,0.07) 0%, transparent 70%);
        }
      `}</style>

      {/* ── NAV ────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#1e2a4a] rounded-lg flex items-center justify-center">
              <Scissors size={13} className="text-white" />
            </div>
            <span className="font-semibold text-base tracking-tight">Vittro</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {['Funcionalidades', 'Planes'].map(l => (
              <a key={l} href={`#${l.toLowerCase()}`} className="text-sm text-slate-500 hover:text-slate-900 transition-colors">{l}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <button className="text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-all">
                Iniciar sesión
              </button>
            </Link>
            <Link to="/login?mode=signup">
              <button className="text-sm bg-[#1e2a4a] text-white px-4 py-1.5 rounded-lg hover:bg-[#2a3a60] transition-colors flex items-center gap-1.5">
                Registrar barbería <ArrowRight size={13} />
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="hero-glow pt-20 pb-0 px-6 text-center overflow-hidden">
        <div className="max-w-3xl mx-auto">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-xs text-slate-500 mb-6"
            style={{ animation: 'fadeSlideIn 0.5s ease' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Sistema de gestión para barberías
          </div>

          <h1
            className="text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.08] mb-5"
            style={{ animation: 'fadeSlideIn 0.5s ease 0.08s both' }}
          >
            Sabé exactamente<br />
            <span className="gradient-text">cuánto gana tu barbería</span>
          </h1>

          <p
            className="text-lg text-slate-500 max-w-lg mx-auto mb-8 leading-relaxed"
            style={{ animation: 'fadeSlideIn 0.5s ease 0.16s both' }}
          >
            Vittro reúne turnos, cobros, caja, sueldos y estadísticas en un solo lugar.
            Completamente GRATIS el primer mes.
          </p>

          <div
            className="flex items-center justify-center gap-3 mb-3"
            style={{ animation: 'fadeSlideIn 0.5s ease 0.24s both' }}
          >
            <Link to="/login?mode=signup">
              <button className="bg-[#1e2a4a] text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-[#2a3a60] transition-colors flex items-center gap-2">
                Registrar mi barbería <ArrowRight size={15} />
              </button>
            </Link>
            <Link to="/login">
              <button className="px-6 py-3 rounded-xl text-sm border border-slate-200 hover:bg-slate-50 transition-colors">
                Iniciar sesión
              </button>
            </Link>
          </div>
          <p className="text-xs text-slate-400 mb-10">Empezás gratis · Sin tarjeta de crédito</p>
        </div>

        {/* Tabs */}
        <div
          className="flex items-center justify-center gap-1.5 mb-4"
          style={{ animation: 'fadeSlideIn 0.5s ease 0.32s both' }}
        >
          {(Object.keys(screens) as ScreenKey[]).map(k => (
            <button
              key={k}
              onClick={() => setHeroTab(k)}
              className={`px-3.5 py-1.5 rounded-full text-xs transition-all ${heroTab === k ? 'bg-[#1e2a4a] text-white' : 'border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'}`}
            >
              {screens[k].label}
            </button>
          ))}
        </div>

        {/* Window */}
        <div
          className="max-w-3xl mx-auto"
          style={{ animation: 'fadeSlideIn 0.5s ease 0.4s both' }}
        >
          <AppWindow activeScreen={heroTab} />
        </div>
      </section>

      {/* ── SOCIAL PROOF ───────────────────────────────────────────────────── */}
      <section className="py-14 px-6 border-y border-slate-100">
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <div className="grid grid-cols-3 divide-x divide-slate-100">
              {[
                { num: '+100', label: 'barberías registradas' },
                { num: '2 mins', label: 'para registrarte y empezar' },
                { num: '100%', label: 'hecho para barberías' },
              ].map(s => (
                <div key={s.label} className="text-center px-8">
                  <p className="text-3xl font-semibold tracking-tight text-[#1e2a4a] mb-1">{s.num}</p>
                  <p className="text-sm text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── PROBLEMA ───────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-slate-50" id="funcionalidades">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">El problema</p>
              <h2 className="text-4xl font-semibold tracking-tight mb-4">
                Si manejás la barbería a ojo,<br />estás perdiendo plata
              </h2>
              <p className="text-slate-500 text-base max-w-md mx-auto">
                Estos son los problemas reales que vemos todos los días en barberías de todo el país.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[
              { title: 'Turnos desordenados', desc: 'WhatsApp, papel, dobles reservas. Los clientes se van con la barbería de enfrente que tiene agenda online.' },
              { title: 'No sabés cuánto ganás', desc: 'Cierres a mano, números aproximados. Siempre la sensación de que algo no cierra bien.' },
              { title: 'Sin control del equipo', desc: 'No sabés qué barbero rinde más ni cuánto le corresponde a cada uno al final del mes.' },
            ].map((p, i) => (
              <Reveal key={p.title} delay={i * 80}>
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full bg-red-50 text-red-500 border border-red-100 mb-3 font-medium">
                    ✕ Problema
                  </div>
                  <h3 className="font-semibold text-sm mb-2">{p.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{p.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="flex items-center gap-4 my-8 text-xs text-slate-300">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-slate-400 font-medium">Vittro lo resuelve todo</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <div className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full bg-[#eef0f8] text-[#1e2a4a] border border-[#c7d2fe] mb-3 font-medium">
                  ✦ Vittro
                </div>
                <h3 className="text-lg font-semibold mb-2">Una sola herramienta para ordenar todo</h3>
                <p className="text-sm text-slate-500 leading-relaxed max-w-sm">
                  Agenda online, cobros, cierre de caja por barbero, comisiones automáticas y estadísticas reales. Todo conectado, sin Excel.
                </p>
              </div>
              <div className="flex flex-col gap-2.5 md:min-w-[200px]">
                {['Cobros registrados al instante', 'Cierre de caja por barbero', 'Comisiones calculadas solas', 'Estadísticas de cada mes', 'Agenda online sin WhatsApp'].map(item => (
                  <div key={item} className="flex items-center gap-2 text-sm text-slate-600">
                    <div className="w-4 h-4 rounded-full bg-[#1e2a4a] flex items-center justify-center flex-shrink-0">
                      <Check size={9} className="text-white" strokeWidth={3} />
                    </div>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURES INTERACTIVAS ──────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Funcionalidades</p>
              <h2 className="text-4xl font-semibold tracking-tight mb-4">
                Todo lo que necesitás<br />para operar tu barbería
              </h2>
              <p className="text-slate-500 text-base max-w-sm mx-auto">
                Hacé click en cada módulo para ver cómo funciona en la app real.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            {/* Feature list */}
            <div className="space-y-2">
              {features.map((f, i) => (
                <Reveal key={f.key} delay={i * 60}>
                  <button
                    onClick={() => setFeatTab(f.key)}
                    className={`w-full text-left px-4 py-4 rounded-xl border transition-all duration-200 ${featTab === f.key ? 'bg-white border-[#1e2a4a] shadow-sm' : 'border-transparent hover:bg-slate-50 hover:border-slate-200'}`}
                  >
                    <div className="flex items-center gap-3 mb-1.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${featTab === f.key ? 'bg-[#1e2a4a] text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {f.icon}
                      </div>
                      <span className="font-semibold text-sm">{f.title}</span>
                      {featTab === f.key && <ChevronRight size={14} className="ml-auto text-[#1e2a4a]" />}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed pl-11">{f.desc}</p>
                  </button>
                </Reveal>
              ))}
            </div>

            {/* Preview */}
            <Reveal className="lg:sticky lg:top-20">
              <AppWindow activeScreen={featTab} />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── PLANES ─────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-slate-50" id="planes">
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Planes</p>
              <h2 className="text-4xl font-semibold tracking-tight mb-4">Registrá tu barbería en minutos</h2>
              <p className="text-slate-500 text-base">¡El primer mes es completamente GRATIS!</p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                tier: 'Basico',
                price: '$30.000',
                sub: 'Para empezar a ordenar tu barbería',
                desc: 'Para arrancar y probar sin compromiso.',
                features: ['1 sucursal', 'Hasta 2 barberos', 'Agenda de turnos', 'Registro de cobros', 'Cierre de caja diario'],
                featured: false,
                cta: 'Registrar mi barbería',
              },
              {
                tier: 'Profesional',
                price: '$50.000',
                sub: 'Para barberías que quieren crecer y entender su negocio',
                desc: 'Más barberos, más control, más datos.',
                features: ['1 sucursal', 'Más barberos y servicios', 'Control completo de finanzas', 'Estadísticas avanzadas', 'Historial de cortes y ventas'],
                featured: true,
                cta: 'Registrar mi barbería',
              },
              {
                tier: 'Premium',
                price: '$100.000',
                sub: 'Para barberías con múltiples sucursales',
                desc: 'Para cadenas que necesitan control total.',
                features: ['Múltiples sucursales', 'Barberos ilimitados', 'Encargados por sede', 'Soporte prioritario', 'Reportes avanzados'],
                featured: false,
                cta: 'Registrar mi barbería',
              },
            ].map((plan, i) => (
              <Reveal key={plan.tier} delay={i * 80}>
                <div className={`relative bg-white rounded-xl p-5 flex flex-col h-full transition-shadow hover:shadow-md ${plan.featured ? 'border-2 border-[#1e2a4a] shadow-sm' : 'border border-slate-200'}`}>
                  {plan.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#1e2a4a] text-white text-[10px] px-3 py-1 rounded-full font-medium">
                      Recomendado
                    </div>
                  )}
                  <div className="mb-4">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{plan.tier}</p>
                    <p className="text-2xl font-semibold tracking-tight">{plan.price}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{plan.sub}</p>
                  </div>
                  <div className="h-px bg-slate-100 mb-4" />
                  <ul className="space-y-2.5 flex-1 mb-5">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                        <div className="w-3.5 h-3.5 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Check size={8} className="text-slate-700" strokeWidth={3} />
                        </div>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/login?mode=signup">
                    <button className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${plan.featured ? 'bg-[#1e2a4a] text-white hover:bg-[#2a3a60]' : 'border border-slate-200 hover:bg-slate-50'}`}>
                      {plan.cta}
                    </button>
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-[#1e2a4a] relative overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(ellipse 70% 70% at 50% 110%, #3a5298 0%, transparent 70%)' }} />
        <div className="max-w-2xl mx-auto text-center relative">
          <Reveal>
            <div className="flex items-center justify-center gap-1 mb-6">
              {[...Array(5)].map((_, i) => <Star key={i} size={14} className="text-amber-400 fill-amber-400" />)}
            </div>
            <h2 className="text-4xl font-semibold text-white mb-4 tracking-tight leading-tight">
              Empezá a tener control real<br />de tu barbería hoy
            </h2>
            <p className="text-slate-300 text-base mb-8 leading-relaxed">
              Creá tu cuenta gratis y ordená tu negocio en menos de 5 minutos.
            </p>
            <div className="flex items-center justify-center gap-3 mb-4">
              <Link to="/login?mode=signup">
                <button className="bg-white text-[#1e2a4a] px-6 py-3 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2">
                  Crear cuenta gratis <ArrowRight size={14} />
                </button>
              </Link>
              <Link to="/login">
                <button className="border border-white/20 text-white px-6 py-3 rounded-xl text-sm hover:bg-white/10 transition-colors">
                  Iniciar sesión
                </button>
              </Link>
            </div>
            <p className="text-slate-400 text-xs">Sin tarjeta de crédito · Cancelás cuando querés</p>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-100 py-6 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#1e2a4a] rounded-md flex items-center justify-center">
              <Scissors size={11} className="text-white" />
            </div>
            <span className="font-semibold text-sm">Vittro</span>
          </div>
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} Vittro · Sistema de gestión para barberías</p>
        </div>
      </footer>

    </div>
  );
}
