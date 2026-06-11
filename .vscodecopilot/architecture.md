

# 🏗️ Guía de Arquitectura - Proyecto Vitro

## 1. Resumen del Proyecto
Vitro es una aplicación (SPA) multitenant (Software as a Service) orientada a la gestión integral de barberías y centros de estética. Incluye subsistemas para la administración de personal, finanzas, control de caja y agenda.

**Stack Tecnológico Principal detectado:**
- **Frontend / Cliente:** React implementado con Vite y TypeScript. Estilos basados en Tailwind CSS y uso extensivo de componentes de la colección `shadcn/ui` (Radix primitives).
- **State Management & Fetching:** React Hooks, Context API y `@tanstack/react-query` para asincronía.
- **Backend / BaaS:** Supabase. Actúa como motor de Backend-as-a-Service, proveyendo autenticación (Supabase Auth) y resolución de las API a través de PostgREST.
- **Database:** PostgreSQL (gestionado a través de Supabase).
- **Lógica de Negocio Sensible:** Supabase Edge Functions (Deno/TypeScript).

---

## 2. Estructura de Carpetas (Árbol)
El diseño del árbol prioriza separar componentes UI, lógica persistente (hooks) y estados globales (contexts).

```text
C:\GIT\VittroProd
├── public/                 # Assets públicos estáticos (robots, imágenes globales).
├── src/                    # Código fuente del Frontend
│   ├── assets/             # Recursos estáticos de la app (íconos, ilustraciones).
│   ├── components/         # Componentes de capa de presentación. 
│   │   ├── ui/             # Componentes base tontos de diseño (botones, dialogos, inputs).
│   │   └── ...             # Dominios y Feature Panels (FinanzasPanel, ClientesPanel, agenda/).
│   ├── contexts/           # Proveedores de estado global (AuthContext, OrganizationContext).
│   ├── hooks/              # Custom Hooks. Abstraen Reglas de negocio y fetching (Repo layer).
│   ├── integrations/       # Clientes de integrados (Config. y Types exportados de Supabase).
│   ├── lib/                # Utilidades puras, formateo, utilidades de Tailwind (utils.ts).
│   ├── pages/              # Vistas principales del router (Index.tsx, Reservar, Login).
│   └── types/              # Definiciones canónicas de interfaces TypeScript (`barbershop.ts`).
├── supabase/               # Lógica del Backend (Infraestructura como Código / IaC)
│   ├── functions/          # Edge Functions (Microservicios serverless de ejecución segura).
│   └── migrations/         # Evolución del schema PostgresSQL y políticas RLS.
└── ...                     # Configuración de ESLint, PostCSS, Vite, y Typescript (tsconfig).
```

---

## 3. Estrategia Multitenant
La división lógica y de seguridad entre clientes (cada barbería o centro de estética) está manejada con el modelo **Shared Schema, Tenant-per-Row**.

- **A nivel Motor de Base de Datos (Seguridad Real):** Toda tabla (ventas, barberos, sucursales, gastos) tiene un campo `organization_id`. Se utiliza **RLS (Row Level Security)** de Postgres para que nadie pueda ver datos de otra barbería. El sistema inyecta el Session Token proveniente del cliente hacia Postgres; la base de datos sabe a qué `organization_id` pertenece el `auth.uid()` actual y filtra de raíz el dataset.
- **A nivel Frontend (Navegación Visual):** Se orquesta a través de **`OrganizationContext`**. Al hacer login, este contexto hidrata toda la app con los detalles del tenant principal.
- **Aislamiento Físico Interno:** Dado que una organización puede tener varias sucursales, se implementa una segunda capa de segregación utilizando el **`SucursalContext`** que filtra la vista local de los módulos al `currentSucursal.id` de turno.

---

## 4. Patrones de Diseño y Arquitectura
- **SPA conectada a Backend-as-a-Service:** En lugar del tradicional patrón MVC (donde un servidor Node.js/C# renderiza la lógica y controlador), Vitro es puramente cliente interactuando contra la DB validada (PostgREST de Supabase).
- **Custom React Hooks como "Data Access Objects / Repositorios":** Evitas ensuciar los componentes visuales interactuando directo con Supabase. Un componente siempre usará abstracciones como `const { addTransaction } = useTransactions();` delegándole al Hook ser el puente con la DB.
- **Inyección de Dependencias por Contexto:** La autenticación y reglas de negocio contextuales (quién es el usuario, su sucursal, permisos basados en su perfil como dueño o barbero) se inyectan en todo el árbol de React jerárquicamente a través de los diversos *Providers*.
- **Arquitectura Basada en Características (Feature-driven):** El código en la carpeta components se agrupa progresivamente alrededor de dominios (ej: `agenda`, `clientes`, `onboarding`).

---

## 5. Flujo de Datos
Un viaje completo de la información sigue este ciclo:
1. **Trigger Inicial:** El usuario realiza una acción en un Smart Component (ej: guarda un pago nuevo en `PaymentRegistration.tsx`).
2. **Capa Repositorio (Hook):** El componente delega la data a una función en el hook subyacente (ej: `useTransactions()`).
3. **Composición de Contextos:** El hook embebe silenciosamente el `organization_id` y `currentSucursal.id` correspondiente, parseando los DTOs usando utilidades internas de la capeta `lib/`.
4. **Transporte:** Se dispara el Request contra el cliente Typescript de Supabase.
5. **Validation y Persistencia:** Supabase valida el usuario (JWT), evalúa la condición de las sentencias RLS en la base de datos (Postgres), y escribe la nueva fila.
6. **Retorno:** La promesa se resuelve en el frontend. El estado local o de caché subyacente se invalida re-poblando la data nueva, causando un re-render o mostrando un Toast de feedback en la pantalla.

---

## 6. Puntos de Extensión Estratégicos
¿Cómo incorporar a partir de aquí un **nuevo módulo de integración de pagos y facturación (AFIP / Stripe / MercadoPago, etc.)** sin romper patrones actuales?

### Frontend
- **Vista de Facturación:** Crear un nuevo directorio (ej. `src/components/facturacion/`), que incluya los formularios respectivos de control tributario / cajas y linkear el Entry Point correspondiente (`FacturacionPanel.tsx`) como nueva pestaña dentro del gestor general Index.tsx.
- **Capa Repo:** Desarrollar un `src/hooks/usePagos.ts` aislado que contenga exclusivamente el registro y petición de generación del pago.

### Backend y Seguridad Sensible (*Lo más crìtico*)
- Generar recibos de pago interactuando con una pasarela fiscal externa requiere almacenar y pasar llaves secretas. **NUNCA** debes invocar librerías nativas transaccionales o Secret API Keys directo desde de tus llamadas de Supabase en React. 
- Debes crear servicios *Serverless* aislando esta lógica en **Supabase Edge Functions** en la ruta `supabase/functions/pagos/` o `supabase/functions/facturacion-fiscal/`.  Allí ejecutarás el cobro y registrarás el movimiento fiscal en tu motor. 
- En el frontend, el hook únicamente hará uso de `supabase.functions.invoke('pagos', body)` esperando el resultado de la confirmación del edge endpoint.
- **Modelo de DB:** Agregar progresivamente el schema de migraciones SQL en migrations definiendo tablas requeridas (ej: `facturas`, `log_transacciones`, configuraciones de pasarela vinculadas vía FK al respectivo `organization_id`), recordando estipular sus políticas RLS con `CREATE POLICY`.

---
