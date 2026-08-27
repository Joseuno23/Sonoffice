# Inventario y estimación de migración de módulos ERP

Este documento define los módulos y submódulos del ERP legacy que se pretenden migrar desde `Erp/` hacia el nuevo sistema Sonoffice, con una estimación inicial en **días hábiles de desarrollo**.

La estimación está basada en:

- Menú real legacy (`sys_menu`).
- Controladores legacy bajo `Erp/application/controllers/`.
- Capturas actuales del menú operativo.
- Estado real del nuevo sistema documentado en `docs/modules-status.md`.

> **Conclusión directa:** si se estima módulo por módulo de forma realista, el alcance funcional completo —sin Cotizaciones ni Banco de Imágenes— está alrededor de **452 días hábiles**.  
> Esto NO es lo mismo que una promesa de calendario: puede comprimirse por paralelización, reutilización de arquitectura, priorización y recorte de alcance, pero no debe venderse como si fueran CRUDs simples.

## Decisión de alcance

| Área | Decisión |
|---|---|
| Fuente funcional | `Erp/` legacy CodeIgniter es la fuente de verdad. No se modifica. |
| Estrategia | Migración incremental por módulo, no big-bang. |
| Unidad de estimación | Días hábiles de desarrollo: backend, frontend, integración, permisos y validación funcional básica. |
| Excluido | **Cotizaciones** y **Banco de Imágenes** no entran en esta estimación. |
| Ya migrado | Helpdesk está funcionalmente migrado; se lista solo para trazabilidad, sin sumar días pendientes. |

## Resumen ejecutivo por módulo

| Módulo | Complejidad | Días estimados | Comentario |
|---|---:|---:|---|
| Sistema General | Alta | 40 | Fundación transversal: usuarios, roles, menús, permisos, botones, cargos, parámetros. |
| Clientes y Proveedores | Alta | 29 | Clientes, proveedores y solicitudes de registro. |
| Admin Medios | Muy alta | 91 | Órdenes costo/gasto, reportes y 10 tipos de presupuesto. |
| Facturación | Muy alta | 113 | Cargues, cuenta 28, documentos, facturar, incentivos, NC, pagos y reportes. |
| Orden de Producción | Muy alta | 80 | OP, tareas, panel, tráfico y asignaciones. |
| Gestión Calidad | Alta | 35 | Procesos, formatos, vacaciones y flujos SGC adicionales. |
| Hojas de Tiempo | Media | 10 | Timesheet y dashboard cliente. |
| Contratos | Alta | 14 | Listado, creación, estados/adjuntos/acciones. |
| Correspondencia / Recepción | Alta | 21 | Radicados, recibidos, enviados e inbox. |
| Activos TI | Alta | 18 | Panel e inventario. |
| SIG estático | Baja | 1 | Documentos informativos. |
| Helpdesk | Migrado | 0 | Ya migrado funcionalmente. |
| **Total estimado** |  | **452 días hábiles** | Excluye Cotizaciones y Banco de Imágenes. |

## Detalle por módulo y submódulo

### 1. Sistema General — 40 días

Legacy relacionado: `Erp/application/controllers/Parameters/`, `sys_menu`, roles/permisos legacy.

| Submódulo | Ruta legacy / referencia | Complejidad | Días |
|---|---|---:|---:|
| Menús | `Parameters/Menu/C_Menu` | Media | 4 |
| Roles | `Parameters/Roles/C_Roles` | Media | 4 |
| Usuarios | `Parameters/User/C_User` | Media/Alta | 5 |
| Permisos de menú | `Permissions` | Alta | 5 |
| Permisos de botones/acciones | `Buttons` | Alta | 5 |
| Cargos | `Parameters/Cargos/C_Cargos` | Baja/Media | 2 |
| Empresa | `Company` | Media | 2 |
| Servicios | `Services` | Media | 2 |
| Emisoras / estaciones | `Station` | Media | 2 |
| Medios | `Medios` | Media | 2 |
| Programas radio | `Station/Program` | Media | 2 |
| Programas TV | `ProgTV` | Media | 1 |
| Resoluciones | `Resolutions` | Media | 1 |
| Retención | `Retention` | Media | 1 |
| Notificación | `Notification` | Media | 1 |
| Rol herramientas | `RolTools` | Media | 1 |

