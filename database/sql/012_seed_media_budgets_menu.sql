-- 012_seed_media_budgets_menu.sql
-- Propósito: registrar el menú "Presupuestos" dentro de Medios con sus tipos
-- y opciones iniciales de navegación, sin lógica de negocio.
-- IMPORTANTE:
-- - Script preparado para MariaDB/MySQL.
-- - No ejecutar sin aprobación explícita.
-- - No altera tablas legacy. Solo inserta filas en app_menus / app_role_menu_permissions.
-- - Idempotente: se puede ejecutar varias veces sin duplicar.

-- Menú raíz: Medios (contenedor, sin ruta propia). Se asegura por si este seed se ejecuta aislado.
INSERT INTO app_menus (code, parent_id, label, route, icon, sort_order, is_active)
SELECT 'media', NULL, 'Medios', NULL, 'image', 40, 1
WHERE NOT EXISTS (
  SELECT 1 FROM app_menus WHERE code = 'media'
);

-- Contenedor: Presupuestos dentro de Medios.
INSERT INTO app_menus (code, parent_id, label, route, icon, sort_order, is_active)
SELECT 'media.budgets', parent.id, 'Presupuestos', NULL, 'file', 20, 1
FROM app_menus AS parent
WHERE parent.code = 'media'
  AND NOT EXISTS (
    SELECT 1 FROM app_menus WHERE code = 'media.budgets'
  );

-- Tipos de presupuesto.
INSERT INTO app_menus (code, parent_id, label, route, icon, sort_order, is_active)
SELECT seed.code, parent.id, seed.label, NULL, 'file', seed.sort_order, 1
FROM app_menus AS parent
JOIN (
  SELECT 'media.budgets.prensa-aviso' AS code, 'Prensa / Aviso' AS label, 10 AS sort_order UNION ALL
  SELECT 'media.budgets.clasificado', 'Clasificado', 20 UNION ALL
  SELECT 'media.budgets.revista', 'Revista', 30 UNION ALL
  SELECT 'media.budgets.radio', 'Radio', 40 UNION ALL
  SELECT 'media.budgets.television', 'Televisión', 50 UNION ALL
  SELECT 'media.budgets.produccion-externa', 'Producción Externa', 60 UNION ALL
  SELECT 'media.budgets.produccion-interna', 'Producción Interna', 70 UNION ALL
  SELECT 'media.budgets.publicidad-exterior', 'Publicidad Exterior', 80 UNION ALL
  SELECT 'media.budgets.impreso', 'Impreso', 90 UNION ALL
  SELECT 'media.budgets.articulos-publicitarios', 'Artículos Publicitarios', 100
) AS seed
WHERE parent.code = 'media.budgets'
  AND NOT EXISTS (
    SELECT 1 FROM app_menus WHERE code = seed.code
  );

-- Opción Listar para todos los tipos de presupuesto.
INSERT INTO app_menus (code, parent_id, label, route, icon, sort_order, is_active)
SELECT CONCAT(parent.code, '.list'), parent.id, 'Listar', CONCAT('/medios/presupuestos/', seed.slug, '/listar'), 'file', 10, 1
FROM app_menus AS parent
JOIN (
  SELECT 'prensa-aviso' AS slug, 'media.budgets.prensa-aviso' AS parent_code UNION ALL
  SELECT 'clasificado', 'media.budgets.clasificado' UNION ALL
  SELECT 'revista', 'media.budgets.revista' UNION ALL
  SELECT 'radio', 'media.budgets.radio' UNION ALL
  SELECT 'television', 'media.budgets.television' UNION ALL
  SELECT 'produccion-externa', 'media.budgets.produccion-externa' UNION ALL
  SELECT 'produccion-interna', 'media.budgets.produccion-interna' UNION ALL
  SELECT 'publicidad-exterior', 'media.budgets.publicidad-exterior' UNION ALL
  SELECT 'impreso', 'media.budgets.impreso' UNION ALL
  SELECT 'articulos-publicitarios', 'media.budgets.articulos-publicitarios'
) AS seed ON seed.parent_code = parent.code
WHERE NOT EXISTS (
  SELECT 1 FROM app_menus WHERE code = CONCAT(parent.code, '.list')
);

-- Opción Órdenes para los tipos que requieren órdenes de proveedor.
INSERT INTO app_menus (code, parent_id, label, route, icon, sort_order, is_active)
SELECT CONCAT(parent.code, '.orders'), parent.id, 'Órdenes', CONCAT('/medios/presupuestos/', seed.slug, '/ordenes'), 'receipt', 20, 1
FROM app_menus AS parent
JOIN (
  SELECT 'prensa-aviso' AS slug, 'media.budgets.prensa-aviso' AS parent_code UNION ALL
  SELECT 'clasificado', 'media.budgets.clasificado' UNION ALL
  SELECT 'revista', 'media.budgets.revista' UNION ALL
  SELECT 'radio', 'media.budgets.radio' UNION ALL
  SELECT 'television', 'media.budgets.television' UNION ALL
  SELECT 'produccion-externa', 'media.budgets.produccion-externa' UNION ALL
  SELECT 'publicidad-exterior', 'media.budgets.publicidad-exterior' UNION ALL
  SELECT 'impreso', 'media.budgets.impreso' UNION ALL
  SELECT 'articulos-publicitarios', 'media.budgets.articulos-publicitarios'
) AS seed ON seed.parent_code = parent.code
WHERE NOT EXISTS (
  SELECT 1 FROM app_menus WHERE code = CONCAT(parent.code, '.orders')
);

-- Permisos de visibilidad para el rol 33 (mismo criterio que los menús de Medios existentes).
-- El rol 1 (root) NO requiere filas: ve todos los menús activos de forma implícita.
INSERT INTO app_role_menu_permissions (role_id, menu_id, can_view)
SELECT 33, menu.id, 1
FROM app_menus AS menu
WHERE menu.code IN (
  'media',
  'media.budgets',
  'media.budgets.prensa-aviso',
  'media.budgets.prensa-aviso.list',
  'media.budgets.prensa-aviso.orders',
  'media.budgets.clasificado',
  'media.budgets.clasificado.list',
  'media.budgets.clasificado.orders',
  'media.budgets.revista',
  'media.budgets.revista.list',
  'media.budgets.revista.orders',
  'media.budgets.radio',
  'media.budgets.radio.list',
  'media.budgets.radio.orders',
  'media.budgets.television',
  'media.budgets.television.list',
  'media.budgets.television.orders',
  'media.budgets.produccion-externa',
  'media.budgets.produccion-externa.list',
  'media.budgets.produccion-externa.orders',
  'media.budgets.produccion-interna',
  'media.budgets.produccion-interna.list',
  'media.budgets.publicidad-exterior',
  'media.budgets.publicidad-exterior.list',
  'media.budgets.publicidad-exterior.orders',
  'media.budgets.impreso',
  'media.budgets.impreso.list',
  'media.budgets.impreso.orders',
  'media.budgets.articulos-publicitarios',
  'media.budgets.articulos-publicitarios.list',
  'media.budgets.articulos-publicitarios.orders'
)
  AND EXISTS (
    SELECT 1 FROM sys_roles WHERE id_roles = 33
  )
  AND NOT EXISTS (
    SELECT 1
    FROM app_role_menu_permissions AS permission
    WHERE permission.role_id = 33
      AND permission.menu_id = menu.id
  );
