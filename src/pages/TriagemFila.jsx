import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Hand, RefreshCw, Sparkles, UserPlus, X, Clock } from 'lucide-react';
import { celulaService, listaEsperaService, triagemService } from '../services/api';
import { config } from '../services/config';
import { useAsync } from '../hooks/useAsync';
import { useToast } from '../context/ToastContext';
import { Avatar, EmptyState, ErrorState, Loading, PageHeader, ScoreBadge, Segmented } from '../components/ui';
import { SCORE_MINIMO } from '../utils/constants';
import { tempoRelativo } from '../utils/format';

/**
 * Triagem em lote.
 * Automática: mostra a melhor sugestão do algoritmo para cada membro pendente.
 * Manual: o voluntário escolhe a célula; células lotadas aparecem bloqueadas.
 */
export default function TriagemFila() {
  const navigate = useNavigate();
  const toast = useToast();
  const [modo, setModo] = useState('AUTOMATICA');
  const [escolhas, setEscolhas] = useState({});
  const [processando, setProcessando] = useState(null);

  const pendentes = useAsync(() => triagemService.pendentes(), [], { pollingMs: config.pollingMs });
  const celulas = useAsync(() => celulaService.listar(), [], { pollingMs: config.pollingMs });

  const opcoesCelulas = useMemo(
    () =>
      (celulas.dados ?? []).map((c) => ({
        value: c.idCelula,
        label: c.lotada ? `${c.nomeCelula} — lotada` : `${c.nomeCelula} (${c.vagas} vagas)`,
        disabled: c.lotada,
      })),
    [celulas.dados],
  );

  const atualizarTudo = () => {
    pendentes.recarregar({ silencioso: true });
    celulas.recarregar({ silencioso: true });
  };

  const alocar = async (membro, idCelula, modoAlocacao) => {
    setProcessando(membro.idMembro);
    try {
      const r = await triagemService.alocar(membro.idMembro, { idCelula: Number(idCelula), modo: modoAlocacao });
      toast.sucesso(`${membro.nomeCompleto} conectado(a) a ${r.celula.nomeCelula}.`);
      setEscolhas((e) => ({ ...e, [membro.idMembro]: '' }));
    } catch (e) {
      toast.erro(e); // 409 CELULA_LOTADA: outra pessoa ocupou a última vaga
    } finally {
      setProcessando(null);
      atualizarTudo();
    }
  };

  const enviarEspera = async (membro) => {
    setProcessando(membro.idMembro);
    try {
      await listaEsperaService.adicionar(membro.idMembro, 'Nenhuma célula compatível no momento da triagem.');
      toast.sucesso(`${membro.nomeCompleto} foi para a lista de espera.`);
    } catch (e) {
      toast.erro(e);
    } finally {
      setProcessando(null);
      atualizarTudo();
    }
  };

  const lista = pendentes.dados ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Algoritmo"
        title="Triagem inteligente"
        subtitle="Escolha o modo de triagem e selecione o membro a ser conectado."
        actions={
          <>
            <button className="btn" onClick={atualizarTudo} aria-label="Atualizar">
              <RefreshCw size={15} /> Atualizar
            </button>
            <Link to="/membros/novo" className="btn btn--primary">
              <UserPlus size={15} /> Novo membro
            </Link>
          </>
        }
      />

      <div className="row" style={{ marginBottom: 12 }}>
        <Segmented
          label="Modo de triagem"
          value={modo}
          onChange={setModo}
          options={[
            { value: 'AUTOMATICA', label: 'Triagem automática', icon: Sparkles },
            { value: 'MANUAL', label: 'Triagem manual', icon: Hand },
          ]}
        />
      </div>
      <p className="small muted" style={{ marginTop: 0 }}>
        {modo === 'AUTOMATICA'
          ? 'O algoritmo sugere a melhor célula com base em idade, gênero, bairro, disponibilidade e perfil.'
          : 'Você seleciona manualmente a célula ideal para cada membro. A ocupação é atualizada automaticamente.'}
      </p>

      {pendentes.carregando && !pendentes.dados && <Loading />}
      {pendentes.erro && <ErrorState erro={pendentes.erro} onRetry={pendentes.recarregar} />}
      {pendentes.dados && lista.length === 0 && (
        <EmptyState title="Nenhum membro aguardando triagem" action={<Link to="/membros/novo" className="btn btn--primary">Cadastrar membro</Link>}>
          Todos os novos membros já foram conectados a uma célula.
        </EmptyState>
      )}

      <div className="stack">
        {lista.map((m) => {
          const s = m.melhorSugestao;
          const ocupado = processando === m.idMembro;
          return (
            <div className="list-row" key={m.idMembro}>
              <Avatar nome={m.nomeCompleto} />
              <div className="list-row__main">
                <div className="list-row__name">{m.nomeCompleto}</div>
                <div className="small muted">
                  {m.idade} anos · {m.bairro} · cadastrado {tempoRelativo(m.dataCadastro)}
                </div>
              </div>

              {modo === 'AUTOMATICA' ? (
                <>
                  <div className="small" style={{ minWidth: 170 }}>
                    {s?.compativel ? (
                      <>
                        <span className="muted">Sugestão: </span>
                        <span className="strong">{s.nomeCelula}</span>
                      </>
                    ) : (
                      <span className="muted">Sem célula compatível</span>
                    )}
                  </div>
                  <ScoreBadge score={s?.score} minimo={SCORE_MINIMO} />
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn btn--sm" onClick={() => navigate(`/triagem/${m.idMembro}`)}>
                      Detalhes
                    </button>
                    {s?.compativel ? (
                      <button className="btn btn--sm btn--primary" disabled={ocupado} onClick={() => alocar(m, s.idCelula, 'AUTOMATICA')}>
                        <Check size={14} /> Aprovar
                      </button>
                    ) : (
                      <button className="btn btn--sm" disabled={ocupado} onClick={() => enviarEspera(m)}>
                        <Clock size={14} /> Lista de espera
                      </button>
                    )}
                    <button className="btn btn--sm" disabled={ocupado} onClick={() => navigate(`/triagem/${m.idMembro}?modo=MANUAL`)}>
                      <X size={14} /> Reencaminhar
                    </button>
                  </div>
                </>
              ) : (
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <label className="sr-only" htmlFor={`cel-${m.idMembro}`}>Célula para {m.nomeCompleto}</label>
                  <span className="small muted">Conectar à:</span>
                  <select
                    id={`cel-${m.idMembro}`}
                    className="select"
                    style={{ width: 240 }}
                    value={escolhas[m.idMembro] ?? ''}
                    onChange={(e) => setEscolhas((x) => ({ ...x, [m.idMembro]: e.target.value }))}
                  >
                    <option value="">Selecione uma célula…</option>
                    {opcoesCelulas.map((o) => (
                      <option key={o.value} value={o.value} disabled={o.disabled}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button className="btn btn--sm" onClick={() => navigate(`/triagem/${m.idMembro}?modo=MANUAL`)}>
                    Detalhes
                  </button>
                  <button
                    className="btn btn--sm btn--primary"
                    disabled={!escolhas[m.idMembro] || ocupado}
                    onClick={() => alocar(m, escolhas[m.idMembro], 'MANUAL')}
                  >
                    <Check size={14} /> Confirmar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
