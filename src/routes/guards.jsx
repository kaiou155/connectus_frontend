import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { EmptyState, Loading } from '../components/ui';

/**
 * Exige usuário autenticado.
 * Quem ainda está com senha temporária só acessa a tela de troca de senha.
 */
export function ProtectedRoute() {
  const { usuario, carregando } = useAuth();
  const location = useLocation();
  if (carregando) return <Loading texto="Verificando sessão…" />;
  if (!usuario) return <Navigate to="/login" replace state={{ de: location }} />;
  if (usuario.senhaTemporaria && location.pathname !== '/alterar-senha') {
    return <Navigate to="/alterar-senha" replace />;
  }
  return <Outlet />;
}

/** Restringe a rota a perfis de acesso específicos. */
export function RoleRoute({ perfis }) {
  const { temPerfil } = useAuth();
  if (!temPerfil(...perfis)) {
    return (
      <EmptyState icon={ShieldAlert} title="Acesso restrito">
        Seu perfil não tem permissão para acessar esta página.
      </EmptyState>
    );
  }
  return <Outlet />;
}
