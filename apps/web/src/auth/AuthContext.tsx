import { createContext, useContext, useEffect, useState } from 'react';
import { api, onUnauthorizedSession, setAuthToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      if (!localStorage.getItem('son_token')) return null;
      return JSON.parse(localStorage.getItem('son_user') || 'null');
    } catch {
      return null;
    }
  });

  const login = (u, token) => {
    setAuthToken(token);
    setUser(u);
    localStorage.setItem('son_user', JSON.stringify(u));
  };
  const updateUser = (patch) => {
    setUser((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      localStorage.setItem('son_user', JSON.stringify(next));
      return next;
    });
  };
  const logout = () => {
    setUser(null);
    setAuthToken(null);
    localStorage.removeItem('son_user');
  };

  useEffect(() => onUnauthorizedSession(() => {
    setUser(null);
    setAuthToken(null);
    localStorage.removeItem('son_user');
    if (window.location.pathname !== '/login') window.location.assign('/login');
  }), []);

  useEffect(() => {
    if (!user?.id) return;

    let live = true;
    api.getSystemUser(user.id)
      .then((response) => {
        if (!live || response?.success === false || !response?.data) return;
        updateUser({
          name: response.data.name ?? user.name,
          avatar: response.data.avatar ?? null,
          avatarUrl: response.data.avatarUrl ?? null,
        });
      })
      .catch(() => {});

    return () => { live = false; };
  }, [user?.id]);

  return <AuthContext.Provider value={{ user, login, logout, updateUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
