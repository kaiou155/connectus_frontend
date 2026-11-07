/**
 * Acesso seguro ao localStorage: alguns navegadores (aba anônima, bloqueio de
 * cookies, iframes) lançam exceção ao acessá-lo. Nesses casos usamos memória.
 */
const memoria = new Map();

export const storage = {
  get(chave) {
    try {
      return window.localStorage.getItem(chave);
    } catch {
      return memoria.get(chave) ?? null;
    }
  },
  set(chave, valor) {
    try {
      window.localStorage.setItem(chave, valor);
    } catch {
      memoria.set(chave, valor);
    }
  },
  remove(chave) {
    try {
      window.localStorage.removeItem(chave);
    } catch {
      memoria.delete(chave);
    }
  },
  getJson(chave, padrao = null) {
    const bruto = this.get(chave);
    if (!bruto) return padrao;
    try {
      return JSON.parse(bruto);
    } catch {
      return padrao;
    }
  },
  setJson(chave, valor) {
    this.set(chave, JSON.stringify(valor));
  },
};
