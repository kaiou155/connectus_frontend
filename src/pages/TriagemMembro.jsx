import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, Hand, MapPin, PartyPopper, Phone, Sparkles, ThumbsDown, Timer, UserPlus } from 'lucide-react';
import { celulaService, listaEsperaService, membroService, triagemService } from '../services/api';
import { config } from '../services/config';
import { useAsync } from '../hooks/useAsync';
import { useToast } from '../context/ToastContext';
import {
  Avatar, Badge, ConfirmDialog, CriteriosScore, EmptyState, ErrorState, Loading, OccupancyBar, PageHeader,
  ScoreBadge, Segmented, SelectField, StatusMembroBadge, TextAreaField, TextField,
} from '../components/ui';
import { CelulaDetalhesModal, encontroTexto } from '../components/domain';
import { DIAS_SEMANA, PERFIS_GRUPO, diaLabel, estadoCivilLabel, perfilGrupoLabel } from '../utils/constants';
import { formatarHorario } from '../utils/format';

function ResumoMembro({ m }) {
  return (
    <div className="card card--flat row" style={{ marginBottom: 18 }}>
      <Avatar nome={m.nomeCompleto} size="lg" />
      <div className="spacer">
        <div className="row" style={{ gap: 8 }}>
          <span className="card__title">{m.nomeCompleto}</span>
          <StatusMembroBadge status={m.statusMembro} />
        </div>
        <div className="small muted">
          {m.idade} anos · {m.genero === 'F' ? 'Feminino' : 'Masculino'} · {estadoCivilLabel(m.estadoCivil)} · {m.bairro}, {m.cidade}
        </div>
        <div className="small muted">
          Disponível:{' '}
          {m.disponibilidades?.length
            ? m.disponibilidades
                .map((d) => `${diaLabel(d.diaSemana, true)}${d.horarioInicio ? ` ${formatarHorario(d.horarioInicio)}–${formatarHorario(d.horarioFim)}` : ''}`)
                .join(', ')
            : 'não informado'}
          {m.perfilInteresse && <> · Interesse: {perfilGrupoLabel(m.perfilInteresse)}</>}
        </div>
      </div>
    </div>
  );
}