### 2. Clientes y Proveedores — 29 días

Legacy relacionado: `Erp/application/controllers/Parameters/Client/C_Client.php`.

| Submódulo | Ruta legacy | Complejidad | Días |
|---|---|---:|---:|
| Clientes | `ClientSupplier/ListClient` | Alta | 8 |
| Proveedores | `ClientSupplier/ListSupplier` | Alta | 9 |
| Solicitud de registro | `ClientSupplier/newRecord` | Alta | 12 |

### 3. Admin Medios — 91 días

Legacy relacionado: `Erp/application/controllers/Managerbudget/`.

Este módulo es de los más pesados. NO debe tratarse como CRUD simple: contiene reglas de órdenes, presupuestos, reportes, documentos, estados, relaciones con medios/clientes/proveedores y flujos de aprobación.

| Submódulo | Ruta legacy | Complejidad | Días |
|---|---|---:|---:|
| Consultar medios / búsqueda general | `Managerbudget/C_Manager.php` | Media | 4 |
| Orden de costo | `Managerbudget/O_Cost/C_Cost.php` | Muy alta | 15 restantes / 25 full |
| Orden de gasto | `Managerbudget/O_Expense/C_Expense.php` | Alta | 14 |
| Presupuesto prensa / aviso | `Managerbudget/C_Ppto.php` | Alta | 6 |
| Presupuesto clasificado | `Managerbudget/C_Ppto.php` | Alta | 5 |
| Presupuesto revista | `Managerbudget/C_Ppto.php` | Alta | 5 |
| Presupuesto radio | `Managerbudget/C_Ppto.php` | Alta | 5 |
| Presupuesto TV | `Managerbudget/C_Ppto.php` | Alta | 6 |
| Presupuesto externa | `Managerbudget/C_Ppto.php` | Alta | 6 |
| Presupuesto interna | `Managerbudget/C_Ppto.php` | Media | 4 |
| Presupuesto publicidad exterior | `Managerbudget/C_Ppto.php` | Alta | 6 |
| Presupuesto impreso | `Managerbudget/C_Ppto.php` | Alta | 6 |
| Presupuesto artículos publicitarios | `Managerbudget/C_Ppto.php` | Alta | 6 |
| Reportes OC/OG + soportes | `Managerbudget/C_Report.php`, soportes de `C_Ppto` | Media | 3 |

> Nota: Orden de costo ya está parcialmente migrada en el nuevo sistema. Si se estimara desde cero, Admin Medios subiría aproximadamente a **101 días**.

### 4. Facturación — 113 días

Legacy relacionado: `Erp/application/controllers/Billing/` y `OP/C_Assign.php`.

Facturación es el módulo con mayor riesgo funcional. Tiene dependencia directa con órdenes, presupuestos, pagos, notas crédito, documentos equivalentes, cierres, incentivos, reportes y cargues externos.

| Submódulo | Ruta legacy | Complejidad | Días |
|---|---|---:|---:|
| Asignar factura / aprobar facturas | `Billing/C_Bill.php`, `ApproveInvoices` | Media | 6 |
| Cargue | `Billing/C_Chargue.php` | Muy alta | 15 |
| Cierre mensual | `Billing/C_Document.php`, `GetMonthClose`, `Close` | Media | 4 |
| Compensar Cuenta 28 | `Billing/C_Count.php` | Alta | 8 |
| Documento equivalente | `Billing/C_Document.php` | Alta | 10 |
| Facturar | `Billing/C_Bill.php` | Muy alta | 18 |
| Liquidar incentivos | `Billing/C_Incentives.php` | Muy alta | 16 |
| Nota crédito | `Billing/C_Credit_Notes.php` | Alta | 12 |
| Reportar pago / historial pagos | `Billing/C_Pay.php` | Alta | 10 |
| Reportes | `Billing/Report/C_Report.php` | Alta | 14 |

