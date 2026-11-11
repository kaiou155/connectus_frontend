# Conectus

Front-end do Conectus, um sistema web de triagem inteligente e gestão de células cristãs.
Ele ajuda o Ministério Welcome a encaminhar novos membros para a célula mais adequada,
em vez de cruzar planilhas à mão.

Trabalho de Conclusão de Curso de Engenharia de Software da UNAERP (2026).

Autores: Giovanna Brocco Luiz, Julia Antonieli de Oliveira e Kaio Henrique Citta de Sousa.
Orientador: Prof. Luciano Saraiva.

## Tecnologias

React, Vite, React Router e Vitest. O back-end é feito em NestJS, Prisma e PostgreSQL, em um repositório separado.

## Como rodar

```bash
npm install
copy .env.example .env
npm run dev
```

Depois é só abrir http://localhost:5173.

## Estado atual

As telas do protótipo estão implementadas, junto com recuperação de senha, consentimento LGPD no cadastro
de membros e a parte de assinatura (planos, pagamento pelo Mercado Pago e bloqueio quando a assinatura vence).

Por padrão o projeto roda em modo demonstração: os dados são simulados no próprio navegador, seguindo o
contrato da API em `docs/API_CONTRACT.md`.

Para usar com o back-end, suba a API (porta 3333) e no `.env` do front coloque `VITE_USE_MOCK=false`.
O `VITE_API_PROXY` já aponta para `http://localhost:3333`. No `.env` do back-end, `CORS_ORIGIN` e
`FRONTEND_URL` devem ser `http://localhost:5173`.

## Demonstração

Na tela de login há botões de acesso rápido para os três perfis (voluntário, líder e
administrador). A senha das contas de teste é `conectus123`.

Para mostrar a assinatura: entre como administradora, abra Configurações e use "Simular fim do teste grátis".
O sistema passa a ficar somente leitura até assinar de novo. No pagamento simulado, o cupom `TCC2026` dá 20% de desconto.

## Testes

```bash
npm test
```
