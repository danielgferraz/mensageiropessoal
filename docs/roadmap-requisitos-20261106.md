# Roadmap — requisitos de 06/11/2026 (via Verificador)

Estado: passos 1 a 4 implementados e validados localmente em 06/11/2026, sem commit nem publicação. Relatório: docs/qa/20261106-roadmap-steps-1-4/report.md. Modo automático segue bloqueado; o RAG aguarda documentos aprovados e um caminho da base no servidor.

## Diagnóstico confirmado no código
- `src/lib/evolution.ts` `parseChats`: aceita `@s.whatsapp.net`, `@g.us` e `@lid` e usa o JID como id da conversa. O mesmo contato pode vir como `@lid` (ID interno, ex.: 232143032717332) e como `@s.whatsapp.net` (5515981033446): duas conversas.
- `parseChats` também cria um `Contact` para toda conversa individual. Qualquer chat avulso vira "contato".
- Scrollbars: só existe `.no-scrollbar` em `src/main.css`; não há estilo global.

## Entregas (ordem sugerida)

### 1. Scrollbars (baixo risco, ~0,5 dia)
- CSS global em `src/main.css`: `scrollbar-width: thin; scrollbar-color: #374248 transparent` (Firefox) e `::-webkit-scrollbar` 5px, trilha transparente, thumb `#374248` com raio, hover `#4a565d`.
- Manter `.no-scrollbar`. Conferir mobile (overlay) e tema claro.
- Aceite: captura em sidebar, chat e drawer; nenhum scroll horizontal novo.

### 2. Duplicidade @lid / @s.whatsapp.net (~1–2 dias)
- Passo 0 (leitura, sem alterar): coletar de `findChats` real (instância WA) os campos `remoteJid`, `remoteJidAlt`/`senderPn`/`lastMessage.key.remoteJidAlt`, `pushName`, `profilePicUrl` dos pares duplicados e confirmar qual campo liga `@lid` ao número. Pedir ao Infra a amostra sanitizada.
- Normalização: função `canonicalJid(row)` — se há JID alternativo `@s.whatsapp.net`, ele é o id canônico; `@lid` vira alias. Agrupar linhas pelo canônico, somar `unreadCount`, manter a `lastMessage` mais recente.
- Mensagens: `findMessages` consultar todos os aliases do contato e mesclar por id (`mergeMessages` já deduplica). Envio sempre ao número canônico.
- Sem alternativa conhecida para um `@lid`: manter isolado, rotulado "ID interno", sem inventar número; não fundir só por nome/foto igual.
- Notas, etiquetas e CRM locais: migrar chaves dos aliases para o id canônico (sem perda).
- Aceite: testes unitários com fixtures do par duplicado, grupo e `@lid` sem alternativo; nenhuma conversa duplicada na lista.

### 3. Contato real x interação avulsa (~2 dias)
- Separar `Contact` (cadastrado/salvo) de `Conversation`. `parseChats` deixa de criar contato automaticamente.
- Classificação por conversa: `grupo`, `contato salvo` (nome vindo da agenda/cadastro do app), `desconhecido` (só número/pushName), `ID interno (@lid) sem número`.
- Filtros na lista: Todas / Contatos / Desconhecidos / Grupos / Não lidas; padrão a definir com o usuário.
- Desconhecidos fora do CRM e dos pipelines; ação explícita "Salvar como contato" promove (nome, telefone, etiquetas).
- Aceite: nenhum número avulso entra no CRM sem ação; filtros persistem; testes de classificação.

### 4. Atendente particular Antigravity Copilot (planejamento + estrutura, ~4–6 dias; sem resposta automática ativa na primeira fase)
- Configuração (aba em Configurações, só admin): ligar/desligar global e por contato; modo `sugestão` (padrão — rascunho para o usuário aprovar) e `automático` (só após aprovação explícita futura).
- Guardrails (aplicados no servidor `server/server.mjs`, nunca só no frontend):
  - lista de permitidos por contato/etiqueta; padrão = ninguém;
  - temas permitidos e proibidos; nunca repassar dados de outros contatos, CRM, notas internas, senhas, dados financeiros ou documentos;
  - limite de respostas por hora/contato, horário de atendimento, parada automática e passagem a humano em tema sensível;
  - filtro de saída antes do envio (padrões de CPF, cartão, chaves, links); log de auditoria de cada resposta com a fonte usada;
  - botão de pausa geral.
- RAG com NebrIA: camada `ContextProvider` somente leitura, com raiz de pastas autorizadas e lista de extensões; resultados com trecho e fonte; escopo de acesso por contato (o atendente só recebe contexto marcado como compartilhável). Depende de informações do usuário/Infra: onde o NebrIA guarda os arquivos (caminho/API) e como a indexação é feita. Sem isso, a fase fica só com a interface do provedor e testes com fixtures.
- Integração com `agy` (já no servidor): prompt de sistema fixo e versionado; conteúdo de mensagens de contatos tratado como dado não confiável (defesa contra injeção de prompt).
- Aceite: testes de recusa (tema proibido, contato não permitido, vazamento de outro contato), auditoria visível, nenhuma resposta enviada sem aprovação na fase 1.

## Decisões do usuário (06/11/2026)
1. Contatos e pipeline (CRM) contêm somente contatos adicionados manualmente. Conversas avulsas não entram em nenhum dos dois. Desconhecidos ficam fora por padrão.
2. Contatos/etiquetas permitidos ao atendente IA são configurados dentro da plataforma (padrão: ninguém).
3. NebrIA: pasta `C:\Users\User\Documents\Projetos\NebrIA` (sincronizada pelo Google Drive for desktop em "Computadores > Meu computador > Projetos > NebrIA"). Ainda não há RAG; o Mensageiro roda na VPS, que não enxerga essa pasta. Falta definir como o conteúdo chega à VPS. Indexar só `07_RAG` e conteúdo aprovado; documentos "Rascunho" ficam de fora.

## Pendências anteriores
Notas internas implementadas só localmente (sem commit/publicação). Envio externo e teclado físico mobile não testados.
