import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Inbox, X } from 'lucide-react';
import { iniciais } from '../../utils/format';
import { STATUS_MEMBRO } from '../../utils/constants';

export function PageHeader({ eyebrow, title, subtitle, back = '/', actions }) {
  return (
    <header className="page-head">
      {back && (
        <Link to={back} className="back-link no-print">
          <ArrowLeft size={14} /> Voltar ao painel
        </Link>
      )}
      <div className="page-head__row">
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="row no-print">{actions}</div>}
      </div>
    </header>
  );
}

export function Field({ label, error, hint, children, className = '' }) {
  const id = useId();
  const filho = typeof children === 'function' ? children({ id, invalid: Boolean(error) }) : children;
  return (
    <div className={`field ${className}`}>
      {label && (
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
      )}
      {filho}
      {error ? <span className="field__error">{error}</span> : hint && <span className="field__hint">{hint}</span>}
    </div>
  );
}

export function TextField({ label, error, hint, className, ...props }) {
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      {({ id, invalid }) => <input id={id} className="input" aria-invalid={invalid} {...props} />}
    </Field>
  );
}

export function SelectField({ label, error, hint, className, options = [], placeholder, ...props }) {
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      {({ id, invalid }) => (
        <select id={id} className="select" aria-invalid={invalid} {...props}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function TextAreaField({ label, error, hint, className, ...props }) {
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      {({ id, invalid }) => <textarea id={id} className="textarea" aria-invalid={invalid} {...props} />}
    </Field>
  );
}

export function Modal({ open, onClose, title, children, footer, size }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const anterior = document.activeElement;
    ref.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      anterior?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${size === 'sm' ? 'modal--sm' : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} ref={ref} tabIndex={-1}>
        <button className="icon-button modal__close" onClick={onClose} aria-label="Fechar">
          <X size={18} />
        </button>
        {title && <h2 className="modal__title">{title}</h2>}
        {children}
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmar', danger, loading, onConfirm, onCancel, children }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`} onClick={onConfirm} disabled={loading}>
            {loading ? 'Aguarde…' : confirmLabel}
          </button>
        </>
      }
    >
      {message && <p className="muted" style={{ marginTop: 10 }}>{message}</p>}
      {children}
    </Modal>
  );
}

export const Badge = ({ tone, children }) => (
  <span className={`badge ${tone ? `badge--${tone}` : ''}`}>{children}</span>
);

export function StatusMembroBadge({ status }) {
  const s = STATUS_MEMBRO[status] ?? { label: status, tone: 'neutral' };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export const Avatar = ({ nome, size, soft }) => (
  <span className={`avatar ${size ? `avatar--${size}` : ''} ${soft ? 'avatar--soft' : ''}`} aria-hidden="true">
    {iniciais(nome)}
  </span>
);

/** Ocupação da célula, com destaque quando está lotando. */
export function OccupancyBar({ atual, maxima, compacto }) {
  const pct = maxima ? Math.min(100, Math.round((atual / maxima) * 100)) : 0;
  const classe = pct >= 100 ? 'occupancy__bar--full' : pct >= 85 ? 'occupancy__bar--high' : '';
  return (
    <div className="occupancy">
      {!compacto && (
        <div className="row row--between small">
          <span className="muted">
            {atual} / {maxima} membros
          </span>
          <span className="strong">{pct >= 100 ? 'Lotada' : `${pct}%`}</span>
        </div>
      )}
      <div
        className="occupancy__track"
        role="progressbar"
        aria-valuenow={atual}
        aria-valuemin={0}
        aria-valuemax={maxima}
        aria-label={`Ocupação: ${atual} de ${maxima}`}
      >
        <div className={`occupancy__bar ${classe}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ScoreBadge({ score, minimo = 50 }) {
  if (score === null || score === undefined) return <span className="score score--low">—</span>;
  return (
    <span className={`score ${score < minimo ? 'score--low' : ''}`} title="Compatibilidade calculada pelo algoritmo de matching">
      {score}%<small>match</small>
    </span>
  );
}

export function InfoTile({ icon: Icon, label, children }) {
  return (
    <div className="info-tile">
      <div className="info-tile__label">
        {Icon && <Icon size={13} />} {label}
      </div>
      <div className="info-tile__value">{children}</div>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, children, action }) {
  return (
    <div className="empty-state">
      <Icon size={34} />
      <div className="strong" style={{ color: 'var(--text)' }}>{title}</div>
      {children && <p className="small" style={{ margin: '6px 0 0' }}>{children}</p>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

export const Loading = ({ texto = 'Carregando…' }) => (
  <div className="loading-block" role="status">
    <span className="spinner" /> {texto}
  </div>
);

export function ErrorState({ erro, onRetry }) {
  return (
    <div className="alert alert--danger" role="alert">
      <AlertTriangle size={18} />
      <div style={{ flex: 1 }}>
        <div className="strong">Não foi possível carregar os dados.</div>
        <div className="small">{erro?.message}</div>
      </div>
      {onRetry && (
        <button className="btn btn--sm" onClick={() => onRetry()}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.icon && <o.icon size={15} />} {o.label}
        </button>
      ))}
    </div>
  );
}

const NOMES_CRITERIO = {
  distancia: 'Proximidade',
  idade: 'Faixa etária',
  disponibilidade: 'Disponibilidade',
  perfil: 'Perfil do grupo',
};

/** Transparência do algoritmo: mostra a contribuição de cada critério (criterios_score). */
export function CriteriosScore({ criterios }) {
  if (!criterios) return null;
  return (
    <div className="criteria">
      {Object.entries(NOMES_CRITERIO).map(([chave, nome]) => {
        const c = criterios[chave];
        if (!c) return null;
        const pct = Math.round(c.pontuacao * 100);
        return (
          <div className="criteria__row" key={chave}>
            <span className="muted">
              {nome}
              {chave === 'distancia' && c.km !== undefined && <> · {c.km.toLocaleString('pt-BR')} km</>}
            </span>
            <div className="hbar__track" title={`Peso ${Math.round(c.peso * 100)}%`}>
              <div className="hbar__fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="strong" style={{ textAlign: 'right' }}>
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
