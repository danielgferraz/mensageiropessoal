# Roadmap 06/11/2026 — passos 1 a 4 (entrega local)

Estado: implementado e validado localmente. Sem commit, sem push e sem publicação (autorização desta rodada: apenas implementação local). A árvore de trabalho também contém, ainda sem commit, a feature de notas internas da rodada anterior.

## Passo 1 — Scrollbars
`src/main.css`: barra de 6px, trilha transparente, thumb `#374248` com raio total, hover `#4a565d` (WebKit) e `scrollbar-width: thin; scrollbar-color: #374248 transparent` (Firefox). `.no-scrollbar` preservado.
Evidência: no navegador, o contêiner rolável das Configurações retornou `scrollbarWidth: thin` e `scrollbarColor: rgb(55, 66, 72) rgba(0, 0, 0, 0)`.

## Passo 2 — Conversas duplicadas @lid / @s.whatsapp.net
Causa confirmada em dados reais da Evolution (amostra local `chats_raw.json`, lida só pela estrutura): a linha `@lid` traz o telefone em `lastMessage.key.remoteJidAlt`. `parseChats` tratava `@lid` e `@s.whatsapp.net` como conversas distintas.
- `src/lib/jids.ts`: identidade canônica (telefone quando conhecido, senão o JID), aliases, formatação de telefone, migração de chaves.
- `parseChats` agrupa por id canônico: soma não lidas, mantém a última mensagem mais recente, junta foto/pushName. Um `@lid` sem telefone conhecido fica isolado (nunca funde por nome ou foto).
- Mensagens: consulta o telefone e cada alias e une por id; envio sempre ao id canônico.
- Dados locais (etiquetas, estágios do CRM, contatos salvos, notas) gravados sob um `@lid` migram para o id canônico quando o telefone aparece. Fixar/arquivar/etiquetas da conversa são herdados.
- Evidência: 9 testes novos em `tests/jids.test.mjs`; no navegador, o par duplicado apareceu como uma só conversa (+55 11 99999-0001, 1 não lida, última mensagem mais recente).

## Passo 3 — Contatos x conversas avulsas
- `Conversation` separado de `Contact`. Contatos e pipeline só contêm quem foi salvo; persistência nova `wa_clone_saved_contacts`.
- Conversa avulsa mostra só o telefone formatado (+55 11 98888-7777), como o WhatsApp. Sem telefone conhecido: nome público ou "Número não identificado".
- Ação explícita "Salvar como contato" (barra no chat, menu do chat e diálogo). Filtro "Contatos" na lista; busca também por telefone.
- Evidência: no navegador, 4 conversas avulsas apareciam sem ir ao filtro Contatos; após salvar uma, só ela apareceu em Contatos, a barra sumiu e a aba Nota interna ficou disponível.

## Passo 4 — Atendente (Antigravity Copilot)
- Servidor: `server/copilot.mjs` (configuração, guardrails, prompt, filtro de saída, auditoria) e `server/rag.mjs` (base NebrIA somente leitura). Rotas admin: `GET/PUT /copilot/config`, `GET /copilot/audit`, `POST /copilot/suggest`.
- Fechado por padrão: desligado, em pausa, modo sugestão, ninguém permitido. Modo automático recusado pelo servidor (precisa de `COPILOT_ALLOW_AUTOMATIC=1`, que ainda não envia nada). O servidor só gera rascunhos; nenhuma rota do atendente chama o envio do WhatsApp.
- Guardrails aplicados no servidor: pausa geral, lista de contatos e etiquetas, só contatos salvos, sem grupos, horário de atendimento, limite por hora/contato e por dia, palavras de passagem ao humano, temas bloqueados, filtro de saída (CPF, CNPJ, cartão, e-mail, telefone de terceiros, link fora da lista, senha/chave/token), resposta `[ENCAMINHAR]`.
- Prompt versionado; texto de clientes e documentos tratado como dado; notas internas nunca entram.
- Auditoria JSONL (decisão, motivo, fontes, usuário); não grava o texto das conversas nem do rascunho.
- RAG: lê `NEBRIA_DIR` somente leitura; só pastas 01–05 e documentos com a linha `Status: Aprovado`; ignora rascunhos, 06_Referencias, 07_RAG, links simbólicos e linhas com credenciais. Hoje a base real não tem documento aprovado, então o atendente encaminha a dúvida.
- Interface: aba "Atendente" em Configurações (ligar, pausa geral imediata, modo, contatos/etiquetas, limites, guardrails, estado da base, auditoria) e "Sugerir resposta (atendente)" no chat, que mostra o rascunho com fontes para "Usar no campo" ou descartar.
- Evidência: 9 testes em `server/copilot.test.mjs` e 6 em `server/copilot-routes.test.mjs`; no navegador, salvar configuração persistiu no servidor, a base listou 1 documento aprovado e o pedido de rascunho sem `agy` voltou "O Antigravity não respondeu" (sem texto inventado).

## Validação
- 66/66 testes (era 51 + 15 novos) em `npm test` e em Docker `node:22-alpine --network none`.
- `tsc`, `oxlint` (sem avisos novos nos arquivos alterados) e `vite build` aprovados.
- Navegador isolado (fixture local): contador de envios do upstream permaneceu 0. Layout 360px conferido; corrigidos tabs apertadas e botão Salvar coberto pelo botão flutuante.
- Limpeza: localStorage, sessionStorage, caches e service workers da origem de teste zerados; aba fechada; servidor da fixture encerrado.

## Não testado / limites
- Rascunho real com `agy` e envio a destinatário real (nenhum envio feito).
- Pedido ao Infra pendente: amostra sanitizada de `findChats` e se `findMessages` devolve mensagens por `@lid` e por telefone. O código consulta os dois e une, então funciona nos dois casos.
- Contatos salvos e configurações de interface continuam locais ao navegador; a configuração do atendente fica no servidor.
- Publicar exige: copiar `server/*.mjs` e `dist`, definir `NEBRIA_DIR` na VPS (a base hoje está só no PC do Daniel) e, opcionalmente, `COPILOT_DATA_DIR`; `server/data/` está no `.gitignore`.
- Havia um `chats_raw.json` (cópia crua de chats reais, UTF-16) na raiz do repositório, criado fora desta entrega. Foi adicionado ao `.gitignore` e não foi removido nem commitado. Recomendo apagá-lo.
