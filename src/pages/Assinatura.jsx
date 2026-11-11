import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, Check, CreditCard, Receipt, Tag } from 'lucide-react';
import { assinaturaService, planoService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { Badge, ConfirmDialog, ErrorState, InfoTile, Loading, Modal, OccupancyBar, PageHeader, TextField } from '../components/ui';
import { STATUS_ASSINATURA } from '../utils/constants';
import { formatarData, formatarNumero } from '../utils/format';
import { isEmail } from '../utils/validators';

const reais = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const limiteTexto = (n) => (n == null ? 'ilimitado' : formatarNumero(n));
const quantidade = (n, nome, ilimitado) => (n == null ? `${nome} ${ilimitado}` : `${formatarNumero(n)} ${nome}`);
const resumoLimites = (l) =>
  [quantidade(l.membros, 'membros', 'ilimitados'), quantidade(l.celulas, 'células', 'ilimitadas'), quantidade(l.usuarios, 'usuários', 'ilimitados')].join(' · ');

const RECURSOS = [
  ['Membros cadastrados', 'membros'],
  ['Células ativas', 'celulas'],
  ['Usuários do sistema', 'usuarios'],
];

/** O Mercado Pago devolve um endereço externo; o modo demonstração devolve uma rota do próprio app. */
function irParaPagamento(initPoint, navigate) {
  if (/^https?:\/\//.test(initPoint)) window.location.assign(initPoint);
  else navigate(initPoint);
}

function CheckoutModal({ plano, emailAdmin, onClose }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [cupom, setCupom] = useState('');
  const [desconto, setDesconto] = useState(null);
  const [emailPagador, setEmailPagador] = useState('');
  const [erros, setErros] = useState({});
  const [validando, setValidando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setCupom('');
    setDesconto(null);
    setEmailPagador('');
    setErros({});
  }, [plano]);

  const aplicarCupom = async () => {
    if (!cupom.trim()) return;
    setValidando(true);
    try {
      const r = await assinaturaService.validarCupom(cupom);
      if (r.valido) {
        setDesconto(r);
        setErros((e) => ({ ...e, cupom: undefined }));
      } else {
        setDesconto(null);
        setErros((e) => ({ ...e, cupom: 'Cupom inválido ou expirado.' }));
      }
    } catch (e) {
      toast.erro(e);
    } finally {
      setValidando(false);
    }
  };

  const pagar = async () => {
    if (emailPagador && !isEmail(emailPagador)) {
      setErros({ emailPagador: 'E-mail inválido.' });
      return;
    }
    setEnviando(true);
    try {
      const r = await assinaturaService.checkout({
        plano: plano.idPlano,
        cupom: desconto?.codigo || undefined,
        emailPagador: emailPagador.trim() || undefined,
      });
      irParaPagamento(r.initPoint, navigate);
    } catch (e) {
      setErros(e.campos ?? {});
      toast.erro(e);
      setEnviando(false);
    }
  };

  if (!plano) return null;
  const valorFinal = desconto ? Math.round(plano.valor * (1 - desconto.percDesconto / 100) * 100) / 100 : plano.valor;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Assinar o plano ${plano.nome}`}
      size="sm"
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={enviando}>Cancelar</button>
          <button className="btn btn--primary" onClick={pagar} disabled={enviando}>
            <CreditCard size={15} /> {enviando ? 'Abrindo pagamento…' : 'Ir para o pagamento'}
          </button>
        </>
      }
    >
      <p className="muted" style={{ marginTop: 10 }}>
        A cobrança é mensal e automática pelo Mercado Pago. Você pode cancelar quando quiser.
      </p>
      <div className="stack">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <TextField className="spacer" label="Cupom de desconto" value={cupom} onChange={(e) => { setCupom(e.target.value.toUpperCase()); setDesconto(null); }} error={erros.cupom} hint="Opcional" />
          <button type="button" className="btn" onClick={aplicarCupom} disabled={validando || !cupom.trim()}>
            <Tag size={15} /> {validando ? 'Validando…' : 'Aplicar'}
          </button>
        </div>
        {desconto && (
          <div className="alert alert--success">
            <Check size={18} /> <span>{desconto.descricao || `${desconto.percDesconto}% de desconto`}</span>
          </div>
        )}
        <TextField
          label="E-mail de quem vai pagar"
          type="email"
          value={emailPagador}
          onChange={(e) => setEmailPagador(e.target.value)}
          error={erros.emailPagador}
          hint={`E-mail da conta do Mercado Pago. Em branco, usamos ${emailAdmin}.`}
        />
        <div className="info-tile">
          <div className="info-tile__label">Valor mensal</div>
          <div className="info-tile__value" style={{ fontSize: 22 }}>
            {reais(valorFinal)}
            {desconto && <span className="small muted" style={{ textDecoration: 'line-through', marginLeft: 8 }}>{reais(plano.valor)}</span>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Assinatura da igreja: situação, uso, troca de plano, pagamento e cancelamento
export default function Assinatura() {
  const { usuario, atualizarSessao } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const { dados: a, erro, carregando, recarregar, setDados } = useAsync(() => assinaturaService.obter(), []);
  const planos = useAsync(() => planoService.listar(), []);
  const [checkout, setCheckout] = useState(null);
  const [troca, setTroca] = useState(null);
  const [cancelar, setCancelar] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const aplicar = async (acao) => {
    setEnviando(true);
    try {
      const r = await acao();
      setDados(r);
      await atualizarSessao();
      toast.sucesso(r.mensagem ?? 'Assinatura atualizada.');
    } catch (e) {
      toast.erro(e);
    } finally {
      setEnviando(false);
      setTroca(null);
      setCancelar(false);
    }
  };

  if (carregando && !a) return <Loading />;
  if (erro) return <ErrorState erro={erro} onRetry={recarregar} />;

  const status = STATUS_ASSINATURA[a.status] ?? { label: a.status, tom: 'neutral' };
  const emTeste = a.status === 'TESTE';
  const lista = planos.dados?.planos ?? [];

  return (
    <>
      <PageHeader eyebrow="Administração" title="Assinatura" subtitle="Plano, pagamento e uso da igreja." back="/configuracoes" />

      {location.state?.boasVindas && (
        <div className="alert alert--success" style={{ marginBottom: 16 }}>
          <Check size={18} />
          <span>
            Igreja cadastrada! O teste grátis já começou. Próximos passos: cadastre líderes em Usuários, crie as células e assine um plano
            quando quiser.
          </span>
        </div>
      )}
      {!a.pagamentosHabilitados && (
        <div className="alert" style={{ marginBottom: 16 }}>
          <span>O pagamento online ainda não foi configurado no servidor. Fale com o suporte do Conectus para assinar.</span>
        </div>
      )}

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="row row--between">
          <h2 className="card__title">Plano {a.plano.nome}</h2>
          <Badge tone={status.tom}>{status.label}</Badge>
        </div>
        <p className="small muted" style={{ marginTop: 4 }}>
          {reais(a.valorCobrado ?? a.plano.valor)}/mês
          {a.cupom && ` · cupom ${a.cupom.codigo} (${a.cupom.percDesconto}% de desconto)`}
        </p>
        {a.planoPendente && (
          <div className="alert alert--info" style={{ marginTop: 10 }}>
            <span>Mudança para o plano {a.planoPendente.nome} agendada para o fim do período pago.</span>
          </div>
        )}
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 10, marginTop: 12 }}>
          {emTeste && <InfoTile icon={CalendarDays} label="Teste grátis até">{formatarData(a.fimTeste)}</InfoTile>}
          {!emTeste && <InfoTile icon={CalendarDays} label="Acesso garantido até">{formatarData(a.acessoAte)}</InfoTile>}
          {a.vencimento && a.status === 'ATIVA' && <InfoTile icon={Receipt} label="Próxima cobrança">{formatarData(a.vencimento)}</InfoTile>}
          <InfoTile icon={Receipt} label="Último pagamento">{formatarData(a.ultimoPagamento)}</InfoTile>
          <InfoTile icon={CreditCard} label="Forma de cobrança">{a.formaCobranca === 'MERCADO_PAGO' ? 'Mercado Pago (mensal)' : 'Nenhuma'}</InfoTile>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2 className="card__title">Uso do plano</h2>
        <div className="grid grid--3" style={{ marginTop: 14 }}>
          {RECURSOS.map(([rotulo, chave]) => {
            const limite = a.limites[chave];
            return (
              <div key={chave} className="info-tile">
                <div className="info-tile__label">{rotulo}</div>
                <div className="info-tile__value" style={{ fontSize: 20 }}>
                  {a.uso[chave]} <span className="small muted">/ {limiteTexto(limite)}</span>
                </div>
                {limite != null && <OccupancyBar atual={a.uso[chave]} maxima={limite} compacto />}
              </div>
            );
          })}
        </div>
        <p className="tiny muted" style={{ marginBottom: 0 }}>
          Histórico de triagens nos relatórios: {a.plano.historicoMeses == null ? 'completo' : `${a.plano.historicoMeses} meses`}.
        </p>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h2 className="card__title" style={{ marginBottom: 10 }}>Planos</h2>
        {planos.erro && <ErrorState erro={planos.erro} onRetry={planos.recarregar} />}
        <div className="grid grid--3">
          {lista.map((p) => {
            const atual = p.idPlano === a.planoId;
            const pendente = p.idPlano === a.planoPendente?.idPlano;
            return (
              <div key={p.idPlano} className={`card card--flat ${atual ? 'btn--selected' : ''}`}>
                <div className="row row--between">
                  <span className="strong">{p.nome}</span>
                  {atual && <Badge tone="success">Plano atual</Badge>}
                  {pendente && <Badge tone="info">Agendado</Badge>}
                </div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>
                  {reais(p.valor)}<span className="small muted">/mês</span>
                </div>
                <p className="small muted" style={{ margin: '4px 0 10px' }}>{p.descricao}</p>
                <div className="tiny muted" style={{ marginBottom: 12 }}>
                  {resumoLimites(p.limites)}
                </div>
                <div className="stack" style={{ gap: 6 }}>
                  {a.podeFazerCheckout && a.pagamentosHabilitados && (
                    <button className={`btn btn--block ${atual ? 'btn--primary' : ''}`} onClick={() => setCheckout(p)} disabled={enviando}>
                      Assinar {atual ? 'este plano' : p.nome}
                    </button>
                  )}
                  {emTeste && !atual && (
                    <button className="btn btn--ghost btn--block btn--sm" onClick={() => aplicar(() => assinaturaService.trocarPlano(p.idPlano))} disabled={enviando}>
                      Usar este plano no teste
                    </button>
                  )}
                  {!a.podeFazerCheckout && (!atual || a.planoPendente) && !pendente && (
                    <button className="btn btn--block" onClick={() => setTroca(p)} disabled={enviando}>
                      Trocar para {p.nome}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {a.faturas?.length > 0 && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2 className="card__title">Pagamentos</h2>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table">
              <thead><tr><th>Referência</th><th>Plano</th><th>Pago em</th><th className="num">Valor</th><th>Status</th></tr></thead>
              <tbody>
                {a.faturas.map((f) => (
                  <tr key={f.idFatura}>
                    <td>{String(f.mes).padStart(2, '0')}/{f.ano}</td>
                    <td>{lista.find((p) => p.idPlano === f.plano)?.nome ?? f.plano}</td>
                    <td>{formatarData(f.pagoEm)}</td>
                    <td className="num">{reais(f.valorPago)}</td>
                    <td>
                      <Badge tone={f.status === 'PAGA' ? 'success' : 'warning'}>{f.status}</Badge>
                      {f.motivoRecusa && <span className="tiny muted"> {f.motivoRecusa}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {a.podeCancelar && (
        <section className="card card--flat">
          <h2 className="card__title">Cancelar assinatura</h2>
          <p className="small muted">A cobrança para e o acesso continua até o fim do período já pago. Depois disso o sistema fica somente leitura.</p>
          <button className="btn btn--danger" onClick={() => setCancelar(true)} disabled={enviando}>Cancelar assinatura</button>
        </section>
      )}

      <CheckoutModal plano={checkout} emailAdmin={usuario.email} onClose={() => setCheckout(null)} />
      <ConfirmDialog
        open={Boolean(troca)}
        title={`Trocar para o plano ${troca?.nome ?? ''}?`}
        message={
          troca && troca.valor > a.plano.valor
            ? 'O upgrade vale na hora. O novo valor é cobrado a partir da próxima fatura.'
            : 'O downgrade é agendado para o fim do período já pago.'
        }
        confirmLabel="Trocar plano"
        loading={enviando}
        onCancel={() => setTroca(null)}
        onConfirm={() => aplicar(() => assinaturaService.trocarPlano(troca.idPlano))}
      />
      <ConfirmDialog
        open={cancelar}
        title="Cancelar a assinatura?"
        message="A cobrança automática será interrompida. Você pode assinar de novo quando quiser."
        confirmLabel="Cancelar assinatura"
        danger
        loading={enviando}
        onCancel={() => setCancelar(false)}
        onConfirm={() => aplicar(() => assinaturaService.cancelar())}
      />
    </>
  );
}
