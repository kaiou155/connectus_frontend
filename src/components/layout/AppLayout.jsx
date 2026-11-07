import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import {
  BarChart3, Bell, Clock, Home, LogOut, MessageCircle, Network, Search, Settings, UserCog, Users, Filter,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { notificacaoService } from '../../services/api';
import { config } from '../../services/config';
import { useAsync } from '../../hooks/useAsync';
import { Avatar } from '../ui';
import { PERFIL_LABEL, PERFIS } from '../../utils/constants';
import { primeiroNome } from '../../utils/format';

const { ADMINISTRADOR, LIDER, VOLUNTARIO } = PERFIS;

export const NAV_ITENS = [
  { to: '/', label: 'Início', icon: Home, perfis: [ADMINISTRADOR, LIDER, VOLUNTARIO], end: true },
  { to: '/relatorios', label: 'Dashboards', icon: BarChart3, perfis: [ADMINISTRADOR] },
  { to: '/triagem', label: 'Triagem', icon: Filter, perfis: [ADMINISTRADOR, VOLUNTARIO] },
  { to: '/lista-espera', label: 'Lista de espera', icon: Clock, perfis: [ADMINISTRADOR, VOLUNTARIO] },
  { to: '/celulas', label: 'Células', icon: Network, perfis: [ADMINISTRADOR, LIDER, VOLUNTARIO] },
  { to: '/membros', label: 'Membros', icon: Users, perfis: [ADMINISTRADOR, LIDER, VOLUNTARIO] },
  { to: '/feedback', label: 'Feedback', icon: MessageCircle, perfis: [ADMINISTRADOR, LIDER] },
  { to: '/usuarios', label: 'Usuários', icon: UserCog, perfis: [ADMINISTRADOR] },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, perfis: [ADMINISTRADOR] },
];

function useClickFora(ref, onFora) {
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && onFora();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, onFora]);
}

function Notificacoes() {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  useClickFora(ref, () => setAberto(false));
  const { dados, recarregar } = useAsync(() => notificacaoService.listar(), [], { pollingMs: config.pollingMs });
  const lista = dados ?? [];

  const abrir = async (n) => {
    setAberto(false);
    await notificacaoService.marcarLida(n.id).catch(() => {});
    recarregar({ silencioso: true });
    navigate(n.link);
  };

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        className="icon-button"
        onClick={() => setAberto((v) => !v)}
        aria-label={`Notificações${lista.length ? ` (${lista.length} novas)` : ''}`}
        aria-expanded={aberto}
      >
        <Bell size={17} />
        {lista.length > 0 && <span className="icon-button__dot">{lista.length}</span>}
      </button>
      {aberto && (
        <div className="dropdown" style={{ width: 320 }}>
          <div className="eyebrow" style={{ padding: '4px 10px' }}>Notificações</div>
          {lista.length === 0 && <p className="small muted" style={{ padding: '4px 10px' }}>Nenhuma notificação nova.</p>}
          {lista.map((n) => (
            <button key={n.id} className="dropdown__item" onClick={() => abrir(n)} style={{ alignItems: 'flex-start' }}>
              <span className="icon-tile" style={{ width: 30, height: 30 }}>
                <Clock size={15} />
              </span>
              <span>
                <span className="strong small" style={{ display: 'block' }}>{n.titulo}</span>
                <span className="small muted">{n.mensagem}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MenuUsuario() {
  const { usuario, logout } = useAuth();
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);
  useClickFora(ref, () => setAberto(false));
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="user-chip" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} aria-haspopup="menu">
        <Avatar nome={usuario.nome} size="sm" />
        <span className="user-chip__text" style={{ textAlign: 'left', lineHeight: 1.15 }}>
          {usuario.nome}
          <span className="user-chip__role" style={{ display: 'block' }}>{PERFIL_LABEL[usuario.perfil]}</span>
        </span>
      </button>
      {aberto && (
        <div className="dropdown" role="menu">
          <div style={{ padding: '6px 10px 10px' }}>
            <div className="strong">{usuario.nome}</div>
            <div className="small muted">{usuario.email}</div>
            {usuario.nomeCelula && <div className="small muted">Líder de {usuario.nomeCelula}</div>}
          </div>
          <button className="dropdown__item" role="menuitem" onClick={logout}>
            <LogOut size={16} /> Sair
          </button>
        </div>
      )}
    </div>
  );
}

function BuscaGlobal() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  return (
    <form
      className="header-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim().length >= 2) navigate(`/busca?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <Search size={15} />
      <label className="sr-only" htmlFor="busca-global">Buscar</label>
      <input
        id="busca-global"
        type="search"
        placeholder="Buscar membros, células, líderes…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
    </form>
  );
}

export default function AppLayout() {
  const { usuario, temPerfil, logout } = useAuth();
  const itens = NAV_ITENS.filter((i) => i.perfis.includes(usuario.perfil));

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <Link to="/" className="brand" aria-label="Conectus — início">
            <span className="brand__mark">C</span>
            <span>
              <span className="brand__name">CONECTUS</span>
              <span className="brand__tagline">Unindo vidas em Cristo</span>
            </span>
          </Link>
          <BuscaGlobal />
          <div className="header-actions">
            {temPerfil(ADMINISTRADOR, VOLUNTARIO) && <Notificacoes />}
            <MenuUsuario />
          </div>
        </div>
      </header>

      <main className="app-main" id="conteudo">
        {config.useMock && (
          <div className="alert alert--info no-print" style={{ marginBottom: 18, fontSize: 13 }}>
            <span>
              <strong>Modo demonstração</strong> — os dados são simulados no navegador. Defina <code>VITE_USE_MOCK=false</code> para usar a API real.
              Olá, {primeiroNome(usuario.nome)}!
            </span>
          </div>
        )}
        <Outlet />
      </main>

      <nav className="app-footer-nav" aria-label="Navegação principal">
        <div className="app-footer-nav__inner">
          {itens.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-link">
              <Icon size={15} /> {label}
            </NavLink>
          ))}
          <button className="nav-link" onClick={logout}>
            <LogOut size={15} /> Sair
          </button>
        </div>
      </nav>
    </div>
  );
}
