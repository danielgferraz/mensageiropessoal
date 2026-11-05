import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getStoredAdminToken, setStoredAdminSession, clearStoredAdminSession, apiFetch } from '@/lib/api';

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface AuthContextType {
  user: AdminUser | null;
  loading: boolean;
  isAdmin: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const verifyToken = useCallback(async (token: string): Promise<boolean> => {
    try {
      const res = await fetch('/mensageiro/api/auth/verify', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 403) {
          setError(data.error || 'Acesso negado: perfil de Administrador obrigatório.');
        } else {
          setError(null);
        }
        setUser(null);
        setIsAdmin(false);
        return false;
      }

      const data = await res.json();
      if (data.authorized && data.user) {
        setUser(data.user);
        setIsAdmin(data.user.role === 'admin');
        setError(null);
        return true;
      }

      setUser(null);
      setIsAdmin(false);
      setError(data.error || 'Acesso restrito a Administradores.');
      return false;
    } catch (err: any) {
      console.error('[Auth Verify Error]', err);
      setError('Erro de conexão ao verificar credenciais.');
      return false;
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    setLoading(true);
    const token = getStoredAdminToken();
    if (!token) {
      setUser(null);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    await verifyToken(token);
    setLoading(false);
  }, [verifyToken]);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const login = async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/mensageiro/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        const errorMsg = data.error || 'Falha no login. Verifique email e senha.';
        setError(errorMsg);
        setLoading(false);
        return false;
      }

      setStoredAdminSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: data.user,
      });

      setUser(data.user);
      setIsAdmin(data.user?.role === 'admin');
      setError(null);
      setLoading(false);
      return true;
    } catch (err: any) {
      console.error('[Login Error]', err);
      setError('Erro ao conectar ao servidor de autenticação.');
      setLoading(false);
      return false;
    }
  };

  const logout = () => {
    clearStoredAdminSession();
    setUser(null);
    setIsAdmin(false);
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        error,
        login,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};
