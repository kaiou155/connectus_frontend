# Contrato da API REST — Conectus

Este documento descreve os endpoints que o back-end Node.js deve expor para o front-end funcionar
sem alterações. A implementação de referência está em `src/services/mock/mockServer.js` (modo
demonstração) — ela aplica as mesmas regras de negócio e pode ser lida como especificação executável.

- **Base URL:** `VITE_API_URL` (padrão `/api`)
- **Formato:** JSON, campos em `camelCase` (o back-end faz o mapeamento para as colunas `snake_case` do MER)
- **Autenticação:** `Authorization: Bearer <JWT>` em todas as rotas, exceto as marcadas como *pública* (RNF02)
- **Multitenância (RF05):** o `idIgreja` vem **do token**, nunca do corpo da requisição. Toda consulta
  deve filtrar por ele — o front-end não envia o tenant.
- **Datas:** ISO 8601 (`2026-10-26T18:30:00.000Z`); datas sem hora como `YYYY-MM-DD`; horários como `HH:MM`.

## Erros

Toda resposta de erro deve ter o formato:

```json
{ "message": "Texto exibido ao usuário", "codigo": "OPCIONAL", "campos": { "email": "E-mail já cadastrado." } }
```

| Status | Quando usar | Tratamento no front-end |
| --- | --- | --- |
| 400 | Validação falhou | Destaca os `campos` no formulário |
| 401 | Token ausente, inválido ou expirado | Encerra a sessão e volta ao login |
| 403 | Perfil sem permissão (RC03) ou limite do plano (`codigo: LIMITE_PLANO`) | Mostra a mensagem |
| 403 | Assinatura sem acesso: escrita recusada (`codigo: ASSINATURA_BLOQUEADA`). GET continua liberado | Relê `/auth/me` e mostra a faixa de sistema bloqueado |
| 404 | Registro inexistente **ou de outra igreja** | Mostra a mensagem |
| 409 | Conflito de regra de negócio (ver códigos abaixo) | Depende do código |
| 429 | Muitas tentativas seguidas (login, esqueci a senha) | Pede para aguardar um minuto |

Códigos de 409 usados pela interface:

| `codigo` | Significado | Ação do front-end |
| --- | --- | --- |
| `CELULA_LOTADA` | A célula atingiu a capacidade entre a sugestão e a confirmação (RC06) | Recalcula o matching |
| `JA_TRIADO` | Outro voluntário já alocou o membro | Volta para a fila de triagem |
| `CONFIRMACAO_NECESSARIA` | Ação exige confirmação (UC009 3a, UC010 3a) | Abre diálogo e reenvia com `confirmar: true` |
| `USO_EXCEDE_PLANO` | O uso atual não cabe no plano escolhido | Mostra a mensagem |
| `CHECKOUT_NECESSARIO` | Troca de plano sem assinatura paga ativa | Mostra a mensagem; o botão "Assinar" leva ao checkout |
| `JA_ASSINANTE` | Checkout com assinatura paga já ativa | Mostra a mensagem |

Outros códigos: `TOKEN_INVALIDO` (400, link de redefinição de senha inválido ou expirado).

## Perfis (RC03)

`ADMINISTRADOR`, `LIDER`, `VOLUNTARIO` — valores de `perfil_acesso.nome_perfil`.

---

## Autenticação — UC001

### `POST /auth/login` *(pública)*
```json
{ "email": "voluntario@conectus.app", "senha": "********" }
```
**200**
```json
{
  "token": "<jwt>",
  "usuario": {
    "idUsuario": 2, "nome": "Carolina Magalhães", "email": "voluntario@conectus.app", "telefone": "(11) 98888-2000",
    "perfil": "VOLUNTARIO", "ativo": true, "senhaTemporaria": false, "dataCriacao": "…", "idIgreja": 1,
    "idCelula": null, "nomeCelula": null
  },
  "assinatura": {
    "status": "TESTE", "liberado": true, "motivoBloqueio": null,
    "acessoAte": "2026-11-18T12:00:00.000Z", "diasRestantes": 7, "plano": "ESSENCIAL"
  }
}
```
`idCelula`/`nomeCelula` vêm preenchidos quando o usuário é líder de uma célula ativa.
`senhaTemporaria: true` leva o usuário à tela de troca de senha antes de qualquer outra.
`assinatura.status`: `TESTE ATIVA ATRASADA CANCELADA EXPIRADA`; com `liberado: false` o sistema fica somente leitura
e `motivoBloqueio` é `TESTE_ENCERRADO PAGAMENTO_ATRASADO ASSINATURA_CANCELADA ASSINATURA_EXPIRADA`.
**401** credenciais inválidas · **403** usuário desativado.

