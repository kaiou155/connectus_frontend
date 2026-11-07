import { config } from './config';
import { storage } from '../utils/storage';

const TOKEN_KEY = 'conectus.token';

/** Erro padronizado da API. `status` segue o HTTP; `campos` traz erros de validação por campo. */
export class ApiError extends Error {
  constructor(message, { status = 0, codigo, campos } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.codigo = codigo;
    this.campos = campos;
  }
}

let onUnauthorized = () => {};
/** Registrado pelo AuthContext: ao receber 401 a sessão é encerrada. */
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

export const tokenStore = {
  get: () => storage.get(TOKEN_KEY),
  set: (token) => storage.set(TOKEN_KEY, token),
  clear: () => storage.remove(TOKEN_KEY),
};

const montarQuery = (params) => {
  if (!params) return '';
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.append(k, v);
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
};

let mockHandler = null;
async function getMock() {
  if (!mockHandler) {
    const mod = await import('./mock/mockServer');
    mockHandler = mod.handleMockRequest;
  }
  return mockHandler;
}

/**
 * Ponto único de saída para a API REST:
 * - injeta o token JWT no cabeçalho Authorization;
 * - converte respostas de erro em ApiError;
 * - em modo demonstração, desvia a chamada para o back-end simulado com o MESMO contrato.
 */
async function request(method, path, { body, params, signal } = {}) {
  const url = `${path}${montarQuery(params)}`;
  const token = tokenStore.get();

  if (config.useMock) {
    const handle = await getMock();
    const res = await handle({ method, url, body, token });
    if (res.status === 401 && token) onUnauthorized();
    if (res.status >= 400) {
      throw new ApiError(res.body?.message ?? 'Erro na requisição', {
        status: res.status,
        codigo: res.body?.codigo,
        campos: res.body?.campos,
      });
    }
    return res.body;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  signal?.addEventListener('abort', () => controller.abort());

  let resposta;
  try {
    resposta = await fetch(`${config.apiUrl}${url}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    const msg =
      e.name === 'AbortError'
        ? 'O servidor demorou para responder. Tente novamente.'
        : 'Sem conexão com o servidor. Verifique sua internet.';
    throw new ApiError(msg, { status: 0 });
  } finally {
    clearTimeout(timer);
  }

  if (resposta.status === 204) return null;

  const tipo = resposta.headers.get('content-type') ?? '';
  const dados = tipo.includes('application/json') ? await resposta.json() : await resposta.text();

  if (!resposta.ok) {
    if (resposta.status === 401 && token) onUnauthorized();
    const mensagem =
      (typeof dados === 'object' && dados?.message) ||
      {
        400: 'Dados inválidos.',
        401: 'Sessão expirada. Entre novamente.',
        403: 'Você não tem permissão para esta ação.',
        404: 'Registro não encontrado.',
        409: 'Conflito: o registro foi alterado por outra pessoa.',
      }[resposta.status] ||
      'Erro inesperado no servidor.';
    throw new ApiError(mensagem, {
      status: resposta.status,
      codigo: dados?.codigo,
      campos: dados?.campos,
    });
  }
  return dados;
}

export const http = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
  delete: (path, opts) => request('DELETE', path, opts),
};
