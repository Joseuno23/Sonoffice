// Tiny fetch wrapper for the Node backend (proxied at /api by Vite).
const BASE = '/api';
const ASSET_ORIGIN = import.meta.env.DEV ? 'http://localhost:3001' : '';
const UNAUTHORIZED_EVENT = 'sonoffice:unauthorized';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message = 'Request failed') {
    super(message + ': ' + status);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function assetUrl(path) {
  if (!path) return null;
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  const normalized = path.startsWith('/') ? path : '/' + path;
  return ASSET_ORIGIN + normalized;
}

export function setAuthToken(token) {
  if (token) localStorage.setItem('son_token', token);
  else localStorage.removeItem('son_token');
}

function handleUnauthorized() {
  setAuthToken(null);
  localStorage.removeItem('son_user');
  window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
}

export function onUnauthorizedSession(handler) {
  window.addEventListener(UNAUTHORIZED_EVENT, handler);
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
}

function getAuthToken() {
  return localStorage.getItem('son_token');
}

async function req(path, options: any = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(BASE + path, {
    ...options,
    headers,
  });
  if (res.status === 401) handleUnauthorized();
  if (!res.ok) throw new ApiError(res.status);
  return res.json();
}

async function reqForm(path, formData) {
  const token = getAuthToken();
  const headers = token ? { Authorization: 'Bearer ' + token } : undefined;
  const res = await fetch(BASE + path, { method: 'POST', body: formData, headers });
  if (res.status === 401) handleUnauthorized();
  if (!res.ok) throw new ApiError(res.status);
  return res.json();
}

export const api = {
  login: (email, password) => req('/auth/login', { method: 'POST', body: JSON.stringify({ username: email, password }) }),
  changeRequiredPassword: (payload) => req('/auth/change-required-password', { method: 'POST', body: JSON.stringify(payload) }),
  forgotPassword: (payload) => req('/auth/forgot-password', { method: 'POST', body: JSON.stringify(payload) }),
  getMenus: () => req('/menus'),
  getSystemMenus: () => req('/system/menus'),
  getSystemMenu: (id) => req('/system/menus/' + encodeURIComponent(id)),
  createSystemMenu: (payload) => req('/system/menus', { method: 'POST', body: JSON.stringify(payload) }),
  updateSystemMenu: (id, payload) => req('/system/menus/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(payload) }),
  updateSystemMenuStatus: (id, isActive) => req('/system/menus/' + encodeURIComponent(id) + '/status', { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  getSystemRoles: () => req('/system/roles'),
  getSystemRole: (id) => req('/system/roles/' + encodeURIComponent(id)),
  createSystemRole: (payload) => req('/system/roles', { method: 'POST', body: JSON.stringify(payload) }),
  updateSystemRole: (id, payload) => req('/system/roles/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(payload) }),
  updateSystemRoleStatus: (id, isActive) => req('/system/roles/' + encodeURIComponent(id) + '/status', { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  getSystemRoleMenuPermissions: (id) => req('/system/roles/' + encodeURIComponent(id) + '/menu-permissions'),
  updateSystemRoleMenuPermissions: (id, menuIds) => req('/system/roles/' + encodeURIComponent(id) + '/menu-permissions', { method: 'PUT', body: JSON.stringify({ menuIds }) }),
  getSystemUsers: () => req('/system/users'),
  getSystemUser: (id) => req('/system/users/' + encodeURIComponent(id)),
  createSystemUser: (payload) => req('/system/users', { method: 'POST', body: JSON.stringify(payload) }),
  updateSystemUser: (id, payload) => req('/system/users/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(payload) }),
  uploadSystemUserAvatar: (id, file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return reqForm('/system/users/' + encodeURIComponent(id) + '/avatar', formData);
  },
  updateSystemUserStatus: (id, isActive) => req('/system/users/' + encodeURIComponent(id) + '/status', { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  resetSystemUserPassword: (id) => req('/system/users/' + encodeURIComponent(id) + '/reset-password', { method: 'POST' }),
  getSystemUserOptions: () => req('/system/users/options'),
  getHelpdesk: () => req('/helpdesk'),
  createHelpdeskTicket: (payload, file) => {
    const formData = new FormData();
    formData.append('description', payload.description || '');
    if (file) formData.append('attachment', file);
    return reqForm('/helpdesk', formData);
  },
  resolveHelpdeskTicket: (id, payload) => req('/helpdesk/' + encodeURIComponent(id) + '/resolve', { method: 'PATCH', body: JSON.stringify(payload) }),
  rateHelpdeskTicket: (id, rating) => req('/helpdesk/' + encodeURIComponent(id) + '/rating', { method: 'POST', body: JSON.stringify({ rating }) }),
  getHelpdeskServiceTypes: () => req('/helpdesk/service-types'),
  getHelpdeskServiceDetails: (serviceType) => req('/helpdesk/service-details?serviceType=' + encodeURIComponent(serviceType || '')),
  getOrders: () => req('/orders'),
  getOrder: (id) => req('/orders/' + encodeURIComponent(id)),
  createOrder: (payload) => req('/orders', { method: 'POST', body: JSON.stringify(payload) }),
  getUsers: () => req('/users'),
  getDashboard: () => req('/dashboard'),
};
