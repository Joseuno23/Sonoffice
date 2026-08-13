# Desarrollo local

El entorno local usa npm workspaces, una app web React/Vite y una API NestJS conectada a MariaDB local vía XAMPP.

## Requisitos

| Herramienta | Uso |
|-------------|-----|
| Node.js / npm | Instalar y correr workspaces |
| XAMPP | Levantar MariaDB local |
| MariaDB | Base legacy local `bd_medios` |

## Variables de entorno

Crear `.env` local copiando `.env.example`. El archivo `.env` es local y está ignorado por git.

```env
PORT=3001
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=bd_medios
DB_USER=root
DB_PASSWORD=
```

## Instalación

Desde la raíz del repositorio:

```bash
npm install
```

## Ejecutar en desarrollo

Levantar web y API juntas:

```bash
npm run dev
```

Levantar solo la API:

```bash
npm run dev:api
```

Levantar solo la web:

```bash
npm run dev:web
```

## Health checks

| Check | URL | Esperado |
|-------|-----|----------|
| API | `http://localhost:3001/api/health` | API responde |
| DB | `http://localhost:3001/api/health/db` | `database: connected` |
| Sin prefijo | `http://localhost:3001/health/db` | 404 |

## Conexión MariaDB local

Configuración validada localmente:

| Campo | Valor |
|-------|-------|
| Host | `127.0.0.1` |
| Puerto | `3306` |
| DB | `bd_medios` |
| Usuario | `root` |
| Password | vacío |

## Troubleshooting

| Síntoma | Revisar |
|---------|---------|
| `/api/health/db` devuelve error | XAMPP/MariaDB levantado, DB `bd_medios`, variables `.env` |
| `/health/db` devuelve 404 | Correcto: falta el prefijo `/api` |
| API no arranca | `PORT`, instalación de dependencias, comando `npm run dev:api` |
| Web no arranca | instalación de dependencias, comando `npm run dev:web` |

## Reglas locales

- No commitear `.env`.
- No modificar `Erp/` para levantar la nueva base.
- No alterar esquema ni datos legacy durante pruebas de documentación.
- Confirmar cada módulo antes de crear endpoints funcionales.
