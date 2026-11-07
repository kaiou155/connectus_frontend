import { useState } from 'react';
import { CalendarDays, Mail, Network, Phone, Users } from 'lucide-react';
import { liderService } from '../services/api';
import { useAsync, useDebounce } from '../hooks/useAsync';
import { Avatar, Badge, EmptyState, ErrorState, InfoTile, Loading, Modal, PageHeader, TextField } from '../components/ui';
import { perfilGrupoLabel } from '../utils/constants';

const mesAno = (iso) => new Date(iso).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '');

// Tela de líderes e detalhes
export default function Lideres() {
  const [q, setQ] = useState('');
  const busca = useDebounce(q);
  const { dados, erro, carregando, recarregar } = useAsync(() => liderService.listar({ q: busca }), [busca]);
  const [aberto, setAberto] = useState(null);

  return (
    <>
      <PageHeader eyebrow="Gestão" title="Líderes" subtitle="Líderes de cada célula e seus contatos." />
      <div className="filters">
        <TextField className="field--search" label="Buscar líder" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome" />
      </div>
      {carregando && !dados && <Loading />}
      {erro && <ErrorState erro={erro} onRetry={recarregar} />}
      {dados && dados.length === 0 && <EmptyState title="Nenhum líder encontrado" />}

      <div className="grid grid--3">
        {dados?.map((l) => (
          <article className="card" key={l.idUsuario}>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <Avatar nome={l.nome} />
              <div className="spacer">
                <div className="strong">{l.nome}</div>
                <div className="tiny muted">
                  {l.celula ? `${l.celula.bairro} · ${perfilGrupoLabel(l.celula.perfilGrupo)}` : 'Sem célula ativa'}
                </div>
              </div>
              <Badge tone={l.celula ? undefined : 'neutral'}>Líder</Badge>
            </div>
            <div className="small muted stack" style={{ gap: 4, margin: '14px 0' }}>
              <span className="row" style={{ gap: 6 }}><Phone size={13} /> {l.telefone || '—'}</span>
              <span className="row" style={{ gap: 6 }}><Mail size={13} /> {l.email}</span>
            </div>
            <hr className="divider" />
            <div className="row row--between small">
              <span className="muted">Membros</span>
              <span className="strong">{l.totalMembros}</span>
            </div>
            <button className="btn btn--ghost btn--sm" style={{ padding: '6px 0', marginTop: 6 }} onClick={() => setAberto(l)}>
              Ver detalhes →
            </button>
          </article>
        ))}
      </div>

      <Modal
        open={Boolean(aberto)}
        onClose={() => setAberto(null)}
        footer={
          aberto && (
            <>
              <button className="btn" onClick={() => setAberto(null)}>Fechar</button>
              {aberto.telefone && (
                <a className="btn btn--primary" href={`https://wa.me/55${aberto.telefone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                  Enviar mensagem
                </a>
              )}
            </>
          )
        }
      >
        {aberto && (
          <>
            <div className="row">
              <Avatar nome={aberto.nome} size="lg" />
              <div>
                <h2 className="modal__title">{aberto.nome}</h2>
                <div className="small muted">
                  Líder{aberto.celula ? ` · ${aberto.celula.nomeCelula}` : ''}
                </div>
              </div>
            </div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 10, marginTop: 18 }}>
              <InfoTile icon={Phone} label="Telefone">{aberto.telefone || '—'}</InfoTile>
              <InfoTile icon={Mail} label="E-mail">{aberto.email}</InfoTile>
              <InfoTile icon={Users} label="Membros">{aberto.totalMembros} pessoas</InfoTile>
              <InfoTile icon={CalendarDays} label="Líder desde">{mesAno(aberto.liderDesde)}</InfoTile>
              <InfoTile icon={Network} label="Célula">
                {aberto.celula ? `${aberto.celula.nomeCelula} (${aberto.celula.capacidadeAtual}/${aberto.celula.capacidadeMaxima})` : 'Nenhuma'}
              </InfoTile>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
