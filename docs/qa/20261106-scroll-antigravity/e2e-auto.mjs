// QA de navegador do ENVIO AUTOMÁTICO (fixture isolado: Evolution, banco e agy falsos; nenhum envio real).
import fs from 'node:fs';
import { chromium } from 'playwright-core';
const BASE = 'http://127.0.0.1:3355/mensageiro/';
const UP = 'http://127.0.0.1:4455';
const results = []; const issues = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (p, body) => fetch(UP + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).then((r) => r.json());
const fx = () => fetch(UP + '/__state').then((r) => r.json());
const admin = (p, method, body) => fetch(`http://127.0.0.1:3355/mensageiro/api${p}`, { method, headers: { Authorization: 'Bearer qa-admin', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());
const J3 = '5511999990003@s.whatsapp.net';

const browser = await chromium.launch({ executablePath: 'C:/Users/User/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error') issues.push(m.text()); }); page.on('pageerror', (e) => issues.push(e.message));
await page.goto(BASE);
await page.fill('input[type=email]', 'qa@example.test'); await page.fill('input[type=password]', 'qa-only');
await page.getByRole('button', { name: 'Entrar no Mensageiro' }).click();
await page.getByText(/99999-0003/).first().click();
await page.waitForSelector('[data-testid=messages-viewport]'); await sleep(600);
const status = () => page.getByTestId('ai-status').innerText();

// 1. UI: opt-in por conversa, com confirmação
await page.getByRole('button', { name: 'Ligar sugestões' }).click();
await page.getByTestId('ai-status').filter({ hasText: 'Só sugestão' }).waitFor({ timeout: 5000 });
check('A1 conversa começa em "Só sugestão", sem selo Automático', /Só sugestão/.test(await status()) && (await page.getByTestId('ai-auto-badge').count()) === 0);
await page.getByRole('button', { name: 'Ativar resposta automática' }).click();
await page.getByRole('alertdialog').waitFor();
check('A2 ativar exige confirmação explícita (diálogo)', /enviar respostas sozinha/.test(await page.getByRole('alertdialog').innerText()));
await page.getByRole('button', { name: 'Cancelar' }).click(); await sleep(300);
check('A3 cancelar não ativa', (await fx()).state.conv[J3].autoReply !== true && (await page.getByTestId('ai-auto-badge').count()) === 0);
await page.getByRole('button', { name: 'Ativar resposta automática' }).click();
await page.getByRole('button', { name: 'Sim, ativar' }).click();
await page.getByTestId('ai-auto-badge').waitFor({ timeout: 5000 });
check('A4 após confirmar: "IA responde automaticamente nesta conversa" + selo Automático', /IA responde automaticamente nesta conversa/.test(await status()));
await page.screenshot({ path: 'shot-auto-on.png' });

// 2. envio automático real (para o fixture)
await post('/__push', { jid: J3, text: 'Qual o prazo de entrega do serviço?' });
for (let i = 0; i < 60 && (await fx()).sent.length < 1; i++) await sleep(250);
let s = await fx();
check('A5 a IA enviou sozinha UMA resposta, para o contato certo, com o texto aprovado', s.sent.length === 1 && s.sent[0].number === J3 && /cinco dias úteis/.test(s.sent[0].text), JSON.stringify(s.sent));
check('A6 nada fica pendente (o rascunho foi usado) e há registro de autoria IA', s.state.sugs.filter((x) => x.jid === J3 && x.status === 'pending').length === 0 && Object.values(s.state.conv[J3] ? { a: 1 } : {}).length > 0);
await page.getByText(/cinco dias úteis/).last().waitFor({ timeout: 8000 });
await sleep(7000);
check('A7 a mensagem enviada aparece na conversa com o selo "IA"', (await page.locator('span[title^="Texto escrito pela IA"]').count()) >= 1);
await page.screenshot({ path: 'shot-auto-sent.png' });

// 3. segunda mensagem dentro da janela: só sugestão
await post('/__push', { jid: J3, text: 'E o prazo para o segundo serviço de entrega?' });
for (let i = 0; i < 40; i++) { s = await fx(); if (s.state.sugs.some((x) => x.jid === J3 && x.status === 'pending')) break; await sleep(250); }
check('A8 segunda mensagem dentro da janela de 60 s NÃO é enviada, vira sugestão', s.sent.length === 1 && s.state.sugs.filter((x) => x.jid === J3 && x.status === 'pending').length === 1);
const audit = (await admin('/copilot/audit', 'GET')).entries;
check('A9 auditoria registra envio (com id da mensagem) e o motivo de ter ficado só sugestão, sem texto', audit.some((e) => e.action === 'auto_sent' && e.messageId) && audit.some((e) => e.action === 'auto_skip' && e.code === 'rate_window') && !JSON.stringify(audit).includes('cinco dias'));

// 4. humano responde pelo celular -> pausa sozinha
await post('/__push', { jid: J3, text: 'Resposta do Daniel pelo celular', fromMe: true });
await page.getByTestId('ai-auto-badge').waitFor({ state: 'detached', timeout: 15000 });
check('A10 humano respondeu: a conversa volta sozinha para "Só sugestão"', /Só sugestão/.test(await status()) && (await fx()).state.conv[J3].autoReply === false);

// 5. kill switch
await page.getByRole('button', { name: 'Ativar resposta automática' }).click();
await page.getByRole('button', { name: 'Sim, ativar' }).click();
await page.getByTestId('ai-auto-badge').waitFor({ timeout: 5000 });
await admin('/copilot/config', 'PUT', { paused: true });
const before = (await fx()).sent.length;
await post('/__push', { jid: J3, text: 'Mais uma pergunta sobre o prazo de entrega?' });
await sleep(7000);
check('A11 atendente em pausa geral: nada é enviado', (await fx()).sent.length === before);
await admin('/copilot/config', 'PUT', { paused: false });

// 6. assumir
await page.getByRole('button', { name: 'Assumir' }).click();
await page.getByTestId('ai-status').filter({ hasText: 'Assumida por humano' }).waitFor();
check('A12 assumir a conversa desliga o automático', (await fx()).state.conv[J3].autoReply === false && (await page.getByTestId('ai-auto-badge').count()) === 0);
await page.getByRole('button', { name: 'Devolver para a IA' }).click(); await sleep(600);
check('A13 devolver para a IA NÃO reativa o automático (continua só sugestão)', /Só sugestão/.test(await status()));

// 7. outra conversa não é afetada
await page.getByText(/99999-0001/).first().click(); await page.waitForSelector('[data-testid=messages-viewport]'); await sleep(800);
check('A14 outra conversa não tem automático nem selo', (await page.getByTestId('ai-auto-badge').count()) === 0);
await page.getByRole('button', { name: 'Ligar sugestões' }).click(); await sleep(500);
check('A15 conversa recém-ligada começa só em sugestão (não herda o opt-in)', /Só sugestão/.test(await status()));
const sentBefore = (await fx()).sent.length;
await post('/__push', { jid: '5511999990001@s.whatsapp.net', text: 'Qual o prazo de entrega do serviço?' });
await sleep(7000);
check('A16 sem opt-in de envio nessa conversa: nada enviado', (await fx()).sent.length === sentBefore);

check('A99 console limpo', issues.length === 0, issues.slice(0, 3).join(' || '));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} verificações passaram`);
fs.writeFileSync('e2e-auto-results.json', JSON.stringify({ results, issues }, null, 2));
process.exit(failed.length ? 1 : 0);
