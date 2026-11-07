# QA — scroll do chat, chat do Antigravity e sugestão automática (06/11/2026)

## Como reproduzir

```bash
pnpm test                                            # 97 testes de servidor e bibliotecas
pnpm exec tsc --noEmit -p tsconfig.app.json && pnpm lint && pnpm build
node docs/qa/20261106-scroll-antigravity/fixture.mjs # Evolution, Auth, banco de estado e agy FALSOS (portas 4455/3355)
# em outro terminal, com playwright-core instalado fora do repositório:
node docs/qa/20261106-scroll-antigravity/e2e.mjs         # 51 verificações no navegador (Chromium headless)
node docs/qa/20261106-scroll-antigravity/e2e-notes.mjs   # foco em nota interna
```

Nada usa WhatsApp, Evolution, banco ou `agy` reais. Resultado completo em `e2e-results.json`; prints em `screens/`.

## Escopo 1 — rolagem (`src/hooks/use-stick-to-bottom.ts`, `src/lib/stick-to-bottom.ts`)

| Critério | Evidência (navegador) |
| --- | --- |
| Abre na última mensagem, sem animação | 1.1 conversa de 150 mensagens: distância do fim = 0 px; 1.2 trocar de conversa e voltar; 1.3 recarregar a página |
| Histórico que chega depois do primeiro render | 1.4 com `findMessages` atrasado em 1,8 s a conversa termina no fim |
| Novas mensagens acompanham quando está no fim (tolerância 100 px) | 1.7 recebida; 1.11 enviada |
| Lendo o histórico, não puxa a tela e avisa | 1.8 `scrollTop` 11633 → 11633 após 2 mensagens; aviso "2 novas mensagens" (1.8b), singular em 1.10 |
| Aviso some ao clicar ou ao voltar ao fim | 1.9b, 1.10b |
| Reancora quando a altura muda (imagem, áudio, barra de IA) | 1.5 bloco cresce +860 px no fim: continua no fim (ResizeObserver no conteúdo e no viewport); 1.6 lendo o histórico: não puxa |
| Enviar mensagem acompanha | 1.11 enviando com a tela em `scrollTop=200` vai ao fim e mostra a mensagem |
| Não quebra nota interna nem busca | `e2e-notes.mjs`: nota salva fica visível e focada; 1.12 busca filtra normalmente |

Limite conhecido: o app ainda não renderiza `<img>`/áudio dentro das mensagens (mídia aparece como resumo); a reancoragem por altura foi validada com um bloco que cresce no conteúdo, que aciona o mesmo `ResizeObserver` que uma imagem real acionaria.

## Escopo 2 — chat do Antigravity (`AntigravityPanel.tsx`, `server/antigravity.mjs`, rota `/api/antigravity/chat`)

- Painel próprio (substitui o console genérico): conversa-alvo escolhível (última ativa por padrão, ou a conversa que abriu pelo menu "Perguntar ao Antigravity"), estado visível **Sugestão / Assumida por humano / IA desligada nesta conversa / Grupo**, ações rápidas e histórico por conversa.
- Contexto real montado no servidor: contato/grupo, até 30 mensagens (limite de 6000 caracteres), notas, estágio, estado da IA. Mostra ao usuário o que foi usado ("8 mensagens, 2 notas, estágio ...").
- Ações com confirmação: resumir (só leitura), sugerir resposta (usa as regras do atendente e leva o rascunho à barra da conversa), criar nota (só grava em "Salvar nota"), sugerir estágio (só entre os estágios do pipeline; "Registrar sugestão" cria sugestão pendente, não aplica), aguardando retorno (nota interna após "Confirmar").
- pt-BR: instrução fixa + segunda passada que reescreve respostas em inglês; falha de idioma vira erro claro. Sem caminhos/stack/stderr: saída sanitizada e erros mapeados (503/504/502/429).
- Evidências: 2.1–2.18 no navegador (incluindo 2.6/2.10 "nada gravado antes de confirmar", 2.13 inglês reescrito, 2.15/2.16 erros claros, 2.18 celular 390 px sem rolagem horizontal) e `server/antigravity.test.mjs`, `server/webhook-routes.test.mjs`.
- Segurança: o `agy` segue sem `MENSAGEIRO_DATABASE_URL`/`EVOLUTION_APIKEY` (agora também nesta rota, que antes usava o ambiente completo). Máximo de 2 chamadas simultâneas.

## Escopo 3 — sugestão automática (`server/auto-suggest.mjs`, `POST /api/webhook/evolution`)

- Fluxo: webhook `messages.upsert` → ignora `fromMe`, grupos, mídia sem texto, mensagens antigas (sincronização) e eventos repetidos → conversa precisa estar com sugestões ligadas e sem humano assumido → debounce → contexto da Evolution → `suggestReply` (guardrails do atendente) → `ai_suggestions` (`reply`, `auto`, `sourceMessageId`).
- Uma pendente por conversa: nova sugestão substitui a anterior; mensagem nova do cliente e resposta humana descartam a pendente (auditoria `suggestion.superseded`).
- Evidências no navegador: 3.1 sugestão aparece sozinha; 3.3 id da mensagem de origem; 3.4 mensagem nova descarta a antiga na hora e gera outra; 3.6 envio só com o clique; 3.7 assumida e 3.8 desligada não geram; 3.8b tema bloqueado ("cartão") não gera; 3.9 número de rascunhos = número de mensagens do cliente (sem loop); 3.2 nenhum envio feito pela IA.
- Testes de servidor (`auto-suggest.test.mjs`, `state-db.test.mjs`): debounce, rodada velha descartada, limites por contato/hora/dia, chave geral desligada/pausada, tema bloqueado, encaminhamento humano, saída bloqueada pelo filtro, falha de contexto/modelo, auditoria sem texto.
- O envio automático continua proibido: `COPILOT_ALLOW_AUTOMATIC` desligado e nenhum código deste fluxo envia mensagem.

