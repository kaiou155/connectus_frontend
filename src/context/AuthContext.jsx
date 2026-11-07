import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/api';
import { setUnauthorizedHandler, tokenStore } from '../services/http';

const AuthContext = createContext(null);

/** Lê o payload do JWT sem validar a assinatura (a validação é feita pelo back-end). */
function tokenExpirado(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return !payload.exp || payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUsuario(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    const token = tokenStore.get();
    if (!token || tokenExpirado(token)) {
      tokenStore.clear();
      setCarregando(false);
      return;
    }
    authService
      .me()
      .then(setUsuario)
      .catch(() => tokenStore.clear())
      .finally(() => setCarregando(false));
  }, [logout]);

  const login = useCallback(async (email, senha) => {
    const { token, usuario: u } = await authService.login(email, senha);
    tokenStore.set(token);
    setUsuario(u);
    return u;
  }, []);

  /** Usado após o cadastro de uma nova igreja, que já devolve o token do administrador. */
  const iniciarSessao = useCallback((token, u) => {
    tokenStore.set(token);
    setUsuario(u);
  }, []);

  const value = useMemo(
    () => ({
      usuario,
      carregando,
      login,
      logout,
      iniciarSessao,
      temPerfil: (...perfis) => Boolean(usuario && perfis.includes(usuario.perfil)),
    }),
    [usuario, carregando, login, logout, iniciarSessao],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
};