Payload esperado do JWT: `{ "sub": idUsuario, "perfil": "…", "idIgreja": 1, "exp": <unix> }`.
Senhas com bcrypt (RNF02).

### `GET /auth/me`
Retorna o objeto `usuario` acima com o campo `assinatura` junto (`{ ...usuario, assinatura }`). Usado ao recarregar a página.

### Senha
| Método | Rota | Corpo | Observações |
| --- | --- | --- | --- |
| POST | `/auth/esqueci-senha` *(pública)* | `{ "email" }` | Envia por e-mail o link `FRONTEND_URL/redefinir-senha?token=…` (válido por 1 hora). Responde igual exista o e-mail ou não |
| POST | `/auth/redefinir-senha` *(pública)* | `{ "token", "novaSenha" }` | Mínimo de 8 caracteres. **400** `TOKEN_INVALIDO` se o link expirou ou já foi usado |
| POST | `/auth/alterar-senha` | `{ "senhaAtual", "novaSenha" }` | Limpa `senhaTemporaria`. **400** com `campos.senhaAtual` se a senha atual estiver errada |
| POST | `/usuarios/:id/redefinir-senha` | `{ "senhaTemporaria" }` | ADMIN. Define senha temporária e envia por e-mail |

Todas respondem `{ "mensagem": "…" }`.

---

## Igreja — UC008 / RF05

### `GET /igrejas/atual`
```json
{
  "idIgreja": 1, "nomeIgreja": "Igreja Batista Nova Vida", "denominacao": "Batista", "cidade": "São Paulo",
  "estado": "SP", "plano": "INTERMEDIARIO", "ativo": true, "dataCadastro": "…",
  "uso": { "membros": 104, "celulas": 7, "usuarios": 9 },
  "limites": { "membros": 500, "celulas": 20, "usuarios": 10 },
  "assinatura": { "status": "ATIVA", "liberado": true, "…": "mesmo formato do login" }
}
```
Planos: `ESSENCIAL` (100/5/3), `INTERMEDIARIO` (500/20/10), `PREMIUM` (ilimitado → `null`).

### `PUT /igrejas/atual` — ADMINISTRADOR
Corpo: `nomeIgreja*`, `denominacao`, `cidade*`, `estado*`, `plano` (opcional; segue a regra de `POST /assinatura/plano`).
O front envia só os dados da igreja; a troca de plano é feita na tela de Assinatura.

### `POST /igrejas` *(pública — onboarding SaaS)*
```json
{
  "igreja": { "nomeIgreja": "…", "denominacao": "…", "cidade": "…", "estado": "SP", "plano": "ESSENCIAL" },
  "administrador": { "nome": "…", "email": "…", "senha": "mínimo 8 caracteres" }
}
```
**201** `{ "igreja": {…}, "token": "<jwt>", "usuario": {…} }` · **409** e-mail já cadastrado.
A igreja começa com a assinatura em teste grátis (`TRIAL_DIAS` no back-end). Erros de validação podem vir
com o caminho completo (`"igreja.nomeIgreja"`); o front também aceita só o nome final do campo.

---

## Usuários — UC009 (ADMINISTRADOR)

| Método | Rota | Corpo / query |
| --- | --- | --- |
| GET | `/usuarios` | `?perfil=LIDER&ativo=true&q=texto` |
| POST | `/usuarios` | `nome*`, `email*`, `perfil*`, `telefone`, `senhaTemporaria*` → **201** `{…usuario, mensagem}` (back-end envia as credenciais por e-mail) |
| PUT | `/usuarios/:id` | `nome*`, `email*`, `perfil*`, `telefone` · **409** se deixar de ser líder tendo célula ativa |
| PATCH | `/usuarios/:id/status` | `{ "ativo": false, "confirmar": false }` · **409 CONFIRMACAO_NECESSARIA** se for líder de célula ativa |

