import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarDays, Filter, Heart, LogOut, Mail, MapPin, Pencil, Phone, UserRound } from 'lucide-react';
import { membroService } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { Avatar, Badge, EmptyState, ErrorState, InfoTile, Loading, PageHeader, StatusMembroBadge } from '../components/ui';
import { SaidaMembroModal } from '../components/domain';
import { PERFIS, diaLabel, estadoCivilLabel, perfilGrupoLabel, statusAdaptacaoLabel } from '../utils/constants';
import { formatarData, formatarDataHora, formatarHorario } from '../utils/format';

const TOM_LOG = { APROVADA: 'success', REJEITADA: 'danger', SUGERIDA: 'warning' };

export default function MembroDetalhe() {
  const { id } = useParams();
  const { temPerfil } = useAuth();
  const { dados: m, erro, carregando, recarregar } = useAsync(() => membroService.obter(id), [id]);
  const [saida, setSaida] = useState(false);

  if (carregando) return <Loading />;
  if (erro) return <ErrorState erro={erro} onRetry={recarregar} />;

  const admin = temPerfil(PERFIS.ADMINISTRADOR);
  const podeTriar = temPerfil(PERFIS.ADMINISTRADOR, PERFIS.VOLUNTARIO) && ['AGUARDANDO_TRIAGEM', 'LISTA_ESPERA'].includes(m.statusMembro);

  return (
    <>
      <PageHeader
        eyebrow="Perfil do membro"
        title={m.nomeCompleto}
        back="/membros"
        actions={
          <>
            {podeTriar && <Link className="btn btn--primary" to={`/triagem/${m.idMembro}`}><Filter size={15} /> Triar agora</Link>}
            {admin && <Link className="btn" to={`/membros/${m.idMembro}/editar`}><Pencil size={15} /> Editar</Link>}
            {(admin || temPerfil(PERFIS.LIDER)) && m.celula && (
              <button className="btn btn--danger" onClick={() => setSaida(true)}><LogOut size={15} /> Registrar saída</button>
            )}
          </>
        }
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ marginBottom: 14 }}>
          <Avatar nome={m.nomeCompleto} size="lg" />
          <div>
            <StatusMembroBadge status={m.statusMembro} />
            <div className="small muted" style={{ marginTop: 4 }}>
              {m.celula ? <>Célula atual: <strong>{m.celula.nomeCelula}</strong></> : 'Sem célula no momento'}
            </div>
          </div>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 10 }}>
          <InfoTile icon={UserRound} label="Perfil">
            {m.idade} anos · {m.genero === 'F' ? 'Feminino' : 'Masculino'} · {estadoCivilLabel(m.estadoCivil)}
          </InfoTile>
          <InfoTile icon={Phone} label="Telefone">{m.telefone}</InfoTile>
          <InfoTile icon={Mail} label="E-mail">{m.email || '—'}</InfoTile>
          <InfoTile icon={MapPin} label="Endereço">{m.bairro}, {m.cidade} {m.cep && `· ${m.cep}`}</InfoTile>
          <InfoTile icon={CalendarDays} label="Disponibilidade">
            {m.disponibilidades.length
              ? m.disponibilidades.map((d) => `${diaLabel(d.diaSemana, true)}${d.horarioInicio ? ` ${formatarHorario(d.horarioInicio)}–${formatarHorario(d.horarioFim)}` : ''}`).join(', ')
              : 'Não informada'}
          </InfoTile>
          <InfoTile icon={Heart} label="Interesse">{m.perfilInteresse ? perfilGrupoLabel(m.perfilInteresse) : '—'}</InfoTile>
          <InfoTile icon={CalendarDays} label="Cadastro">{formatarDataHora(m.dataCadastro)}</InfoTile>
          <InfoTile icon={UserRound} label="Indicado por">{m.indicadoPorNome ?? '—'}</InfoTile>
        </div>
        {m.observacoes && <p className="small" style={{ marginBottom: 0 }}><strong>Observações:</strong> {m.observacoes}</p>}
      </div>

      <div className="grid grid--2">
        <section className="card">
          <h2 className="card__title">Histórico de células</h2>
          {m.historico.length === 0 ? (
            <p className="small muted">Ainda não participou de nenhuma célula.</p>
          ) : (
            <div className="stack" style={{ marginTop: 12 }}>
              {m.historico.map((h) => (
                <div key={h.idHistorico} className="info-tile">
                  <div className="row row--between">
                    <span className="strong">{h.nomeCelula}</span>
                    {h.dataSaida ? <Badge tone="neutral">Saiu</Badge> : <Badge tone="success">Atual</Badge>}
                  </div>
                  <div className="small muted">
                    {formatarData(h.dataEntrada)} → {h.dataSaida ? formatarData(h.dataSaida) : 'hoje'}
                    {h.motivoSaida && ` · ${h.motivoSaida}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="card__title">Feedback de integração</h2>
          {m.feedbacks.length === 0 ? (
            <p className="small muted">Nenhum feedback registrado pelo líder.</p>
          ) : (
            <div className="stack" style={{ marginTop: 12 }}>
              {m.feedbacks.map((fb) => (
                <div key={fb.idFeedback} className="info-tile">
                  <div className="row row--between">
                    <span className="strong">{statusAdaptacaoLabel(fb.statusAdaptacao)}</span>
                    {fb.notaIntegracao && <Badge>Nota {fb.notaIntegracao}/5</Badge>}
                  </div>
                  <div className="small muted">{formatarData(fb.dataCriacao)}{fb.avaliacaoLider && ` · ${fb.avaliacaoLider}`}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {m.logs?.length > 0 && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2 className="card__title">Log de triagem</h2>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table">
              <thead>
                <tr><th>Data</th><th>Célula</th><th className="num">Escore</th><th>Status</th><th>Motivo</th></tr>
              </thead>
              <tbody>
                {m.logs.map((l) => (
                  <tr key={l.idLog}>
                    <td>{formatarDataHora(l.dataHora)}</td>
                    <td>{l.nomeCelula}</td>
                    <td className="num">{l.scoreMatching != null ? `${l.scoreMatching}%` : '—'}</td>
                    <td><Badge tone={TOM_LOG[l.statusTriagem]}>{l.statusTriagem}</Badge></td>
                    <td className="small muted">{l.motivoRejeicao ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!m.logs?.length && !m.historico.length && m.statusMembro === 'AGUARDANDO_TRIAGEM' && (
        <div style={{ marginTop: 16 }}>
          <EmptyState icon={Filter} title="Aguardando triagem" action={podeTriar && <Link className="btn btn--primary" to={`/triagem/${m.idMembro}`}>Triar agora</Link>} />
        </div>
      )}

      <SaidaMembroModal membro={saida ? m : null} admin={admin} onClose={() => setSaida(false)} onConcluido={recarregar} />
    </>
  );
}
