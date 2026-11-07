import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remover = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const mostrar = useCallback(
    (mensagem, tipo = 'sucesso', duracao = 4500) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((t) => [...t.slice(-3), { id, mensagem, tipo }]);
      setTimeout(() => remover(id), duracao);
    },
    [remover],
  );

  const api = useMemo(
    () => ({
      sucesso: (m) => mostrar(m, 'sucesso'),
      erro: (m) => mostrar(typeof m === 'string' ? m : m?.message ?? 'Algo deu errado.', 'erro', 6500),
    }),
    [mostrar],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tipo === 'erro' ? 'toast--error' : ''}`}>
            {t.tipo === 'erro' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span style={{ flex: 1 }}>{t.mensagem}</span>
            <button className="btn btn--ghost btn--sm" style={{ padding: 0, color: 'inherit' }} onClick={() => remover(t.id)} aria-label="Fechar aviso">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
