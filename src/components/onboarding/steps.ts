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
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 's1_sidebar',
    targetId: 'mi-negocio-nav',
    title: 'Configurá tu negocio',
    description: 'Desde aquí vas a administrar toda la información principal de tu barbería.',
  },
  {
    id: 's2_cuenta_intro',
    targetId: 'cuenta-sucursal-button',
    title: '¿Para qué sirve la cuenta de sucursal?',
    description: 'La cuenta de sucursal está pensada para el trabajo diario de la barbería sin necesidad de utilizar cuentas personales.',
    requiredTab: 'mi-negocio',
  },
  {
    id: 's2_cuenta_bullets',
    targetId: 'cuenta-sucursal-button',
    title: '¿Para qué sirve la cuenta de sucursal?',
    description: 'Tres ideas clave para tener en cuenta:',
    bullets: [
      'Cada sucursal tiene una cuenta propia.',
      'Sirve para operar el día a día sin usar cuentas personales del equipo.',
      'No accede a configuraciones, estadísticas, comisiones ni gestión del negocio.',
    ],
    requiredTab: 'mi-negocio',
  },
  {
    id: 's3_info',
    targetId: 'info-sucursal-card',
    title: 'Información de la sucursal',
    description: 'Acá podés configurar y gestionar toda la información principal de esta sucursal.',
    requiredTab: 'mi-negocio',
  },
  {
    id: 's4_equipo',
    targetId: 'equipo-section',
    title: 'Gestioná tu equipo',
    description: 'Acá podés agregar barberos, encargados, cajeros y miembros del equipo.',
    requiredTab: 'mi-negocio',
  },
  {
    id: 's5_servicios',
    targetId: 'catalogo-section',
    title: 'Servicios',
    description: 'Acá podés agregar los servicios disponibles en tu barbería.',
    requiredTab: 'mi-negocio',
  },
  {
    id: 's6_extras',
    targetId: 'catalogo-section',
    title: 'Extras y productos',
    description: 'Acá también podés configurar servicios extras, productos y descuentos.',
    requiredTab: 'mi-negocio',
  },
  {
    id: 's7_pagos',
    targetId: 'metodos-pago-section',
    title: 'Métodos de pago',
    description: 'Configurá los medios de pago disponibles para esta sucursal.',
    requiredTab: 'mi-negocio',
  },
];