## Envio automático (opt-in por conversa) — adendo

- Travas em série (`server/auto-suggest.mjs`): servidor liberado (`COPILOT_ALLOW_AUTOMATIC=1`) + atendente ligado/fora de pausa/modo Automático + migração 003 + opt-in da conversa (`auto_reply`) sem humano assumindo + texto puro com até 2 min + rascunho com fonte aprovada e aprovado pelo filtro de saída + ainda atual + janela de 60 s, 3/h por conversa e 10/h global. Rascunho reservado no banco antes de enviar; falha de envio não reenvia e volta como sugestão.
- Pausas: humano respondeu (eco das nossas mensagens é reconhecido pelo id e por janela curta), assumir ou desligar a IA.
- Nunca envia: grupos, mídia/áudio/figurinha (e legenda de foto não conta como texto puro), conversa sem opt-in, atendente pausado/desligado, kill switch.
- Testes: `server/auto-reply.test.mjs` (10 cenários com Evolution falsa), `auto-reply-routes.test.mjs` (webhook -> sendText falso), `state-db.test.mjs` (coluna/migração/reset), `copilot.test.mjs` (kill switch). Navegador `e2e-auto.mjs`: 17/17 (confirmação, envio único, janela, auditoria, humano responde pausa, pausa geral, assumir, outra conversa intacta). Regressão `e2e.mjs`: 51/51.
- UI: "IA responde automaticamente nesta conversa" + selo AUTOMÁTICO x "Só sugestão"; botão com confirmação; Antigravity mostra o mesmo estado.

## Espera de 6 s com reinício e "digitando…" — adendo

- Debounce 6 s (antes 4 s) contado da última mensagem, com reinício por mensagem e uma única resposta para a rajada; vale também para o card de sugestão.
- Presença `composing` desde o início da espera (só quando um envio automático ainda é possível), renovada a cada 8 s, sempre encerrada com `paused`; abortada se humano assumir/IA desligar/pausa; teto de 150 s; falha de presença não derruba a resposta.
- Testes: `server/auto-presence.test.mjs` (10 cenários, estáveis em 3 execuções) e `auto-reply-routes.test.mjs` (formato do `/chat/sendPresence`). Navegador `e2e-auto.mjs` 22/22, com medição real: última mensagem -> resposta 6024 ms; primeira -> resposta 9035 ms (reinício); composing,composing,paused; nada preso depois. Regressão `e2e.mjs` 51/51.

## Tom natural e fonte não-trava — adendo

- Prompt reescrito (v2): primeira pessoa como Daniel, informal, 1-2 frases, espelha o contato, sem lista/"Prezado"/"Como posso ajudar?", varia a abertura, nunca diz que é bot/IA; fatos só do contexto aprovado, senão "deixa eu confirmar e já te falo". Painel do Antigravity com o mesmo tom (sem falar de projeto, servidor ou bot).
- Filtro de saída: bloqueia menção a IA/bot, frases robotizadas e listas (com uma reescrita automática) e, na resposta automática SEM trecho aprovado, qualquer número/valor/prazo.
- Handoff: reclamação, cancelamento, reembolso, negociação e jurídico (padrões embutidos) e `[ENCAMINHAR]` nunca são enviados ao contato. Pergunta de identidade ("é robô? é pessoa?") nunca é respondida pela IA: vai para humano.
- Testes: `server/natural-reply.test.mjs` (10 cenários): "oi"/"tudo bem?" enviados sem fonte; sem a env tudo sem fonte fica sugestão; "quanto custa" sem fonte não inventa (valor e número por extenso bloqueados, "vou confirmar" enviado, modo suggest); com fonte usa o trecho; reclamação/desconto/cancelar/identidade/[ENCAMINHAR] sem envio; resposta que soa bot é reescrita uma vez, se persistir não envia; filtros e detectores; prompt do painel.

## Prompt v3 (tom de conversa) — adendo

- Prompt v3 + filtro "soa humano" (muletas, tamanho, emoji, abertura repetida; uma reescrita, senão não envia) + anti-repetição de abertura entre respostas + até 2 bolhas + exemplos do jeito do Daniel escolhidos por ele (seção "Meu jeito de escrever").
- Testes: `natural-v3.test.mjs` (7), `style-routes.test.mjs` (4) e ajustes em `natural-reply.test.mjs`; 10 respostas a "oi" com 10 aberturas diferentes; modelo teimoso envia uma vez só; conversa sintética com exemplos de estilo; 2 bolhas em ordem, digitando até o fim, falha na 2ª bolha não duplica. Navegador: `e2e-style.mjs` 4/4 e `e2e-auto.mjs` 22/22.

## Resultado

- `pnpm test`: 146/146; `tsc`: sem erros; `oxlint`: sem avisos nos arquivos novos/alterados; `vite build`: ok.
- Navegador: 51/51, console limpo (as respostas 503/502 provocadas de propósito em 2.15/2.16 são ignoradas).

## Não testado / pendente

- `agy` real e Evolution real (webhook real, `remoteJidAlt` ao vivo): só fixtures.
- Configurar o webhook na Evolution e `EVOLUTION_WEBHOOK_SECRET` no serviço (ver README); até lá a sugestão automática fica inativa.
- Decisão registrada: "Ligar sugestões" numa conversa vale como autorização do contato para o rascunho automático (as etiquetas/lista de permitidos continuam valendo para "Sugerir resposta" manual). A chave geral do atendente continua mandando.