/** Sugestões do algoritmo de matching (top 3). */
function TriagemAutomatica({ membro, onEscolher, onManual, onEspera, onDetalhes }) {
  const toast = useToast();
  // mede o tempo de resposta percebido pelo voluntário (meta: até 3 s)
  const { dados, erro, carregando, recarregar } = useAsync(async () => {
    const inicio = performance.now();
    const r = await triagemService.matching(membro.idMembro);
    return { ...r, respostaMs: Math.round(performance.now() - inicio) };
  }, [membro.idMembro]);
  const [rejeitando, setRejeitando] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [rejeitadas, setRejeitadas] = useState([]);

  const rejeitar = async () => {
    try {
      await triagemService.rejeitarSugestao(membro.idMembro, { idLog: rejeitando.idLog, motivo });
      setRejeitadas((r) => [...r, rejeitando.idLog]);
      toast.sucesso('Sugestão descartada e registrada no log de triagem.');
    } catch (e) {
      toast.erro(e);
    } finally {
      setRejeitando(null);
      setMotivo('');
    }
  };

  if (carregando) return <Loading texto="Calculando compatibilidade…" />;
  if (erro) return <ErrorState erro={erro} onRetry={recarregar} />;

  const visiveis = dados.sugestoes.filter((s) => !rejeitadas.includes(s.idLog));
  const compativeis = visiveis.filter((s) => s.compativel);

  return (
    <>
      <div className="row small muted" style={{ marginBottom: 12 }}>
        <Timer size={14} /> Resposta em {(dados.respostaMs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} s (meta ≤ 3 s) ·
        compatibilidade mínima {dados.scoreMinimo}%
      </div>

      {compativeis.length === 0 && (
        // nenhuma célula compatível
        <div className="alert" style={{ marginBottom: 14 }}>
          <Clock size={18} />
          <div className="spacer">
            <div className="strong">Nenhuma célula compatível encontrada.</div>
            <div className="small">Você pode triar manualmente ou registrar o membro na lista de espera.</div>
          </div>
          <div className="row">
            <button className="btn btn--sm" onClick={onManual}><Hand size={14} /> Triagem manual</button>
            <button className="btn btn--sm btn--primary" onClick={onEspera}><Clock size={14} /> Lista de espera</button>
          </div>
        </div>
      )}

      <div className="grid grid--3">
        {visiveis.map((s, i) => (
          <article className="card" key={s.idLog} style={{ borderColor: i === 0 && s.compativel ? 'var(--accent)' : undefined }}>
            <div className="row row--between" style={{ alignItems: 'flex-start' }}>
              <div>
                {i === 0 && s.compativel && <Badge tone="success">Melhor opção</Badge>}
                <h3 className="card__title" style={{ marginTop: 6 }}>{s.celula.nomeCelula}</h3>
                <div className="small muted">Líder: {s.celula.lider?.nome}</div>
              </div>
              <ScoreBadge score={s.score} minimo={dados.scoreMinimo} />
            </div>
            <div className="small muted" style={{ margin: '10px 0' }}>
              <div className="row" style={{ gap: 5 }}><Clock size={13} /> {encontroTexto(s.celula)}</div>
              <div className="row" style={{ gap: 5 }}><MapPin size={13} /> {s.celula.bairro} · {s.criterios.distancia.km.toLocaleString('pt-BR')} km</div>
            </div>
            <OccupancyBar atual={s.celula.capacidadeAtual} maxima={s.celula.capacidadeMaxima} />
            <hr className="divider" />
            <CriteriosScore criterios={s.criterios} />
            <div className="row" style={{ marginTop: 14, gap: 6 }}>
              <button className="btn btn--sm" onClick={() => onDetalhes(s.celula.idCelula)}>Detalhes</button>
              <button className="btn btn--sm btn--ghost" onClick={() => setRejeitando(s)} aria-label="Descartar sugestão">
                <ThumbsDown size={14} />
              </button>
              <span className="spacer" />
              <button className="btn btn--sm btn--primary" onClick={() => onEscolher(s.celula, 'AUTOMATICA', s.idLog)}>
                <CheckCircle2 size={14} /> Escolher
              </button>
            </div>
          </article>
        ))}
      </div>

      {visiveis.length > 0 && (
        <div className="row" style={{ marginTop: 16, justifyContent: 'center' }}>
          <button className="btn btn--ghost btn--sm" onClick={onManual}>Nenhuma serve? Fazer triagem manual</button>
          <button className="btn btn--ghost btn--sm" onClick={onEspera}>Enviar para lista de espera</button>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(rejeitando)}
        title="Descartar sugestão"
        message={rejeitando && `Por que ${rejeitando.celula.nomeCelula} não é adequada? O motivo fica registrado no log de triagem.`}
        confirmLabel="Descartar"
        danger
        onCancel={() => setRejeitando(null)}
        onConfirm={rejeitar}
      >
        <div style={{ marginTop: 10 }}>
          <TextAreaField label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: membro prefere encontros aos sábados" />
        </div>
      </ConfirmDialog>
    </>
  );
}

/** Listagem completa de células, com filtros. */
function TriagemManual({ onEscolher, onEspera, onDetalhes }) {
  const [filtros, setFiltros] = useState({ bairro: '', perfil: '', dia: '', comVagas: 'true' });
  const set = (k) => (e) => setFiltros((f) => ({ ...f, [k]: e.target.value }));
  const { dados, erro, carregando, recarregar } = useAsync(
    () => celulaService.listar(filtros),
    [filtros.bairro, filtros.perfil, filtros.dia, filtros.comVagas],
    { pollingMs: config.pollingMs },
  );

  return (
    <>
      <div className="filters">
        <TextField label="Bairro" value={filtros.bairro} onChange={set('bairro')} placeholder="Todos" />
        <SelectField label="Perfil do grupo" value={filtros.perfil} onChange={set('perfil')} options={PERFIS_GRUPO} placeholder="Todos" />
        <SelectField label="Dia" value={filtros.dia} onChange={set('dia')} options={DIAS_SEMANA} placeholder="Qualquer dia" />
        <SelectField label="Vagas" value={filtros.comVagas} onChange={set('comVagas')} options={[{ value: 'true', label: 'Somente com vagas' }, { value: '', label: 'Todas (lotadas bloqueadas)' }]} />
      </div>
      {carregando && !dados && <Loading />}
      {erro && <ErrorState erro={erro} onRetry={recarregar} />}
      {dados && dados.length === 0 && (
        // nenhuma célula encontrada com os filtros
        <EmptyState title="Nenhuma célula encontrada com esses filtros" action={<button className="btn btn--sm" onClick={onEspera}>Enviar para lista de espera</button>}>
          Tente ampliar os critérios de busca (bairro, perfil ou dia).
        </EmptyState>
      )}
      <div className="stack">
        {dados?.map((c) => (
          <div className="list-row" key={c.idCelula} style={{ opacity: c.lotada ? 0.6 : 1 }}>
            <div className="list-row__main">
              <div className="row" style={{ gap: 8 }}>
                <span className="list-row__name">{c.nomeCelula}</span>
                <Badge>{perfilGrupoLabel(c.perfilGrupo)} {c.faixaEtaria}</Badge>
                {c.lotada && <Badge tone="danger">Lotada</Badge>}
              </div>
              <div className="small muted">
                {encontroTexto(c)} · {c.bairro} · Líder {c.lider?.nome}
              </div>
            </div>
            <div style={{ width: 180 }}>
              <OccupancyBar atual={c.capacidadeAtual} maxima={c.capacidadeMaxima} />
            </div>
            <button className="btn btn--sm" onClick={() => onDetalhes(c.idCelula)}>Detalhes</button>
            <button className="btn btn--sm btn--primary" disabled={c.lotada} onClick={() => onEscolher(c, 'MANUAL')} title={c.lotada ? 'Célula lotada' : undefined}>
              Selecionar
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function Sucesso({ resultado }) {
  const { membro, celula } = resultado;
  return (
    <div className="card" style={{ maxWidth: 620, margin: '0 auto', textAlign: 'center', padding: 32 }}>
      <PartyPopper size={40} color="var(--accent)" />
      <h2 className="page-title" style={{ fontSize: 26, marginTop: 10 }}>Conexão realizada!</h2>
      <p className="muted">
        <strong>{membro.nomeCompleto}</strong> agora faz parte de <strong>{celula.nomeCelula}</strong>.
      </p>
      <div className="info-tile" style={{ textAlign: 'left', margin: '18px 0' }}>
        <div className="info-tile__label">Próximo passo</div>
        <div className="info-tile__value small">
          Apresente o membro ao líder {celula.lider?.nome} — encontros {encontroTexto(celula).toLowerCase()} em {celula.endereco || celula.bairro}.
        </div>
        {celula.lider?.telefone && (
          <a className="btn btn--sm" style={{ marginTop: 8 }} href={`tel:${celula.lider.telefone.replace(/\D/g, '')}`}>
            <Phone size={14} /> {celula.lider.telefone}
          </a>
        )}
      </div>
      <div className="row" style={{ justifyContent: 'center' }}>
        <Link to="/triagem" className="btn">Voltar à triagem</Link>
        <Link to="/membros/novo" className="btn btn--primary"><UserPlus size={15} /> Cadastrar outro membro</Link>
      </div>
    </div>
  );
}

// Triagem de um membro
export default function TriagemMembro() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const modo = params.get('modo') === 'MANUAL' ? 'MANUAL' : 'AUTOMATICA';
  const setModo = (m) => setParams(m === 'MANUAL' ? { modo: m } : {}, { replace: true });

  const membro = useAsync(() => membroService.obter(id), [id]);
  const [escolha, setEscolha] = useState(null);
  const [detalhes, setDetalhes] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [chave, setChave] = useState(0); // força novo matching após conflito

  useEffect(() => setResultado(null), [id]);

  const confirmar = async () => {
    setEnviando(true);
    try {
      const r = await triagemService.alocar(id, { idCelula: escolha.celula.idCelula, modo: escolha.modo, idLog: escolha.idLog });
      setResultado(r);
      toast.sucesso('Alocação registrada e ocupação atualizada.');
    } catch (e) {
      toast.erro(e);
      if (e.codigo === 'CELULA_LOTADA') setChave((k) => k + 1);
      if (e.codigo === 'JA_TRIADO') navigate('/triagem');
    } finally {
      setEnviando(false);
      setEscolha(null);
    }
  };

  const enviarEspera = async () => {
    try {
      await listaEsperaService.adicionar(Number(id), 'Nenhuma célula compatível no momento da triagem.');
      toast.sucesso('Membro registrado na lista de espera.');
      navigate('/lista-espera');
    } catch (e) {
      toast.erro(e);
    }
  };

  if (membro.carregando) return <Loading />;
  if (membro.erro) return <ErrorState erro={membro.erro} onRetry={membro.recarregar} />;
  const m = membro.dados;

  if (resultado) return <Sucesso resultado={resultado} />;

  const triavel = ['AGUARDANDO_TRIAGEM', 'LISTA_ESPERA'].includes(m.statusMembro);

  return (
    <>
      <PageHeader eyebrow="Triagem" title="Encontrar a célula ideal" subtitle="Escolha entre a sugestão automática e a seleção manual." back="/triagem" />
      <ResumoMembro m={m} />

      {!triavel ? (
        <EmptyState icon={CheckCircle2} title="Este membro já foi triado" action={<Link className="btn" to={`/membros/${m.idMembro}`}>Ver perfil</Link>}>
          {m.celula ? `Alocado(a) em ${m.celula.nomeCelula}.` : 'Consulte o perfil para mais detalhes.'}
        </EmptyState>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <Segmented
              label="Modo de triagem"
              value={modo}
              onChange={setModo}
              options={[
                { value: 'AUTOMATICA', label: 'Automática', icon: Sparkles },
                { value: 'MANUAL', label: 'Manual', icon: Hand },
              ]}
            />
          </div>
          {modo === 'AUTOMATICA' ? (
            <TriagemAutomatica
              key={chave}
              membro={m}
              onEscolher={(celula, mo, idLog) => setEscolha({ celula, modo: mo, idLog })}
              onManual={() => setModo('MANUAL')}
              onEspera={enviarEspera}
              onDetalhes={setDetalhes}
            />
          ) : (
            <TriagemManual
              key={chave}
              onEscolher={(celula, mo) => setEscolha({ celula, modo: mo })}
              onEspera={enviarEspera}
              onDetalhes={setDetalhes}
            />
          )}
        </>
      )}

      <CelulaDetalhesModal
        idCelula={detalhes}
        onClose={() => setDetalhes(null)}
        acaoExtra={
          triavel
            ? (c) => (
                <button
                  className="btn btn--primary"
                  disabled={c.lotada}
                  onClick={() => {
                    setDetalhes(null);
                    setEscolha({ celula: c, modo: modo === 'MANUAL' ? 'MANUAL' : 'AUTOMATICA' });
                  }}
                >
                  {c.lotada ? 'Lotada' : 'Escolher esta célula'}
                </button>
              )
            : undefined
        }
      />

      <ConfirmDialog
        open={Boolean(escolha)}
        title="Confirmar alocação"
        confirmLabel="Confirmar alocação"
        loading={enviando}
        onCancel={() => setEscolha(null)}
        onConfirm={confirmar}
      >
        {escolha && (
          <div className="stack" style={{ marginTop: 12 }}>
            <p className="muted small" style={{ margin: 0 }}>
              Conectar <strong>{m.nomeCompleto}</strong> à célula <strong>{escolha.celula.nomeCelula}</strong> ({encontroTexto(escolha.celula)}).
            </p>
            <OccupancyBar atual={escolha.celula.capacidadeAtual} maxima={escolha.celula.capacidadeMaxima} />
            <span className="tiny muted">Modo: {escolha.modo === 'MANUAL' ? 'triagem manual' : 'sugestão do algoritmo'}</span>
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}
