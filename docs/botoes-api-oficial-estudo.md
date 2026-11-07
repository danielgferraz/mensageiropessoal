# Botões que chegam de verdade: API oficial do WhatsApp, modelo do Chatwoot e alternativas

Estudo (somente leitura, nada implementado, nada alterado em produção). Data: 07/11/2026. Pedido do usuário: "procura no Chatwoot, acho que lá eles têm um modelo de botões que funcionam".

## Recomendação

**Manter o texto numerado como padrão no número pessoal agora. Se o usuário quer botão que chegue de verdade, fazer um piloto com um NÚMERO NOVO de teste na API oficial (instância Evolution `WHATSAPP-BUSINESS` em paralelo à instância atual), sem tocar no número pessoal. Migrar o número principal só depois de ver o piloto funcionando, e só com aval explícito dele.** Em paralelo, vale um ajuste barato no construtor: o campo `description` por botão e o formato de saída "plugável" (seção 3).

Por quê: o botão do Chatwoot funciona porque roda na API oficial (Cloud API), não por um truque. No canal que usamos (Baileys, não oficial) os botões dependem de comportamento que o WhatsApp muda sem aviso. A migração tem custo, regras (janela de 24 h, templates) e risco para o número, por isso o caminho de menor risco é testar fora do número principal.

## 1. O que o Chatwoot faz (fonte: doc oficial deles, trazida pelo Verificador)

- `content_type: "input_select"` com `content_attributes.items[{title, value, description}]`; "WhatsApp list messages use description as the row subtitle". Ou seja, o "modelo de botões" é a **list message / interactive message da API oficial**.
- `template_params` para templates aprovados (botões `url` e `copy_code`).
- Canais de WhatsApp na doc deles: Cloud, Twilio e 360Dialog. Regra de saída: só template aprovado depois de 24 h da última mensagem do cliente. **Não há canal Baileys.**

## 2. Migrar para a API oficial (viabilidade)

**O que a Meta exige** ([get-started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started), [phone-numbers](https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers)):

