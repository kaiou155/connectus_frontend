# Conectus

Front-end do Conectus, um sistema web de triagem inteligente e gestão de células cristãs.
Ele ajuda o Ministério Welcome a encaminhar novos membros para a célula mais adequada,
em vez de cruzar planilhas à mão.

Trabalho de Conclusão de Curso de Engenharia de Software da UNAERP (2026).

Autores: Giovanna Brocco Luiz, Julia Antonieli de Oliveira e Kaio Henrique Citta de Sousa.
Orientador: Prof. Luciano Saraiva.

## Tecnologias

React, Vite, React Router e Vitest. O back-end será em Node.js com PostgreSQL.

## Como rodar

```bash
npm install
copy .env.example .env
npm run dev
```

Depois é só abrir http://localhost:5173.

## Estado atual

O back-end ainda não está pronto, então o projeto roda em modo demonstração: os dados
são simulados no próprio navegador, seguindo o contrato da API em `docs/API_CONTRACT.md`.
As telas do protótipo já estão implementadas e o algoritmo de matching funciona em modo
demonstração. Ainda falta o back-end (API em Node.js e banco PostgreSQL) e a integração com o front.

Para usar com o back-end real, altere `VITE_USE_MOCK` para `false` no `.env` e configure
o endereço da API (veja `.env.example`).

## Demonstração

Na tela de login há botões de acesso rápido para os três perfis (voluntário, líder e
administrador). A senha das contas de teste é `conectus123`.

## Testes

```bash
npm test
```
