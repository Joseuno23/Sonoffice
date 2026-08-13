// Tiny fetch wrapper for the Node backend (proxied at /api by Vite).
const BASE = '/api';

async function req(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error('Request failed: ' + res.status);
  return res.json();
}

export const api = {
  login: (email, password) => req('/auth/login', { method: 'POST', body: JSON.stringify({ username: email, password }) }),
  changeRequiredPassword: (payload) => req('/auth/change-required-password', { method: 'POST', body: JSON.stringify(payload) }),
  forgotPassword: (payload) => req('/auth/forgot-password', { method: 'POST', body: JSON.stringify(payload) }),
  getOrders: () => req('/orders'),
  getOrder: (id) => req('/orders/' + encodeURIComponent(id)),
  createOrder: (payload) => req('/orders', { method: 'POST', body: JSON.stringify(payload) }),
  getUsers: () => req('/users'),
  getDashboard: () => req('/dashboard'),
};