### 5. Orden de Producción — 80 días

Legacy relacionado: `Erp/application/controllers/OP/`.

| Submódulo | Ruta legacy | Complejidad | Días |
|---|---|---:|---:|
| Consultar OP | `OP/C_OP.php`, `ListAll`, `ListarOrden` | Alta | 8 |
| Ingresar OP | `OP/C_OP.php`, `CrearOp`, `ActualizarOp` | Alta | 12 |
| Mis tareas | `OP/C_OP.php`, `ListTask/FALSE` | Alta | 10 |
| Mis tareas notificadas | `OP/C_OP.php`, `OtherTask/TRUE` | Media/Alta | 8 |
| Panel de control | `OP/C_Control.php` | Alta | 10 |
| Tareas / formularios por categoría | `OP/C_OP.php`, `views/OP/Form_Categorias*` | Muy alta | 16 |
| Tráfico | `OP/C_Trafic.php` | Alta | 8 |
| Asignación OP / tareas | `OP/C_Assign.php` | Alta | 8 |

### 6. Gestión Calidad — 35 días

Legacy relacionado: `Erp/application/controllers/Sgc/C_Sgc.php`.

| Submódulo | Ruta legacy | Complejidad | Días |
|---|---|---:|---:|
| Procesos | `Process` | Baja | 3 |
| Formatos | `Formats` | Media | 6 |
| Reporte vacaciones | `VacationReport` | Media | 4 |
| Solicitar vacaciones | `RequestVacation`, `GetTableFormat/2`, `NewP(2)` | Alta | 8 |
| Solicitud vacante | `GetTableFormat/1`, `NewP(1)` | Alta | 8 |
| Creación clientes/proveedores desde SGC | `GetTableFormat/3/4`, `PanelClients`, `PanelProvs` | Media | 6 |

### 7. Hojas de Tiempo — 10 días

Legacy relacionado: `Erp/application/controllers/Time/`.

| Submódulo | Ruta legacy | Complejidad | Días |
|---|---|---:|---:|
| Timesheet | `Time/C_Time.php`, `Time/C_Time/MyTimes` | Media | 6 |
| Dashboard cliente | `Time/C_TimeClient.php` | Media | 4 |

### 8. Contratos — 14 días

Legacy relacionado: `Erp/application/controllers/Contracts/C_Contracts.php`.

| Submódulo | Ruta legacy | Complejidad | Días |
|---|---|---:|---:|
| Listar contratos | `Contracts` | Media/Alta | 4 |
| Agregar contrato | `CreateContract` | Media/Alta | 4 |
| Estados / acciones / adjuntos | `Contracts/C_Contracts.php` | Alta | 6 |

### 9. Correspondencia / Recepción — 21 días

Legacy relacionado: `Erp/application/controllers/Reception/`.

| Submódulo | Ruta legacy | Complejidad | Días |
|---|---|---:|---:|
| Radicados | `Reception/C_Filed.php`, `Filed` | Alta | 10 |
| Enviados | `Reception/C_Sent.php` | Media | 5 |
| Recibidos | `Reception/C_Received.php` | Media | 4 |
| Inbox | `Reception/C_Received/Index/TRUE` | Media | 2 |

### 10. Activos TI — 18 días

Legacy relacionado: `Erp/application/controllers/TI/C_TI.php`.

| Submódulo | Ruta legacy | Complejidad | Días |
|---|---|---:|---:|
| Panel | `TI/Panel` | Alta | 8 |
| Inventario / reportes | `TI/Report` | Alta | 10 |

### 11. SIG estático — 1 día

