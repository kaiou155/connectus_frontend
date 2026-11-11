/**
 * Domínios usados no front-end. Os valores (chaves) devem ser os mesmos
 * persistidos pelo back-end nas colunas correspondentes do MER.
 */

// perfil_acesso.nome_perfil — níveis de acesso distintos
export const PERFIS = {
  ADMINISTRADOR: 'ADMINISTRADOR',
  LIDER: 'LIDER',
  VOLUNTARIO: 'VOLUNTARIO',
};

export const PERFIL_LABEL = {
  ADMINISTRADOR: 'Administrador',
  LIDER: 'Líder',
  VOLUNTARIO: 'Voluntário',
};

// dia_semana (celula e disponibilidade_membro)
export const DIAS_SEMANA = [
  { value: 'SEG', label: 'Segunda', curto: 'Seg' },
  { value: 'TER', label: 'Terça', curto: 'Ter' },
  { value: 'QUA', label: 'Quarta', curto: 'Qua' },
  { value: 'QUI', label: 'Quinta', curto: 'Qui' },
  { value: 'SEX', label: 'Sexta', curto: 'Sex' },
  { value: 'SAB', label: 'Sábado', curto: 'Sáb' },
  { value: 'DOM', label: 'Domingo', curto: 'Dom' },
];

export const diaLabel = (value, curto = false) => {
  const dia = DIAS_SEMANA.find((d) => d.value === value);
  if (!dia) return value ?? '—';
  return curto ? dia.curto : dia.label;
};

// celula.perfil_grupo
export const PERFIS_GRUPO = [
  { value: 'JOVENS', label: 'Jovens' },
  { value: 'UNIVERSITARIOS', label: 'Universitários' },
  { value: 'CASAIS', label: 'Casais' },
  { value: 'MULHERES', label: 'Mulheres' },
  { value: 'HOMENS', label: 'Homens' },
  { value: 'NOVOS_CONVERTIDOS', label: 'Novos convertidos' },
  { value: 'FAMILIAS', label: 'Famílias' },
  { value: 'MISTO', label: 'Misto' },
];

export const perfilGrupoLabel = (value) =>
  PERFIS_GRUPO.find((p) => p.value === value)?.label ?? value ?? '—';

// membro.genero
export const GENEROS = [
  { value: 'F', label: 'Feminino' },
  { value: 'M', label: 'Masculino' },
];

// membro.estado_civil
export const ESTADOS_CIVIS = [
  { value: 'SOLTEIRO', label: 'Solteiro(a)' },
  { value: 'CASADO', label: 'Casado(a)' },
  { value: 'DIVORCIADO', label: 'Divorciado(a)' },
  { value: 'VIUVO', label: 'Viúvo(a)' },
];

export const estadoCivilLabel = (value) =>
  ESTADOS_CIVIS.find((e) => e.value === value)?.label ?? value ?? '—';

// membro.status_membro
export const STATUS_MEMBRO = {
  AGUARDANDO_TRIAGEM: { label: 'Aguardando triagem', tone: 'warning' },
  ALOCADO: { label: 'Alocado', tone: 'success' },
  LISTA_ESPERA: { label: 'Lista de espera', tone: 'info' },
  DESLIGADO: { label: 'Desligado', tone: 'neutral' },
};

// feedback.status_adaptacao — botões rápidos do feedback
export const STATUS_ADAPTACAO = [
  { value: 'RESPONDEU', label: 'Respondeu' },
  { value: 'NAO_RESPONDEU', label: 'Não respondeu' },
  { value: 'PARTICIPANDO', label: 'Participando' },
];

export const statusAdaptacaoLabel = (value) =>
  STATUS_ADAPTACAO.find((s) => s.value === value)?.label ?? 'Pendente';

// log_triagem.status_triagem
export const STATUS_TRIAGEM = {
  SUGERIDA: 'SUGERIDA',
  APROVADA: 'APROVADA',
  REJEITADA: 'REJEITADA',
};

// Planos de assinatura. Com o back-end real a lista vem de GET /planos; estes valores são o padrão.
export const PLANOS = {
  ESSENCIAL: {
    label: 'Essencial',
    preco: 49,
    descricao: 'Para igrejas de pequeno porte: até 100 membros, 5 células e 3 usuários.',
    limites: { membros: 100, celulas: 5, usuarios: 3 },
    historicoMeses: 6,
  },
  INTERMEDIARIO: {
    label: 'Intermediário',
    preco: 99,
    descricao: 'Para igrejas em crescimento: até 500 membros, 20 células e 10 usuários.',
    limites: { membros: 500, celulas: 20, usuarios: 10 },
    historicoMeses: 12,
  },
  PREMIUM: {
    label: 'Premium',
    preco: 179,
    descricao: 'Para grandes instituições: cadastros ilimitados e histórico completo.',
    limites: { membros: Infinity, celulas: Infinity, usuarios: Infinity },
    historicoMeses: Infinity,
  },
};

export const STATUS_ASSINATURA = {
  TESTE: { label: 'Teste grátis', tom: 'info' },
  ATIVA: { label: 'Ativa', tom: 'success' },
  ATRASADA: { label: 'Pagamento atrasado', tom: 'warning' },
  CANCELADA: { label: 'Cancelada', tom: 'neutral' },
  EXPIRADA: { label: 'Expirada', tom: 'danger' },
};

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

/** Pontuação mínima para uma célula ser considerada "compatível". */
export const SCORE_MINIMO = 65;
