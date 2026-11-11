/**
 * Banco de dados simulado (modo demonstração).
 * As coleções espelham as tabelas do MER. Os dados ficam no localStorage
 * do navegador para que as alterações sobrevivam a um recarregamento da página.
 */
import { storage } from '../../utils/storage';
import { geocodificar } from './geo';
import { assinaturaDe } from './assinatura';

const DB_KEY = 'conectus.mockdb.v1';
// aumente quando o formato do banco simulado mudar (versão 2: assinaturas e recuperação de senha)
const VERSAO = 2;
const DIA = 86400000;

// PRNG determinístico (mulberry32) — a mesma semente gera sempre os mesmos dados
function criarRandom(semente) {
  let a = semente;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOMES_F = [
  'Letícia', 'Camila', 'Gabriela', 'Beatriz', 'Amanda', 'Larissa', 'Juliana', 'Bruna', 'Rafaela',
  'Isabela', 'Natália', 'Vitória', 'Carolina', 'Manuela', 'Sofia', 'Helena', 'Lívia', 'Yasmin',
  'Priscila', 'Débora', 'Raquel', 'Tatiane', 'Renata', 'Paula', 'Elisa', 'Clara', 'Ester', 'Rute',
];
const NOMES_M = [
  'Lucas', 'Bruno', 'Diego', 'Gabriel', 'Mateus', 'Rafael', 'Felipe', 'Gustavo', 'Thiago', 'André',
  'Leonardo', 'Samuel', 'Daniel', 'Vinícius', 'Henrique', 'Eduardo', 'Rodrigo', 'Caio', 'Murilo',
  'Otávio', 'Davi', 'Arthur', 'Heitor', 'Enzo', 'Paulo', 'Marcelo', 'Fábio', 'Ricardo',
];
const SOBRENOMES = [
  'Reis', 'Lima', 'Souza', 'Alves', 'Prado', 'Martins', 'Rocha', 'Ferreira', 'Barbosa', 'Ribeiro',
  'Carvalho', 'Gomes', 'Mendes', 'Araújo', 'Nogueira', 'Teixeira', 'Moura', 'Cardoso', 'Freitas',
  'Pires', 'Duarte', 'Campos', 'Batista', 'Vieira', 'Monteiro', 'Castro', 'Moreira', 'Rezende',
];

const VIZINHOS = {
  'Vila Mariana': ['Vila Mariana', 'Vila Mariana', 'Aclimação', 'Paraíso', 'Vila Clementino', 'Saúde'],
  Pinheiros: ['Pinheiros', 'Pinheiros', 'Vila Madalena', 'Jardim Paulista', 'Alto de Pinheiros'],
  Moema: ['Moema', 'Moema', 'Campo Belo', 'Saúde', 'Vila Clementino'],
  Tatuapé: ['Tatuapé', 'Tatuapé', 'Carrão', 'Vila Formosa', 'Mooca'],
  Santana: ['Santana', 'Santana', 'Água Fria'],
  Centro: ['Centro', 'República', 'Santa Cecília', 'Bela Vista', 'Consolação', 'Liberdade'],
  Lapa: ['Lapa', 'Lapa', 'Perdizes'],
  'Jardim Botânico': ['Jardim Botânico', 'Nova Aliança', 'Jardim Irajá'],
};

const CEPS = {
  'Vila Mariana': '04010-100', Pinheiros: '05422-000', Moema: '04078-000', Tatuapé: '03081-000',
  Santana: '02031-000', Centro: '01044-000', Lapa: '05074-000', 'Jardim Botânico': '14021-500',
};

const iso = (ms) => new Date(ms).toISOString();
const isoDia = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Senha de todas as contas de demonstração. No back-end real é guardado apenas o hash bcrypt. */
export const SENHA_DEMO = 'conectus123';

export function criarSeed(agora = Date.now()) {
  const rnd = criarRandom(2026);
  const escolher = (arr) => arr[Math.floor(rnd() * arr.length)];
  const entre = (min, max) => min + Math.floor(rnd() * (max - min + 1));

  const igrejas = [
    {
      idIgreja: 1, nomeIgreja: 'Igreja Batista Nova Vida', denominacao: 'Batista',
      cidade: 'São Paulo', estado: 'SP', plano: 'INTERMEDIARIO', ativo: true,
      dataCadastro: iso(agora - 400 * DIA),
    },
    {
      idIgreja: 2, nomeIgreja: 'Comunidade Ribeirão', denominacao: 'Evangélica',
      cidade: 'Ribeirão Preto', estado: 'SP', plano: 'ESSENCIAL', ativo: true,
      dataCadastro: iso(agora - 90 * DIA),
    },
  ];

  const perfis = [
    { idPerfil: 1, nomePerfil: 'ADMINISTRADOR', descricao: 'Gestão completa da igreja' },
    { idPerfil: 2, nomePerfil: 'LIDER', descricao: 'Líder de célula' },
    { idPerfil: 3, nomePerfil: 'VOLUNTARIO', descricao: 'Voluntário do Ministério Welcome' },
  ];

  const u = (idUsuario, nome, email, perfil, telefone, idIgreja, diasAtras) => ({
    idUsuario, nome, email, perfil, telefone, idIgreja, ativo: true,
    senha: SENHA_DEMO, dataCriacao: iso(agora - diasAtras * DIA),
  });

  const usuarios = [
    u(1, 'Julia Antonieli', 'admin@conectus.app', 'ADMINISTRADOR', '(11) 98888-1000', 1, 400),
    u(2, 'Carolina Magalhães', 'voluntario@conectus.app', 'VOLUNTARIO', '(11) 98888-2000', 1, 300),
    u(3, 'Pedro Almeida', 'pedro@conectus.app', 'LIDER', '(11) 98888-1010', 1, 960),
    u(4, 'Ana Carolina', 'ana@conectus.app', 'LIDER', '(11) 98888-1020', 1, 700),
    u(5, 'Lucas Pereira', 'lucas@conectus.app', 'LIDER', '(11) 98888-1030', 1, 520),
    u(6, 'Beatriz Souza', 'bia@conectus.app', 'LIDER', '(11) 98888-1040', 1, 410),
    u(7, 'Rafael Lima', 'rafa@conectus.app', 'LIDER', '(11) 98888-1050', 1, 380),
    u(8, 'Juliana Reis', 'ju@conectus.app', 'LIDER', '(11) 98888-1060', 1, 600),
    u(9, 'Tiago Moreira', 'tiago@conectus.app', 'LIDER', '(11) 98888-1070', 1, 250),
    u(10, 'Isaac Montanari', 'isaac@conectus.app', 'ADMINISTRADOR', '(16) 99777-1000', 2, 90),
    u(11, 'Daniel Rocha', 'daniel@conectus.app', 'LIDER', '(16) 99777-1010', 2, 85),
  ];

  const c = (idCelula, nomeCelula, idLider, bairro, endereco, diaSemana, horario, perfilGrupo, faixaEtaria, capacidadeMaxima, ocupacao, descricao, idIgreja = 1, cidade = 'São Paulo') => ({
    idCelula, nomeCelula, idLider, bairro, endereco, cidade, cep: CEPS[bairro], diaSemana, horario,
    perfilGrupo, faixaEtaria, capacidadeMaxima, capacidadeAtual: 0, ocupacaoSeed: ocupacao,
    statusCelula: 'ATIVA', ativa: true, descricao, idIgreja, ...geocodificar(bairro, cidade),
  });

  const celulas = [
    c(1, 'Vila Mariana - Jovens', 3, 'Vila Mariana', 'Rua Domingos de Morais, 1200', 'QUA', '20:00', 'JOVENS', '18-28', 20, 14,
      'Célula voltada para jovens com encontros descontraídos, louvor acústico e estudo bíblico aplicado.'),
    c(2, 'Pinheiros - Mulheres', 4, 'Pinheiros', 'Rua dos Pinheiros, 540', 'TER', '19:30', 'MULHERES', '18-60', 25, 22,
      'Encontro de mulheres com partilha, oração e mentoria entre gerações.'),
    c(3, 'Moema - Casais', 5, 'Moema', 'Av. Ibirapuera, 980', 'SEX', '20:00', 'CASAIS', '25-55', 16, 11,
      'Casais que desejam fortalecer o casamento com estudo, jantar compartilhado e acompanhamento.'),
    c(4, 'Tatuapé - Novos', 6, 'Tatuapé', 'Rua Tuiuti, 320', 'QUI', '20:00', 'NOVOS_CONVERTIDOS', '16-70', 15, 9,
      'Primeiros passos na fé: discipulado básico para quem acabou de chegar.'),
    c(5, 'Santana - Jovens', 7, 'Santana', 'Av. Cruzeiro do Sul, 1500', 'QUA', '20:00', 'JOVENS', '18-30', 22, 18,
      'Jovens da Zona Norte reunidos para louvor, comunhão e serviço no bairro.'),
    c(6, 'Centro - Universitários', 8, 'Centro', 'Rua Sete de Abril, 80', 'SEG', '19:00', 'UNIVERSITARIOS', '17-26', 20, 16,
      'Universitários e vestibulandos, próximo ao metrô República.'),
    c(7, 'Lapa - Famílias', 9, 'Lapa', 'Rua Clélia, 210', 'SAB', '17:00', 'FAMILIAS', '20-70', 12, 12,
      'Famílias com crianças — encontro aos sábados com programação infantil.'),
    c(8, 'Jardim Botânico - Jovens', 11, 'Jardim Botânico', 'Av. Prof. João Fiúsa, 1000', 'SEX', '20:00', 'JOVENS', '16-30', 15, 3,
      'Jovens de Ribeirão Preto.', 2, 'Ribeirão Preto'),
  ];

  const membros = [];
  const historicoCelulas = [];
  const logsTriagem = [];
  const disponibilidades = [];
  const feedbacks = [];
  let idMembro = 0;
  let idHist = 0;
  let idLog = 0;

  const novoMembro = (dados) => {
    idMembro += 1;
    const membro = {
      idMembro, idCelulaAlocada: null, idUsuarioTriagem: null, email: '', perfilInteresse: '',
      indicadoPor: null, observacoes: '', statusMembro: 'AGUARDANDO_TRIAGEM', cep: '', consentimentoLgpd: true,
      ...dados, ...geocodificar(dados.bairro, dados.cidade),
    };
    membros.push(membro);
    return membro;
  };

  const alocar = (membro, celula, dataMs, voluntario = 2) => {
    membro.idCelulaAlocada = celula.idCelula;
    membro.statusMembro = 'ALOCADO';
    membro.idUsuarioTriagem = voluntario;
    celula.capacidadeAtual += 1;
    idHist += 1;
    historicoCelulas.push({ idHistorico: idHist, idMembro: membro.idMembro, idCelula: celula.idCelula, dataEntrada: isoDia(dataMs), dataSaida: null, motivoSaida: null });
    idLog += 1;
    logsTriagem.push({
      idLog, idMembro: membro.idMembro, idVoluntario: voluntario, idCelulaSugerida: celula.idCelula,
      scoreMatching: entre(78, 98), criteriosScore: null, statusTriagem: 'APROVADA',
      idRespDecisao: voluntario, motivoRejeicao: null, dataHora: iso(dataMs),
    });
    return idLog;
  };

  // Integrantes de cada célula — distribuídos nos últimos ~7 meses com tendência de crescimento
  const destaqueVilaMariana = ['Letícia Prado', 'Lucas Reis', 'Bruno Lima', 'Camila Souza', 'Diego Alves'];
  celulas.forEach((cel) => {
    const { min, max } = (() => {
      const [a, b] = cel.faixaEtaria.split('-').map(Number);
      return { min: a, max: b };
    })();
    for (let i = 0; i < cel.ocupacaoSeed; i += 1) {
      let genero = rnd() < 0.5 ? 'F' : 'M';
      if (cel.perfilGrupo === 'MULHERES') genero = 'F';
      const destaque = cel.idCelula === 1 && i >= cel.ocupacaoSeed - destaqueVilaMariana.length
        ? destaqueVilaMariana[i - (cel.ocupacaoSeed - destaqueVilaMariana.length)]
        : null;
      if (destaque) genero = ['Letícia Prado', 'Camila Souza'].includes(destaque) ? 'F' : 'M';
      const nome = destaque ?? `${escolher(genero === 'F' ? NOMES_F : NOMES_M)} ${escolher(SOBRENOMES)} ${escolher(SOBRENOMES)}`;
      const idade = entre(min, Math.min(max, min + 22));
      // datas: os últimos 5 de Vila Mariana são recentes (aparecem no feedback do líder)
      const diasAtras = destaque
        ? 2 + (cel.ocupacaoSeed - i) * 4
        : Math.floor((1 - Math.sqrt(rnd())) * 210) + 20;
      const dataMs = agora - diasAtras * DIA;
      const casado = ['CASAIS', 'FAMILIAS'].includes(cel.perfilGrupo) || (idade > 30 && rnd() < 0.5);
      const m = novoMembro({
        nomeCompleto: nome,
        dataNascimento: isoDia(agora - (idade * 365.25 + entre(0, 300)) * DIA),
        genero,
        estadoCivil: casado ? 'CASADO' : 'SOLTEIRO',
        telefone: `(${cel.idIgreja === 2 ? 16 : 11}) 9${entre(1000, 9999)}-${entre(1000, 9999)}`,
        bairro: escolher(VIZINHOS[cel.bairro] ?? [cel.bairro]),
        cidade: cel.cidade,
        cep: cel.cep,
        dataCadastro: iso(dataMs - DIA),
        idIgreja: cel.idIgreja,
      });
      const log = alocar(m, cel, dataMs);
      if (destaque && i < cel.ocupacaoSeed - 2) {
        feedbacks.push({
          idFeedback: feedbacks.length + 1, idMembro: m.idMembro, idLogTriagem: log,
          statusAdaptacao: i % 2 ? 'PARTICIPANDO' : 'RESPONDEU', notaIntegracao: i % 2 ? 5 : 4,
          permaneceuNaCelula: true, dataVisita: isoDia(dataMs + 2 * DIA), dataProximoContato: null,
          comentariosMembro: '', avaliacaoLider: 'Bem recebido pelo grupo.', dataCriacao: iso(dataMs + 3 * DIA),
        });
      }
    }
    delete cel.ocupacaoSeed;
  });

  // Saídas registradas — histórico de células
  [5, 23, 47].forEach((id, idx) => {
    const m = membros.find((x) => x.idMembro === id);
    if (!m) return;
    const cel = celulas.find((x) => x.idCelula === m.idCelulaAlocada);
    const h = historicoCelulas.find((x) => x.idMembro === id && !x.dataSaida);
    h.dataSaida = isoDia(agora - (10 + idx * 7) * DIA);
    h.motivoSaida = ['Mudou de cidade', 'Incompatibilidade de horário', 'Transferido para outra igreja'][idx];
    m.statusMembro = 'DESLIGADO';
    m.idCelulaAlocada = null;
    cel.capacidadeAtual -= 1;
    // repõe a ocupação original com um novo integrante
    const novo = novoMembro({
      nomeCompleto: `${escolher(NOMES_M)} ${escolher(SOBRENOMES)}`, dataNascimento: m.dataNascimento,
      genero: m.genero, estadoCivil: m.estadoCivil, telefone: m.telefone, bairro: m.bairro,
      cidade: m.cidade, cep: m.cep, dataCadastro: iso(agora - (8 + idx) * DIA), idIgreja: m.idIgreja,
    });
    if (cel.perfilGrupo === 'MULHERES') {
      novo.genero = 'F';
      novo.nomeCompleto = `${escolher(NOMES_F)} ${escolher(SOBRENOMES)}`;
    }
    alocar(novo, cel, agora - (7 + idx) * DIA);
  });

  // Aguardando triagem
  const pendentes = [
    ['Mariana Costa', 24, 'F', 'SOLTEIRO', 'Vila Mariana', [['QUA', '19:00', '22:00']], 'JOVENS'],
    ['João Henrique', 31, 'M', 'CASADO', 'Campo Belo', [['SEX', '19:00', '22:00'], ['SAB', '', '']], 'CASAIS'],
    ['Larissa Pinto', 19, 'F', 'SOLTEIRO', 'Vila Madalena', [['TER', '18:00', '22:00']], ''],
    ['Carlos Eduardo', 27, 'M', 'SOLTEIRO', 'Água Fria', [['QUA', '19:30', '22:30'], ['QUI', '19:00', '22:00']], ''],
    ['Fernanda Alves', 22, 'F', 'SOLTEIRO', 'Bela Vista', [['SEG', '18:30', '21:00']], 'UNIVERSITARIOS'],
  ];
  pendentes.forEach(([nome, idade, genero, estadoCivil, bairro, disp, interesse], i) => {
    const m = novoMembro({
      nomeCompleto: nome, dataNascimento: isoDia(agora - (idade * 365.25 + 40) * DIA), genero, estadoCivil,
      telefone: `(11) 9${entre(1000, 9999)}-${entre(1000, 9999)}`, bairro, cidade: 'São Paulo',
      cep: CEPS[bairro] ?? '', perfilInteresse: interesse, email: `${nome.split(' ')[0].toLowerCase()}@email.com`,
      dataCadastro: iso(agora - (i * 35 + 20) * 60000), idIgreja: 1, idUsuarioTriagem: 2,
    });
    disp.forEach(([diaSemana, horarioInicio, horarioFim]) =>
      disponibilidades.push({ idDisponibilidade: disponibilidades.length + 1, idMembro: m.idMembro, diaSemana, horarioInicio, horarioFim }),
    );
  });

  // Lista de espera
  const listaEspera = [];
  // Patrícia chegou quando Pinheiros - Mulheres estava lotada: hoje há vaga (notificação de vaga aberta).
  // Sérgio só pode aos sábados — a célula ideal (Lapa - Famílias) está lotada.
  const espera = [
    ['Aline Faria', 15, 'F', 'SOLTEIRO', 'Itaim Bibi', 3, 'Idade abaixo da faixa das células disponíveis.', [['DOM', '', '']], ''],
    ['Sérgio Pacheco', 52, 'M', 'CASADO', 'Brás', 5, 'Célula compatível (Lapa - Famílias) lotada.', [['SAB', '16:00', '19:00']], 'FAMILIAS'],
    ['Patrícia Lemos', 38, 'F', 'DIVORCIADO', 'Butantã', 7, 'Pinheiros - Mulheres estava lotada no dia da triagem.', [['TER', '18:00', '22:00']], ''],
    ['Marcos Silveira', 60, 'M', 'VIUVO', 'Penha', 8, 'Não há células ativas na região e perfil declarado.', [['QUA', '19:00', '22:00']], ''],
  ];
  espera.forEach(([nome, idade, genero, estadoCivil, bairro, dias, motivo, disp, interesse]) => {
    const m = novoMembro({
      nomeCompleto: nome, dataNascimento: isoDia(agora - (idade * 365.25 + 60) * DIA), genero, estadoCivil,
      telefone: `(11) 9${entre(1000, 9999)}-${entre(1000, 9999)}`, bairro, cidade: 'São Paulo', cep: '',
      dataCadastro: iso(agora - dias * DIA), idIgreja: 1, statusMembro: 'LISTA_ESPERA', idUsuarioTriagem: 2,
      perfilInteresse: interesse,
    });
    disp.forEach(([diaSemana, horarioInicio, horarioFim]) =>
      disponibilidades.push({ idDisponibilidade: disponibilidades.length + 1, idMembro: m.idMembro, diaSemana, horarioInicio, horarioFim }),
    );
    listaEspera.push({
      idEspera: listaEspera.length + 1, idMembro: m.idMembro, dataEntrada: iso(agora - dias * DIA),
      motivo, status: 'AGUARDANDO', dataResolucao: null, tentativas: 1,
    });
  });

  // as duas igrejas do cenário já são assinantes em dia
  const comAssinaturas = { igrejas, assinaturas: [] };
  igrejas.forEach((i) => assinaturaDe(comAssinaturas, i.idIgreja, agora));

  return {
    versao: VERSAO,
    seq: {
      membro: idMembro, historico: idHist, log: idLog, espera: listaEspera.length,
      feedback: feedbacks.length, disponibilidade: disponibilidades.length,
      usuario: usuarios.length, celula: celulas.length, igreja: igrejas.length,
    },
    igrejas, perfis, usuarios, celulas, membros, disponibilidades, historicoCelulas,
    logsTriagem, listaEspera, feedbacks, notificacoesLidas: [],
    assinaturas: comAssinaturas.assinaturas, tokensSenha: [],
  };
}

let cache = null;

export function getDb() {
  if (!cache) {
    cache = storage.getJson(DB_KEY);
    // banco salvo por uma versão anterior do front: recria o cenário de demonstração
    if (!cache || cache.versao !== VERSAO) {
      cache = criarSeed();
      salvarDb();
    }
  }
  return cache;
}

export function salvarDb() {
  if (cache) storage.setJson(DB_KEY, cache);
}

export function resetarDb() {
  cache = criarSeed();
  salvarDb();
  return cache;
}

export function proximoId(db, chave) {
  db.seq[chave] += 1;
  return db.seq[chave];
}
