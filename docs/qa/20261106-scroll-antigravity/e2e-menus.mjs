// QA de navegador do construtor de menus/botões. Fixture isolado: Evolution, banco e agy FALSOS; nada vai a WhatsApp real.
import fs from 'node:fs';
import { chromium } from 'playwright-core';
const BASE = 'http://127.0.0.1:3355/mensageiro/';
const UP = 'http://127.0.0.1:4455';
const results = []; const issues = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (p, body) => fetch(UP + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).then((r) => r.json());
const fx = () => fetch(UP + '/__state').then((r) => r.json());
const J3 = '5511999990003@s.whatsapp.net';

const browser = await chromium.launch({ executablePath: 'C:/Users/User/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
let expectErrors = false;
page.on('console', (m) => { if (m.type() === 'error' && !expectErrors) issues.push(m.text()); }); page.on('pageerror', (e) => issues.push(e.message));
await page.goto(BASE);
await page.fill('input[type=email]', 'qa@example.test'); await page.fill('input[type=password]', 'qa-only');
await page.getByRole('button', { name: 'Entrar no Mensageiro' }).click();
await page.getByText(/99999-0001/).first().waitFor({ timeout: 10000 });

// ---------- construtor ----------
await page.getByRole('button', { name: /Menus e botões/ }).first().click();
await page.getByTestId('menus-page').waitFor();
check('M1 página "Menus e botões" abre e orienta a criar o primeiro menu', /Nenhum menu ainda/.test(await page.getByTestId('menus-page').innerText()));
await page.getByRole('button', { name: 'Novo menu' }).click();
await page.getByLabel('Nome do menu').fill('Atendimento inicial');
await page.getByLabel('Texto de abertura').fill('Bem-vindo à nossa central de atendimento. Digite 1 para vendas');
await page.getByLabel('Rótulo do botão 1').fill('Digite 1 para vendas');
await sleep(900);
const warn = await page.getByLabel('Pré-visualização').innerText();
check('M2 o editor avisa quando o menu soa como URA corporativa (não bloqueia)', /URA corporativa/.test(warn), warn.replace(/\n/g, ' | ').slice(0, 160));
await page.getByLabel('Texto de abertura').fill('Me conta o que você precisa:');
await page.getByLabel('Rótulo do botão 1').fill('Ver os serviços');
await page.getByLabel('Texto da resposta').first().fill('Faço vídeos e roteiros, {{nome}}. Quer ver exemplos?');
// botão 2: pedir dado + CRM + resposta
await page.getByRole('button', { name: 'Adicionar botão' }).click();
await page.getByLabel('Rótulo do botão 2').fill('Pedir orçamento');
await page.getByLabel('Ação 1 do botão 2').selectOption('ask');
await page.getByLabel('Pergunta').fill('Qual o seu nome?');
await page.locator('[data-testid=menu-item]').nth(1).getByRole('button', { name: 'Adicionar ação' }).click();
await page.getByLabel('Ação 2 do botão 2').selectOption('crm');
await page.locator('[data-testid=menu-item]').nth(1).locator('select').nth(3).selectOption({ label: 'Em contato' }).catch(() => {});
await page.locator('[data-testid=menu-item]').nth(1).getByRole('button', { name: 'Adicionar ação' }).click();
await page.getByLabel('Texto da resposta').last().fill('Anotado, {{nome}}! Já te retorno.');
// botão 3: chamar humano
await page.getByRole('button', { name: 'Adicionar botão' }).click();
await page.getByLabel('Rótulo do botão 3').fill('Falar comigo');
await page.getByLabel('Ação 1 do botão 3').selectOption('handoff');
await sleep(900);
const nativeText = await page.getByTestId('preview-native').innerText();
check('M3 prévia "Botões" mostra os 3 botões como o contato vê', ['Ver os serviços', 'Pedir orçamento', 'Falar comigo'].every((l) => nativeText.includes(l)));
await page.getByRole('tab', { name: 'Texto numerado' }).click();
const textPrev = await page.getByTestId('preview-text').innerText();
check('M4 prévia "Texto numerado": 1 - 2 - 3 e fechamento de conversa', /1 - Ver os serviços\n2 - Pedir orçamento\n3 - Falar comigo/.test(textPrev) && !/digite|prezado/i.test(textPrev), textPrev.replace(/\n/g, ' | '));
await page.getByRole('button', { name: 'Descer botão 1' }).click();
await sleep(700);
check('M5 reordenar (seta) muda a ordem na prévia', /1 - Pedir orçamento\n2 - Ver os serviços/.test(await page.getByTestId('preview-text').innerText()));
await page.getByRole('button', { name: 'Subir botão 2' }).click();
await sleep(700);
check('M6 voltar a ordem', /1 - Ver os serviços\n2 - Pedir orçamento/.test(await page.getByTestId('preview-text').innerText()));
await page.getByTestId('preview-text').getByRole('button', { name: '2', exact: true }).click();
const sim = await page.getByTestId('simulation').innerText();
check('M7 simulação mostra o que o botão faz, sem enviar nada', /Pergunta: “Qual o seu nome\?”/.test(sim) && /Responde: “Anotado/.test(sim) && (await fx()).sent.length === 0 && (await fx()).natives.length === 0, sim.replace(/\n/g, ' | ').slice(0, 200));
check('M7b padrão de fábrica do menu novo é texto numerado', (await page.getByLabel('Modo de envio').inputValue()) === 'text');
await page.getByLabel('Modo de envio').selectOption('native');
check('M8 aviso claro sobre botão nativo silencioso + troca para texto com um clique', /pode ser aceito.*nunca chegar ao contato/.test(await page.getByRole('note').first().innerText()));
await page.getByRole('button', { name: 'usar texto numerado' }).click();
check('M9 um clique troca o menu para texto numerado', (await page.getByLabel('Modo de envio').inputValue()) === 'text');
await page.getByLabel('Modo de envio').selectOption('native');
await page.getByRole('button', { name: 'Salvar', exact: true }).click();
await page.getByText('Menu salvo', { exact: true }).first().waitFor({ timeout: 8000 });
await sleep(500);
check('M10 salvou: aparece na lista com 3 botões e modo nativo', /Atendimento inicial[\s\S]*3 botões · nativo/.test(await page.getByRole('complementary', { name: 'Menus' }).innerText()));
await page.screenshot({ path: 'shot-menus-editor.png' });
// validação do servidor
expectErrors = true;   // o 400 abaixo é provocado de propósito
await page.getByLabel('Rótulo do botão 3').fill('');
await page.getByRole('button', { name: 'Salvar', exact: true }).click();
await page.getByRole('alert').first().waitFor({ timeout: 8000 });
check('M11 erro de validação do servidor é mostrado em português e nada é salvo pela metade', /rótulo/i.test(await page.getByRole('alert').first().innerText()));
await page.getByLabel('Rótulo do botão 3').fill('Falar comigo');
expectErrors = false;
await page.getByRole('button', { name: 'Salvar', exact: true }).click();
await page.getByText('Menu salvo', { exact: true }).first().waitFor({ timeout: 8000 });

// ---------- enviar na conversa ----------
await page.getByRole('button', { name: /Conversas/ }).first().click();
await page.getByText(/99999-0003/).first().click();
await page.waitForSelector('[data-testid=messages-viewport]'); await sleep(500);
await page.getByTitle('Mais opções do chat').click();
await page.getByRole('menuitem', { name: /Enviar menu/ }).click();
await page.getByLabel('Menu a enviar').selectOption({ label: 'Atendimento inicial (3 botões)' });
await page.getByTestId('send-preview').waitFor();
check('M12 diálogo de envio mostra a prévia exata e começa em "botões do WhatsApp"', /1 - Ver os serviços/.test(await page.getByTestId('send-preview').innerText()) && (await page.getByLabel('Como enviar').inputValue()) === 'native');
check('M13 nada foi enviado antes do clique', (await fx()).natives.length === 0 && (await fx()).sent.length === 0);
await page.getByRole('button', { name: 'Enviar menu', exact: true }).click();
await page.getByTestId('menu-session-bar').waitFor({ timeout: 10000 });
let s = await fx();
check('M14 menu nativo saiu pela rota sendButtons da Evolution (3 botões, ids m:menu:item)', s.natives.length === 1 && s.natives[0].route === 'sendButtons' && s.natives[0].body.number === J3 && s.natives[0].body.buttons.length === 3 && s.natives[0].body.buttons.every((b) => /^m:\d+:\d+$/.test(b.id) && b.type === 'reply'), JSON.stringify(s.natives[0]?.body?.buttons?.map((b) => b.displayText)));
await page.getByRole('button', { name: 'Reenviar como texto' }).waitFor({ timeout: 8000 });   // o diálogo acabou de fechar (aria-hidden por instantes)
const bar = await page.getByTestId('menu-session-bar').innerText();
check('M15 faixa "menu em andamento" avisa que o botão pode não chegar e oferece reenviar como texto', /botões do WhatsApp/.test(bar) && /pode ser aceito e não chegar/.test(bar) && (await page.getByRole('button', { name: 'Reenviar como texto' }).count()) >= 1);
check('M15b só uma faixa de sessão por conversa', (await page.getByTestId('menu-session-bar').count()) === 1, `faixas=${await page.getByTestId('menu-session-bar').count()} botoes=${await page.getByRole('button', { name: 'Reenviar como texto' }).count()}`);
await page.getByRole('button', { name: 'Reenviar como texto' }).click();
await page.waitForFunction(() => /texto numerado/.test(document.querySelector('[data-testid=menu-session-bar]')?.textContent || ''), null, { timeout: 10000 });
s = await fx();
check('M16 "reenviar como texto": um texto numerado saiu e o nativo não foi tentado de novo', s.sent.length === 1 && /1 - Ver os serviços\n2 - Pedir orçamento\n3 - Falar comigo/.test(s.sent[0].text) && s.natives.length === 1, s.sent[0]?.text.replace(/\n/g, ' | '));
await page.screenshot({ path: 'shot-menus-session.png' });

// resposta do contato: pedir dado -> CRM -> resposta
await post('/__push', { jid: J3, text: '2' });
for (let i = 0; i < 40 && (await fx()).sent.length < 2; i++) await sleep(250);
s = await fx();
check('M17 contato respondeu "2": o menu perguntou o nome (sem IA)', s.sent.at(-1).text === 'Qual o seu nome?' && !s.agyPrompts.some((p) => p.includes('Escreva o rascunho:')));
await post('/__push', { jid: J3, text: 'Ana Souza' });
for (let i = 0; i < 40 && (await fx()).sent.length < 3; i++) await sleep(250);
s = await fx();
check('M18 dado coletado, CRM movido como decisão humana e resposta com o nome', s.sent.at(-1).text === 'Anotado, Ana Souza! Já te retorno.' && s.state.crm[J3]?.stage === 'Em contato' && s.state.crm[J3]?.updatedBy === 'humano', JSON.stringify(s.state.crm[J3]));
await sleep(8000);
check('M19 sessão encerrada: a faixa some', (await page.getByTestId('menu-session-bar').count()) === 0);

// fallback automático quando o nativo falha
await post('/__control', { set: { buttons: 'error400' } });
await page.getByTitle('Mais opções do chat').click();
await page.getByRole('menuitem', { name: /Enviar menu/ }).click();
await page.getByLabel('Menu a enviar').selectOption({ label: 'Atendimento inicial (3 botões)' });
const sentBefore = (await fx()).sent.length; const nativeBefore = (await fx()).natives.length;
await page.getByRole('button', { name: 'Enviar menu', exact: true }).click();
await page.getByText('Enviado como texto numerado').first().waitFor({ timeout: 10000 });
s = await fx();
check('M20 nativo com erro 400 cai para texto numerado, uma vez só, e avisa', s.natives.length === nativeBefore + 1 && s.sent.length === sentBefore + 1 && /1 - Ver os serviços/.test(s.sent.at(-1).text));
await post('/__control', { set: { buttons: 'ok' } });
// encerrar menu
await page.getByRole('button', { name: 'Encerrar menu' }).click();
await page.getByTestId('menu-session-bar').waitFor({ state: 'detached', timeout: 10000 });
check('M21 "Encerrar menu" fecha a sessão', true);

// auditoria
const audit = await fetch('http://127.0.0.1:3355/mensageiro/api/copilot/audit', { headers: { Authorization: 'Bearer qa-admin' } }).then((r) => r.json());
const sentEntries = audit.entries.filter((e) => e.action === 'menu_sent');
check('M22 auditoria registra o modo usado em cada envio (nativo, texto, fallback)', sentEntries.some((e) => e.modeUsed === 'native' && !e.fallback) && sentEntries.some((e) => e.modeUsed === 'text' && !e.fallback) && sentEntries.some((e) => e.fallback === true && e.reason === 'native_error'), sentEntries.map((e) => `${e.modeRequested}>${e.modeUsed}${e.fallback ? '*' : ''}`).join(' '));
check('M23 auditoria sem o que o contato digitou', !JSON.stringify(audit.entries).includes('Ana Souza'));

// celular
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole('button', { name: 'Abrir menu lateral' }).first().click().catch(() => {});
await page.keyboard.press('Escape');
check('M99 console limpo', issues.length === 0, issues.slice(0, 3).join(' || '));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} verificações passaram`);
fs.writeFileSync('e2e-menus-results.json', JSON.stringify({ results, issues }, null, 2));
process.exit(failed.length ? 1 : 0);
