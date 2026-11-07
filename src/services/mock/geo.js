/**
 * Geocodificação simplificada para o modo demonstração.
 * No sistema real, o back-end obtém latitude/longitude a partir do CEP
 * (ex.: API de geocodificação) e grava em membro.latitude / membro.longitude.
 */
const BAIRROS = {
  'sao paulo': {
    _centro: [-23.5505, -46.6333],
    'vila mariana': [-23.5893, -46.6346],
    pinheiros: [-23.5662, -46.6918],
    moema: [-23.6009, -46.665],
    tatuape: [-23.5403, -46.5765],
    santana: [-23.5025, -46.6251],
    centro: [-23.5446, -46.6424],
    republica: [-23.5432, -46.6426],
    se: [-23.5503, -46.6339],
    lapa: [-23.5235, -46.7035],
    'itaim bibi': [-23.5845, -46.6795],
    itaim: [-23.5845, -46.6795],
    bras: [-23.5453, -46.6152],
    butanta: [-23.5717, -46.7086],
    penha: [-23.5244, -46.5414],
    liberdade: [-23.5587, -46.634],
    'bela vista': [-23.5614, -46.6474],
    perdizes: [-23.5367, -46.6782],
    mooca: [-23.559, -46.598],
    saude: [-23.6186, -46.6386],
    consolacao: [-23.553, -46.66],
    'jardim paulista': [-23.5685, -46.661],
    'vila madalena': [-23.5535, -46.6908],
    ipiranga: [-23.5888, -46.6091],
    aclimacao: [-23.5718, -46.6312],
    'santa cecilia': [-23.537, -46.651],
    'agua fria': [-23.4896, -46.6243],
    'vila clementino': [-23.5985, -46.6431],
    paraiso: [-23.5747, -46.6413],
    'campo belo': [-23.6219, -46.6697],
    carrao: [-23.5521, -46.5413],
    'vila formosa': [-23.5672, -46.5434],
    'alto de pinheiros': [-23.5526, -46.7116],
  },
  'ribeirao preto': {
    _centro: [-21.1775, -47.8103],
    centro: [-21.1775, -47.8103],
    'jardim botanico': [-21.2132, -47.8194],
    ribeirania: [-21.1965, -47.79],
    'vila seixas': [-21.1885, -47.808],
    'jardim irajá': [-21.2017, -47.8179],
    'jardim iraja': [-21.2017, -47.8179],
    'nova alianca': [-21.2234, -47.8119],
    campos_eliseos: [-21.1643, -47.8051],
    'campos eliseos': [-21.1643, -47.8051],
  },
};

export const normalizar = (s = '') =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

const hash = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
};

export function geocodificar(bairro, cidade = 'São Paulo') {
  const tabela = BAIRROS[normalizar(cidade)] ?? BAIRROS['sao paulo'];
  const ponto = tabela[normalizar(bairro)];
  if (ponto) return { latitude: ponto[0], longitude: ponto[1] };
  // bairro desconhecido: centro da cidade com um deslocamento determinístico (~até 6 km)
  const h = hash(normalizar(bairro));
  const [lat, lng] = tabela._centro;
  return {
    latitude: lat + ((h % 100) / 100) * 0.05 - 0.025,
    longitude: lng + (((h >> 8) % 100) / 100) * 0.05 - 0.025,
  };
}
