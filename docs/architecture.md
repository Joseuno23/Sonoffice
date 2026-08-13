# Arquitectura actual de Sonoffice

Sonoffice convive hoy con un ERP legacy en CodeIgniter y una nueva base de aplicaciones en React/NestJS. La migración debe ser gradual: el legacy sigue siendo la referencia funcional hasta que cada módulo sea confirmado, migrado, probado y retirado.

## Resumen ejecutivo

| Área | Estado actual |
|------|---------------|
| Legacy | `Erp/` con CodeIgniter 3.1.7 |
| Frontend nuevo | `apps/web` con React, Vite, TypeScript, Tailwind y React Router |
| Backend nuevo | `apps/api` con NestJS y TypeScript |
| API nueva | Prefijo global `/api` |
| Base de datos | MariaDB legacy local `bd_medios` |
| Migración funcional | Ningún módulo funcional migrado todavía |

## Arquitectura legacy

El sistema existente vive en `Erp/` y usa CodeIgniter 3.1.7.

| Elemento | Dato confirmado |
|----------|-----------------|
| Código legacy | `Erp/` |
| Framework | CodeIgniter 3.1.7 |
| Configuración DB | `Erp/application/config/database.php` |
| DB local identificada | `bd_medios` |

> Regla: no modificar `Erp/` durante la documentación o la preparación de la migración.

## Nueva arquitectura

La nueva arquitectura separa experiencia web y API.

| Capa | Ubicación | Responsabilidad |
|------|-----------|------------------|
| Web | `apps/web` | Interfaz de usuario, navegación, vistas y consumo de API |
| API | `apps/api` | Contratos HTTP, reglas de aplicación y acceso controlado a datos |
| DB | MariaDB legacy | Fuente de datos existente mientras dure la migración |

## Comunicación del sistema

```text
Usuario
  ↓
apps/web (React)
  ↓ HTTP /api/*
apps/api (NestJS)
  ↓ mysql2 pool
MariaDB bd_medios
```

El backend expone endpoints bajo `/api`. La ruta `/api/health/db` valida conexión a la base. La ruta sin prefijo, por ejemplo `/health/db`, responde 404.

## Responsabilidad del frontend

El frontend nuevo debe:

- Renderizar pantallas y flujos de usuario.
- Navegar con React Router.
- Consumir únicamente contratos publicados por `apps/api`.
- Evitar lógica de negocio crítica que pertenezca al backend.
- Tratar módulos no migrados como pendientes hasta confirmación.

## Responsabilidad del backend

El backend nuevo debe:

- Exponer endpoints bajo `/api`.
- Centralizar acceso a MariaDB mediante el pool `mysql2` existente.
- Usar configuración desde `@nestjs/config`.
- Mantener respuestas consistentes para éxito, error y paginación.
- No alterar el esquema legacy sin una decisión explícita.

## Fuente de verdad

| Tema | Fuente de verdad actual |
|------|-------------------------|
| Comportamiento funcional existente | ERP legacy en `Erp/` |
| Datos productivos / legacy | MariaDB `bd_medios` |
| Nuevos contratos HTTP | `apps/api` bajo `/api` |
| Nueva experiencia web | `apps/web` |
| Módulos migrados | Pendiente: ninguno confirmado todavía |

## Pendientes de confirmación

- Inventario funcional de módulos legacy.
- Tablas y relaciones por módulo.
- Criterios específicos de equivalencia funcional por módulo.
- Estrategia de autenticación/autorización final.
