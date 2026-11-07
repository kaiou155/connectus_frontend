import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Executa uma função assíncrona (normalmente um service) e controla
 * carregando / erro / dados. `deps` dispara uma nova busca quando mudam.
 * `pollingMs` mantém os dados atualizados periodicamente (ocupação em tempo real).
 */
export function useAsync(fn, deps = [], { pollingMs = 0, imediato = true } = {}) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(imediato);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);

  const executar = useCallback(async ({ silencioso = false } = {}) => {
    const atual = ++seq.current;
    if (!silencioso) setCarregando(true);
    setErro(null);
    try {
      const r = await fnRef.current();
      if (atual === seq.current) setDados(r);
      return r;
    } catch (e) {
      if (atual === seq.current) setErro(e);
      return null;
    } finally {
      if (atual === seq.current) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (imediato) executar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (!pollingMs) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') executar({ silencioso: true });
    }, pollingMs);
    return () => clearInterval(id);
  }, [pollingMs, executar]);

  return { dados, setDados, erro, carregando, recarregar: executar };
}

/** Debounce simples para campos de busca. */
export function useDebounce(valor, ms = 300) {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}
