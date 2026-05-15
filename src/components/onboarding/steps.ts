export type OnboardingSubTab = 'general' | 'first-sucursal';
export type OnboardingEvent = 'mi-negocio:sucursal-selected';

export interface OnboardingStep {
  id: string;
  targetId: string;
  title: string;
  description: string;
  bullets?: string[];
  /** Tab del sidebar que debe quedar activo en este paso */
  requiredTab?: string;
  /** Tabs permitidos durante este paso (además del requiredTab) */
  allowedTabs?: string[];
  /** Sub-tab dentro de Mi Negocio (general o primera sucursal) */
  miNegocioSubTab?: OnboardingSubTab;
  /** Si está definido, este paso avanza al recibir el evento (no botón Continuar) */
  advanceOnEvent?: OnboardingEvent;
  /** Oculta el botón "Continuar" (cuando se avanza por evento) */
  hideContinueButton?: boolean;
  /** Paso de bienvenida: se muestra como diálogo centrado, sin target */
  isWelcome?: boolean;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 's0_welcome',
    targetId: '',
    title: 'Te damos la bienvenida a Vittro',
    description: 'Vittro centraliza la operación, la agenda, el equipo y las finanzas de tu barbería en un solo lugar, para que la gestionés con más claridad y menos tareas manuales. En los próximos pasos te mostramos cómo dejar todo configurado para empezar a trabajar.',
    isWelcome: true,
  },
  {
    id: 's1_sidebar',
    targetId: 'mi-negocio-nav',
    title: 'Configurá tu negocio',
    description: 'Desde aquí vas a administrar toda la información principal de tu barbería.',
    requiredTab: 'mi-negocio',
  },
  {
    id: 's2_cuenta_intro',
    targetId: 'cuentas-sucursal-section',
    title: '¿Para qué sirve la cuenta de sucursal?',
    description: 'La cuenta de sucursal está pensada para el trabajo diario de la barbería, sin necesidad de utilizar cuentas personales.',
    requiredTab: 'mi-negocio',
    miNegocioSubTab: 'general',
  },
  {
    id: 's3_cuenta_bullets',
    targetId: 'cuentas-sucursal-bullets',
    title: '¿Para qué sirve la cuenta de sucursal?',
    description: 'Tres ideas clave para tener en cuenta:',
    requiredTab: 'mi-negocio',
    miNegocioSubTab: 'general',
  },
  {
    id: 's4_select_sucursal',
    targetId: 'sucursal-tab',
    title: 'Accede a tu sucursal principal',
    description: 'Hacé clic en la pestaña de tu sucursal para continuar configurándola.',
    requiredTab: 'mi-negocio',
    miNegocioSubTab: 'general',
    advanceOnEvent: 'mi-negocio:sucursal-selected',
    hideContinueButton: true,
  },
  {
    id: 's5_info',
    targetId: 'info-sucursal-card',
    title: 'Información de la sucursal',
    description: 'Acá podés configurar y gestionar toda la información principal de esta sucursal.',
    requiredTab: 'mi-negocio',
    miNegocioSubTab: 'first-sucursal',
  },
  {
    id: 's6_equipo',
    targetId: 'equipo-section',
    title: 'Gestioná tu equipo',
    description: 'Acá podés agregar barberos, encargados, cajeros y miembros del equipo.',
    requiredTab: 'mi-negocio',
    miNegocioSubTab: 'first-sucursal',
  },
  {
    id: 's7_catalogo',
    targetId: 'catalogo-section',
    title: 'Servicios, extras y productos',
    description: 'Acá podés configurar los servicios, extras, productos y descuentos particulares de la sucursal.',
    requiredTab: 'mi-negocio',
    miNegocioSubTab: 'first-sucursal',
  },
  {
    id: 's8_pagos',
    targetId: 'metodos-pago-section',
    title: 'Métodos de pago',
    description: 'Configurá los medios de pago disponibles para esta sucursal.',
    requiredTab: 'mi-negocio',
    miNegocioSubTab: 'first-sucursal',
  },
];
