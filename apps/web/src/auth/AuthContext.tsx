import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('son_user') || 'null');
    } catch {
      return null;
    }
  });

  const login = (u) => {
    setUser(u);
    localStorage.setItem('son_user', JSON.stringify(u));
  };
  const logout = () => {
    setUser(null);
    localStorage.removeItem('son_user');
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
