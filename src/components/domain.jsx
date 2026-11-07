import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock, Mail, MapPin, Phone, Users, UserRound, Pencil } from 'lucide-react';
import { celulaService, membroService } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useToast } from '../context/ToastContext';
import { Badge, ErrorState, InfoTile, Loading, Modal, OccupancyBar, TextAreaField } from './ui';
import { diaLabel, perfilGrupoLabel } from '../utils/constants';
import { formatarHorario } from '../utils/format';

/** "Quartas 20h", "Terças 19h30"… */
export const encontroTexto = (c) => `${diaLabel(c.diaSemana)}s ${formatarHorario(c.horario)}`;

const linkWhatsApp = (telefone = '') => `https://wa.me/55${telefone.replace(/\D/g, '')}`;

/** Card de célula — ocupação em tempo real e bloqueio quando lotada. */
export function CelulaCard({ celula, onDetalhes, acao }) {
  return (
    <article className="card" style={{ opacity: celula.ativa === false ? 0.6 : 1 }}>
      <div className="row row--between" style={{ alignItems: 'flex-start' }}>
        <div>
          <h3 className="card__title">{celula.nomeCelula}</h3>
          <div className="small muted">Líder: {celula.lider?.nome ?? '—'}</div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {celula.ativa === false && <Badge tone="neutral">Inativa</Badge>}
          {celula.lotada && celula.ativa !== false && <Badge tone="danger">Lotada</Badge>}
          <Badge>{perfilGrupoLabel(celula.perfilGrupo)} {celula.faixaEtaria}</Badge>
        </div>
      </div>
      <div className="row small muted" style={{ margin: '12px 0', gap: 16 }}>
        <span className="row" style={{ gap: 5 }}><Clock size={14} /> {encontroTexto(celula)}</span>
        <span className="row" style={{ gap: 5 }}><MapPin size={14} /> {celula.endereco || celula.bairro}</span>
      </div>
      <OccupancyBar atual={celula.capacidadeAtual} maxima={celula.capacidadeMaxima} />
      <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
        {acao}
        {onDetalhes && (
          <button className="btn btn--sm" onClick={() => onDetalhes(celula)}>
            Detalhes →
          </button>
        )}
      </div>
    </article>
  );
}

/** Detalhes da célula: permite inspecionar antes de alocar. */
export function CelulaDetalhesModal({ idCelula, onClose, onEditar, acaoExtra }) {
  const { dados: c, erro, carregando, recarregar } = useAsync(
    () => (idCelula ? celulaService.obter(idCelula) : Promise.resolve(null)),
    [idCelula],
  );
  return (
    <Modal
      open={Boolean(idCelula)}
      onClose={onClose}
      footer={
        c && (
          <>
            {onEditar && (
              <button className="btn" onClick={() => onEditar(c)}>
                <Pencil size={15} /> Editar
              </button>
            )}
            <button className="btn" onClick={onClose}>Fechar</button>
            {acaoExtra?.(c)}
            {c.lider?.telefone && !acaoExtra && (
              <a className="btn btn--primary" href={linkWhatsApp(c.lider.telefone)} target="_blank" rel="noreferrer">
                Contatar líder
              </a>
            )}
          </>
        )
      }
    >
      {carregando && <Loading />}
      {erro && <ErrorState erro={erro} onRetry={recarregar} />}
      {c && (
        <>
          <Badge>{perfilGrupoLabel(c.perfilGrupo)} {c.faixaEtaria}</Badge>
          <h2 className="modal__title" style={{ marginTop: 10 }}>{c.nomeCelula}</h2>
          {c.descricao && <p className="muted small" style={{ margin: '4px 0 0' }}>{c.descricao}</p>}
          <div className="grid grid--2" style={{ marginTop: 16, gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))' }}>
            <InfoTile icon={UserRound} label="Líder">{c.lider?.nome ?? 'Sem líder ativo'}</InfoTile>
            <InfoTile icon={Clock} label="Encontros">{encontroTexto(c)}</InfoTile>
            <InfoTile icon={MapPin} label="Local">{[c.endereco, c.bairro].filter(Boolean).join(' · ')}</InfoTile>
            <InfoTile icon={Users} label="Membros">
              {c.capacidadeAtual} de {c.capacidadeMaxima} (capacidade máx.)
            </InfoTile>
            <InfoTile icon={Phone} label="Telefone do líder">{c.lider?.telefone || '—'}</InfoTile>
            <InfoTile icon={Mail} label="E-mail">{c.lider?.email || '—'}</InfoTile>
          </div>
          <div style={{ marginTop: 12 }}>
            <OccupancyBar atual={c.capacidadeAtual} maxima={c.capacidadeMaxima} />
          </div>
          {c.proximaReuniao && (
            <div className="info-tile" style={{ marginTop: 12, background: 'var(--surface-strong)' }}>
              <div className="info-tile__label"><CalendarDays size={13} /> Próxima reunião</div>
              <div className="info-tile__value" style={{ fontSize: 18 }}>
                {new Date(c.proximaReuniao).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })} às{' '}
                {formatarHorario(c.horario)}
              </div>
            </div>
          )}
          {c.integrantes?.length > 0 && (
            <>
              <div className="eyebrow" style={{ marginTop: 16 }}>Integrantes recentes</div>
              <div className="chips">
                {c.integrantes.slice(0, 8).map((i) => (
                  <span className="chip" key={i.idMembro}>{i.nomeCompleto}</span>
                ))}
                {c.integrantes.length > 8 && <span className="chip">+{c.integrantes.length - 8}</span>}
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

/** Registrar saída de membro. */
export function SaidaMembroModal({ membro, onClose, onConcluido, admin }) {
  const toast = useToast();
  const [motivo, setMotivo] = useState('');
  const [reencaminhar, setReencaminhar] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    if (!motivo.trim()) {
      setErro('Informe o motivo da saída.');
      return;
    }
    setEnviando(true);
    try {
      await membroService.registrarSaida(membro.idMembro, { motivo, reencaminhar });
      toast.sucesso(`Saída de ${membro.nomeCompleto} registrada.`);
      onConcluido?.();
      onClose();
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      open={Boolean(membro)}
      onClose={onClose}
      size="sm"
      title={admin ? 'Desvincular membro' : 'Registrar saída'}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={enviando}>Cancelar</button>
          <button className="btn btn--danger" onClick={confirmar} disabled={enviando}>
            {enviando ? 'Registrando…' : 'Confirmar saída'}
          </button>
        </>
      }
    >
      {membro && (
        <div className="stack" style={{ marginTop: 12 }}>
          <p className="muted small" style={{ margin: 0 }}>
            {membro.nomeCompleto} será removido(a) de <strong>{membro.celula?.nomeCelula}</strong>. A ocupação da célula é atualizada e a saída fica no histórico.
          </p>
          <TextAreaField
            label="Motivo da saída"
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              setErro('');
            }}
            placeholder="Ex.: mudou de bairro, horário incompatível…"
            error={erro}
          />
          <label className="checkbox">
            <input type="checkbox" checked={reencaminhar} onChange={(e) => setReencaminhar(e.target.checked)} />
            Encaminhar para nova triagem
          </label>
        </div>
      )}
    </Modal>
  );
}

export const LinkMembro = ({ membro }) => (
  <Link to={`/membros/${membro.idMembro}`} className="strong" style={{ textDecoration: 'none' }}>
    {membro.nomeCompleto}
  </Link>
);
