export const iniciais = (nome = '') =>
  nome
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((_, i, arr) => i === 0 || i === arr.length - 1)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

export const primeiroNome = (nome = '') => nome.trim().split(/\s+/)[0] ?? '';

export const calcularIdade = (dataNascimento, hoje = new Date()) => {
  if (!dataNascimento) return null;
  const nasc = new Date(`${String(dataNascimento).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(nasc.getTime())) return null;
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade -= 1;
  return idade;
};

export const formatarData = (valor) => {
  if (!valor) return '—';
  const d = new Date(valor.length === 10 ? `${valor}T00:00:00` : valor);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
};

export const formatarDataHora = (valor) => {
  if (!valor) return '—';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

export const tempoRelativo = (valor, agora = new Date()) => {
  if (!valor) return '';
  const diffMs = agora - new Date(valor);
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
  const s = Math.round(d / 7);
  if (d < 30) return `há ${s} ${s === 1 ? 'semana' : 'semanas'}`;
  const mes = Math.round(d / 30);
  return `há ${mes} ${mes === 1 ? 'mês' : 'meses'}`;
};

export const formatarHorario = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':');
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
};

export const formatarTelefone = (valor = '') => {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

export const formatarCep = (valor = '') => {
  const d = valor.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

export const percentual = (parte, total) =>
  total > 0 ? Math.round((parte / total) * 100) : 0;

export const formatarNumero = (n) =>
  Number.isFinite(n) ? n.toLocaleString('pt-BR') : '∞';

/**
 * Troca texto vazio por null nos campos opcionais antes de enviar à API.
 * O back-end valida e-mail, datas e ids quando o campo vem preenchido; null significa "não informado".
 */
export const vazioParaNulo = (dados, campos) => {
  const copia = { ...dados };
  campos.forEach((c) => {
    if (typeof copia[c] === 'string' && copia[c].trim() === '') copia[c] = null;
  });
  return copia;
};

export const mesCurto = (yyyyMm) => {
  const [y, m] = yyyyMm.split('-').map(Number);
  const nome = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' });
  return nome.replace('.', '').replace(/^./, (c) => c.toUpperCase());
};
