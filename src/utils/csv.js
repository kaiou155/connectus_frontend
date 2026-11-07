/** Exportação de relatórios em CSV. Separador ";" abre direto no Excel pt-BR. */
const escapar = (valor) => {
  const s = valor === null || valor === undefined ? '' : String(valor);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function gerarCsv(linhas, colunas) {
  const cabecalho = colunas.map((c) => escapar(c.label)).join(';');
  const corpo = linhas.map((l) => colunas.map((c) => escapar(c.value(l))).join(';'));
  return [cabecalho, ...corpo].join('\r\n');
}

export function baixarArquivo(conteudo, nomeArquivo, tipo = 'text/csv;charset=utf-8') {
  // BOM garante acentuação correta no Excel
  const blob = new Blob(['﻿', conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
