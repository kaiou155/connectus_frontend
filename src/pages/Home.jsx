import { Link } from 'react-router-dom';
import { BarChart3, Clock, Filter, MessageCircle, Network, UserPlus, Users, UsersRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { relatorioService } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { PERFIS } from '../utils/constants';
import { formatarNumero, primeiroNome } from '../utils/format';

const { ADMINISTRADOR, LIDER, VOLUNTARIO } = PERFIS;

function AtalhoCard({ to, icon: Icon, titulo, texto, selo }) {
  return (
    <Link to={to} className="card card--link">
      <div className="row row--between" style={{ alignItems: 'flex-start' }}>
        <span className="icon-tile">
          <Icon size={18} />
        </span>
        {selo && <span className="badge badge--neutral">{selo}</span>}
      </div>
      <div className="card__title" style={{ marginTop: 14 }}>{titulo}</div>
      <p className="card__text">{texto}</p>
      <div className="small strong" style={{ marginTop: 12 }}>Acessar →</div>
    </Link>
  );
}

// Tela inicial
export default function Home() {
  const { usuario, temPerfil } = useAuth();
  const { dados } = useAsync(() => relatorioService.resumo(), []);
  const k = dados?.kpis;

  const atalhos = [
    {
      perfis: [ADMINISTRADOR, VOLUNTARIO, LIDER], to: '/lideres', icon: UsersRound, titulo: 'Líderes',
      texto: 'Líderes de cada célula e seus contatos.', selo: k && `${k.lideres} ativos`,
    },
    {
      perfis: [ADMINISTRADOR, VOLUNTARIO, LIDER], to: '/celulas', icon: Network, titulo: 'Células',
      texto: 'Todas as células, horários, localização e vagas.', selo: k && `${k.celulasAtivas} células`,
    },
    {
      perfis: [ADMINISTRADOR, VOLUNTARIO], to: '/triagem', icon: Filter, titulo: 'Triagem',
      texto: 'Algoritmo automático por idade, perfil, disponibilidade e localização.', selo: k && `${k.pendentes} pendentes`,
    },
    {
      perfis: [ADMINISTRADOR, VOLUNTARIO], to: '/lista-espera', icon: Clock, titulo: 'Lista de espera',
      texto: 'Membros sem célula compatível aguardando uma vaga.', selo: k && `${k.listaEspera} aguardando`,
    },
    {
      perfis: [ADMINISTRADOR, LIDER], to: '/feedback', icon: MessageCircle, titulo: 'Feedback',
      texto: 'Acompanhamento dos membros triados pelo líder.', selo: usuario.nomeCelula ?? 'Para líderes',
    },
    {
      perfis: [ADMINISTRADOR, VOLUNTARIO, LIDER], to: '/membros', icon: Users,
      titulo: temPerfil(LIDER) ? 'Membros da célula' : 'Membros',
      texto: 'Busca e consulta de membros com filtros.',
    },
    {
      perfis: [ADMINISTRADOR], to: '/relatorios', icon: BarChart3, titulo: 'Relatórios',
      texto: 'Novos membros, ocupação e distribuição geográfica.',
    },
  ].filter((a) => a.perfis.includes(usuario.perfil));

  return (
    <>
      <section className="hero">
        <div className="eyebrow">Painel principal</div>
        <h1 className="hero__title">Bem-vindo ao Conectus, {primeiroNome(usuario.nome)}</h1>
        <p className="hero__text">
          Conecte cada nova vida à célula certa — automaticamente, com base em idade, localização e perfil.
        </p>
        {temPerfil(ADMINISTRADOR, VOLUNTARIO) && (
          <>
            <Link to="/membros/novo" className="btn btn--primary btn--lg">
              <UserPlus size={18} /> Cadastrar novo membro
            </Link>
            <p className="tiny muted" style={{ marginTop: 8 }}>A triagem é iniciada logo após o cadastro.</p>
          </>
        )}
        {temPerfil(LIDER) && (
          <Link to="/feedback" className="btn btn--primary btn--lg">
            <MessageCircle size={18} /> Acompanhar minha célula
          </Link>
        )}
      </section>

      <div className="grid grid--3">
        {atalhos.map((a) => (
          <AtalhoCard key={a.to} {...a} />
        ))}
      </div>

      {k && (
        <div className="grid grid--3" style={{ marginTop: 16 }}>
          <div className="card kpi">
            <div className="kpi__label">Membros ativos</div>
            <div className="kpi__value">{formatarNumero(k.membrosAtivos)}</div>
            <div className="kpi__delta">+{k.novosSemana} cadastrados esta semana</div>
          </div>
          <div className="card kpi">
            <div className="kpi__label">Triagens hoje</div>
            <div className="kpi__value">{k.triagensHoje}</div>
            <div className="kpi__delta">{k.pendentes} aguardando</div>
          </div>
          <div className="card kpi">
            <div className="kpi__label">Taxa de ocupação</div>
            <div className="kpi__value">{k.taxaOcupacao}%</div>
            <div className="kpi__delta">das vagas das células ativas</div>
          </div>
        </div>
      )}
    </>
  );
}
