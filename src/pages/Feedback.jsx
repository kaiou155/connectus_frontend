import { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, MessageSquare, Sparkles, UserMinus, XCircle } from 'lucide-react';
import { celulaService, feedbackService } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Avatar, Badge, EmptyState, ErrorState, Loading, Modal, PageHeader, Segmented, SelectField, TextAreaField, TextField } from '../components/ui';
import { LinkMembro, SaidaMembroModal } from '../components/domain';
import { PERFIS, STATUS_ADAPTACAO, statusAdaptacaoLabel } from '../utils/constants';
import { formatarData } from '../utils/format';

const ICONES = { RESPONDEU: CheckCircle2, NAO_RESPONDEU: XCircle, PARTICIPANDO: Sparkles };

/** Formulário completo de feedback: nota, permanência, datas e observações. */
function FeedbackCompletoModal({ item, onClose, onSalvo }) {
  const toast = useToast();
  const [f, setF] = useState({});
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (item)
      setF({
        statusAdaptacao: item.ultimoFeedback?.statusAdaptacao ?? '',
        notaIntegracao: '',
        permaneceuNaCelula: 'true',
        dataVisita: new Date().toISOString().slice(0, 10),
        dataProximoContato: '',
        comentariosMembro: '',
        avaliacaoLider: '',
      });
    setErro('');
  }, [item]);

  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));

  const salvar = async () => {
    // campos obrigatórios
    if (!f.statusAdaptacao || !f.notaIntegracao) {
      setErro('Informe o status de adaptação e a nota de integração.');
      return;
    }
    setEnviando(true);
    try {
      await feedbackService.registrar({
        ...f,
        idMembro: item.membro.idMembro,
        notaIntegracao: Number(f.notaIntegracao),
        permaneceuNaCelula: f.permaneceuNaCelula === 'true',
      });
      toast.sucesso('Feedback registrado.');
      onSalvo();
      onClose();
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      open={Boolean(item)}
      onClose={onClose}
      title="Feedback de integração"
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={enviando}>Cancelar</button>
          <button className="btn btn--primary" onClick={salvar} disabled={enviando}>{enviando ? 'Salvando…' : 'Registrar feedback'}</button>
        </>
      }
    >
      {item && (
        <>
          <p className="small muted">{item.membro.nomeCompleto} · na célula desde {formatarData(item.dataEntrada)}</p>
          <div className="form-grid">
            <SelectField label="Status de adaptação" value={f.statusAdaptacao} onChange={set('statusAdaptacao')} options={STATUS_ADAPTACAO} placeholder="Selecione" />
            <SelectField
              label="Nota de integração"
              value={f.notaIntegracao}
              onChange={set('notaIntegracao')}
              placeholder="1 a 5"
              options={[5, 4, 3, 2, 1].map((n) => ({ value: n, label: `${n} — ${['', 'Muito baixa', 'Baixa', 'Regular', 'Boa', 'Excelente'][n]}` }))}
            />
            <SelectField label="Permanece na célula?" value={f.permaneceuNaCelula} onChange={set('permaneceuNaCelula')} options={[{ value: 'true', label: 'Sim' }, { value: 'false', label: 'Não' }]} />
            <TextField label="Data da visita" type="date" value={f.dataVisita} onChange={set('dataVisita')} />
            <TextField className="span-2" label="Próximo contato" type="date" value={f.dataProximoContato} onChange={set('dataProximoContato')} hint="Opcional" />
            <TextAreaField className="span-2" label="Comentários do membro" value={f.comentariosMembro} onChange={set('comentariosMembro')} />
            <TextAreaField className="span-2" label="Avaliação do líder" value={f.avaliacaoLider} onChange={set('avaliacaoLider')} />
          </div>
          {erro && <div className="alert alert--danger" style={{ marginTop: 12 }}>{erro}</div>}
        </>
      )}
    </Modal>
  );
}