O próprio administrador não pode se desativar nem remover o próprio perfil (400).
Limite de usuários do plano → **403 LIMITE_PLANO**.

## Líderes — Figuras 22/23

### `GET /lideres?q=` · `GET /lideres/:id`
```json
[{
  "idUsuario": 3, "nome": "Pedro Almeida", "email": "…", "telefone": "…", "perfil": "LIDER",
  "liderDesde": "…", "totalMembros": 14,
  "celula": { "idCelula": 1, "nomeCelula": "Vila Mariana - Jovens", "bairro": "Vila Mariana", "perfilGrupo": "JOVENS", "capacidadeAtual": 14, "capacidadeMaxima": 20 }
}]
```

---

## Células — UC004 / UC010 / RF03 / RF04 / RC06

### Objeto célula
```json
{
  "idCelula": 1, "nomeCelula": "Vila Mariana - Jovens", "idLider": 3,
  "lider": { "idUsuario": 3, "nome": "Pedro Almeida", "telefone": "…", "email": "…" },
  "capacidadeMaxima": 20, "capacidadeAtual": 14, "vagas": 6, "lotada": false, "ocupacaoPct": 70,
  "statusCelula": "ATIVA", "ativa": true,
  "diaSemana": "QUA", "horario": "20:00", "perfilGrupo": "JOVENS", "faixaEtaria": "18-28",
  "cep": "04010-100", "bairro": "Vila Mariana", "cidade": "São Paulo", "endereco": "Rua Domingos de Morais, 1200",
  "descricao": "…", "latitude": -23.5893, "longitude": -46.6346, "idIgreja": 1
}
```
`diaSemana`: `SEG TER QUA QUI SEX SAB DOM` ·
`perfilGrupo`: `JOVENS UNIVERSITARIOS CASAIS MULHERES HOMENS NOVOS_CONVERTIDOS FAMILIAS MISTO`.

| Método | Rota | Perfis | Observações |
| --- | --- | --- | --- |
| GET | `/celulas` | todos | `?q=&bairro=&perfil=&dia=&comVagas=true&incluirInativas=true` (inativas só para admin) |
| GET | `/celulas/:id` | todos | + `integrantes: [{idMembro, nomeCompleto, dataEntrada}]`, `proximaReuniao` |
| POST | `/celulas` | ADMIN | campos obrigatórios: `nomeCelula idLider capacidadeMaxima horario diaSemana perfilGrupo faixaEtaria cep bairro`. O back-end geocodifica o CEP (latitude/longitude). **409** se o líder já tem célula ativa |
| PUT | `/celulas/:id` | ADMIN | **400** se `capacidadeMaxima < capacidadeAtual` |
| PATCH | `/celulas/:id/status` | ADMIN | `{ativa, confirmar}` · **409 CONFIRMACAO_NECESSARIA** se houver membros. Ao confirmar, os membros voltam a `AGUARDANDO_TRIAGEM` e o histórico é fechado com motivo "Célula desativada" |

O front-end consulta `/celulas` periodicamente (`VITE_POLLING_MS`) nas telas de triagem para exibir a
ocupação em tempo real (RF03). Para atualização instantânea, o back-end pode expor WebSocket/SSE no futuro.

---

## Membros — UC002 / UC005 / UC006 / UC011 / RF07

### Objeto membro
```json
{
  "idMembro": 98, "nomeCompleto": "Mariana Costa", "dataNascimento": "2002-05-10", "idade": 24,
  "genero": "F", "estadoCivil": "SOLTEIRO", "telefone": "(11) 91234-5678", "email": "mariana@email.com",
  "cep": "04010-100", "bairro": "Vila Mariana", "cidade": "São Paulo", "latitude": -23.58, "longitude": -46.63,
  "perfilInteresse": "JOVENS", "indicadoPor": 12, "observacoes": "", "consentimentoLgpd": true,
  "disponibilidades": [{ "diaSemana": "QUA", "horarioInicio": "19:00", "horarioFim": "22:00" }],
  "statusMembro": "AGUARDANDO_TRIAGEM", "idCelulaAlocada": null, "celula": null,
  "idUsuarioTriagem": 2, "dataCadastro": "…", "idIgreja": 1
}
```
`genero`: `F M` · `estadoCivil`: `SOLTEIRO CASADO DIVORCIADO VIUVO` ·
`statusMembro`: `AGUARDANDO_TRIAGEM ALOCADO LISTA_ESPERA DESLIGADO`.

