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

## Diseño

Se mantiene exactamente el diseño del prototipo original: paleta, tipografías (Inter + JetBrains Mono), modo claro/oscuro, sidebar colapsable con dos estilos, gráficas SVG, skeletons de carga y todas las pantallas.
