import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import AppShell from '../layouts/AppShell';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import OrdersList from '../pages/OrdersList';
import OrderDetail from '../pages/OrderDetail';
import OrderForm from '../pages/OrderForm';
import Settings from '../pages/Settings';
import SystemMenus from '../pages/SystemMenus';
import SystemRoles from '../pages/SystemRoles';
import SystemUsers from '../pages/SystemUsers';
import ComingSoon from '../pages/ComingSoon';
import CodeOfEthics from '../pages/CodeOfEthics';
import SigPolicies from '../pages/SigPolicies';
import SigScope from '../pages/SigScope';
import InternalRegulation from '../pages/InternalRegulation';
import Helpdesk from '../pages/Helpdesk';
import CostOrdersList from '../pages/CostOrdersList';
import CostOrderForm from '../pages/CostOrderForm';
import CostOrderPrint from '../pages/CostOrderPrint';
import CostOrderCompensate from '../pages/CostOrderCompensate';
import CostOrdersReport from '../pages/CostOrdersReport';
import CostOrdersCompensationReport from '../pages/CostOrdersCompensationReport';
import RolePermissions from '../pages/RolePermissions';
import BudgetPlaceholder from '../pages/BudgetPlaceholder';
import ExternalProductionBudgets from '../pages/ExternalProductionBudgets';
import ExternalProductionBudgetForm from '../pages/ExternalProductionBudgetForm';
import ExternalProductionBudgetOrders from '../pages/ExternalProductionBudgetOrders';
import ExternalProductionBudgetPrint from '../pages/ExternalProductionBudgetPrint';
import ExternalProductionBudgetSupport from '../pages/ExternalProductionBudgetSupport';

const budgetTypes = [
  { slug: 'prensa-aviso', label: 'Prensa / Aviso', hasOrders: true },
  { slug: 'clasificado', label: 'Clasificado', hasOrders: true },
  { slug: 'revista', label: 'Revista', hasOrders: true },
  { slug: 'radio', label: 'Radio', hasOrders: true },
  { slug: 'television', label: 'Televisión', hasOrders: true },
  { slug: 'produccion-externa', label: 'Producción Externa', hasOrders: true },
  { slug: 'produccion-interna', label: 'Producción Interna', hasOrders: false },
  { slug: 'publicidad-exterior', label: 'Publicidad Exterior', hasOrders: true },
  { slug: 'impreso', label: 'Impreso', hasOrders: true },
  { slug: 'articulos-publicitarios', label: 'Artículos Publicitarios', hasOrders: true },
];

function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/medios/ordenes-costo/:id/imprimir"
        element={
          <RequireAuth>
            <CostOrderPrint />
          </RequireAuth>
        }
      />
      <Route
        path="/medios/presupuestos/produccion-externa/:id/imprimir"
        element={
          <RequireAuth>
            <ExternalProductionBudgetPrint />
          </RequireAuth>
        }
      />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/ordenes" element={<OrdersList />} />
        <Route path="/ordenes/nueva" element={<OrderForm />} />
        <Route path="/ordenes/:id" element={<OrderDetail />} />
        <Route path="/usuarios" element={<Settings />} />
        {/* Módulos del roadmap — pantalla "en construcción" */}
        <Route path="/buscador" element={<ComingSoon />} />
        <Route path="/cotizaciones" element={<ComingSoon />} />
        <Route path="/contratos" element={<ComingSoon />} />
        <Route path="/facturacion" element={<ComingSoon />} />
        <Route path="/recepcion" element={<ComingSoon />} />
        <Route path="/clientes" element={<ComingSoon />} />
        <Route path="/medios" element={<ComingSoon />} />
        <Route path="/imagenes" element={<ComingSoon />} />
        <Route path="/correspondencia" element={<ComingSoon />} />
        <Route path="/calidad" element={<ComingSoon />} />
        <Route path="/tiempos" element={<ComingSoon />} />
        <Route path="/activos" element={<ComingSoon />} />
        <Route path="/sistema" element={<ComingSoon />} />
        <Route path="/system/menus" element={<SystemMenus />} />
        <Route path="/system/roles" element={<SystemRoles />} />
        <Route path="/system/roles/permissions" element={<RolePermissions />} />
        <Route path="/system/users" element={<SystemUsers />} />
        <Route path="/helpdesk" element={<Helpdesk />} />
        <Route path="/medios/ordenes-costo/listar" element={<CostOrdersList />} />
        <Route path="/medios/ordenes-costo/compensar" element={<CostOrderCompensate />} />
        <Route path="/medios/ordenes-costo/nueva" element={<CostOrderForm />} />
        <Route path="/medios/ordenes-costo/:id/editar" element={<CostOrderForm />} />
        <Route path="/medios/presupuestos/produccion-externa/listar" element={<ExternalProductionBudgets />} />
        <Route path="/medios/presupuestos/produccion-externa/nuevo" element={<ExternalProductionBudgetForm />} />
        <Route path="/medios/presupuestos/produccion-externa/:id/editar" element={<ExternalProductionBudgetForm />} />
        <Route path="/medios/presupuestos/produccion-externa/:id/soporte-pauta" element={<ExternalProductionBudgetSupport />} />
        <Route path="/medios/presupuestos/produccion-externa/ordenes" element={<ExternalProductionBudgetOrders />} />
        {budgetTypes.map((budgetType) => (
          <Route key={`${budgetType.slug}-listar`} path={`/medios/presupuestos/${budgetType.slug}/listar`} element={<BudgetPlaceholder typeLabel={budgetType.label} section="listar" />} />
        ))}
        {budgetTypes.filter((budgetType) => budgetType.hasOrders).map((budgetType) => (
          <Route key={`${budgetType.slug}-ordenes`} path={`/medios/presupuestos/${budgetType.slug}/ordenes`} element={<BudgetPlaceholder typeLabel={budgetType.label} section="ordenes" />} />
        ))}
        <Route path="/reportes/ordenes-costo" element={<Navigate to="/reportes/ordenes-costo/general" replace />} />
        <Route path="/reportes/ordenes-costo/general" element={<CostOrdersReport />} />
        <Route path="/reportes/ordenes-costo/compensacion" element={<CostOrdersCompensationReport />} />
        <Route path="/accesos-rapidos/codigo-etica-conducta" element={<CodeOfEthics />} />
        <Route path="/accesos-rapidos/politicas-sig" element={<SigPolicies />} />
        <Route path="/accesos-rapidos/alcance-sig" element={<SigScope />} />
        <Route path="/accesos-rapidos/reglamento-interno" element={<InternalRegulation />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