| Item | Fato verificado | Observação |
| --- | --- | --- |
| Conta | portfólio empresarial (Meta Business), app de desenvolvedor, WABA | |
| Verificação do negócio | novos portfólios ficam "limitados a 2 números", sobem para 20 "se o negócio for verificado" | se a verificação é obrigatória para começar **não ficou claro** nas páginas lidas |
| Nome de exibição | obrigatório e passa por revisão (`name_status`) | regras exatas de aprovação **não verificadas** |
| Número | seu, com código de país/área, que receba SMS/ligação | PIN de verificação em duas etapas obrigatório |
| Número em uso no app | "Numbers already in use with WhatsApp cannot be registered unless they are deleted first" | **na via normal, o número deixa de funcionar no app comum**: a página é ambígua ("podem ser usados para ligação e SMS, mas não com o WhatsApp") |
| Exceção: **Coexistência** | mesmo número no app **WhatsApp Business** + API ([doc Meta](https://developers.facebook.com/docs/whatsapp/embedded-signup/custom-flows/onboarding-business-app-users)) | exige app Business 2.24.17+, onboarding por Tech Provider/Solution Partner via Embedded Signup (não é o cadastro direto token-a-token que a Evolution usa), grupos não sincronizam, 6 meses de histórico, sem mensagens temporárias/ligações no número com API. Brasil: **listado por fornecedores, não pela página da Meta** |

**Evolution 2.3.7 desta VPS:** o código do canal WhatsApp Business existe no bundle (o Infra viu `templateMessage` implementado só nesse canal e "Method not available" nos canais Evolution/Business para outras rotas). A configuração é token permanente + `number id` + `business account id`, `integration: "WHATSAPP-BUSINESS"`, `qrcode: false`, webhook da Meta em `API_URL/webhook/meta` e `WA_BUSINESS_TOKEN_WEBHOOK` ([doc Evolution, via busca](https://doc.evolution-api.com/v2/en/integrations/cloudapi)). A doc de `sendButtons` diz que botões "são totalmente suportados só no conector Cloud API" (resumo de busca; as páginas da Evolution devolveram 404 na leitura direta, então **não verifiquei os corpos de `sendButtons`/`sendList` do canal Business**).

**Limites dos botões na API oficial** ([botões de resposta](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-reply-buttons-messages), [lista](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-list-messages)): botões de resposta até **3**, rótulo até 20 caracteres, corpo até 1024; lista até 10 linhas no total, título de linha até 24, descrição da linha até 72, corpo até 4096. São mensagens **não-template**: só dentro da janela de 24 h (a página de início diz que só nessa janela se envia mensagem sem template; que botões valham só nela é inferência).

**O que muda no nosso sistema (estimativa, nada feito):**

| Parte | Hoje (Baileys) | Canal oficial |
| --- | --- | --- |
| Entrada de mensagens | webhook `messages.upsert` | a Evolution traduz o webhook da Meta; o **formato do clique em botão/lista** (`interactive.button_reply`/`list_reply`) precisa ser conferido no piloto (nosso roteador já lê `buttonsResponseMessage`, `listResponseMessage` e `nativeFlow`) |
| Janela de 24 h | não existe | o app precisa saber a hora da última mensagem do cliente por conversa e **trocar para template** fora dela; hoje não guardamos isso |
| Templates | não há | criar e aprovar na Meta (categoria utilidade/marketing/autenticação); botões de template: URL/copiar código/resposta rápida |
| "Digitando…" | `sendPresence` | a API oficial tem recurso próprio de indicador de digitação; **não verificado** |
| Mídia | envio por Baileys | upload/ID de mídia na Cloud API; o app hoje nem envia mídia |
| Número | pessoal, app comum no celular | dedicado (ou coexistência) |

## 3. Reaproveitar o modelo do Chatwoot já (vale o esforço?)

O nosso construtor já tem rótulo, apelidos e ações (equivale a `title`/`value`). Faltam duas coisas pequenas e **úteis mesmo sem a API oficial**:

1. **`description` opcional por botão** (≤ 72 caracteres): vira "subtítulo" na lista oficial e uma linha extra no texto numerado ("2 - Orçamento: prazo e valores").
2. **Saída plugável por canal**: já temos `renderText` e `nativePlan`; basta formalizar a interface `render(menu, items, channel)` com os formatos `text`, `baileys-buttons/list` (hoje) e `cloud-interactive` (futuro: botões ≤3 / lista ≤10, corpo ≤1024/4096, `id` do item).

Esforço estimado: **meio dia**, baixo risco, nenhuma mudança de comportamento hoje. **Veredito: vale como preparo barato, mas é cosmético para o problema real (entrega)**; não resolve nada sozinho. Fazer só se o usuário decidir seguir para o piloto na API oficial (ou se quiser a descrição no texto numerado).

## 4. Custo na prática (Brasil)

Fonte oficial: [Pricing on the WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) (a página diz refletir as mudanças de 01/10/2026; não mostra data de publicação).

- Modelo: **por mensagem entregue**, só mensagens da empresa para o usuário; as do usuário para a empresa não são cobradas. Categorias: marketing, utilidade e autenticação (templates); serviço (não-template, dentro da janela); Meta Business Agent (tokens, só USD).
- Gratuito: **as primeiras 1.000 mensagens de serviço por mês por número**, sem acumular; janela de entrada gratuita de até 7 dias para anúncios click-to-WhatsApp (somente Android/iOS). Depois da franquia, mensagens de serviço são cobradas pela tabela (mudança de 01/10/2026). Mensagens de **utilidade dentro da janela deixaram de ser gratuitas** em 01/10/2026 (tipo de cobrança passou de `free_customer_service` para `regular`). Sem forma de pagamento cadastrada, a Meta entrega até a franquia e **deixa de entregar** depois.
- Fora da janela de 24 h: só template aprovado (e o usuário precisa ter dado opt-in).
- Moeda: contas em **BRL** faturadas pela Facebook Brasil; tabela BRL "lançada em 01/07/2026"; contas em dólar precisam migrar para BRL até **30/06/2027**, e a partir de 01/07/2027 a Meta para de entregar mensagens de contas não-BRL. **Os valores em reais da tabela oficial não apareceram nas páginas lidas** (só rótulos de CSV/PDF).
- Única cifra oficial vista para o Brasil: **utilidade/autenticação ≈ 0,68 ¢ por mensagem (US$)**. Um revendedor publica **marketing R$ 0,3217 e utilidade/autenticação R$ 0,0350** ([ChatMaxima](https://chatmaxima.com/whatsapp-api-pricing/brazil/), **não oficial**); os números são coerentes entre si, mas **confirme na tabela BRL da Meta antes de decidir**.
- Ordem de grandeza para o caso de uso (atendimento iniciado pelo cliente): quase tudo fica dentro da janela, ou seja, serviço (grátis até 1.000/mês por número) e o menu em botões é mensagem de serviço. Custo relevante só aparece com marketing (R$ ~0,32 por envio, não oficial) e com templates fora da janela. Há ainda a taxa do provedor/BSP, se houver um (não pesquisada).

## 5. Caminhos intermediários (fontes e confiança)

| Caminho | Confiabilidade | Observação |
| --- | --- | --- |
| **Enquete (`sendPoll`) no Baileys** | média; **não verificada** a leitura do voto pelo webhook | rota existe e monta `pollCreationMessage` (Infra). É mensagem nativa e estável, mas o voto chega criptografado e o servidor precisa decifrar; serve para escolha, não abre link. Dá para testar com o próprio número |
| **Coexistência** (mesmo número no app Business + API) | boa, com ressalvas acima | exige provedor/Tech Provider (ex.: 360dialog); mantém o celular; grupos não sincronizam |
| **Número dedicado só para menus/automação na Cloud API** | alta | o pessoal continua no Baileys; é o "piloto" recomendado |
| Forks pagos do Baileys para botão ([#1620](https://github.com/evolution-foundation/evolution-api/issues/1620)) | baixa | mantidos por terceiros, dependem do app do WhatsApp e aumentam o risco de bloqueio do número |
| Link `wa.me` com texto pré-preenchido | alta, mas **não é botão** | só leva o cliente a mandar uma frase; útil em site/anúncio, não dentro da conversa |

Risco geral do canal atual: usar WhatsApp por cliente não oficial (Baileys) para automação contraria os termos do WhatsApp e pode levar a bloqueio do número (conhecimento geral, **sem fonte lida neste estudo**).

## 6. Riscos

- Migrar o número principal pela via normal tira o número do app comum; na coexistência há perdas (grupos, mensagens temporárias, ligações no número com API).
- Janela de 24 h: sem template aprovado, nada de proativo fora dela; templates têm aprovação e custo.
- Dependência de provedor/Meta: conta, verificação, nome de exibição e política podem bloquear ou atrasar.
- O patch manual de 24/10 na Evolution continua frágil (se o container for recriado, some) e não faz parte de nenhum caminho oficial.
- Tudo aqui sobre o corpo exato de `sendButtons`/`sendList` do canal Business e sobre o webhook de clique é **a confirmar no piloto**.

## 7. O que o usuário precisa decidir

1. Quer **botão que chegue de verdade** o suficiente para criar uma conta Meta/WABA e (talvez) um número novo? Se não, **ficar no texto numerado**.
2. Se sim: aprovar um **piloto com número novo** (ou o número de teste que a Meta oferece no painel de desenvolvedor, a confirmar), sem tocar no pessoal.
3. Aceita a regra da janela de 24 h e a aprovação de templates para mensagens proativas?
4. Aceita custo por mensagem (confirmar a tabela BRL oficial) e, se houver, a taxa de um provedor?
5. Se quiser manter o celular e o número pessoal juntos com a API: avaliar **coexistência** via provedor (exige app WhatsApp Business).
6. Quer o preparo barato agora (`description` por botão + saída plugável, meio dia)?

Nada será feito sobre número, conta Meta, compra de serviço ou produção sem o aval explícito dele.
