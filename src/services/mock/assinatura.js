/**
 * Assinatura no modo demonstração — mesmas regras do back-end (src/assinatura/situacao.ts):
 *
 *   TESTE     -> liberado até o fim do teste grátis
 *   ATIVA     -> liberado até o vencimento; depois entra em atraso
 *   ATRASADA  -> liberado até vencimento + carência
 *   CANCELADA -> liberado até o fim do período já pago
 *   EXPIRADA  -> sistema em modo somente leitura
 *
 * O pagamento pelo Mercado Pago é simulado: o checkout devolve um link interno
 * (/assinatura/retorno) e a sincronização confirma o pagamento.
 */
import { PLANOS } from '../../utils/constants';

export const TRIAL_DIAS = 7;
export const CARENCIA_DIAS = 5;
const DIA = 86400000;

/** Cupons válidos no modo demonstração. */
export const CUPONS = {
  TCC2026: { percDesconto: 20, descricao: '20% de desconto para a banca do TCC' },
  BEMVINDO: { percDesconto: 10, descricao: '10% de desconto na primeira assinatura' },
};

const semInfinito = (n) => (Number.isFinite(n) ? n : null);

/** Mesmo formato de GET /planos do back-end (null = ilimitado). */
export const planoPublico = (id) => {
  const p = PLANOS[id];
  return {
    idPlano: id,
    nome: p.label,
    descricao: p.descricao,
    valor: p.preco,
    limites: {
      membros: semInfinito(p.limites.membros),
      celulas: semInfinito(p.limites.celulas),
      usuarios: semInfinito(p.limites.usuarios),
    },
    historicoMeses: semInfinito(p.historicoMeses),
  };
};

export const listarPlanos = () => ({
  trialDias: TRIAL_DIAS,
  planos: Object.keys(PLANOS).map(planoPublico),
});

/** Cria a assinatura de uma igreja que ainda não tem uma (bancos salvos antes desta versão). */
export function assinaturaDe(db, idIgreja, agora = Date.now()) {
  db.assinaturas ??= [];
  let a = db.assinaturas.find((x) => x.idIgreja === idIgreja);
  if (!a) {
    const igreja = db.igrejas.find((i) => i.idIgreja === idIgreja);
    // as igrejas do cenário de demonstração já são assinantes em dia
    a = {
      idAssinatura: db.assinaturas.length + 1,
      idIgreja,
      status: 'ATIVA',
      idPlano: igreja?.plano ?? 'ESSENCIAL',
      idPlanoPendente: null,
      inicioTeste: null,
      fimTeste: null,
      vencimento: new Date(agora + 18 * DIA).toISOString(),
      ultimoPagamento: new Date(agora - 12 * DIA).toISOString(),
      dataCancelamento: null,
      assinanteMp: true,
      valorCobrado: PLANOS[igreja?.plano ?? 'ESSENCIAL'].preco,
      cupom: null,
      checkoutPendente: null,
      faturas: [],
    };
    a.faturas.push(faturaPaga(a, agora - 12 * DIA));
    db.assinaturas.push(a);
  }
  return a;
}

export function novaAssinaturaEmTeste(db, idIgreja, idPlano, agora = Date.now()) {
  db.assinaturas ??= [];
  const a = {
    idAssinatura: db.assinaturas.length + 1,
    idIgreja,
    status: 'TESTE',
    idPlano,
    idPlanoPendente: null,
    inicioTeste: new Date(agora).toISOString(),
    fimTeste: new Date(agora + TRIAL_DIAS * DIA).toISOString(),
    vencimento: null,
    ultimoPagamento: null,
    dataCancelamento: null,
    assinanteMp: false,
    valorCobrado: null,
    cupom: null,
    checkoutPendente: null,
    faturas: [],
  };
  db.assinaturas.push(a);
  return a;
}

export function faturaPaga(a, quando = Date.now()) {
  const d = new Date(quando);
  return {
    idFatura: (a.faturas?.length ?? 0) + 1,
    mes: d.getMonth() + 1,
    ano: d.getFullYear(),
    plano: a.idPlano,
    vencimento: d.toISOString().slice(0, 10),
    pagoEm: d.toISOString(),
    valorTotal: PLANOS[a.idPlano].preco,
    valorPago: a.valorCobrado ?? PLANOS[a.idPlano].preco,
    status: 'PAGA',
    motivoRecusa: null,
  };
}

export function avaliarAcesso(a, agora = Date.now()) {
  const data = (v) => (v ? new Date(v).getTime() : null);
  switch (a.status) {
    case 'TESTE': {
      const fim = data(a.fimTeste);
      if (fim && agora <= fim) return { status: 'TESTE', liberado: true, motivoBloqueio: null, acessoAte: fim };
      return { status: 'EXPIRADA', liberado: false, motivoBloqueio: 'TESTE_ENCERRADO', acessoAte: fim };
    }
    case 'ATIVA':
    case 'ATRASADA': {
      const venc = data(a.vencimento);
      if (!venc) return { status: a.status, liberado: true, motivoBloqueio: null, acessoAte: null };
      const limite = venc + CARENCIA_DIAS * DIA;
      if (agora <= venc && a.status === 'ATIVA') return { status: 'ATIVA', liberado: true, motivoBloqueio: null, acessoAte: venc };
      if (agora <= limite) return { status: 'ATRASADA', liberado: true, motivoBloqueio: null, acessoAte: limite };
      return { status: 'EXPIRADA', liberado: false, motivoBloqueio: 'PAGAMENTO_ATRASADO', acessoAte: limite };
    }
    case 'CANCELADA': {
      const venc = data(a.vencimento);
      if (venc && agora <= venc) return { status: 'CANCELADA', liberado: true, motivoBloqueio: null, acessoAte: venc };
      return { status: 'EXPIRADA', liberado: false, motivoBloqueio: 'ASSINATURA_CANCELADA', acessoAte: venc };
    }
    default:
      return { status: 'EXPIRADA', liberado: false, motivoBloqueio: 'ASSINATURA_EXPIRADA', acessoAte: null };
  }
}

/** Mesmo formato do campo `assinatura` do login, de /auth/me e de /igrejas/atual. */
export function resumoAcesso(a, agora = Date.now()) {
  const s = avaliarAcesso(a, agora);
  return {
    status: s.status,
    liberado: s.liberado,
    motivoBloqueio: s.motivoBloqueio,
    acessoAte: s.acessoAte ? new Date(s.acessoAte).toISOString() : null,
    diasRestantes: s.acessoAte ? Math.max(0, Math.ceil((s.acessoAte - agora) / DIA)) : null,
    plano: a.idPlano,
  };
}

export function mensagemBloqueio(motivo, admin) {
  const base = {
    TESTE_ENCERRADO: 'O período de teste gratuito terminou.',
    PAGAMENTO_ATRASADO: 'O pagamento da assinatura está em atraso.',
    ASSINATURA_CANCELADA: 'A assinatura foi cancelada.',
    ASSINATURA_EXPIRADA: 'A assinatura expirou.',
  }[motivo ?? 'ASSINATURA_EXPIRADA'];
  return `${base} O sistema está em modo somente leitura. ${
    admin ? 'Regularize em Configurações > Assinatura.' : 'Peça ao administrador da igreja para regularizar a assinatura.'
  }`;
}
