import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import AppShell from '../layouts/AppShell';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import OrdersList from '../pages/OrdersList';
import OrderDetail from '../pages/OrderDetail';
import OrderForm from '../pages/OrderForm';
import Settings from '../pages/Settings';
import ComingSoon from '../pages/ComingSoon';

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
        <Route path="/helpdesk" element={<ComingSoon />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
