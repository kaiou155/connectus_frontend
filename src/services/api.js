/**
 * Services do Conectus — um objeto por recurso REST.
 * Este arquivo é o contrato entre front-end e back-end: cada função corresponde a
 * um endpoint documentado em docs/API_CONTRACT.md.
 */
import { http } from './http';

// Login
export const authService = {
  login: (email, senha) => http.post('/auth/login', { email, senha }),
  me: () => http.get('/auth/me'),
  /** Envia o link de redefinição por e-mail. A resposta é a mesma exista o e-mail ou não. */
  esqueciSenha: (email) => http.post('/auth/esqueci-senha', { email }),
  redefinirSenha: (token, novaSenha) => http.post('/auth/redefinir-senha', { token, novaSenha }),
  alterarSenha: (senhaAtual, novaSenha) => http.post('/auth/alterar-senha', { senhaAtual, novaSenha }),
};

// Igreja e multitenância
export const igrejaService = {
  atual: () => http.get('/igrejas/atual'),
  atualizar: (dados) => http.put('/igrejas/atual', dados),
  criar: (dados) => http.post('/igrejas', dados),
};

// Usuários
export const usuarioService = {
  listar: (params) => http.get('/usuarios', { params }),
  criar: (dados) => http.post('/usuarios', dados),
  atualizar: (id, dados) => http.put(`/usuarios/${id}`, dados),
  alterarStatus: (id, ativo, confirmar = false) =>
    http.patch(`/usuarios/${id}/status`, { ativo, confirmar }),
  /** Define uma nova senha temporária; o usuário troca no próximo acesso. */
  redefinirSenha: (id, senhaTemporaria) => http.post(`/usuarios/${id}/redefinir-senha`, { senhaTemporaria }),
};

// Líderes
export const liderService = {
  listar: (params) => http.get('/lideres', { params }),
  obter: (id) => http.get(`/lideres/${id}`),
};

// Células
export const celulaService = {
  listar: (params) => http.get('/celulas', { params }),
  obter: (id) => http.get(`/celulas/${id}`),
  criar: (dados) => http.post('/celulas', dados),
  atualizar: (id, dados) => http.put(`/celulas/${id}`, dados),
  alterarStatus: (id, ativa, confirmar = false) =>
    http.patch(`/celulas/${id}/status`, { ativa, confirmar }),
};

// Membros
export const membroService = {
  listar: (params) => http.get('/membros', { params }),
  obter: (id) => http.get(`/membros/${id}`),
  criar: (dados) => http.post('/membros', dados),
  atualizar: (id, dados) => http.put(`/membros/${id}`, dados),
  /** `reencaminhar: true` devolve o membro à fila de triagem. */
  registrarSaida: (id, { motivo, reencaminhar = false }) =>
    http.post(`/membros/${id}/saida`, { motivo, reencaminhar }),
  desvincular: (id, motivo) => http.post(`/membros/${id}/desvincular`, { motivo }),
  /** Exclusão definitiva (LGPD) — somente administrador. */
  excluir: (id) => http.delete(`/membros/${id}`),
};

// Triagem
export const triagemService = {
  pendentes: () => http.get('/triagem/pendentes'),
  /** Executa o algoritmo de matching e devolve as 3 células mais compatíveis. */
  matching: (idMembro) => http.post(`/triagem/${idMembro}/matching`),
  /** Confirma a alocação. Retorna 409 se a célula lotou nesse meio tempo. */
  alocar: (idMembro, { idCelula, modo, idLog }) =>
    http.post(`/triagem/${idMembro}/alocacao`, { idCelula, modo, idLog }),
  rejeitarSugestao: (idMembro, { idLog, motivo }) =>
    http.post(`/triagem/${idMembro}/rejeicao`, { idLog, motivo }),
  historico: (idMembro) => http.get(`/triagem/${idMembro}/logs`),
};

// Lista de espera
export const listaEsperaService = {
  listar: (params) => http.get('/lista-espera', { params }),
  adicionar: (idMembro, motivo) => http.post('/lista-espera', { idMembro, motivo }),
  registrarTentativa: (idEspera) => http.post(`/lista-espera/${idEspera}/tentativas`),
};

// Notificação automática de vaga aberta
export const notificacaoService = {
  listar: () => http.get('/notificacoes'),
  marcarLida: (id) => http.patch(`/notificacoes/${id}`, { lida: true }),
};

// Feedback
export const feedbackService = {
  /** Membros triados para a célula + último feedback de cada um. */
  acompanhamento: (params) => http.get('/feedbacks/acompanhamento', { params }),
  listar: (params) => http.get('/feedbacks', { params }),
  registrar: (dados) => http.post('/feedbacks', dados),
};

// Relatórios
export const relatorioService = {
  resumo: () => http.get('/relatorios/resumo'),
  novosMembros: (params) => http.get('/relatorios/novos-membros', { params }),
  ocupacao: () => http.get('/relatorios/ocupacao'),
  distribuicaoGeografica: (params) => http.get('/relatorios/distribuicao-geografica', { params }),
};

// Busca global
export const buscaService = {
  buscar: (q) => http.get('/busca', { params: { q } }),
};