// Registrar feedback
export default function Feedback() {
  const { usuario, temPerfil } = useAuth();
  const toast = useToast();
  const lider = temPerfil(PERFIS.LIDER);
  const [idCelula, setIdCelula] = useState('');
  const celulas = useAsync(() => (lider ? Promise.resolve([]) : celulaService.listar()), []);
  const { dados, erro, carregando, recarregar } = useAsync(
    () => (lider || idCelula ? feedbackService.acompanhamento({ idCelula }) : Promise.resolve({ celula: null, itens: [] })),
    [idCelula],
  );
  const [comentarios, setComentarios] = useState({});
  const [abrirComentario, setAbrirComentario] = useState({});
  const [completo, setCompleto] = useState(null);
  const [retirar, setRetirar] = useState(null);
  const [enviando, setEnviando] = useState(null);
  const [periodo, setPeriodo] = useState('RECENTES');

  useEffect(() => {
    if (!lider && !idCelula && celulas.dados?.length) setIdCelula(String(celulas.dados[0].idCelula));
  }, [lider, idCelula, celulas.dados]);

  const rapido = async (item, statusAdaptacao) => {
    setEnviando(item.membro.idMembro);
    try {
      await feedbackService.registrar({
        idMembro: item.membro.idMembro,
        statusAdaptacao,
        permaneceuNaCelula: true,
        dataVisita: statusAdaptacao === 'PARTICIPANDO' ? new Date().toISOString().slice(0, 10) : null,
        avaliacaoLider: comentarios[item.membro.idMembro] ?? '',
      });
      toast.sucesso(`${item.membro.nomeCompleto}: ${statusAdaptacaoLabel(statusAdaptacao).toLowerCase()}.`);
      setComentarios((c) => ({ ...c, [item.membro.idMembro]: '' }));
      recarregar({ silencioso: true });
    } catch (e) {
      toast.erro(e);
    } finally {
      setEnviando(null);
    }
  };

  const limite = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  const todos = dados?.itens ?? [];
  const itens = periodo === 'RECENTES' ? todos.filter((i) => !i.dataEntrada || i.dataEntrada >= limite) : todos;

  return (
    <>
      <PageHeader
        eyebrow="Acompanhamento do líder"
        title="Feedback dos membros triados"
        subtitle={lider ? `Atualize o status de cada novo membro conectado a ${usuario.nomeCelula ?? 'sua célula'}.` : 'Visualize o acompanhamento registrado pelos líderes.'}
      />

      {!lider && (
        <div className="filters">
          <SelectField label="Célula" value={idCelula} onChange={(e) => setIdCelula(e.target.value)} options={(celulas.dados ?? []).map((c) => ({ value: c.idCelula, label: c.nomeCelula }))} placeholder="Selecione" />
        </div>
      )}

      {dados?.celula && (
        <div className="row" style={{ marginBottom: 14 }}>
          <Segmented
            label="Período"
            value={periodo}
            onChange={setPeriodo}
            options={[
              { value: 'RECENTES', label: 'Triados nos últimos 60 dias' },
              { value: 'TODOS', label: `Todos (${todos.length})` },
            ]}
          />
        </div>
      )}

      {lider && !usuario.idCelula && <EmptyState title="Você ainda não lidera uma célula ativa">Peça ao administrador para vinculá-lo a uma célula.</EmptyState>}
      {carregando && !dados && <Loading />}
      {erro && <ErrorState erro={erro} onRetry={recarregar} />}
      {dados?.celula && itens.length === 0 && <EmptyState title="Nenhum membro triado neste período" />}

      <div className="stack">
        {itens.map((item) => {
          const fb = item.ultimoFeedback;
          const idM = item.membro.idMembro;
          return (
            <div className="card" key={idM} style={{ padding: 16 }}>
              <div className="row">
                <Avatar nome={item.membro.nomeCompleto} />
                <div className="spacer">
                  <LinkMembro membro={item.membro} />
                  <div className="small muted">
                    {dados.celula.nomeCelula} · triado em {formatarData(item.dataEntrada)} · {item.membro.telefone}
                  </div>
                </div>
                <Badge tone={fb ? (fb.statusAdaptacao === 'NAO_RESPONDEU' ? 'warning' : 'success') : 'neutral'}>
                  {fb ? statusAdaptacaoLabel(fb.statusAdaptacao) : 'Pendente'}
                </Badge>
              </div>

              {lider && (
                <>
                  <div className="grid grid--4" style={{ marginTop: 12, gap: 8 }}>
                    {STATUS_ADAPTACAO.map((s) => {
                      const Icone = ICONES[s.value];
                      return (
                        <button
                          key={s.value}
                          className={`btn btn--sm ${fb?.statusAdaptacao === s.value ? 'btn--selected' : ''}`}
                          disabled={enviando === idM}
                          onClick={() => rapido(item, s.value)}
                        >
                          <Icone size={14} /> {s.label}
                        </button>
                      );
                    })}
                    <button className="btn btn--sm btn--danger" onClick={() => setRetirar(item.membro)}>
                      <UserMinus size={14} /> Retirar
                    </button>
                  </div>
                  <div className="row" style={{ marginTop: 10, gap: 6 }}>
                    <button className="btn btn--ghost btn--sm" onClick={() => setAbrirComentario((a) => ({ ...a, [idM]: !a[idM] }))}>
                      <MessageSquare size={14} /> Comentário (opcional)
                    </button>
                    <button className="btn btn--ghost btn--sm" onClick={() => setCompleto(item)}>
                      <ClipboardList size={14} /> Avaliação completa
                    </button>
                    {fb && <span className="tiny muted">Último registro em {formatarData(fb.dataCriacao)}{fb.notaIntegracao ? ` · nota ${fb.notaIntegracao}/5` : ''}</span>}
                  </div>
                  {abrirComentario[idM] && (
                    <textarea
                      className="textarea"
                      style={{ marginTop: 8 }}
                      aria-label={`Comentário sobre ${item.membro.nomeCompleto}`}
                      placeholder="Escreva e depois escolha um status acima para salvar junto."
                      value={comentarios[idM] ?? ''}
                      onChange={(e) => setComentarios((c) => ({ ...c, [idM]: e.target.value }))}
                    />
                  )}
                </>
              )}
              {!lider && fb && (
                <p className="small muted" style={{ margin: '10px 0 0' }}>
                  {formatarData(fb.dataCriacao)}{fb.notaIntegracao ? ` · nota ${fb.notaIntegracao}/5` : ''}{fb.avaliacaoLider ? ` · “${fb.avaliacaoLider}”` : ''}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <FeedbackCompletoModal item={completo} onClose={() => setCompleto(null)} onSalvo={() => recarregar({ silencioso: true })} />
      <SaidaMembroModal membro={retirar} onClose={() => setRetirar(null)} onConcluido={() => recarregar({ silencioso: true })} />
    </>
  );
}
