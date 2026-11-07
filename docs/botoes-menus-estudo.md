# Botões / menus no Mensageiro — estudo de viabilidade e desenho (fase 1, sem implementação)

Pedido do usuário: um **construtor** de menus (ele cria o menu, adiciona e reordena botões com rótulo e ação), que aparece **só quando ele quiser enviar** numa conversa, com as ações: responder texto pronto, pedir um dado, mover no CRM e/ou criar nota, chamar humano (assumir) e encadear para outro menu.

## 1. Viabilidade: botão nativo do WhatsApp na Evolution 2.3.7 (Baileys)

**Conclusão: não é confiável hoje nesta VPS. Recomendação: menu numerado em texto como padrão, com o mesmo construtor e o mesmo roteamento ("1", "2"...). Botão nativo fica como um "modo" futuro, ligado só se houver canal oficial.**

Evidências (documentação e issues públicas; a evidência da própria VPS foi pedida ao Infra e está na seção 1.2):

| Fato | Fonte |
| --- | --- |
| Evolution **2.3.7**: `sendButtons`/`sendList` falham com `400 "TypeError: this.isZero is not a function"`; funcionavam na 2.3.6. Issue fechada como duplicata de #2404 | [evolution-api #2390](https://github.com/evolution-foundation/evolution-api/issues/2390) |
| `sendButtons` retorna **201 mas a mensagem nunca é entregue** ao WhatsApp (falha silenciosa) | #2404 (citada em #2390) |
| `sendList` com o mesmo erro em 2.3.6/2.3.7; fechada "not planned" em 19/05/2026; mantenedor pede nova issue se reproduz na 2.3.7; lista só funcionou na 2.4.0-rc2 (pré-lançamento, "não recomendado para produção"); quem desistiu usou **texto numerado** | [evolution-api #2188](https://github.com/evolution-foundation/evolution-api/issues/2188) |
| Lista "envia mas nunca chega" (status PENDING, sem erro) conforme a versão do Baileys (6.7.12 ok, 6.7.18 não) | [evolution-api #1620](https://github.com/evolution-foundation/evolution-api/issues/1620) |
| PR mesclado em 24/02/2026 só valida botões (máx. 3 reply, 2 CTA, sem misturar tipos); não corrige a entrega | [evolution-api PR #2382](https://github.com/EvolutionAPI/evolution-api/pull/2382) |
| Comunidade Baileys: `buttonsMessage`/`listMessage` legados foram removidos pelo WhatsApp; hoje seria `interactiveMessage`/`nativeFlow`, que o Baileys padrão não monta por completo (faltam nós binários) e cujo comportamento depende do tipo de conta; relatos de lista sem renderizar na maioria dos clientes | forks do Baileys (documentação comunitária) |

Limites relevantes:

- **Canal Baileys (WhatsApp Web não oficial)**: botão/lista podem ser aceitos pela API e não chegar; quebram a cada atualização do WhatsApp/Baileys; mexer nisso aumenta o risco de bloqueio do número. Não há "janela de 24 h" formal porque não é a API oficial.
- **WhatsApp Cloud API oficial (WhatsApp Business)**: botões de resposta (máx. 3), listas (máx. 10 itens) e templates existem e são confiáveis, **mas** só dentro da janela de 24 h desde a última mensagem do cliente; fora dela só templates aprovados. Exige conta Business e outro canal na Evolution (`WHATSAPP-BUSINESS`), não o número pessoal atual.
- **Enquete (`sendPoll`)**: é a opção nativa mais estável no Baileys, mas só permite escolha visível e não dispara ação por "botão" nem abre link; serve como extra, não como base do construtor.

### 1.2 Evidência da VPS (pedida ao Infra, só leitura)

Versão da Evolution já confirmada pelo Infra: **2.3.7**, instância `WA` com Baileys, e a rota `sendPresence` existe. Pendente a confirmação de `sendButtons`/`sendList`/`sendPoll` no `main.js`, a versão do Baileys e o que o patch manual de 24/10 muda. Esta seção é atualizada com a resposta.

## 2. Modelo de menus

Um **menu** tem nome interno, texto de abertura e uma lista **ordenada** de **itens**. Cada item tem rótulo, apelidos (palavras que também valem) e uma lista **ordenada de ações**, executadas em sequência.

Ações (todas as pedidas):

| Ação | Configuração | O que faz |
| --- | --- | --- |
| `reply` | `text` | Responde com texto pronto (aceita `{{nome}}`, `{{email}}`... dos dados já coletados) |
| `ask` | `field` (nome, e-mail, cidade, tipo de serviço ou campo próprio), `prompt`, `validate` (nenhum, e-mail, texto curto) | Pergunta e **espera a resposta livre** do contato; valida; guarda; segue para a próxima ação |
| `crm` | `stage`, `note` opcional | Move o contato no pipeline (como decisão **humana**, pois o dono do menu a definiu) e/ou cria nota interna com os dados coletados |
| `handoff` | `message` opcional | Assume a conversa (`mode=human`, desliga o automático) e avisa o contato |
| `goto` | `menu_id` | Envia outro menu e abre nova etapa (limite de encadeamento e detecção de ciclo ao salvar) |

Envio: **só por ação do usuário** ("Enviar menu" na conversa). Nunca na primeira mensagem, nunca automático. Como o dono iniciou o menu, as respostas determinísticas aos cliques desta sessão são autorizadas por esse gesto; elas não usam o modelo.

### 2.1 Roteamento das respostas (o mesmo para texto numerado e, no futuro, botão nativo)

1. Webhook `messages.upsert` entra → antes do fluxo da IA, o roteador de menus procura **sessão ativa** da conversa (`menu_sessions`).
2. Sem sessão: segue o fluxo normal (IA/sugestão). Com sessão: a IA **não** gera nada para essa mensagem.
3. Sessão aguardando **escolha**: aceita `1`, `1.`, `1)`, `opção 1`, `1️⃣`, o rótulo ou um apelido (sem acento/maiúscula). Inválido: reenvia o menu uma vez ("responde só com o número"); no 2º erro encerra a sessão e devolve a conversa ao fluxo normal.
4. Sessão aguardando **dado** (`ask`): valida, guarda em `contact_data`, avança. Dado inválido: pede de novo até 2 vezes.
5. Fim das ações: encerra a sessão (ou abre a do próximo menu, se `goto`). Expira em 30 min sem resposta (configurável) e se um humano escrever na conversa (cancelamento conservador).
6. Texto livre fora do que a etapa espera ("2 dias" contra "2") só conta como escolha se a mensagem for **exatamente** a opção; senão cai nas regras 3/4.

Conversas em grupo: nunca. Números `@lid`: usa o mesmo JID canônico do resto do app.

## 3. Esquema de dados proposto (banco `mensageiro`, migração futura `005_menus.sql`, não aplicada)

```sql
CREATE TABLE mensageiro.menus (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text   NOT NULL CHECK (length(name) BETWEEN 1 AND 60),       -- nome interno
  intro       text   NOT NULL CHECK (length(intro) BETWEEN 1 AND 600),     -- texto de abertura enviado
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE mensageiro.menu_items (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  menu_id   bigint NOT NULL REFERENCES mensageiro.menus(id) ON DELETE CASCADE,
  position  int    NOT NULL,                                                -- ordem (1..10)
  label     text   NOT NULL CHECK (length(label) BETWEEN 1 AND 40),
  aliases   text[] NOT NULL DEFAULT '{}',
  actions   jsonb  NOT NULL DEFAULT '[]',                                   -- lista ordenada de {type, ...} validada no servidor
  active    boolean NOT NULL DEFAULT true,
  UNIQUE (menu_id, position)
);
CREATE TABLE mensageiro.menu_sessions (                                     -- uma sessão ativa por conversa
  jid        text PRIMARY KEY,
  menu_id    bigint NOT NULL REFERENCES mensageiro.menus(id) ON DELETE CASCADE,
  item_id    bigint,                                                        -- item em andamento (quando há ações pendentes)
  step       int    NOT NULL DEFAULT 0,                                     -- próxima ação a executar
  awaiting   text   NOT NULL CHECK (awaiting IN ('choice', 'field')),
  field      text,                                                          -- campo esperado quando awaiting='field'
  attempts   int    NOT NULL DEFAULT 0,
  collected  jsonb  NOT NULL DEFAULT '{}',
  started_by text   NOT NULL,                                               -- admin que enviou o menu
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE mensageiro.contact_data (                                      -- dados pedidos pelo menu (LGPD: só o necessário)
  jid text NOT NULL, key text NOT NULL CHECK (key ~ '^[a-z_]{1,30}$'),
  value text NOT NULL CHECK (length(value) <= 200), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (jid, key)
);
```

Segurança e governança: RLS forçado e uma policy para `mensageiro_app`, como nas outras tabelas; `audit` recebe os eventos `menu.sent`, `menu.choice`, `menu.field`, `menu.handoff`, `menu.expired` (a restrição de `actor` do `audit` hoje só aceita `ia`/`humano`: a migração acrescenta `contato` e `sistema`). A auditoria registra ids e tamanhos, nunca o texto do que o contato digitou além do campo coletado em `contact_data`.

## 4. API admin (mesmo token de admin das rotas `/state` e `/copilot`)

| Rota | Função |
| --- | --- |
| `GET /api/menus` · `POST /api/menus` | listar / criar |
| `GET/PUT/DELETE /api/menus/:id` | ler, editar nome/intro/ativo, apagar |
| `PUT /api/menus/:id/items` | salva a lista **inteira e ordenada** de itens numa transação (valida: ≤10 itens, rótulos únicos, ações permitidas, `goto` sem ciclo e com profundidade ≤5, estágio existente) |
| `POST /api/menus/preview` | devolve o texto numerado e simula uma escolha sem enviar nada |
| `POST /api/menus/:id/send` | `{ jid, instance }`: envia o menu naquela conversa (autoria `humano`, abre sessão) |
| `GET /api/menu-sessions?jid=` · `DELETE` | ver / encerrar sessão da conversa |
| `GET /api/menus/capabilities` | informa se há botão nativo confiável (padrão: só texto numerado) |

## 5. Tela (página nova "Menus" no menu lateral)

```
┌ Menus ────────────┬ Editor: "Atendimento inicial" ─────────────────────┬ Pré-visualização ───────────┐
│ + Novo menu       │ Nome interno  [Atendimento inicial        ] [ativo]│  ┌─────────────────────────┐ │
│ ▸ Atendimento…    │ Texto de abertura                                   │  │ Oi! Como posso te ajudar?│ │
│ ▸ Orçamento       │ [Oi! Como posso te ajudar?                       ]  │  │ 1 - Ver serviços         │ │
│                   │ Botões (arraste ou use ▲▼)                          │  │ 2 - Pedir orçamento      │ │
│                   │ ⠿ 1 [Ver serviços       ]  ações: [Texto pronto ▾]  │  │ 3 - Falar com o Daniel   │ │
│                   │      └ + ação (texto, pedir dado, CRM/nota, humano, │  │ Responda com o número.   │ │
│                   │        ir para menu)                          [🗑]  │  └─────────────────────────┘ │
│                   │ ⠿ 2 [Pedir orçamento    ]  ações: [Pedir dado ▾]    │  Simular clique: [1][2][3]  │
│                   │ ⠿ 3 [Falar com o Daniel ]  ações: [Chamar humano ▾] │  → mostra o que aconteceria │
│                   │ [+ Adicionar botão]            [Salvar] [Enviar…]   │    (nada é enviado)         │
└───────────────────┴─────────────────────────────────────────────────────┴─────────────────────────────┘
```

- Editor com reordenação por arrastar e por botões ▲▼ (teclado e celular), validação em linha (rótulo vazio, ciclo de menus, estágio inexistente) e aviso de alterações não salvas.
- **Enviar menu numa conversa**: item novo "Enviar menu…" no menu de anexos e no menu "⋮" do chat → escolhe o menu → vê a prévia exata → "Enviar". O chat mostra uma faixa "Menu em andamento: Atendimento inicial (expira 14:32) · Encerrar".
- Celular: lista de menus e editor em telas empilhadas; a pré-visualização vira aba.

## 6. Fases

1. **Agora (esta fase):** viabilidade, desenho da tela e esquema (este documento). Nada implementado.
2. Backend: migração 005, API admin, roteador de sessões e envio do menu, com testes e Evolution falsa (sem WhatsApp real).
3. Página "Menus" (editor + prévia + simulação).
4. "Enviar menu" na conversa e faixa de sessão; auditoria; deploy pelo Infra.
5. Opcional, só se houver canal oficial: modo "botão nativo" (Cloud API) reaproveitando o mesmo roteamento.

## 7. Riscos e decisões para o usuário

- Menu numerado é texto: o contato pode digitar algo diferente. O desenho já trata (reenvio uma vez, depois devolve à IA/humano).
- Dados pedidos (nome, e-mail, cidade) são dados pessoais: guardamos só o necessário, na conversa, com auditoria; avisar o contato do uso (frase no texto de abertura) é recomendável.
- Interação com o atendente de IA: enquanto há sessão de menu, a IA fica quieta naquela conversa; ao terminar, a IA volta ao normal (se estava ligada).
- **Perguntas:** (1) validade da sessão (30 min serve?); (2) o humano escrever na conversa deve cancelar a sessão? (sugerido: sim); (3) "mover no CRM" por menu conta como decisão humana (sugerido: sim, pois ele criou a regra); (4) querem que o texto do menu avise "responda com o número"? (sugerido: sim); (5) o número atual continua sendo o pessoal (Baileys)? Se quiserem botão nativo real, o caminho é um número Business na Cloud API.
