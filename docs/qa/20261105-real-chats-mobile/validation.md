# Mensageiro Pessoal — validação e limpeza local

## Implementação
- Conversas e mensagens reais via proxy Evolution v2; seleção automática da instância WA conectada, com fallback para outra instância open.
- Lista em polling de 5 s e conversa aberta em 3 s, sem sobreposição de requisições. Histórico em páginas de 50, ordenação e deduplicação por key.id.
- Texto enviado somente pela API autenticada; confirmações refletem o servidor. Rascunho preservado em falha; sem respostas, entregas ou leituras simuladas.
- Mobile: lista/chat em tela única, menu recolhível com foco e Escape, visualViewport, safe areas e controles principais de 44 px.
- Backend admin: credenciais Evolution fora do código e fora da resposta de instâncias, validação de JIDs individuais/grupos/LID, timeouts, no-store, proteção de caminhos estáticos.

## Testes e evidências
- 29 testes Node aprovados: proxy/autorização, adaptação/paginação/deduplicação/status e 8 cenários da limpeza seletiva.
- Os mesmos 29 testes passaram em Docker node:22-alpine, com --network none.
- TypeScript, lint sem erros (avisos legados) e pnpm build aprovados.
- Smoke Docker: health200 e API sem autenticação401.
- Navegador com upstream fictício: envio, recebimento por polling, histórico, erro com rascunho preservado, estados vazio/desconectado/parcial e bloqueio não-admin403.
- Layouts em320/390/768/1440 px e área reduzida390x400: ver browser-observations.json e design-evidence.json. Checker da skill aprovado.
- Complemento de limpeza: tela Configurações conferida em390x844 no bundle index-Ccnknqgn.js; sem orientação para restaurar exemplos.

## Limpeza
- Removidos mockData.ts, onboarding demonstrativo e seeds CRM/etiquetas de contatos/log inicial.
- Migração no boot remove somente IDs fixos de demonstração dos dados antigos do navegador; preserva JIDs reais, registros manuais, perfil editado, autenticação e configurações.
- Etiquetas, respostas rápidas e estágios padrão permanecem como configuração útil; não representam mensagens ou clientes fictícios.
- Origem de QA http://localhost:3334: localStorage=0, sessionStorage=0, caches=0, serviceWorkers=0 após limpeza verificada pelo navegador.
- Aba e container mensageiro-ui-qa fechados/removidos. Registros sintéticos eram somente do servidor de testes em memória; não houve criação de dados na VPS.
- Fixtures de regressão permanecem apenas no código de testes; o pacote de produção contém somente dist, servidor, README e manifesto.
- manifest.json não rastreado, criado fora desta edição, foi preservado.

## Produção e limites
- Infra informou Evolution v2.3.7 e confirmou EVOLUTION_APIKEY no ambiente systemd. Os formatos sanitizados enviados correspondem aos adaptadores implementados.
- Publicação do frontend final confirmada diretamente por este agente: os 10 arquivos dist da URL pública respondem200 e os SHA256 coincidem com o pacote clean do commit84573e7. Ver public-verification-clean.json.
- API pública sem autenticação confirmada401. Infra informou serviço ativo, WAopen, backup preservado e hash do backend a610418acf735b05a6b8e85166b7532fbf7f2eb44521a777bfa0150e6f1f5515; essas observações da VPS são relatadas pelo Infra.
- Ainda aguardados os smoke tests autenticados do proxy na VPS: admin200 em instâncias/chats/histórico e não-admin403. O retorno inicial do Infra não inclui esses testes.
- Não houve envio externo para testes: destinatário não foi especificado. Teclado físico iOS/Android e instalação standalone não testados; somente redução de viewport.
- Mídias recebidas têm resumo textual; envio de mídia/áudio, criação de grupos e reações remotas permanecem indisponíveis.
- Notas, etiquetas e CRM permanecem locais ao navegador nesta entrega.
- A chave Evolution foi removida do código corrente, mas a chave antiga permanece no histórico Git. Infra deve planejar a rotação sem quebrar outros consumidores.
