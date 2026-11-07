const env = import.meta.env ?? {};

export const config = {
  /** Quando true, as requisições são atendidas pelo back-end simulado (src/services/mock). */
  useMock: String(env.VITE_USE_MOCK ?? 'true') === 'true',
  apiUrl: (env.VITE_API_URL ?? '/api').replace(/\/$/, ''),
  pollingMs: Number(env.VITE_POLLING_MS ?? 15000),
  routerMode: env.VITE_ROUTER_MODE ?? 'browser',
  timeoutMs: 15000,
  /** Build de prévia hospedada (sem download de arquivos nem impressão). */
  preview: String(env.VITE_PREVIEW ?? 'false') === 'true',
};
