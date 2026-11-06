# Mensageiro Pessoal — validação local

- 21 testes Node aprovados, também no Docker isolado sem rede externa.
- TypeScript, lint (sem erros; avisos de código legado) e build aprovados.
- UI exercitada com upstream local: seleção WA, chats individuais/grupo, histórico, polling, envio, falha com rascunho preservado, estados vazio/desconectado e bloqueio não-admin.
- Responsividade e teclado: ver browser-observations.json.
- Build: assets/index-DvDxeoSG.js + assets/index-BUsuLlLS.css.
- Publicação e contrato real Evolution pendentes da validação do Infra.
- Não houve envio externo para testes. Teclado físico iOS/Android não testado.
- A chave Evolution foi removida do código corrente; administrador da VPS deve rotacionar a chave antiga presente no histórico e configurar EVOLUTION_APIKEY no serviço.
