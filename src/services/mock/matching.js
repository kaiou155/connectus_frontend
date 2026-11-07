/**
 * Algoritmo de matching — versão de referência usada pelo modo demonstração.
 *
 * O cálculo oficial roda no back-end Node.js. Este módulo replica a mesma lógica
 * para que o front-end possa ser demonstrado sem servidor e para servir de especificação
 * executável: mantenha PESOS e as funções de pontuação iguais às do back-end.
 *
 * Escore = Σ (peso_i × pontuação_i), com pontuação_i ∈ [0, 1], convertido para 0–100.
 */
import { calcularIdade } from '../../utils/format';

export const PESOS = {
  distancia: 0.4, // proximidade geográfica (Haversine)
  idade: 0.25, // faixa etária predominante da célula
  disponibilidade: 0.2, // dia/horário do encontro × disponibilidade declarada
  perfil: 0.15, // perfil do grupo × gênero, estado civil e interesse
};

/** Distância máxima (km) a partir da qual a proximidade não pontua. */
export const RAIO_MAXIMO_KM = 12;

const RAIO_TERRA_KM = 6371;
const rad = (g) => (g * Math.PI) / 180;

/** Fórmula de Haversine — distância em km entre dois pontos (lat/lng em graus). */
export function haversine(lat1, lng1, lat2, lng2) {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.sqrt(a));
}

export const parseFaixa = (faixa = '') => {
  const [min, max] = String(faixa).split('-').map(Number);
  return { min: Number.isFinite(min) ? min : 0, max: Number.isFinite(max) ? max : 120 };
};

export function pontuarDistancia(km) {
  if (km <= 1) return 1;
  if (km >= RAIO_MAXIMO_KM) return 0;
  return 1 - (km - 1) / (RAIO_MAXIMO_KM - 1);
}

export function pontuarIdade(idade, faixa) {
  if (idade === null || idade === undefined) return 0.5;
  const { min, max } = parseFaixa(faixa);
  if (idade >= min && idade <= max) return 1;
  const fora = idade < min ? min - idade : idade - max;
  return Math.max(0, 1 - fora * 0.15);
}

export function pontuarDisponibilidade(disponibilidades = [], diaSemana, horario) {
  if (!disponibilidades.length) return 0.5; // não informou: neutro
  const mesmoDia = disponibilidades.filter((d) => d.diaSemana === diaSemana);
  if (!mesmoDia.length) return 0;
  const cabe = mesmoDia.some(
    (d) =>
      (!d.horarioInicio || d.horarioInicio <= horario) && (!d.horarioFim || horario <= d.horarioFim),
  );
  return cabe ? 1 : 0.5;
}

/** Retorna null quando o perfil é incompatível de forma eliminatória (ex.: célula feminina). */
export function pontuarPerfil(membro, idade, perfilGrupo) {
  const interesse = membro.perfilInteresse === perfilGrupo ? 1 : null;
  switch (perfilGrupo) {
    case 'MULHERES':
      return membro.genero === 'F' ? 1 : null;
    case 'HOMENS':
      return membro.genero === 'M' ? 1 : null;
    case 'CASAIS':
      return membro.estadoCivil === 'CASADO' ? 1 : 0.15;
    case 'FAMILIAS':
      return interesse ?? (membro.estadoCivil === 'CASADO' ? 0.9 : 0.4);
    case 'JOVENS':
      return interesse ?? (idade !== null && idade <= 30 && membro.estadoCivil !== 'CASADO' ? 0.9 : 0.4);
    case 'UNIVERSITARIOS':
      return interesse ?? (idade !== null && idade >= 17 && idade <= 26 ? 0.8 : 0.3);
    case 'NOVOS_CONVERTIDOS':
      return interesse ?? 0.5;
    default:
      return interesse ?? 0.7;
  }
}

/**
 * Calcula o escore de um membro para cada célula elegível e devolve as mais compatíveis.
 * Regras eliminatórias: célula inativa, sem vagas ou perfil incompatível.
 * Desempate: mais vagas livres, depois menor distância.
 */
export function calcularMatching(membro, celulas, { limite = 3, hoje = new Date() } = {}) {
  const idade = calcularIdade(membro.dataNascimento, hoje);
  const resultados = [];

  celulas.forEach((celula) => {
    const vagas = celula.capacidadeMaxima - celula.capacidadeAtual;
    if (!celula.ativa || vagas <= 0) return;

    const perfil = pontuarPerfil(membro, idade, celula.perfilGrupo);
    if (perfil === null) return;

    const km = haversine(membro.latitude, membro.longitude, celula.latitude, celula.longitude);
    const criterios = {
      distancia: { pontuacao: pontuarDistancia(km), peso: PESOS.distancia, km: Number(km.toFixed(2)) },
      idade: { pontuacao: pontuarIdade(idade, celula.faixaEtaria), peso: PESOS.idade, idade },
      disponibilidade: {
        pontuacao: pontuarDisponibilidade(membro.disponibilidades, celula.diaSemana, celula.horario),
        peso: PESOS.disponibilidade,
      },
      perfil: { pontuacao: perfil, peso: PESOS.perfil },
    };
    const score = Object.values(criterios).reduce((s, c) => s + c.pontuacao * c.peso, 0);

    resultados.push({
      idCelula: celula.idCelula,
      score: Math.round(score * 100),
      vagas,
      criterios,
    });
  });

  resultados.sort(
    (a, b) => b.score - a.score || b.vagas - a.vagas || a.criterios.distancia.km - b.criterios.distancia.km,
  );
  return resultados.slice(0, limite);
}