Estos accesos aparecen como documentos/páginas informativas.

| Documento | Ruta legacy / referencia | Complejidad | Días |
|---|---|---:|---:|
| Código de Ética y Conducta | `Ethics` | Baja | 0.25 |
| Políticas del SIG | `Politics` | Baja | 0.25 |
| Alcance del SIG | `Scope` | Baja | 0.25 |
| Reglamento interno | Página estática equivalente | Baja | 0.25 |

### 12. Helpdesk — 0 días pendientes

Legacy relacionado: `Erp/application/controllers/Help/C_Help.php`.

| Submódulo | Ruta legacy | Estado | Días pendientes |
|---|---|---|---:|
| Tickets | `Help` | Migrado funcionalmente en el nuevo sistema | 0 |

## Alcance excluido

### Cotizaciones — excluido

Legacy visible:

| Submódulo | Ruta legacy |
|---|---|
| Solicitud cotización | `Request` |
| Cotizaciones | `Quotations` |

No se estima en este documento.

### Banco de Imágenes — excluido

Legacy visible:

| Submódulo | Ruta legacy |
|---|---|
| Cargar imagen | `Vectors/Upload` |
| Listar imágenes | `Vectors/List` |

No se estima en este documento.

## Supuestos de estimación

- Los días son **días hábiles de desarrollo**, no días calendario.
- Incluyen backend, frontend, integración con base legacy, permisos y validación funcional básica.
- No incluyen infraestructura productiva, compra/configuración de servidores, negociación con proveedores ni soporte post-salida.
- La base de datos legacy se mantiene como fuente; cualquier cambio estructural requiere aprobación explícita.
- Se asume disponibilidad de usuario funcional para validar reglas por módulo.
- Se asume uso de IA para acelerar análisis, documentación y ejecución repetitiva, sin reemplazar validación funcional.
- La cifra puede bajar si se decide recortar alcance funcional, no migrar flujos poco usados o dejar reportes históricos en modo consulta.

## Riesgos principales

| Riesgo | Módulo afectado | Impacto | Mitigación |
|---|---|---|---|
| Tratar módulos complejos como CRUDs | Admin Medios / Facturación / OP | Alto | Discovery por flujo antes de implementar. |
| Presupuestos con reglas distintas por tipo | Admin Medios | Alto | Crear base común y validar tipo por tipo. |
| Cargues Excel/importaciones no documentadas | Facturación | Alto | Conseguir archivos reales y construir pruebas de aceptación. |
| Dependencias contables no explícitas | Facturación | Alto | Migrar por subflujo y validar con usuario contable. |
| Formularios de tareas por categoría | Orden de Producción | Alto | Inventariar categorías antes de estimar compromiso final. |
| Permisos legacy inconsistentes | Sistema General / todos | Medio/Alto | Centralizar permisos en nuevo sistema y validar roles reales. |
| Datos históricos sucios | Todos | Medio | Validar con muestras reales y tolerar estados heredados. |
| Cambios de alcance durante desarrollo | Todos | Alto | Control formal de cambios y reestimación por módulo. |

## Orden recomendado de migración

1. Sistema General y permisos.
2. Clientes y Proveedores.
3. Admin Medios, continuando Órdenes de Costo y luego Presupuestos.
4. Facturación.
5. Orden de Producción.
6. Hojas de Tiempo y Gestión Calidad.
7. Contratos, Correspondencia / Recepción y Activos TI.
8. SIG estático y hardening final.

## Criterio para marcar un módulo como migrado

Un módulo solo se considera migrado cuando cumple:

- [ ] Inventario funcional revisado contra legacy.
- [ ] Tablas y relaciones principales identificadas.
- [ ] Backend nuevo implementado.
- [ ] Frontend nuevo implementado.
- [ ] Permisos aplicados.
- [ ] Validación con datos reales.
- [ ] Usuario funcional aprueba el flujo.
- [ ] Legacy puede dejar de usarse para ese flujo.
