# Convenciones de API

Todas las rutas nuevas del backend deben publicarse bajo el prefijo `/api`. Esta convención ya está activa en NestJS: `/api/health/db` funciona y `/health/db` responde 404.

## Ruta base

| Convención | Valor |
|------------|-------|
| Prefijo global | `/api` |
| Health API | `GET /api/health` |
| Health DB | `GET /api/health/db` |
| Ruta sin prefijo | No válida |

## Respuesta exitosa

Usar esta forma para endpoints funcionales nuevos:

```json
{
  "success": true,
  "data": {},
  "message": null
}
```

## Respuesta de error

Usar esta forma para errores controlados:

```json
{
  "success": false,
  "data": null,
  "message": "Descripción legible del error",
  "errorCode": "ERROR_CODE"
}
```

La ruta `GET /api/health/db` ya sigue esta idea para el error `DATABASE_CONNECTION_ERROR`.

## Respuesta paginada

Usar esta forma cuando un endpoint devuelva listas paginadas:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 0,
    "totalPages": 0
  },
  "message": null
}
```

## Manejo de errores

| Caso | Regla |
|------|-------|
| Error esperado | Devolver `success: false` con `message` y `errorCode` |
| Error no esperado | No exponer detalles internos |
| Error de DB | Usar códigos explícitos como `DATABASE_CONNECTION_ERROR` |
| Validaciones | Pendiente de definir al migrar módulos funcionales |

## Fechas y nombres de campos

| Tema | Regla |
|------|-------|
| JSON | Usar `camelCase` en respuestas nuevas |
| Fechas | Usar strings ISO 8601 cuando se definan contratos nuevos |
| IDs | Mantener nombres claros (`id`, `customerId`, etc.) según contrato nuevo |
| Campos legacy | No exponer nombres legacy crípticos si el contrato público puede ser más claro |

## Health check de DB

| Endpoint | Resultado esperado |
|----------|--------------------|
| `GET /api/health/db` | Confirma conexión con MariaDB |
| `GET /health/db` | 404 por faltar prefijo `/api` |

Ejemplo exitoso actual:

```json
{
  "success": true,
  "data": {
    "database": "connected"
  },
  "message": null
}
```
