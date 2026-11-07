/**
 * Consulta de endereço por CEP (ViaCEP — serviço público e gratuito).
 * A geolocalização (latitude/longitude) é responsabilidade do back-end, que a calcula
 * a partir do CEP ao persistir o membro ou a célula.
 */
export async function buscarCep(cep) {
  const digitos = String(cep).replace(/\D/g, '');
  if (digitos.length !== 8) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const r = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, {
      signal: controller.signal,
    });
    if (!r.ok) return null;
    const d = await r.json();
    if (d.erro) return { naoEncontrado: true };
    return {
      logradouro: d.logradouro,
      bairro: d.bairro,
      cidade: d.localidade,
      estado: d.uf,
    };
  } catch {
    return null; // sem rede ou bloqueado: o usuário preenche manualmente
  } finally {
    clearTimeout(timer);
  }
}