| Método | Rota | Perfis | Observações |
| --- | --- | --- | --- |
| GET | `/membros` | todos | `?q=&status=&idCelula=&bairro=&de=YYYY-MM-DD&ate=YYYY-MM-DD`. **Líder recebe apenas os membros da própria célula** |
| GET | `/membros/:id` | todos | + `historico[]` (com `nomeCelula`), `feedbacks[]`, `logs[]`, `indicadoPorNome`. Líder: 403 se não for da sua célula |
| POST | `/membros` | VOLUNTARIO, ADMIN | obrigatórios: `nomeCompleto dataNascimento genero estadoCivil telefone cep bairro`. Status inicial `AGUARDANDO_TRIAGEM`; `idUsuarioTriagem` = usuário do token. Grava `disponibilidade_membro` |
| PUT | `/membros/:id` | ADMIN | mesmo corpo do POST; substitui as disponibilidades |
| POST | `/membros/:id/saida` | LIDER (própria célula), ADMIN | `{ "motivo": "…", "reencaminhar": false }` — fecha `historico_celulas`, decrementa `capacidade_atual`; status vira `AGUARDANDO_TRIAGEM` se `reencaminhar`, senão `DESLIGADO` |
| POST | `/membros/:id/desvincular` | ADMIN | `{ "motivo": "…" }` — equivale à saída com `reencaminhar: true` |
| DELETE | `/membros/:id` | ADMIN | Exclusão definitiva a pedido do titular (LGPD). Devolve a vaga da célula. `{ "mensagem": "…" }` |

Campos opcionais não preenchidos (`email`, `indicadoPor`) são enviados como `null`. No cadastro, o front exige
`consentimentoLgpd: true` (o visitante autorizou o uso dos dados).

---

## Triagem — UC003 / UC003a / UC003b / RF01 / RF02 / RC04 / RC06

### `GET /triagem/pendentes` — VOLUNTARIO, ADMIN
Membros com `AGUARDANDO_TRIAGEM`, do cadastro mais antigo para o mais recente, cada um com:
```json
{ "...membro": "…", "melhorSugestao": { "idCelula": 1, "nomeCelula": "…", "bairro": "…", "perfilGrupo": "…", "score": 96, "compativel": true } }
```

### `POST /triagem/:idMembro/matching` — VOLUNTARIO, ADMIN
Executa o algoritmo e grava um `log_triagem` com `statusTriagem: "SUGERIDA"` para cada célula sugerida.
Deve responder em até **3 s** (RC04 / RNF01).
```json
{
  "membro": { "…": "…" },
  "scoreMinimo": 65,
  "tempoMs": 12,
  "sugestoes": [
    {
      "idLog": 431, "score": 96, "compativel": true,
      "celula": { "…objeto célula…": "" },
      "criterios": {
        "distancia":       { "pontuacao": 1,   "peso": 0.4,  "km": 0.8 },
        "idade":           { "pontuacao": 1,   "peso": 0.25, "idade": 24 },
        "disponibilidade": { "pontuacao": 1,   "peso": 0.2 },
        "perfil":          { "pontuacao": 0.9, "peso": 0.15 }
      }
    }
  ]
}
```
`criterios` é o JSON salvo em `log_triagem.criterios_score`. No máximo 3 sugestões, ordenadas por
escore (desempate: mais vagas, depois menor distância). Células inativas, lotadas ou de perfil
eliminatório (ex.: célula feminina para membro masculino) nunca são sugeridas. `compativel = score >= scoreMinimo`.

