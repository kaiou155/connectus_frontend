/**
 * Back-end simulado — implementa no navegador o MESMO contrato REST documentado em
 * docs/API_CONTRACT.md. Serve para demonstrar o front-end sem servidor e como
 * referência executável das regras de negócio que o back-end Node.js deve aplicar.
 *
 * Ative/desative com VITE_USE_MOCK no arquivo .env.
 */
import { getDb, salvarDb, proximoId } from './db';
import { calcularMatching, haversine } from './matching';
import { geocodificar, normalizar } from './geo';
import { calcularIdade } from '../../utils/format';
import { PLANOS, SCORE_MINIMO } from '../../utils/constants';

const DIA = 86400000;
const agoraIso = () => new Date().toISOString();
const hojeIso = () => new Date().toISOString().slice(0, 10);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- respostas
const ok = (body) => ({ status: 200, body });
const created = (body) => ({ status: 201, body });
const erro = (status, message, extra = {}) => ({ status, body: { message, ...extra } });

class HttpErro extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
const falhar = (status, message, extra) => {
  throw new HttpErro(status, message, extra);
};

// ---------------------------------------------------------------- token JWT (simulado)
const b64 = (obj) => btoa(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const unb64 = (s) => JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/')));

function emitirToken(usuario) {
  const payload = {
    sub: usuario.idUsuario,
    perfil: usuario.perfil,
    idIgreja: usuario.idIgreja,
    exp: Math.floor(Date.now() / 1000) + 8 * 3600, // 8 horas
  };
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.mock-assinatura`;
}

function autenticar(db, token) {
  if (!token) return null;
  try {
    const payload = unb64(token.split('.')[1]);
    if (payload.exp * 1000 < Date.now()) return null;
    const usuario = db.usuarios.find((u) => u.idUsuario === payload.sub && u.ativo);
    return usuario ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- projeções (sem dados sensíveis)
const celulaLiderada = (db, idUsuario) =>
  db.celulas.find((c) => c.idLider === idUsuario && c.ativa) ?? null;

const usuarioPublico = (db, u) => {
  const cel = celulaLiderada(db, u.idUsuario);
  return {
    idUsuario: u.idUsuario,
    nome: u.nome,
    email: u.email,
    telefone: u.telefone ?? '',
    perfil: u.perfil,
    ativo: u.ativo,
    dataCriacao: u.dataCriacao,
    idIgreja: u.idIgreja,
    idCelula: cel?.idCelula ?? null,
    nomeCelula: cel?.nomeCelula ?? null,
  };
};

const celulaPublica = (db, c) => {
  const lider = db.usuarios.find((u) => u.idUsuario === c.idLider);
  const vagas = Math.max(0, c.capacidadeMaxima - c.capacidadeAtual);
  return {
    ...c,
    vagas,
    lotada: vagas === 0,
    ocupacaoPct: Math.round((c.capacidadeAtual / c.capacidadeMaxima) * 100),
    lider: lider ? { idUsuario: lider.idUsuario, nome: lider.nome, telefone: lider.telefone, email: lider.email } : null,
  };
};

const resumoCelula = (c) =>
  c ? { idCelula: c.idCelula, nomeCelula: c.nomeCelula, bairro: c.bairro, perfilGrupo: c.perfilGrupo } : null;

const membroComDisp = (db, m) => ({
  ...m,
  disponibilidades: db.disponibilidades
    .filter((d) => d.idMembro === m.idMembro)
    .map(({ diaSemana, horarioInicio, horarioFim }) => ({ diaSemana, horarioInicio, horarioFim })),
});

const membroPublico = (db, m) => {
  const cel = db.celulas.find((c) => c.idCelula === m.idCelulaAlocada);
  return {
    ...membroComDisp(db, m),
    idade: calcularIdade(m.dataNascimento),
    celula: resumoCelula(cel),
  };
};

// ---------------------------------------------------------------- regras de apoio
const doTenant = (lista, usuario) => lista.filter((x) => x.idIgreja === usuario.idIgreja);

function exigirPerfil(usuario, ...perfis) {
  if (!perfis.includes(usuario.perfil)) falhar(403, 'Seu perfil não tem acesso a esta funcionalidade.');
}

function buscarNoTenant(lista, campo, id, usuario, nome = 'Registro') {
  const item = lista.find((x) => x[campo] === Number(id));
  if (!item || item.idIgreja !== usuario.idIgreja) falhar(404, `${nome} não encontrado.`);
  return item;
}

function usoDoPlano(db, idIgreja) {
  return {
    membros: db.membros.filter((m) => m.idIgreja === idIgreja && m.statusMembro !== 'DESLIGADO').length,
    celulas: db.celulas.filter((c) => c.idIgreja === idIgreja && c.ativa).length,
    usuarios: db.usuarios.filter((u) => u.idIgreja === idIgreja && u.ativo).length,
  };
}

function verificarLimite(db, usuario, recurso) {
  const igreja = db.igrejas.find((i) => i.idIgreja === usuario.idIgreja);
  const plano = PLANOS[igreja.plano];
  const uso = usoDoPlano(db, usuario.idIgreja);
  if (uso[recurso] >= plano.limites[recurso]) {
    falhar(403, `Limite do plano ${plano.label} atingido (${plano.limites[recurso]} ${recurso}). Faça upgrade em Configurações.`, {
      codigo: 'LIMITE_PLANO',
    });
  }
}

function exigirCampos(body, campos) {
  const faltando = {};
  campos.forEach((c) => {
    const v = body?.[c];
    if (v === undefined || v === null || String(v).trim() === '') faltando[c] = 'Campo obrigatório.';
  });
  if (Object.keys(faltando).length) falhar(400, 'Preencha os campos obrigatórios.', { campos: faltando });
}

const celulasDoTenant = (db, usuario) => doTenant(db.celulas, usuario);

function matchingPara(db, membro, usuario, limite = 3) {
  const m = membroComDisp(db, membro);
  return calcularMatching(m, celulasDoTenant(db, usuario), { limite });
}

function fecharHistorico(db, idMembro, motivo) {
  const h = db.historicoCelulas.find((x) => x.idMembro === idMembro && !x.dataSaida);
  if (h) {
    h.dataSaida = hojeIso();
    h.motivoSaida = motivo;
  }
}

function proximaReuniao(diaSemana, horario) {
  const ordem = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
  const alvo = ordem.indexOf(diaSemana);
  const [h, min] = horario.split(':').map(Number);
  const d = new Date();
  for (let i = 0; i < 8; i += 1) {
    const c = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i, h, min);
    if (c.getDay() === alvo && c > d) return c.toISOString();
  }
  return null;
}

function salvarDisponibilidades(db, idMembro, lista = []) {
  db.disponibilidades = db.disponibilidades.filter((d) => d.idMembro !== idMembro);
  lista
    .filter((d) => d.diaSemana)
    .forEach((d) =>
      db.disponibilidades.push({
        idDisponibilidade: proximoId(db, 'disponibilidade'),
        idMembro,
        diaSemana: d.diaSemana,
        horarioInicio: d.horarioInicio || '',
        horarioFim: d.horarioFim || '',
      }),
    );
}

function dadosMembro(body) {
  return {
    nomeCompleto: body.nomeCompleto.trim(),
    dataNascimento: body.dataNascimento,
    genero: body.genero,
    estadoCivil: body.estadoCivil,
    telefone: body.telefone,
    email: body.email?.trim() ?? '',
    cep: body.cep,
    bairro: body.bairro.trim(),
    cidade: body.cidade?.trim() || 'São Paulo',
    perfilInteresse: body.perfilInteresse ?? '',
    indicadoPor: body.indicadoPor ? Number(body.indicadoPor) : null,
    observacoes: body.observacoes ?? '',
    ...(body.consentimentoLgpd !== undefined ? { consentimentoLgpd: Boolean(body.consentimentoLgpd) } : {}),
    ...geocodificar(body.bairro, body.cidade),
  };
}

function dadosCelula(body) {
  return {
    nomeCelula: body.nomeCelula.trim(),
    idLider: Number(body.idLider),
    capacidadeMaxima: Number(body.capacidadeMaxima),
    horario: body.horario,
    diaSemana: body.diaSemana,
    perfilGrupo: body.perfilGrupo,
    faixaEtaria: body.faixaEtaria,
    cep: body.cep,
    bairro: body.bairro.trim(),
    cidade: body.cidade?.trim() || 'São Paulo',
    endereco: body.endereco?.trim() ?? '',
    descricao: body.descricao?.trim() ?? '',
    ...geocodificar(body.bairro, body.cidade),
  };
}

// ---------------------------------------------------------------- rotas
const rotas = [];
const rota = (method, padrao, handler, { publica = false } = {}) => {
  const chaves = [];
  const regex = new RegExp(
    `^${padrao.replace(/:(\w+)/g, (_, k) => {
      chaves.push(k);
      return '([^/]+)';
    })}$`,
  );
  rotas.push({ method, regex, chaves, handler, publica });
};

// ---- Login
rota('POST', '/auth/login', ({ db, body }) => {
  const email = String(body?.email ?? '').trim().toLowerCase();
  const u = db.usuarios.find((x) => x.email.toLowerCase() === email);
  if (!u || u.senha !== body?.senha) return erro(401, 'E-mail ou senha inválidos.');
  if (!u.ativo) return erro(403, 'Usuário desativado. Procure o administrador.');
  return ok({ token: emitirToken(u), usuario: usuarioPublico(db, u) });
}, { publica: true });

rota('GET', '/auth/me', ({ db, usuario }) => ok(usuarioPublico(db, usuario)));

// ---- Igreja e multitenância
rota('GET', '/igrejas/atual', ({ db, usuario }) => {
  const igreja = db.igrejas.find((i) => i.idIgreja === usuario.idIgreja);
  return ok({ ...igreja, uso: usoDoPlano(db, igreja.idIgreja), limites: PLANOS[igreja.plano].limites });
});

rota('PUT', '/igrejas/atual', ({ db, usuario, body }) => {
  exigirPerfil(usuario, 'ADMINISTRADOR');
  exigirCampos(body, ['nomeIgreja', 'cidade', 'estado', 'plano']);
  if (!PLANOS[body.plano]) falhar(400, 'Plano inválido.');
  const uso = usoDoPlano(db, usuario.idIgreja);
  const limites = PLANOS[body.plano].limites;
  const excede = Object.keys(limites).filter((k) => uso[k] > limites[k]);
  if (excede.length) {
    falhar(409, `O uso atual (${excede.map((k) => `${uso[k]} ${k}`).join(', ')}) excede o plano ${PLANOS[body.plano].label}.`);
  }
  const igreja = db.igrejas.find((i) => i.idIgreja === usuario.idIgreja);
  Object.assign(igreja, {
    nomeIgreja: body.nomeIgreja.trim(),
    denominacao: body.denominacao?.trim() ?? '',
    cidade: body.cidade.trim(),
    estado: body.estado,
    plano: body.plano,
  });
  return ok({ ...igreja, uso: usoDoPlano(db, igreja.idIgreja), limites: PLANOS[igreja.plano].limites });
});

// Cadastro de uma nova igreja cliente (onboarding SaaS): cria o tenant e o primeiro administrador
rota('POST', '/igrejas', ({ db, body }) => {
  const igrejaBody = body?.igreja ?? {};
  const admin = body?.administrador ?? {};
  exigirCampos(igrejaBody, ['nomeIgreja', 'cidade', 'estado', 'plano']);
  exigirCampos(admin, ['nome', 'email', 'senha']);
  if (String(admin.senha).length < 8) falhar(400, 'A senha deve ter ao menos 8 caracteres.', { campos: { senha: 'Mínimo de 8 caracteres.' } });
  if (db.usuarios.some((u) => u.email.toLowerCase() === admin.email.trim().toLowerCase()))
    falhar(409, 'Já existe um usuário com este e-mail.', { campos: { email: 'E-mail já cadastrado.' } });
  const igreja = {
    idIgreja: proximoId(db, 'igreja'),
    nomeIgreja: igrejaBody.nomeIgreja.trim(),
    denominacao: igrejaBody.denominacao?.trim() ?? '',
    cidade: igrejaBody.cidade.trim(),
    estado: igrejaBody.estado,
    plano: igrejaBody.plano,
    ativo: true,
    dataCadastro: agoraIso(),
  };
  db.igrejas.push(igreja);
  const u = {
    idUsuario: proximoId(db, 'usuario'),
    nome: admin.nome.trim(),
    email: admin.email.trim().toLowerCase(),
    telefone: admin.telefone ?? '',
    perfil: 'ADMINISTRADOR',
    senha: admin.senha,
    ativo: true,
    dataCriacao: agoraIso(),
    idIgreja: igreja.idIgreja,
  };
  db.usuarios.push(u);
  return created({ igreja, token: emitirToken(u), usuario: usuarioPublico(db, u) });
}, { publica: true });

// ---- Usuários
rota('GET', '/usuarios', ({ db, usuario, query }) => {
  exigirPerfil(usuario, 'ADMINISTRADOR');
  let lista = doTenant(db.usuarios, usuario);
  if (query.perfil) lista = lista.filter((u) => u.perfil === query.perfil);
  if (query.ativo) lista = lista.filter((u) => String(u.ativo) === query.ativo);
  if (query.q) lista = lista.filter((u) => normalizar(`${u.nome} ${u.email}`).includes(normalizar(query.q)));
  return ok(lista.map((u) => usuarioPublico(db, u)).sort((a, b) => a.nome.localeCompare(b.nome)));
});

rota('POST', '/usuarios', ({ db, usuario, body }) => {
  exigirPerfil(usuario, 'ADMINISTRADOR');
  exigirCampos(body, ['nome', 'email', 'perfil', 'senhaTemporaria']);
  verificarLimite(db, usuario, 'usuarios');
  const email = body.email.trim().toLowerCase();
  if (db.usuarios.some((u) => u.email.toLowerCase() === email))
    falhar(409, 'Já existe um usuário com este e-mail.', { campos: { email: 'E-mail já cadastrado.' } });
  const novo = {
    idUsuario: proximoId(db, 'usuario'),
    nome: body.nome.trim(),
    email,
    telefone: body.telefone ?? '',
    perfil: body.perfil,
    senha: body.senhaTemporaria,
    ativo: true,
    dataCriacao: agoraIso(),
    idIgreja: usuario.idIgreja,
  };
  db.usuarios.push(novo);
  return created({ ...usuarioPublico(db, novo), mensagem: `Credenciais enviadas para ${email}.` });
});

rota('PUT', '/usuarios/:id', ({ db, usuario, body, params }) => {
  exigirPerfil(usuario, 'ADMINISTRADOR');
  const alvo = buscarNoTenant(db.usuarios, 'idUsuario', params.id, usuario, 'Usuário');
  exigirCampos(body, ['nome', 'email', 'perfil']);
  const email = body.email.trim().toLowerCase();
  if (db.usuarios.some((u) => u.email.toLowerCase() === email && u.idUsuario !== alvo.idUsuario))
    falhar(409, 'Já existe um usuário com este e-mail.', { campos: { email: 'E-mail já cadastrado.' } });
  const cel = celulaLiderada(db, alvo.idUsuario);
  if (cel && body.perfil !== 'LIDER')
    falhar(409, `${alvo.nome} lidera a célula "${cel.nomeCelula}". Defina outro líder antes de mudar o perfil.`);
  if (alvo.idUsuario === usuario.idUsuario && body.perfil !== 'ADMINISTRADOR')
    falhar(400, 'Você não pode remover seu próprio perfil de administrador.');
  Object.assign(alvo, { nome: body.nome.trim(), email, perfil: body.perfil, telefone: body.telefone ?? '' });
  return ok(usuarioPublico(db, alvo));
});

rota('PATCH', '/usuarios/:id/status', ({ db, usuario, body, params }) => {
  exigirPerfil(usuario, 'ADMINISTRADOR');
  const alvo = buscarNoTenant(db.usuarios, 'idUsuario', params.id, usuario, 'Usuário');
  if (alvo.idUsuario === usuario.idUsuario) falhar(400, 'Você não pode desativar o próprio acesso.');
  if (body.ativo) {
    verificarLimite(db, usuario, 'usuarios');
    alvo.ativo = true;
    return ok(usuarioPublico(db, alvo));
  }
  const cel = celulaLiderada(db, alvo.idUsuario);
  if (cel && !body.confirmar) {
    // exige confirmação explícita
    falhar(409, `${alvo.nome} é líder da célula "${cel.nomeCelula}". A célula ficará sem líder ativo. Deseja continuar?`, {
      codigo: 'CONFIRMACAO_NECESSARIA',
    });
  }
  alvo.ativo = false;
  return ok(usuarioPublico(db, alvo));
});

// ---- Líderes
const liderDetalhado = (db, u) => {
  const cel = db.celulas.find((c) => c.idLider === u.idUsuario && c.ativa);
  return {
    ...usuarioPublico(db, u),
    liderDesde: u.dataCriacao,
    celula: cel ? { ...resumoCelula(cel), capacidadeAtual: cel.capacidadeAtual, capacidadeMaxima: cel.capacidadeMaxima } : null,
    totalMembros: cel?.capacidadeAtual ?? 0,
  };
};

rota('GET', '/lideres', ({ db, usuario, query }) => {
  let lista = doTenant(db.usuarios, usuario).filter((u) => u.perfil === 'LIDER' && u.ativo);
  if (query.q) lista = lista.filter((u) => normalizar(u.nome).includes(normalizar(query.q)));
  return ok(lista.map((u) => liderDetalhado(db, u)).sort((a, b) => a.nome.localeCompare(b.nome)));
});

rota('GET', '/lideres/:id', ({ db, usuario, params }) => {
  const u = buscarNoTenant(db.usuarios, 'idUsuario', params.id, usuario, 'Líder');
  if (u.perfil !== 'LIDER') falhar(404, 'Líder não encontrado.');
  return ok(liderDetalhado(db, u));
});

// ---- Células
rota('GET', '/celulas', ({ db, usuario, query }) => {
  let lista = celulasDoTenant(db, usuario);
  const incluirInativas = query.incluirInativas === 'true' && usuario.perfil === 'ADMINISTRADOR';
  if (!incluirInativas) lista = lista.filter((c) => c.ativa);
  if (query.q) lista = lista.filter((c) => normalizar(`${c.nomeCelula} ${c.bairro}`).includes(normalizar(query.q)));
  if (query.bairro) lista = lista.filter((c) => normalizar(c.bairro).includes(normalizar(query.bairro)));
  if (query.perfil) lista = lista.filter((c) => c.perfilGrupo === query.perfil);
  if (query.dia) lista = lista.filter((c) => c.diaSemana === query.dia);
  if (query.comVagas === 'true') lista = lista.filter((c) => c.capacidadeAtual < c.capacidadeMaxima);
  return ok(lista.map((c) => celulaPublica(db, c)).sort((a, b) => a.nomeCelula.localeCompare(b.nomeCelula)));
});

rota('GET', '/celulas/:id', ({ db, usuario, params }) => {
  const c = buscarNoTenant(db.celulas, 'idCelula', params.id, usuario, 'Célula');
  const integrantes = db.membros
    .filter((m) => m.idCelulaAlocada === c.idCelula)
    .map((m) => ({
      idMembro: m.idMembro,
      nomeCompleto: m.nomeCompleto,
      dataEntrada: db.historicoCelulas.find((h) => h.idMembro === m.idMembro && h.idCelula === c.idCelula && !h.dataSaida)?.dataEntrada,
    }))
    .sort((a, b) => String(b.dataEntrada).localeCompare(String(a.dataEntrada)));
  return ok({ ...celulaPublica(db, c), integrantes, proximaReuniao: c.ativa ? proximaReuniao(c.diaSemana, c.horario) : null });
});

function validarLiderDaCelula(db, usuario, idLider, idCelulaAtual = null) {
  const lider = db.usuarios.find((u) => u.idUsuario === Number(idLider) && u.idIgreja === usuario.idIgreja);
  if (!lider || lider.perfil !== 'LIDER' || !lider.ativo)
    falhar(400, 'Selecione um usuário ativo com perfil Líder.', { campos: { idLider: 'Líder inválido.' } });
  const outra = celulaLiderada(db, lider.idUsuario);
  if (outra && outra.idCelula !== idCelulaAtual)
    falhar(409, `${lider.nome} já lidera a célula "${outra.nomeCelula}".`, { campos: { idLider: 'Líder já possui célula.' } });
}

const CAMPOS_CELULA = ['nomeCelula', 'idLider', 'capacidadeMaxima', 'horario', 'diaSemana', 'perfilGrupo', 'faixaEtaria', 'cep', 'bairro'];

rota('POST', '/celulas', ({ db, usuario, body }) => {
  exigirPerfil(usuario, 'ADMINISTRADOR');
  exigirCampos(body, CAMPOS_CELULA);
  verificarLimite(db, usuario, 'celulas');
  validarLiderDaCelula(db, usuario, body.idLider);
  const nova = {
    idCelula: proximoId(db, 'celula'),
    ...dadosCelula(body),
    capacidadeAtual: 0,
    statusCelula: 'ATIVA',
    ativa: true,
    idIgreja: usuario.idIgreja,
  };
  db.celulas.push(nova);
  return created(celulaPublica(db, nova));
});

rota('PUT', '/celulas/:id', ({ db, usuario, body, params }) => {
  exigirPerfil(usuario, 'ADMINISTRADOR');
  const c = buscarNoTenant(db.celulas, 'idCelula', params.id, usuario, 'Célula');
  exigirCampos(body, CAMPOS_CELULA);
  validarLiderDaCelula(db, usuario, body.idLider, c.idCelula);
  if (Number(body.capacidadeMaxima) < c.capacidadeAtual)
    falhar(400, `A célula já possui ${c.capacidadeAtual} membros; a capacidade não pode ser menor.`, {
      campos: { capacidadeMaxima: `Mínimo atual: ${c.capacidadeAtual}.` },
    });
  Object.assign(c, dadosCelula(body));
  return ok(celulaPublica(db, c));
});

rota('PATCH', '/celulas/:id/status', ({ db, usuario, body, params }) => {
  exigirPerfil(usuario, 'ADMINISTRADOR');
  const c = buscarNoTenant(db.celulas, 'idCelula', params.id, usuario, 'Célula');
  if (body.ativa) {
    verificarLimite(db, usuario, 'celulas');
    Object.assign(c, { ativa: true, statusCelula: 'ATIVA' });
    return ok(celulaPublica(db, c));
  }
  const vinculados = db.membros.filter((m) => m.idCelulaAlocada === c.idCelula);
  if (vinculados.length && !body.confirmar) {
    // desativar célula com membros ativos exige confirmação
    falhar(409, `A célula possui ${vinculados.length} membro(s) ativo(s). Eles ficarão sem alocação até serem redistribuídos.`, {
      codigo: 'CONFIRMACAO_NECESSARIA',
    });
  }
  vinculados.forEach((m) => {
    fecharHistorico(db, m.idMembro, 'Célula desativada');
    m.idCelulaAlocada = null;
    m.statusMembro = 'AGUARDANDO_TRIAGEM';
  });
  Object.assign(c, { ativa: false, statusCelula: 'INATIVA', capacidadeAtual: 0 });
  return ok({ ...celulaPublica(db, c), membrosRedistribuir: vinculados.length });
});

// ---- Membros
rota('GET', '/membros', ({ db, usuario, query }) => {
  let lista = doTenant(db.membros, usuario);
  if (usuario.perfil === 'LIDER') {
    const cel = celulaLiderada(db, usuario.idUsuario);
    lista = lista.filter((m) => cel && m.idCelulaAlocada === cel.idCelula);
  }
  if (query.q) lista = lista.filter((m) => normalizar(m.nomeCompleto).includes(normalizar(query.q)));
  if (query.status) lista = lista.filter((m) => m.statusMembro === query.status);
  if (query.idCelula) lista = lista.filter((m) => m.idCelulaAlocada === Number(query.idCelula));
  if (query.bairro) lista = lista.filter((m) => normalizar(m.bairro).includes(normalizar(query.bairro)));
  if (query.de) lista = lista.filter((m) => m.dataCadastro.slice(0, 10) >= query.de);
  if (query.ate) lista = lista.filter((m) => m.dataCadastro.slice(0, 10) <= query.ate);
  return ok(lista.map((m) => membroPublico(db, m)).sort((a, b) => b.dataCadastro.localeCompare(a.dataCadastro)));
});

rota('GET', '/membros/:id', ({ db, usuario, params }) => {
  const m = buscarNoTenant(db.membros, 'idMembro', params.id, usuario, 'Membro');
  if (usuario.perfil === 'LIDER' && celulaLiderada(db, usuario.idUsuario)?.idCelula !== m.idCelulaAlocada)
    falhar(403, 'Este membro não pertence à sua célula.');
  const nomeCel = (id) => db.celulas.find((c) => c.idCelula === id)?.nomeCelula ?? '—';
  const indicador = db.membros.find((x) => x.idMembro === m.indicadoPor);
  return ok({
    ...membroPublico(db, m),
    indicadoPorNome: indicador?.nomeCompleto ?? null,
    historico: db.historicoCelulas
      .filter((h) => h.idMembro === m.idMembro)
      .map((h) => ({ ...h, nomeCelula: nomeCel(h.idCelula) }))
      .sort((a, b) => b.dataEntrada.localeCompare(a.dataEntrada)),
    feedbacks: db.feedbacks.filter((f) => f.idMembro === m.idMembro).sort((a, b) => b.dataCriacao.localeCompare(a.dataCriacao)),
    logs: db.logsTriagem
      .filter((l) => l.idMembro === m.idMembro)
      .map((l) => ({ ...l, nomeCelula: nomeCel(l.idCelulaSugerida) }))
      .sort((a, b) => b.dataHora.localeCompare(a.dataHora)),
  });
});

const CAMPOS_MEMBRO = ['nomeCompleto', 'dataNascimento', 'genero', 'estadoCivil', 'telefone', 'cep', 'bairro'];

rota('POST', '/membros', ({ db, usuario, body }) => {
  exigirPerfil(usuario, 'VOLUNTARIO', 'ADMINISTRADOR');
  exigirCampos(body, CAMPOS_MEMBRO);
  verificarLimite(db, usuario, 'membros');
  const novo = {
    idMembro: proximoId(db, 'membro'),
    ...dadosMembro(body),
    idCelulaAlocada: null,
    idUsuarioTriagem: usuario.idUsuario,
    statusMembro: 'AGUARDANDO_TRIAGEM',
    dataCadastro: agoraIso(),
    idIgreja: usuario.idIgreja,
  };
  db.membros.push(novo);
  salvarDisponibilidades(db, novo.idMembro, body.disponibilidades);
  return created(membroPublico(db, novo));
});

rota('PUT', '/membros/:id', ({ db, usuario, body, params }) => {
  exigirPerfil(usuario, 'ADMINISTRADOR');
  const m = buscarNoTenant(db.membros, 'idMembro', params.id, usuario, 'Membro');
  exigirCampos(body, CAMPOS_MEMBRO);
  Object.assign(m, dadosMembro(body));
  salvarDisponibilidades(db, m.idMembro, body.disponibilidades);
  return ok(membroPublico(db, m));
});

function registrarSaida(db, usuario, id, motivo, reencaminhar) {
  const m = buscarNoTenant(db.membros, 'idMembro', id, usuario, 'Membro');
  if (!m.idCelulaAlocada) falhar(400, 'O membro não está alocado em uma célula.');
  if (usuario.perfil === 'LIDER' && celulaLiderada(db, usuario.idUsuario)?.idCelula !== m.idCelulaAlocada)
    falhar(403, 'Só é possível registrar saída de membros da sua célula.');
  if (!String(motivo ?? '').trim()) falhar(400, 'Informe o motivo da saída.', { campos: { motivo: 'Obrigatório.' } });
  const cel = db.celulas.find((c) => c.idCelula === m.idCelulaAlocada);
  fecharHistorico(db, m.idMembro, motivo.trim());
  cel.capacidadeAtual = Math.max(0, cel.capacidadeAtual - 1);
  m.idCelulaAlocada = null;
  m.statusMembro = reencaminhar ? 'AGUARDANDO_TRIAGEM' : 'DESLIGADO';
  return ok(membroPublico(db, m));
}

rota('POST', '/membros/:id/saida', ({ db, usuario, body, params }) => {
  exigirPerfil(usuario, 'LIDER', 'ADMINISTRADOR');
  return registrarSaida(db, usuario, params.id, body?.motivo, Boolean(body?.reencaminhar));
});

rota('POST', '/membros/:id/desvincular', ({ db, usuario, body, params }) => {
  exigirPerfil(usuario, 'ADMINISTRADOR');
  return registrarSaida(db, usuario, params.id, body?.motivo || 'Desvinculado pelo administrador', true);
});

// exclusão definitiva a pedido do titular (LGPD): apaga o membro e tudo que depende dele
rota('DELETE', '/membros/:id', ({ db, usuario, params }) => {
  exigirPerfil(usuario, 'ADMINISTRADOR');
  const m = buscarNoTenant(db.membros, 'idMembro', params.id, usuario, 'Membro');
  if (m.idCelulaAlocada) {
    const c = db.celulas.find((x) => x.idCelula === m.idCelulaAlocada);
    if (c && c.capacidadeAtual > 0) c.capacidadeAtual -= 1;
  }
  const outro = (x) => x.idMembro !== m.idMembro;
  db.membros = db.membros.filter(outro);
  db.disponibilidades = db.disponibilidades.filter(outro);
  db.historicoCelulas = db.historicoCelulas.filter(outro);
  db.logsTriagem = db.logsTriagem.filter(outro);
  db.listaEspera = db.listaEspera.filter(outro);
  db.feedbacks = db.feedbacks.filter(outro);
  db.membros.forEach((x) => {
    if (x.indicadoPor === m.idMembro) x.indicadoPor = null;
  });
  return ok({ mensagem: 'Dados do membro excluídos definitivamente.' });
});

// ---- Triagem
rota('GET', '/triagem/pendentes', ({ db, usuario }) => {
  exigirPerfil(usuario, 'VOLUNTARIO', 'ADMINISTRADOR');
  const pendentes = doTenant(db.membros, usuario)
    .filter((m) => m.statusMembro === 'AGUARDANDO_TRIAGEM')
    .sort((a, b) => a.dataCadastro.localeCompare(b.dataCadastro))
    .map((m) => {
      const [melhor] = matchingPara(db, m, usuario, 1);
      const cel = melhor && db.celulas.find((c) => c.idCelula === melhor.idCelula);
      return {
        ...membroPublico(db, m),
        melhorSugestao: melhor
          ? { ...resumoCelula(cel), score: melhor.score, compativel: melhor.score >= SCORE_MINIMO }
          : null,
      };
    });
  return ok(pendentes);
});

rota('POST', '/triagem/:id/matching', ({ db, usuario, params }) => {
  exigirPerfil(usuario, 'VOLUNTARIO', 'ADMINISTRADOR');
  const inicio = performance.now();
  const m = buscarNoTenant(db.membros, 'idMembro', params.id, usuario, 'Membro');
  if (!['AGUARDANDO_TRIAGEM', 'LISTA_ESPERA'].includes(m.statusMembro))
    falhar(409, 'Este membro já foi triado.', { codigo: 'JA_TRIADO' });
  // sugestões anteriores ainda abertas são descartadas
  db.logsTriagem
    .filter((l) => l.idMembro === m.idMembro && l.statusTriagem === 'SUGERIDA')
    .forEach((l) => Object.assign(l, { statusTriagem: 'REJEITADA', motivoRejeicao: 'Nova execução do matching', idRespDecisao: usuario.idUsuario }));
  const resultado = matchingPara(db, m, usuario, 3);
  const sugestoes = resultado.map((r) => {
    const idLog = proximoId(db, 'log');
    db.logsTriagem.push({
      idLog,
      idMembro: m.idMembro,
      idVoluntario: usuario.idUsuario,
      idCelulaSugerida: r.idCelula,
      scoreMatching: r.score,
      criteriosScore: r.criterios,
      statusTriagem: 'SUGERIDA',
      idRespDecisao: null,
      motivoRejeicao: null,
      dataHora: agoraIso(),
    });
    const cel = db.celulas.find((c) => c.idCelula === r.idCelula);
    return { idLog, score: r.score, compativel: r.score >= SCORE_MINIMO, criterios: r.criterios, celula: celulaPublica(db, cel) };
  });
  return ok({
    membro: membroPublico(db, m),
    sugestoes,
    scoreMinimo: SCORE_MINIMO,
    tempoMs: Math.round(performance.now() - inicio),
  });
});

rota('POST', '/triagem/:id/alocacao', ({ db, usuario, body, params }) => {
  exigirPerfil(usuario, 'VOLUNTARIO', 'ADMINISTRADOR');
  const m = buscarNoTenant(db.membros, 'idMembro', params.id, usuario, 'Membro');
  if (!['AGUARDANDO_TRIAGEM', 'LISTA_ESPERA'].includes(m.statusMembro))
    falhar(409, `${m.nomeCompleto} já foi alocado(a) por outro voluntário.`, { codigo: 'JA_TRIADO' });
  const cel = buscarNoTenant(db.celulas, 'idCelula', body?.idCelula, usuario, 'Célula');
  if (!cel.ativa) falhar(409, 'Esta célula está inativa.', { codigo: 'CELULA_INATIVA' });
  if (cel.capacidadeAtual >= cel.capacidadeMaxima) {
    // bloqueio de alocação em célula lotada (verificado também no servidor)
    falhar(409, `A célula "${cel.nomeCelula}" atingiu a capacidade máxima. Escolha outra célula.`, { codigo: 'CELULA_LOTADA' });
  }

  let log = body.idLog ? db.logsTriagem.find((l) => l.idLog === Number(body.idLog) && l.idMembro === m.idMembro) : null;
  if (log && log.idCelulaSugerida !== cel.idCelula) log = null;
  if (log) {
    Object.assign(log, { statusTriagem: 'APROVADA', idRespDecisao: usuario.idUsuario });
  } else {
    // triagem manual: registra o log com o escore calculado para a célula escolhida
    const calc = calcularMatching(membroComDisp(db, m), [cel], { limite: 1 })[0];
    log = {
      idLog: proximoId(db, 'log'),
      idMembro: m.idMembro,
      idVoluntario: usuario.idUsuario,
      idCelulaSugerida: cel.idCelula,
      scoreMatching: calc?.score ?? null,
      criteriosScore: { ...(calc?.criterios ?? {}), modo: body.modo ?? 'MANUAL' },
      statusTriagem: 'APROVADA',
      idRespDecisao: usuario.idUsuario,
      motivoRejeicao: null,
      dataHora: agoraIso(),
    };
    db.logsTriagem.push(log);
  }
  db.logsTriagem
    .filter((l) => l.idMembro === m.idMembro && l.statusTriagem === 'SUGERIDA')
    .forEach((l) => Object.assign(l, { statusTriagem: 'REJEITADA', motivoRejeicao: 'Outra célula foi escolhida', idRespDecisao: usuario.idUsuario }));

  const espera = db.listaEspera.find((e) => e.idMembro === m.idMembro && e.status === 'AGUARDANDO');
  if (espera) Object.assign(espera, { status: 'RESOLVIDO', dataResolucao: agoraIso() });

  m.idCelulaAlocada = cel.idCelula;
  m.statusMembro = 'ALOCADO';
  m.idUsuarioTriagem = usuario.idUsuario;
  cel.capacidadeAtual += 1;
  db.historicoCelulas.push({
    idHistorico: proximoId(db, 'historico'),
    idMembro: m.idMembro,
    idCelula: cel.idCelula,
    dataEntrada: hojeIso(),
    dataSaida: null,
    motivoSaida: null,
  });
  return ok({ membro: membroPublico(db, m), celula: celulaPublica(db, cel), idLog: log.idLog, modo: body.modo ?? 'MANUAL' });
});

rota('POST', '/triagem/:id/rejeicao', ({ db, usuario, body, params }) => {
  exigirPerfil(usuario, 'VOLUNTARIO', 'ADMINISTRADOR');
  const m = buscarNoTenant(db.membros, 'idMembro', params.id, usuario, 'Membro');
  const log = db.logsTriagem.find((l) => l.idLog === Number(body?.idLog) && l.idMembro === m.idMembro);
  if (!log) falhar(404, 'Sugestão não encontrada.');
  Object.assign(log, { statusTriagem: 'REJEITADA', motivoRejeicao: body?.motivo || 'Sem motivo informado', idRespDecisao: usuario.idUsuario });
  return ok(log);
});

rota('GET', '/triagem/:id/logs', ({ db, usuario, params }) => {
  const m = buscarNoTenant(db.membros, 'idMembro', params.id, usuario, 'Membro');
  return ok(db.logsTriagem.filter((l) => l.idMembro === m.idMembro).sort((a, b) => b.dataHora.localeCompare(a.dataHora)));
});

// ---- Lista de espera
function itemEspera(db, usuario, e) {
  const m = db.membros.find((x) => x.idMembro === e.idMembro);
  const [melhor] = matchingPara(db, m, usuario, 1);
  const cel = melhor && db.celulas.find((c) => c.idCelula === melhor.idCelula);
  return {
    ...e,
    membro: membroPublico(db, m),
    melhorSugestao: melhor ? { ...resumoCelula(cel), score: melhor.score, compativel: melhor.score >= SCORE_MINIMO } : null,
    vagaDisponivel: Boolean(melhor && melhor.score >= SCORE_MINIMO),
  };
}

rota('GET', '/lista-espera', ({ db, usuario, query }) => {
  exigirPerfil(usuario, 'VOLUNTARIO', 'ADMINISTRADOR');
  const status = query.status ?? 'AGUARDANDO';
  const lista = db.listaEspera
    .filter((e) => e.status === status)
    .filter((e) => db.membros.find((m) => m.idMembro === e.idMembro)?.idIgreja === usuario.idIgreja)
    .sort((a, b) => a.dataEntrada.localeCompare(b.dataEntrada))
    .map((e) => itemEspera(db, usuario, e));
  return ok(lista);
});

rota('POST', '/lista-espera', ({ db, usuario, body }) => {
  exigirPerfil(usuario, 'VOLUNTARIO', 'ADMINISTRADOR');
  const m = buscarNoTenant(db.membros, 'idMembro', body?.idMembro, usuario, 'Membro');
  if (m.statusMembro === 'ALOCADO') falhar(409, 'O membro já está alocado.');
  db.logsTriagem
    .filter((l) => l.idMembro === m.idMembro && l.statusTriagem === 'SUGERIDA')
    .forEach((l) => Object.assign(l, { statusTriagem: 'REJEITADA', motivoRejeicao: 'Enviado para lista de espera', idRespDecisao: usuario.idUsuario }));
  let e = db.listaEspera.find((x) => x.idMembro === m.idMembro && x.status === 'AGUARDANDO');
  if (e) {
    e.tentativas += 1;
    e.motivo = body.motivo || e.motivo;
  } else {
    e = {
      idEspera: proximoId(db, 'espera'),
      idMembro: m.idMembro,
      dataEntrada: agoraIso(),
      motivo: body.motivo || 'Nenhuma célula disponível no momento da triagem.',
      status: 'AGUARDANDO',
      dataResolucao: null,
      tentativas: 1,
    };
    db.listaEspera.push(e);
  }
  m.statusMembro = 'LISTA_ESPERA';
  return created(itemEspera(db, usuario, e));
});

rota('POST', '/lista-espera/:id/tentativas', ({ db, usuario, params }) => {
  exigirPerfil(usuario, 'VOLUNTARIO', 'ADMINISTRADOR');
  const e = db.listaEspera.find((x) => x.idEspera === Number(params.id));
  if (!e) falhar(404, 'Registro não encontrado.');
  e.tentativas += 1;
  return ok(itemEspera(db, usuario, e));
});

// ---- Notificações de vaga aberta
rota('GET', '/notificacoes', ({ db, usuario }) => {
  if (usuario.perfil === 'LIDER') return ok([]);
  const itens = db.listaEspera
    .filter((e) => e.status === 'AGUARDANDO')
    .filter((e) => db.membros.find((m) => m.idMembro === e.idMembro)?.idIgreja === usuario.idIgreja)
    .map((e) => itemEspera(db, usuario, e))
    .filter((e) => e.vagaDisponivel)
    .map((e) => ({
      id: `vaga-${e.idEspera}-${e.melhorSugestao.idCelula}`,
      tipo: 'VAGA_DISPONIVEL',
      titulo: 'Vaga compatível disponível',
      mensagem: `${e.membro.nomeCompleto} pode ser alocado(a) em ${e.melhorSugestao.nomeCelula} (${e.melhorSugestao.score}% de compatibilidade).`,
      link: `/lista-espera?membro=${e.idMembro}`,
      data: agoraIso(),
    }))
    .filter((n) => !db.notificacoesLidas.includes(n.id));
  return ok(itens);
});

rota('PATCH', '/notificacoes/:id', ({ db, params }) => {
  if (!db.notificacoesLidas.includes(params.id)) db.notificacoesLidas.push(params.id);
  return ok({ id: params.id, lida: true });
});

// ---- Feedback
rota('GET', '/feedbacks/acompanhamento', ({ db, usuario, query }) => {
  exigirPerfil(usuario, 'LIDER', 'ADMINISTRADOR');
  let idCelula = Number(query.idCelula);
  if (usuario.perfil === 'LIDER') idCelula = celulaLiderada(db, usuario.idUsuario)?.idCelula;
  if (!idCelula) return ok({ celula: null, itens: [] });
  const cel = buscarNoTenant(db.celulas, 'idCelula', idCelula, usuario, 'Célula');
  const itens = db.membros
    .filter((m) => m.idCelulaAlocada === cel.idCelula)
    .map((m) => {
      const hist = db.historicoCelulas.find((h) => h.idMembro === m.idMembro && h.idCelula === cel.idCelula && !h.dataSaida);
      const log = [...db.logsTriagem].reverse().find((l) => l.idMembro === m.idMembro && l.statusTriagem === 'APROVADA');
      const fbs = db.feedbacks.filter((f) => f.idMembro === m.idMembro).sort((a, b) => b.dataCriacao.localeCompare(a.dataCriacao));
      return {
        membro: membroPublico(db, m),
        dataEntrada: hist?.dataEntrada ?? null,
        idLogTriagem: log?.idLog ?? null,
        ultimoFeedback: fbs[0] ?? null,
        totalFeedbacks: fbs.length,
      };
    })
    .sort((a, b) => String(b.dataEntrada).localeCompare(String(a.dataEntrada)));
  return ok({ celula: celulaPublica(db, cel), itens });
});

rota('GET', '/feedbacks', ({ db, usuario, query }) => {
  exigirPerfil(usuario, 'LIDER', 'ADMINISTRADOR');
  const idsTenant = new Set(doTenant(db.membros, usuario).map((m) => m.idMembro));
  let lista = db.feedbacks.filter((f) => idsTenant.has(f.idMembro));
  if (query.idMembro) lista = lista.filter((f) => f.idMembro === Number(query.idMembro));
  return ok(lista.sort((a, b) => b.dataCriacao.localeCompare(a.dataCriacao)));
});

rota('POST', '/feedbacks', ({ db, usuario, body }) => {
  exigirPerfil(usuario, 'LIDER');
  exigirCampos(body, ['idMembro', 'statusAdaptacao']);
  const m = buscarNoTenant(db.membros, 'idMembro', body.idMembro, usuario, 'Membro');
  const cel = celulaLiderada(db, usuario.idUsuario);
  if (!cel || m.idCelulaAlocada !== cel.idCelula) falhar(403, 'O membro não pertence à sua célula.');
  const nota = body.notaIntegracao ? Number(body.notaIntegracao) : null;
  if (nota !== null && (nota < 1 || nota > 5)) falhar(400, 'A nota deve ser de 1 a 5.', { campos: { notaIntegracao: '1 a 5.' } });
  const log = [...db.logsTriagem].reverse().find((l) => l.idMembro === m.idMembro && l.statusTriagem === 'APROVADA');
  const fb = {
    idFeedback: proximoId(db, 'feedback'),
    idMembro: m.idMembro,
    idLogTriagem: log?.idLog ?? null,
    statusAdaptacao: body.statusAdaptacao,
    notaIntegracao: nota,
    permaneceuNaCelula: body.permaneceuNaCelula ?? true,
    dataVisita: body.dataVisita || null,
    dataProximoContato: body.dataProximoContato || null,
    comentariosMembro: body.comentariosMembro ?? '',
    avaliacaoLider: body.avaliacaoLider ?? '',
    dataCriacao: agoraIso(),
  };
  db.feedbacks.push(fb);
  return created(fb);
});

// ---- Relatórios
const ultimosMeses = (n) => {
  const d = new Date();
  return Array.from({ length: n }, (_, i) => {
    const x = new Date(d.getFullYear(), d.getMonth() - (n - 1 - i), 1);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
  });
};

const noPeriodo = (dataIso, de, ate) => {
  const d = dataIso.slice(0, 10);
  return (!de || d >= de) && (!ate || d <= ate);
};

rota('GET', '/relatorios/resumo', ({ db, usuario }) => {
  const membros = doTenant(db.membros, usuario);
  const celulas = celulasDoTenant(db, usuario).filter((c) => c.ativa);
  const idsTenant = new Set(membros.map((m) => m.idMembro));
  const logs = db.logsTriagem.filter((l) => idsTenant.has(l.idMembro));
  const hoje = hojeIso();
  const inicioMes = `${hoje.slice(0, 8)}01`;
  const semanaAtras = new Date(Date.now() - 7 * DIA).toISOString();
  const aprovadosMes = new Set(logs.filter((l) => l.statusTriagem === 'APROVADA' && l.dataHora >= inicioMes).map((l) => l.idMembro));
  const cadastradosMes = membros.filter((m) => m.dataCadastro >= inicioMes);
  const capTotal = celulas.reduce((s, c) => s + c.capacidadeMaxima, 0);
  const ocupTotal = celulas.reduce((s, c) => s + c.capacidadeAtual, 0);
  const fbs = db.feedbacks.filter((f) => idsTenant.has(f.idMembro));
  const notas = fbs.map((f) => f.notaIntegracao).filter(Boolean);

  const atividade = [
    ...logs.filter((l) => l.statusTriagem === 'APROVADA').map((l) => ({
      tipo: 'TRIAGEM',
      data: l.dataHora,
      texto: `${membros.find((m) => m.idMembro === l.idMembro)?.nomeCompleto} conectado(a) a ${db.celulas.find((c) => c.idCelula === l.idCelulaSugerida)?.nomeCelula}`,
    })),
    ...membros.map((m) => ({ tipo: 'CADASTRO', data: m.dataCadastro, texto: `${m.nomeCompleto} cadastrado(a)` })),
  ]
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 6);

  return ok({
    kpis: {
      membrosAtivos: membros.filter((m) => m.statusMembro === 'ALOCADO').length,
      novosSemana: membros.filter((m) => m.dataCadastro >= semanaAtras).length,
      celulasAtivas: celulas.length,
      lideres: doTenant(db.usuarios, usuario).filter((u) => u.perfil === 'LIDER' && u.ativo).length,
      triagensHoje: logs.filter((l) => l.statusTriagem === 'APROVADA' && l.dataHora.slice(0, 10) === hoje).length,
      pendentes: membros.filter((m) => m.statusMembro === 'AGUARDANDO_TRIAGEM').length,
      listaEspera: membros.filter((m) => m.statusMembro === 'LISTA_ESPERA').length,
      taxaOcupacao: capTotal ? Math.round((ocupTotal / capTotal) * 100) : 0,
      taxaConexao: cadastradosMes.length
        ? Math.min(100, Math.round((cadastradosMes.filter((m) => aprovadosMes.has(m.idMembro)).length / cadastradosMes.length) * 100))
        : 0,
      mediaIntegracao: notas.length ? Number((notas.reduce((s, n) => s + n, 0) / notas.length).toFixed(1)) : null,
    },
    novosPorMes: ultimosMeses(6).map((mes) => ({ mes, total: membros.filter((m) => m.dataCadastro.startsWith(mes)).length })),
    topCelulas: [...celulas].sort((a, b) => b.capacidadeAtual - a.capacidadeAtual).slice(0, 4).map((c) => celulaPublica(db, c)),
    atividadeRecente: atividade,
  });
});

rota('GET', '/relatorios/novos-membros', ({ db, usuario, query }) => {
  exigirPerfil(usuario, 'ADMINISTRADOR');
  const linhas = doTenant(db.membros, usuario)
    .filter((m) => noPeriodo(m.dataCadastro, query.de, query.ate))
    .sort((a, b) => a.dataCadastro.localeCompare(b.dataCadastro))
    .map((m) => membroPublico(db, m));
  const porMes = {};
  linhas.forEach((m) => {
    const k = m.dataCadastro.slice(0, 7);
    porMes[k] = (porMes[k] ?? 0) + 1;
  });
  return ok({
    total: linhas.length,
    alocados: linhas.filter((m) => m.statusMembro === 'ALOCADO').length,
    porMes: Object.entries(porMes).map(([mes, total]) => ({ mes, total })),
    linhas,
  });
});

rota('GET', '/relatorios/ocupacao', ({ db, usuario }) => {
  exigirPerfil(usuario, 'ADMINISTRADOR');
  const linhas = celulasDoTenant(db, usuario)
    .filter((c) => c.ativa)
    .map((c) => celulaPublica(db, c))
    .sort((a, b) => b.ocupacaoPct - a.ocupacaoPct);
  const cap = linhas.reduce((s, c) => s + c.capacidadeMaxima, 0);
  const ocup = linhas.reduce((s, c) => s + c.capacidadeAtual, 0);
  return ok({ linhas, totais: { capacidade: cap, ocupacao: ocup, vagas: cap - ocup, pct: cap ? Math.round((ocup / cap) * 100) : 0 } });
});

rota('GET', '/relatorios/distribuicao-geografica', ({ db, usuario, query }) => {
  exigirPerfil(usuario, 'ADMINISTRADOR');
  const membros = doTenant(db.membros, usuario).filter(
    (m) => m.statusMembro !== 'DESLIGADO' && noPeriodo(m.dataCadastro, query.de, query.ate),
  );
  const celulas = celulasDoTenant(db, usuario).filter((c) => c.ativa);
  const grupos = {};
  membros.forEach((m) => {
    const k = `${m.bairro}|${m.cidade}`;
    grupos[k] ??= { bairro: m.bairro, cidade: m.cidade, total: 0, alocados: 0, latitude: m.latitude, longitude: m.longitude };
    grupos[k].total += 1;
    if (m.statusMembro === 'ALOCADO') grupos[k].alocados += 1;
  });
  const linhas = Object.values(grupos)
    .map((g) => {
      const kms = celulas.map((c) => haversine(g.latitude, g.longitude, c.latitude, c.longitude));
      return { ...g, celulaMaisProximaKm: kms.length ? Number(Math.min(...kms).toFixed(1)) : null };
    })
    .sort((a, b) => b.total - a.total);
  return ok({ total: membros.length, linhas });
});

// ---- Busca global
rota('GET', '/busca', ({ db, usuario, query }) => {
  const q = normalizar(query.q ?? '');
  if (q.length < 2) return ok({ membros: [], celulas: [], lideres: [] });
  let membros = doTenant(db.membros, usuario);
  if (usuario.perfil === 'LIDER') {
    const cel = celulaLiderada(db, usuario.idUsuario);
    membros = membros.filter((m) => cel && m.idCelulaAlocada === cel.idCelula);
  }
  return ok({
    membros: membros.filter((m) => normalizar(m.nomeCompleto).includes(q)).slice(0, 8).map((m) => membroPublico(db, m)),
    celulas: celulasDoTenant(db, usuario)
      .filter((c) => c.ativa && normalizar(`${c.nomeCelula} ${c.bairro}`).includes(q))
      .slice(0, 8)
      .map((c) => celulaPublica(db, c)),
    lideres: doTenant(db.usuarios, usuario)
      .filter((u) => u.perfil === 'LIDER' && u.ativo && normalizar(u.nome).includes(q))
      .slice(0, 8)
      .map((u) => liderDetalhado(db, u)),
  });
});

// ---------------------------------------------------------------- despachante
export async function handleMockRequest({ method, url, body, token }) {
  if (import.meta.env?.MODE !== 'test') await esperar(120 + Math.random() * 280); // simula latência de rede
  const db = getDb();
  const [caminho, qs = ''] = url.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs));

  for (const r of rotas) {
    if (r.method !== method) continue;
    const match = caminho.match(r.regex);
    if (!match) continue;
    const params = Object.fromEntries(r.chaves.map((k, i) => [k, decodeURIComponent(match[i + 1])]));

    const usuario = autenticar(db, token);
    if (!r.publica && !usuario) return erro(401, 'Sessão expirada. Entre novamente.');

    try {
      const res = r.handler({ db, usuario, body: body ?? {}, params, query });
      if (method !== 'GET' || caminho.startsWith('/triagem')) salvarDb();
      // devolve cópias para que a UI nunca altere o "banco" por referência
      return { status: res.status, body: res.body === undefined ? null : structuredClone(res.body) };
    } catch (e) {
      if (e instanceof HttpErro) return erro(e.status, e.message, e.extra);
      console.error('[mock]', e);
      return erro(500, 'Erro interno no servidor simulado.');
    }
  }
  return erro(404, `Rota não encontrada: ${method} ${caminho}`);
}
