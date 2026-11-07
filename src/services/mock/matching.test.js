import { describe, expect, it } from 'vitest';
import { calcularMatching, haversine, pontuarDistancia, pontuarIdade, pontuarDisponibilidade } from './matching';

const hoje = new Date('2026-10-26T12:00:00');

const celula = (over) => ({
  idCelula: 1,
  ativa: true,
  capacidadeMaxima: 20,
  capacidadeAtual: 10,
  perfilGrupo: 'JOVENS',
  faixaEtaria: '18-28',
  diaSemana: 'QUA',
  horario: '20:00',
  latitude: -23.5893,
  longitude: -46.6346,
  ...over,
});

const membro = (over) => ({
  dataNascimento: '2002-05-10', // 24 anos
  genero: 'F',
  estadoCivil: 'SOLTEIRO',
  perfilInteresse: 'JOVENS',
  latitude: -23.5893,
  longitude: -46.6346,
  disponibilidades: [{ diaSemana: 'QUA', horarioInicio: '19:00', horarioFim: '22:00' }],
  ...over,
});

describe('haversine', () => {
  it('calcula ~6,5 km entre Vila Mariana e Pinheiros', () => {
    const km = haversine(-23.5893, -46.6346, -23.5662, -46.6918);
    expect(km).toBeGreaterThan(6);
    expect(km).toBeLessThan(7);
  });
  it('retorna zero para o mesmo ponto', () => {
    expect(haversine(-21.17, -47.81, -21.17, -47.81)).toBe(0);
  });
});

describe('pontuações individuais', () => {
  it('distância: 1 até 1 km e 0 a partir do raio máximo', () => {
    expect(pontuarDistancia(0.5)).toBe(1);
    expect(pontuarDistancia(12)).toBe(0);
    expect(pontuarDistancia(6.5)).toBeCloseTo(0.5, 1);
  });
  it('idade: dentro da faixa pontua 1 e decai fora dela', () => {
    expect(pontuarIdade(24, '18-28')).toBe(1);
    expect(pontuarIdade(30, '18-28')).toBeCloseTo(0.7);
    expect(pontuarIdade(60, '18-28')).toBe(0);
  });
  it('disponibilidade: dia e horário compatíveis', () => {
    const d = [{ diaSemana: 'QUA', horarioInicio: '19:00', horarioFim: '22:00' }];
    expect(pontuarDisponibilidade(d, 'QUA', '20:00')).toBe(1);
    expect(pontuarDisponibilidade(d, 'QUA', '23:00')).toBe(0.5);
    expect(pontuarDisponibilidade(d, 'SEX', '20:00')).toBe(0);
    expect(pontuarDisponibilidade([], 'SEX', '20:00')).toBe(0.5);
  });
});

describe('calcularMatching', () => {
  it('cenário de sucesso: célula ideal recebe escore 100', () => {
    const [r] = calcularMatching(membro(), [celula()], { hoje });
    expect(r.score).toBe(100);
  });

  it('ordena pelo escore e limita a 3 sugestões', () => {
    const cels = [
      celula({ idCelula: 1, latitude: -23.5025, longitude: -46.6251 }), // Santana, longe
      celula({ idCelula: 2 }), // ideal
      celula({ idCelula: 3, diaSemana: 'SEX' }),
      celula({ idCelula: 4, faixaEtaria: '40-60' }),
    ];
    const res = calcularMatching(membro(), cels, { hoje });
    expect(res).toHaveLength(3);
    expect(res[0].idCelula).toBe(2);
    expect(res[0].score).toBeGreaterThanOrEqual(res[1].score);
  });

  it('nunca sugere célula lotada ou inativa', () => {
    const res = calcularMatching(
      membro(),
      [celula({ idCelula: 1, capacidadeAtual: 20 }), celula({ idCelula: 2, ativa: false })],
      { hoje },
    );
    expect(res).toEqual([]);
  });

  it('exclui células de perfil incompatível (gênero)', () => {
    const res = calcularMatching(membro({ genero: 'M' }), [celula({ perfilGrupo: 'MULHERES', faixaEtaria: '18-60' })], { hoje });
    expect(res).toEqual([]);
  });

  it('empate: prefere a célula com mais vagas', () => {
    const res = calcularMatching(
      membro(),
      [celula({ idCelula: 1, capacidadeAtual: 18 }), celula({ idCelula: 2, capacidadeAtual: 5 })],
      { hoje },
    );
    expect(res[0].score).toBe(res[1].score);
    expect(res[0].idCelula).toBe(2);
  });

  it('sem células disponíveis retorna lista vazia', () => {
    expect(calcularMatching(membro(), [], { hoje })).toEqual([]);
  });
});
