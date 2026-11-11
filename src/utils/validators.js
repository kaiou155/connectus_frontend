/**
 * Validações de formulário no cliente.
 * O back-end deve repetir estas validações — o front-end só antecipa o erro ao usuário.
 */

export const isEmail = (v = '') => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export const isTelefone = (v = '') => {
  const d = v.replace(/\D/g, '');
  return d.length === 10 || d.length === 11;
};

export const isCep = (v = '') => v.replace(/\D/g, '').length === 8;

export const isDataPassada = (v) => {
  if (!v) return false;
  const d = new Date(`${v}T00:00:00`);
  return !Number.isNaN(d.getTime()) && d < new Date();
};

export function validarMembro(m) {
  const erros = {};
  if (!m.nomeCompleto?.trim() || m.nomeCompleto.trim().split(/\s+/).length < 2)
    erros.nomeCompleto = 'Informe nome e sobrenome.';
  if (!isDataPassada(m.dataNascimento)) erros.dataNascimento = 'Data de nascimento inválida.';
  if (!m.genero) erros.genero = 'Selecione o gênero.';
  if (!m.estadoCivil) erros.estadoCivil = 'Selecione o estado civil.';
  if (!isTelefone(m.telefone)) erros.telefone = 'Telefone com DDD (10 ou 11 dígitos).';
  if (m.email && !isEmail(m.email)) erros.email = 'E-mail inválido.';
  if (!isCep(m.cep)) erros.cep = 'CEP deve ter 8 dígitos.';
  if (!m.bairro?.trim()) erros.bairro = 'Informe o bairro.';
  if (!m.cidade?.trim()) erros.cidade = 'Informe a cidade.';
  (m.disponibilidades ?? []).forEach((d, i) => {
    if (!d.diaSemana) erros[`disp_${i}`] = 'Selecione o dia.';
    else if (d.horarioInicio && d.horarioFim && d.horarioFim <= d.horarioInicio)
      erros[`disp_${i}`] = 'O horário final deve ser após o inicial.';
  });
  return erros;
}

export function validarCelula(c) {
  const erros = {};
  if (!c.nomeCelula?.trim()) erros.nomeCelula = 'Informe o nome da célula.';
  if (!c.idLider) erros.idLider = 'Selecione o líder responsável.';
  if (!c.diaSemana) erros.diaSemana = 'Selecione o dia.';
  if (!c.horario) erros.horario = 'Informe o horário.';
  if (!isCep(c.cep)) erros.cep = 'CEP deve ter 8 dígitos.';
  if (!c.bairro?.trim()) erros.bairro = 'Informe o bairro.';
  const cap = Number(c.capacidadeMaxima);
  if (!Number.isInteger(cap) || cap < 2 || cap > 200)
    erros.capacidadeMaxima = 'Capacidade entre 2 e 200.';
  if (!c.perfilGrupo) erros.perfilGrupo = 'Selecione o perfil do grupo.';
  const min = Number(c.faixaEtariaMin);
  const max = Number(c.faixaEtariaMax);
  if (!min || !max || min > max) erros.faixaEtaria = 'Faixa etária inválida.';
  return erros;
}

export function validarUsuario(u, { edicao = false } = {}) {
  const erros = {};
  if (!u.nome?.trim()) erros.nome = 'Informe o nome.';
  if (!isEmail(u.email)) erros.email = 'E-mail inválido.';
  if (!u.perfil) erros.perfil = 'Selecione o perfil.';
  if (!edicao && (!u.senhaTemporaria || u.senhaTemporaria.length < 8))
    erros.senhaTemporaria = 'Mínimo de 8 caracteres.';
  return erros;
}

export function validarIgreja(i) {
  const erros = {};
  if (!i.nomeIgreja?.trim()) erros.nomeIgreja = 'Informe o nome da igreja.';
  if (!i.cidade?.trim()) erros.cidade = 'Informe a cidade.';
  if (!i.estado) erros.estado = 'Selecione o estado.';
  if (!i.plano) erros.plano = 'Selecione o plano.';
  return erros;
}

/** Nova senha + confirmação (mesmo mínimo exigido pelo back-end). */
export function validarNovaSenha({ novaSenha = '', confirmacao = '' }) {
  const erros = {};
  if (novaSenha.length < 8) erros.novaSenha = 'Mínimo de 8 caracteres.';
  else if (novaSenha !== confirmacao) erros.confirmacao = 'As senhas não conferem.';
  return erros;
}

export const temErros = (erros) => Object.keys(erros).length > 0;
