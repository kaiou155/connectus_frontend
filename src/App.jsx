import { BrowserRouter, HashRouter, Link, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ProtectedRoute, RoleRoute } from './routes/guards';
import AppLayout from './components/layout/AppLayout';
import { EmptyState } from './components/ui';
import { config } from './services/config';
import { PERFIS } from './utils/constants';

import Login from './pages/Login';
import CadastroIgreja from './pages/CadastroIgreja';
import Home from './pages/Home';
import MembroForm from './pages/MembroForm';
import Membros from './pages/Membros';
import MembroDetalhe from './pages/MembroDetalhe';
import TriagemFila from './pages/TriagemFila';
import TriagemMembro from './pages/TriagemMembro';
import ListaEspera from './pages/ListaEspera';
import Celulas from './pages/Celulas';
import Lideres from './pages/Lideres';
import Feedback from './pages/Feedback';
import Relatorios from './pages/Relatorios';
import Usuarios from './pages/Usuarios';
import Configuracoes from './pages/Configuracoes';
import Busca from './pages/Busca';
import EsqueciSenha from './pages/EsqueciSenha';
import RedefinirSenha from './pages/RedefinirSenha';
import AlterarSenha from './pages/AlterarSenha';

const { ADMINISTRADOR, LIDER, VOLUNTARIO } = PERFIS;
const Router = config.routerMode === 'hash' ? HashRouter : BrowserRouter;

/**
 * Mapa de rotas × perfis de acesso:
 *   Voluntário    — cadastro, triagem, lista de espera, consultas
 *   Líder         — membros da própria célula, feedback, saída de membros
 *   Administrador — tudo, incluindo células, usuários, relatórios e configurações
 */
export default function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro-igreja" element={<CadastroIgreja />} />
            <Route path="/esqueci-senha" element={<EsqueciSenha />} />
            <Route path="/redefinir-senha" element={<RedefinirSenha />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/alterar-senha" element={<AlterarSenha />} />
              <Route element={<AppLayout />}>
                <Route index element={<Home />} />
                <Route path="busca" element={<Busca />} />
                <Route path="celulas" element={<Celulas />} />
                <Route path="lideres" element={<Lideres />} />
                <Route path="membros" element={<Membros />} />
                <Route path="membros/:id" element={<MembroDetalhe />} />

                <Route element={<RoleRoute perfis={[ADMINISTRADOR, VOLUNTARIO]} />}>
                  <Route path="membros/novo" element={<MembroForm />} />
                  <Route path="triagem" element={<TriagemFila />} />
                  <Route path="triagem/:id" element={<TriagemMembro />} />
                  <Route path="lista-espera" element={<ListaEspera />} />
                </Route>

                <Route element={<RoleRoute perfis={[ADMINISTRADOR, LIDER]} />}>
                  <Route path="feedback" element={<Feedback />} />
                </Route>

                <Route element={<RoleRoute perfis={[ADMINISTRADOR]} />}>
                  <Route path="membros/:id/editar" element={<MembroForm />} />
                  <Route path="relatorios" element={<Relatorios />} />
                  <Route path="usuarios" element={<Usuarios />} />
                  <Route path="configuracoes" element={<Configuracoes />} />
                </Route>

                <Route
                  path="*"
                  element={
                    <EmptyState title="Página não encontrada" action={<Link className="btn" to="/">Voltar ao início</Link>}>
                      O endereço acessado não existe.
                    </EmptyState>
                  }
                />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </Router>
  );
}