### `POST /triagem/:idMembro/alocacao` — VOLUNTARIO, ADMIN
```json
{ "idCelula": 1, "modo": "AUTOMATICA", "idLog": 431 }
```
`modo`: `AUTOMATICA` | `MANUAL`. `idLog` é opcional (ausente na triagem manual — o back-end cria o log).
Na mesma transação: revalidar a capacidade (**409 CELULA_LOTADA**), marcar o log como `APROVADA`
(e as demais sugestões abertas como `REJEITADA`), alocar o membro, incrementar `capacidade_atual`,
abrir `historico_celulas` e resolver a entrada da lista de espera, se houver.
**200** `{ "membro": {…}, "celula": {…}, "idLog": 431, "modo": "AUTOMATICA" }`.

### `POST /triagem/:idMembro/rejeicao`
`{ "idLog": 431, "motivo": "Prefere encontros aos sábados" }` → log `REJEITADA` com `motivoRejeicao`.

### `GET /triagem/:idMembro/logs`
Histórico de `log_triagem` do membro.

---

## Lista de espera — UC012 / RF08

| Método | Rota | Observações |
| --- | --- | --- |
| GET | `/lista-espera?status=AGUARDANDO` | Cada item: `idEspera idMembro dataEntrada motivo status dataResolucao tentativas membro melhorSugestao vagaDisponivel` |
| POST | `/lista-espera` | `{ "idMembro": 1, "motivo": "…" }` → membro vai para `LISTA_ESPERA` (se já estiver, incrementa `tentativas`) |
| POST | `/lista-espera/:id/tentativas` | Mantém na lista e registra a tentativa (UC012 4a) |

`vagaDisponivel` é `true` quando o matching atual encontra célula compatível.
`tentativas` pode ser derivado da contagem de `log_triagem` do membro.

## Notificações — RF08

### `GET /notificacoes` — VOLUNTARIO, ADMIN
```json
[{ "id": "vaga-3-2", "tipo": "VAGA_DISPONIVEL", "titulo": "Vaga compatível disponível",
   "mensagem": "Patrícia Lemos pode ser alocada em Pinheiros - Mulheres (97% de compatibilidade).",
   "link": "/lista-espera?membro=101", "data": "…" }]
```
### `PATCH /notificacoes/:id` — `{ "lida": true }`

O front-end consulta a cada `VITE_POLLING_MS`. O back-end pode gerar as notificações quando uma vaga
abre (saída de membro, aumento de capacidade, nova célula) ou calculá-las na consulta.

---

## Feedback — UC007 / RF09

### `GET /feedbacks/acompanhamento?idCelula=` — LIDER (própria célula, ignora o parâmetro), ADMIN
```json
{ "celula": { "…": "" }, "itens": [
  { "membro": { "…": "" }, "dataEntrada": "2026-10-20", "idLogTriagem": 431, "ultimoFeedback": null, "totalFeedbacks": 0 }
]}
```
### `GET /feedbacks?idMembro=`
### `POST /feedbacks` — LIDER
```json
{
  "idMembro": 98, "statusAdaptacao": "PARTICIPANDO", "notaIntegracao": 5, "permaneceuNaCelula": true,
  "dataVisita": "2026-10-26", "dataProximoContato": null, "comentariosMembro": "", "avaliacaoLider": "Bem recebido."
}
```
`statusAdaptacao` obrigatório (`RESPONDEU NAO_RESPONDEU PARTICIPANDO`); `notaIntegracao` 1–5.
O back-end vincula `idLogTriagem` ao último log aprovado. **403** se o membro não for da célula do líder.

---

## Relatórios — UC013 / RF06

| Método | Rota | Perfis | Resposta |
| --- | --- | --- | --- |
| GET | `/relatorios/resumo` | todos | `kpis` (membrosAtivos, novosSemana, celulasAtivas, lideres, triagensHoje, pendentes, listaEspera, taxaOcupacao, taxaConexao, mediaIntegracao), `novosPorMes[{mes:"2026-10", total}]` (6 meses), `topCelulas[]`, `atividadeRecente[{tipo, texto, data}]` |
| GET | `/relatorios/novos-membros?de=&ate=` | ADMIN | `{ total, alocados, porMes[], linhas[membro] }` |
| GET | `/relatorios/ocupacao` | ADMIN | `{ linhas[célula], totais: { capacidade, ocupacao, vagas, pct } }` |
| GET | `/relatorios/distribuicao-geografica?de=&ate=` | ADMIN | `{ total, linhas[{ bairro, cidade, total, alocados, celulaMaisProximaKm }] }` |

