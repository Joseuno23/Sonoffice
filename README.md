# Sonoffice ERP — Monorepo

Migración del prototipo a un proyecto real, organizado como **monorepo** con workspaces de npm:

```
.
├─ apps/
│  ├─ web/   → React 19 + Vite + TypeScript + Tailwind CSS
│  └─ api/   → NestJS + TypeScript
└─ package.json  (workspaces + scripts raíz)
```

## Requisitos

- Node.js 18+ (recomendado 20+)

## Instalación

Desde la raíz (instala ambos workspaces):

```bash
npm install
```

## Ejecución

```bash
npm run dev
```

Levanta **API + Web a la vez**:

| App | URL | Stack |
|-----|-----|-------|
| `apps/api` | http://localhost:3001/api | NestJS + TypeScript |
| `apps/web` | http://localhost:5173 | React 19 + Vite + TS + Tailwind |

Vite hace *proxy* de `/api` → `http://localhost:3001`, así que el frontend consume la API sin configuración extra. Abre **http://localhost:5173**.

> El login valida contra la base legacy local mediante la API NestJS. Configura `.env` antes de iniciar sesión.

### Ejecutar por separado

```bash
npm run dev:web      # solo frontend
npm run dev:api      # solo backend
```

### Build / typecheck

```bash
npm run build        # build de api y web
npm run typecheck    # chequeo de tipos de ambos
```

> El dev server y el build usan esbuild (Vite) / el compilador de Nest; el chequeo estricto de tipos está en `typecheck` para no bloquear el arranque.

## apps/web

```
apps/web/
├─ index.html
├─ vite.config.ts          # dev server + proxy /api
├─ tsconfig.json
├─ tailwind.config.js · postcss.config.js
├─ public/logo.png
└─ src/
   ├─ main.tsx · App.tsx · index.css
   ├─ auth/      → AuthContext (sesión)
   ├─ theme/     → ThemeContext + variables CSS (claro/oscuro/sidebar)
   ├─ lib/       → icons, status, format, cliente API
   ├─ components/→ Sidebar, Topbar, AppShell, PageHeader, charts, skeletons…
   └─ pages/     → Login, Dashboard, OrdersList, OrderDetail, OrderForm, Settings, ComingSoon
```

## apps/api (NestJS)

```
apps/api/
├─ nest-cli.json · tsconfig.json
└─ src/
   ├─ main.ts               # bootstrap, CORS, prefijo global /api
   ├─ app.module.ts
   ├─ health.controller.ts
   ├─ auth/                 # Login y recuperación de contraseña
   ├─ orders/               # /api/orders (+ data.ts: generadores)
   ├─ users/                # GET  /api/users
   └─ dashboard/            # GET  /api/dashboard
```

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login contra base legacy |
| POST | `/api/auth/change-required-password` | Cambio obligatorio de contraseña |
| POST | `/api/auth/forgot-password` | Recuperación de contraseña con Brevo |
| GET | `/api/orders` | Lista de órdenes |
| GET | `/api/orders/:id` | Detalle de orden |
| POST | `/api/orders` | Crea una orden |
| GET | `/api/users` | Usuarios |
| GET | `/api/dashboard` | KPIs y roles |
| GET | `/api/health` | Estado del servicio |

El frontend consume la API mediante el proxy `/api` de Vite.

### Presupuesto Producción Externa

Defaults configurables para migrar el comportamiento legacy del presupuesto tipo 6 sin hardcodear constantes en la lógica de negocio:

- `EXTERNAL_PRODUCTION_BUDGET_DEFAULT_IVA` (default `19`)
- `EXTERNAL_PRODUCTION_BUDGET_DEFAULT_SPA` (default `10`)
- `EXTERNAL_PRODUCTION_BUDGET_DEFAULT_IVA_SPA` (default `19`)
- `EXTERNAL_PRODUCTION_BUDGET_TYPE` (default `6`)
- `EXTERNAL_PRODUCTION_BUDGET_TPO_DOC` (default `externa`)
- `EXTERNAL_PRODUCTION_BUDGET_STATUS_ACTIVE` (default `1`)
- `EXTERNAL_PRODUCTION_BUDGET_STATUS_PRINTED` (default `5`)
- `EXTERNAL_PRODUCTION_BUDGET_STATUS_CREDIT_NOTE` (default `47`)
- `EXTERNAL_PRODUCTION_BUDGET_STATUS_CANCELLED` (default `9999`)
- `EXTERNAL_PRODUCTION_COST_ORDER_STATUS_PRINTED` (default `27`)
- `EXTERNAL_PRODUCTION_COST_ORDER_STATUS_FINALIZED` (default `8`)
- `EXTERNAL_PRODUCTION_BUDGET_SERVICE_TYPE` (default `E`)
- `EXTERNAL_PRODUCTION_BUDGET_SPECIAL_SPA_CLIENT_ID` (default `1339`)
- `EXTERNAL_PRODUCTION_BUDGET_SPECIAL_SPA` (default `6`)
- `EXTERNAL_PRODUCTION_BUDGET_SPECIAL_SPA_SERVICE_IDS` (default legacy comma-separated services)
- `EXTERNAL_PRODUCTION_BUDGET_EDITABLE_INCENTIVE_COST_SERVICE_IDS` (default `160,163,170,173`)

## Diseño

Se mantiene exactamente el diseño del prototipo original: paleta, tipografías (Inter + JetBrains Mono), modo claro/oscuro, sidebar colapsable con dos estilos, gráficas SVG, skeletons de carga y todas las pantallas.
