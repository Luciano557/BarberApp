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
  /** Ocultar este paso en mobile */
  hideOnMobile?: boolean;
  /** Ocultar este paso en desktop */
  hideOnDesktop?: boolean;
  /** Id de una sección colapsable que debe abrirse antes de mostrar el paso */
  requiresOpen?: string;
  /** Condición de auto-avance evaluada al montar el paso */
  autoAdvanceIf?: 'on-sucursal-tab';
  /** Si el target no existe en el DOM, saltar el paso en silencio */
  optionalTarget?: boolean;
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
    id: 's2b_general_tab',
    targetId: 'general-tab',
    title: 'Configuración General',
    description: 'Desde aquí vas a administrar la información general de tu negocio. Los cambios que hagas acá se van a reflejar en todas tus sucursales.',
    requiredTab: 'mi-negocio',
    miNegocioSubTab: 'general',
  },
  {
    id: 's3_equipo_general',
    targetId: 'equipo-general-section',
    title: 'Agregá a tu equipo',
    description: 'Acá das de alta a los miembros de tu equipo: barberos, encargados y cajeros. Desde esta sección los creás, les asignás sucursales y les enviás la invitación de acceso.',
    requiredTab: 'mi-negocio',
    miNegocioSubTab: 'general',
    optionalTarget: true,
  },
  {
    id: 's4_cuenta_sucursal',
    targetId: 'cuentas-sucursal-section',
    title: '¿Para qué sirve la cuenta de sucursal?',
    description: 'Es un acceso operativo que Vittro genera automáticamente para cada sucursal, pensado para el trabajo diario sin usar cuentas personales del equipo.',
    bullets: [
      'Cada sucursal tiene su propia cuenta, generada automáticamente.',
      'Sirve para operar el día a día desde caja o recepción.',
      'No accede a configuración, estadísticas, comisiones ni gestión del negocio.',
    ],
    requiredTab: 'mi-negocio',
    miNegocioSubTab: 'general',
    requiresOpen: 'cuentas-sucursal',
  },
  {
    id: 's5_select_sucursal',
    targetId: 'sucursal-tab',
    title: 'Accede a tu sucursal principal',
    description: 'Hacé clic en la pestaña de tu sucursal para continuar configurándola.',
    requiredTab: 'mi-negocio',
    miNegocioSubTab: 'general',
    advanceOnEvent: 'mi-negocio:sucursal-selected',
    hideContinueButton: true,
    autoAdvanceIf: 'on-sucursal-tab',
  },
  {
    id: 's6_info',
    targetId: 'info-sucursal-card',
    title: 'Información de la sucursal',
    description: 'Acá configurás y gestionás la información principal de esta sucursal. Desde el botón "Cuenta de sucursal", arriba a la derecha de esta tarjeta, accedés a las credenciales reales de este local: email, contraseña temporal y la opción de regenerarla.',
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