A exportação CSV é gerada no navegador a partir dessas respostas; o PDF usa a impressão do navegador
com estilos próprios para impressão.

## Busca global — RF07

### `GET /busca?q=` (mínimo 2 caracteres)
`{ "membros": [], "celulas": [], "lideres": [] }` — até 8 de cada. Líder só recebe membros da própria célula.

---

## Planos e assinatura

### `GET /planos` *(pública)*
```json
{
  "trialDias": 7,
  "planos": [
    { "idPlano": "ESSENCIAL", "nome": "Essencial", "descricao": "…", "valor": 49,
      "limites": { "membros": 100, "celulas": 5, "usuarios": 3 }, "historicoMeses": 6 }
  ]
}
```
`null` em um limite significa ilimitado.

### Rotas de `/assinatura` — ADMINISTRADOR, funcionam mesmo com o sistema bloqueado
| Método | Rota | Corpo | Resposta |
| --- | --- | --- | --- |
| GET | `/assinatura` | — | Situação completa (abaixo) |
| GET | `/assinatura/cupom/:codigo` *(pública)* | — | `{ "valido", "codigo", "percDesconto", "descricao" }` |
| POST | `/assinatura/checkout` | `{ "plano", "cupom"?, "emailPagador"? }` | `{ "initPoint", "valor", "percDesconto", … }` — o front redireciona para `initPoint` (Mercado Pago) |
| POST | `/assinatura/sincronizar` | — | Situação completa. Chamado na tela `/assinatura/retorno`, para onde o Mercado Pago devolve o cliente |
| POST | `/assinatura/plano` | `{ "plano" }` | Situação completa + `mensagem`. Em teste troca na hora; upgrade vale na hora; downgrade fica agendado |
| POST | `/assinatura/cancelar` | — | Situação completa + `mensagem`. O acesso continua até o fim do período pago |

Situação completa (`GET /assinatura`):
```json
{
  "status": "ATIVA", "liberado": true, "motivoBloqueio": null, "acessoAte": "…", "diasRestantes": 18,
  "planoId": "INTERMEDIARIO", "plano": { "…": "objeto de /planos" }, "planoPendente": null,
  "valorCobrado": 99, "cupom": null, "fimTeste": null, "vencimento": "…", "ultimoPagamento": "…",
  "formaCobranca": "MERCADO_PAGO", "podeFazerCheckout": false, "podeCancelar": true, "pagamentosHabilitados": true,
  "uso": { "membros": 104, "celulas": 7, "usuarios": 9 }, "limites": { "…": "…" },
  "faturas": [{ "idFatura": 1, "mes": 10, "ano": 2026, "plano": "INTERMEDIARIO", "pagoEm": "…", "valorPago": 99, "status": "PAGA" }]
}
```

No modo demonstração o pagamento é simulado: o checkout devolve `/assinatura/retorno` em vez do link do
Mercado Pago, e os cupons `TCC2026` (20%) e `BEMVINDO` (10%) são aceitos.

---

## Campos presentes nas telas que não aparecem no MER (Figura 18)

Os protótipos do Capítulo 8 exibem informações que não têm coluna no modelo lógico. O front-end
já envia/espera estes campos como **opcionais**; sugerimos incluí-los no banco:

| Tabela | Coluna sugerida | Onde aparece |
| --- | --- | --- |
| `membro` | `email` | Figura 21 — Cadastrar Membro |
| `membro` | `cidade` | Figura 21 (o MER tem só `cep` e `bairro_membro`) |
| `membro` | `perfil_interesse` | Figura 21 — "Perfil / Interesse", usado no matching |
| `celula` | `endereco`, `cidade`, `descricao` | Figuras 24 e 25 — endereço e texto da célula |
| `usuario` | `telefone` | Figuras 22, 23 e 25 — telefone do líder |
| `lista_espera` | `tentativas` (ou derivar de `log_triagem`) | UC012 fluxo 4a |
