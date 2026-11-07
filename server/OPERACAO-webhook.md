# Webhook da Evolution → Mensageiro (sugestão automática de RASCUNHO)

Ativado em 07/11/2026 às 02:21 UTC (06/11, 23:21 em Brasília).

## Como está

- **Instância:** WA. Só o evento `MESSAGES_UPSERT`, com `byEvents=false` e `base64=false`.
- **URL:** `http://172.20.0.1:3333/api/webhook/evolution`.
  - `172.20.0.1` é o gateway da rede Docker `evolution_internal`, ou seja, o próprio host visto de dentro do container.
  - `127.0.0.1` não serve, porque dentro do container aponta para o próprio container.
  - O tráfego não passa pelo nginx.
- **Segredo:** a Evolution manda o header `x-webhook-secret`. O valor fica em `/etc/mensageiro/webhook.env` (root, 0600) e entra pelo drop-in `/etc/systemd/system/mensageiro.service.d/20-webhook.conf`. Ele não fica no git, no bundle nem em log.
- **O que o endpoint responde:**
  - 503 se o segredo não estiver definido;
  - 401 se o segredo estiver errado ou faltando;
  - 200 se estiver certo (`{ ok, received }`).
- **O que ele faz:** só agenda rascunhos, e só para conversas com "sugestões ligadas" (`ai_enabled=true`, `mode=suggestion`). Mensagens `fromMe`, de grupo, de broadcast ou de conversas sem opt-in não geram nada. Nunca envia mensagem. `COPILOT_ALLOW_AUTOMATIC` continua desligado.
- **Também acessível pelo público:** `https://techagenda.app.br/mensageiro/api/webhook/evolution`, que exige o mesmo segredo (sem ele, 401).

## Webhook anterior (substituído)

Antes, a WA apontava para `http://infra-api-1:8000/api/v1/webhooks/evolution`, com os eventos `MESSAGES_UPSERT` e `CONNECTION_UPDATE` e 1 header. Esse container não existe mais, e a Evolution registrava `ENOTFOUND` a cada evento. A configuração completa, header incluído, foi guardada em `/etc/mensageiro/webhook-WA.bak-20261107.json` (root, 0600).

## Rollback

```sh
# 1) Desligar o webhook na Evolution, ou restaurar o anterior a partir do backup
K=$(sudo systemctl show mensageiro -p Environment | grep -o "EVOLUTION_APIKEY=[^ ]*" | cut -d= -f2)
curl -s -X POST -H "apikey: $K" -H 'Content-Type: application/json' \
  -d '{"webhook":{"enabled":false,"url":"http://172.20.0.1:3333/api/webhook/evolution","events":["MESSAGES_UPSERT"]}}' \
  http://127.0.0.1:8080/webhook/set/WA
# 2) Tirar o segredo do Mensageiro (o endpoint volta a responder 503)
sudo rm /etc/systemd/system/mensageiro.service.d/20-webhook.conf
sudo systemctl daemon-reload && sudo systemctl restart mensageiro
# (opcional) sudo rm /etc/mensageiro/webhook.env
```
