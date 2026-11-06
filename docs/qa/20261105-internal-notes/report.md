# Notas internas no chat — entrega local

## Resultado
Implementado no Mensageiro Pessoal sobre a base main b742abe. A feature está pronta e validada localmente; não foi publicada, commitada ou enviada ao GitHub neste pedido de desenvolvimento.

- Chat individual tem modos separados Mensagem e Nota interna. A nota é salva localmente; nenhum handler de envio WhatsApp é chamado.
- Timeline mescla notas e mensagens por data de criação, com estilo âmbar, indicação Não enviada ao WhatsApp, autor e data/hora. Editar não muda autor original nem posição cronológica.
- Notas novas usam UUID e data ISO; notas antigas com data pt-BR são preservadas. Sem autoria antiga registrada, aparece Autor não registrado.
- Detalhes do contato e modal do CRM oferecem criar, ler, editar e excluir; confirmação para excluir. Texto/Ver no chat abre a conversa, fecha os detalhes, remove filtro de busca e rola/foca a nota.
- Gravação acontece antes de confirmar sucesso. Quota, bloqueio ou dados locais inválidos geram erro preservando os dados e o rascunho.

## Evidências
- pnpm test: 43/43 aprovados, incluindo 14 testes novos de notas.
- Os mesmos 43 testes passaram em Docker node:22-alpine com --network none.
- pnpm exec tsc --noEmit -p tsconfig.app.json, pnpm lint e pnpm build aprovados. Lint mantém avisos legados; build avisa sobre bundle maior que 500 kB.
- Integração no navegador com upstream local: CRUD, reload, foco pelo drawer e modal CRM, nota legada, erro de escrita, preservação de armazenamento inválido e isolamento de formulário.
- Contador de envios da fixture permaneceu 0 após CRUD. Controle positivo em modo Mensagem chegou a 1; operações de notas seguintes não elevaram o contador. Não houve mensagens externas.
- Revisão visual em 390x844,320x568 e1440x900; artefatos browser-integration.json e design-evidence.json documentam resultados e revisões do navegador.
- Bundle validado: index-BK8-5c34.js / index-BFEI3TBT.css.

## Limpeza e preservação
Origem de QA localhost:3334 zerada: localStorage 0, sessionStorage 0, caches 0 e serviceWorkers 0; aba fechada e container mensageiro-notes-qa removido. Dados de teste eram apenas locais, em memória ou no navegador isolado. Nenhuma alteração de dados/banco/WhatsApp na VPS.

O arquivo manifest.json não rastreado preexistente foi preservado. A suíte contém fixtures explícitas para regressão; elas não foram inseridas no app nem em produção.

## Arquivos principais
- src/lib/contact-notes.ts e tests/contact-notes.test.mjs: validação, datas, autoria, armazenamento e composição da timeline.
- src/context/WhatsAppContext.tsx: mutações locais e pedido de foco.
- src/components/ChatArea.tsx: compositor isolado e timeline.
- src/components/ContactNotesTab.tsx, ContactDetailsDrawer.tsx e ContactDetailsModal.tsx: CRUD e acesso à nota.
- src/pages/Index.tsx e src/types/whatsapp.ts: navegação e metadados.
- tests/browser-fixture.mjs: contador de envios para validação isolada.

## Limites e próximo passo
O armazenamento continua neste navegador, sem sincronização entre dispositivos. Limpar seus dados locais remove as notas. Teclado físico iOS/Android e instalação standalone não testados.

Próximo passo: revisão e autorização específica para commit/publicação desta feature, se desejada. Não há bloqueio técnico identificado na validação local.
