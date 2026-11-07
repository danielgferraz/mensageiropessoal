// QA de navegador: scroll do chat (escopo 1), painel Antigravity (2) e sugestão automática (3).
import fs from 'node:fs';
import { chromium } from 'playwright-core';
const BASE = 'http://127.0.0.1:3355/mensageiro/';
const UP = 'http://127.0.0.1:4455';
const results = []; const consoleIssues = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, body) => fetch(UP + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).then((r) => r.json());
const fixture = () => fetch(UP + '/__state').then((r) => r.json());

const browser = await chromium.launch({ executablePath: 'C:/Users/User/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
let expectErrors = false;
page.on('console', (m) => { if (m.type() === 'error' && !expectErrors) consoleIssues.push('console.error: ' + m.text()); });
page.on('pageerror', (e) => consoleIssues.push('pageerror: ' + e.message));

const VP = '[data-testid=messages-viewport]';
const metrics = () => page.locator(VP).evaluate((el) => ({ top: Math.round(el.scrollTop), client: el.clientHeight, height: el.scrollHeight, dist: Math.round(el.scrollHeight - el.scrollTop - el.clientHeight) }));
const scrollBy = (dy) => page.locator(VP).evaluate((el, d) => { el.scrollTop = el.scrollTop + d; }, dy);
const scrollEnd = () => page.locator(VP).evaluate((el) => { el.scrollTop = el.scrollHeight; });
const login = async () => {
  await page.goto(BASE);
  await page.fill('input[type=email]', 'qa@example.test'); await page.fill('input[type=password]', 'qa-only');
  await page.getByRole('button', { name: 'Entrar no Mensageiro' }).click();
  await page.getByText(/99999-0001/).first().waitFor({ timeout: 10000 });
};
const openChat = async (suffix) => { await page.getByText(new RegExp(suffix)).first().click(); await page.waitForSelector(VP); };
const atBottom = async (label, tol = 4) => { const m = await metrics(); check(label, m.dist <= tol, JSON.stringify(m)); return m; };
const shot = (n) => page.screenshot({ path: `shot-${n}.png` });
const inView = (re) => page.locator(VP).getByText(re).first();
const J1 = '5511999990001@s.whatsapp.net', J2 = '5511999990002@s.whatsapp.net', J3 = '5511999990003@s.whatsapp.net';

// ---------- ESCOPO 1: SCROLL ----------
await login();
await openChat('99999-0001');
await inView(/Mensagem 150 da conversa longa/).waitFor();
await atBottom('1.1 conversa longa (150 msgs) abre na última mensagem');
await sleep(1200);
await atBottom('1.1b continua no fim após o polling');
await openChat('99999-0003'); await sleep(500);
await atBottom('1.2 troca para outra conversa: abre no fim');
await openChat('99999-0001'); await sleep(500);
await atBottom('1.2b volta para a conversa longa: abre no fim');
await page.reload(); await page.getByText(/99999-0001/).first().waitFor({ timeout: 10000 });
await openChat('99999-0001'); await inView(/Mensagem 150 da conversa longa/).waitFor();
await atBottom('1.3 após recarregar a página: abre no fim');

// histórico lento: chega depois do primeiro render
await api('/__control', { set: { slow: { [J2]: 1800 } } });
await openChat('99999-0002');
await sleep(300);
await inView('Segunda mensagem').waitFor({ timeout: 8000 });
await sleep(300);
await atBottom('1.4 histórico que chega depois do primeiro render: fica no fim', 4);
await api('/__control', { set: { slow: {} } });

// altura muda depois do render (imagem/áudio): simula com um bloco que cresce
await openChat('99999-0001'); await inView(/Mensagem 150 da conversa longa/).waitFor(); await sleep(400);
await page.locator(VP + ' > div').evaluate((c) => { const d = document.createElement('div'); d.id = 'fake-media'; d.style.height = '40px'; d.textContent = 'midia'; c.appendChild(d); });
await sleep(300);
await page.locator('#fake-media').evaluate((d) => { d.style.height = '900px'; });
await sleep(500);
await atBottom('1.5 mídia carregando depois (altura +860px) com a tela no fim: reancora no fim');
await scrollBy(-1500); await sleep(400);
const readingBefore = await metrics();
await page.locator('#fake-media').evaluate((d) => { d.style.height = '1500px'; });
await sleep(600);
const readingAfter = await metrics();
check('1.6 mídia carregando com a tela no histórico: NÃO puxa para o fim', Math.abs(readingAfter.top - readingBefore.top) <= 2 && readingAfter.dist > 500, `${readingBefore.top} -> ${readingAfter.top}, dist ${readingAfter.dist}`);
await page.locator('#fake-media').evaluate((d) => d.remove());
await scrollEnd(); await sleep(400);

// receber mensagem no fim
await api('/__push', { jid: J1, text: 'RECEBIDA-NO-FIM', webhook: false });
await inView('RECEBIDA-NO-FIM').waitFor({ timeout: 8000 }); await sleep(400);
await atBottom('1.7 mensagem recebida com a tela no fim: acompanha');
check('1.7b sem aviso quando está no fim', (await page.getByTestId('new-messages-chip').count()) === 0);

// receber mensagem lendo histórico
await scrollBy(-1200); await sleep(400);
const before = await metrics();
await api('/__push', { jid: J1, text: 'NOVA-A', webhook: false });
await api('/__push', { jid: J1, text: 'NOVA-B', webhook: false });
await page.getByTestId('new-messages-chip').waitFor({ timeout: 9000 }); await sleep(500);
const during = await metrics();
const chipText = (await page.getByTestId('new-messages-chip').innerText()).trim();
check('1.8 lendo histórico: tela NÃO é puxada', Math.abs(during.top - before.top) <= 2, `${before.top} -> ${during.top}`);
check('1.8b aviso discreto "N novas mensagens"', /2 novas mensagens/.test(chipText), chipText);
await shot('chip');
await page.getByTestId('new-messages-chip').click(); await sleep(400);
await atBottom('1.9 clicar no aviso leva ao fim');
check('1.9b aviso some ao clicar', (await page.getByTestId('new-messages-chip').count()) === 0);
await scrollBy(-1200); await sleep(300);
await api('/__push', { jid: J1, text: 'NOVA-C', webhook: false });
await page.getByTestId('new-messages-chip').waitFor({ timeout: 9000 });
check('1.10 aviso no singular', /^1 nova mensagem$/.test((await page.getByTestId('new-messages-chip').innerText()).trim()));
await scrollEnd(); await sleep(400);
check('1.10b aviso some ao voltar ao fim manualmente', (await page.getByTestId('new-messages-chip').count()) === 0);

// enviar mensagem lendo histórico -> vai ao fim
await page.locator(VP).evaluate((el) => { el.scrollTop = 200; }); await sleep(400);
await page.getByLabel('Mensagem', { exact: true }).fill('ENVIO-QA');
await page.getByRole('button', { name: 'Enviar mensagem' }).click();
await inView('ENVIO-QA').waitFor({ timeout: 8000 }); await sleep(600);
await atBottom('1.11 enviar mensagem lendo o histórico: tela vai ao fim e mostra a mensagem');
let fx = await fixture();
check('1.11b envio foi só para o fixture (nenhum envio real)', fx.sent.length === 1 && fx.sent[0].text === 'ENVIO-QA', JSON.stringify(fx.sent));

// busca no chat
await page.getByTitle('Buscar mensagens no chat').click();
await page.getByPlaceholder('Buscar nesta conversa...').fill('Mensagem 20 ');
await sleep(500);
check('1.12 busca no chat continua funcionando', (await page.getByText(/Mensagem 20 da conversa/).count()) >= 1);
await page.getByRole('button', { name: 'Fechar' }).first().click(); await sleep(400);
await shot('chat-bottom');

// ---------- ESCOPO 3: SUGESTÃO AUTOMÁTICA ----------
await openChat('99999-0003'); await sleep(600);
await page.getByRole('button', { name: 'Ligar sugestões' }).click();
await page.getByTestId('ai-status').filter({ hasText: 'IA em modo sugestão' }).waitFor({ timeout: 5000 });
check('3.0 conversa com IA ligada mostra "IA em modo sugestão"', true);
await api('/__push', { jid: J3, text: 'Qual o prazo de entrega do serviço?' });
await page.getByTestId('reply-suggestion').waitFor({ timeout: 25000 });
const sugText = await page.getByTestId('reply-suggestion').innerText();
check('3.1 sugestão aparece sozinha na barra da conversa', /Sugestão pronta da IA/.test(sugText) && /cinco dias úteis/.test(sugText), sugText.replace(/\n/g, ' | ').slice(0, 140));
fx = await fixture();
check('3.2 nada enviado ao WhatsApp pela IA', fx.sent.length === 1, `envios no fixture: ${fx.sent.length} (só o ENVIO-QA do teste 1.11)`);
const sugRow = fx.state.sugs.filter((s) => s.jid === J3 && s.status === 'pending');
check('3.3 uma sugestão pendente, com id da mensagem de origem', sugRow.length === 1 && !!sugRow[0].payload.sourceMessageId && sugRow[0].payload.auto === true, JSON.stringify(sugRow[0]?.payload).slice(0, 120));
await shot('auto-suggestion');
await api('/__push', { jid: J3, text: 'E o prazo para o segundo serviço?', webhook: true });
await sleep(600);
fx = await fixture();
check('3.4 mensagem nova descarta a sugestão antiga imediatamente', fx.state.sugs.filter((s) => s.jid === J3 && s.status === 'pending').length === 0);
for (let i = 0; i < 100; i++) { fx = await fixture(); if (fx.state.sugs.filter((s) => s.jid === J3 && s.status === 'pending').length === 1) break; await sleep(250); }
await page.waitForFunction(() => /segundo serviço|cinco dias/.test(document.querySelector('[data-testid=reply-suggestion]')?.textContent || ''), null, { timeout: 15000 });
fx = await fixture();
check('3.4b depois gera uma nova (continua só uma pendente)', fx.state.sugs.filter((s) => s.jid === J3 && s.status === 'pending').length === 1);
await page.getByRole('button', { name: /Usar e editar no campo/ }).click();
const typed = await page.getByLabel('Mensagem', { exact: true }).inputValue();
check('3.5 "Usar e editar" coloca o rascunho no campo sem enviar', /cinco dias/.test(typed) && (await fixture()).sent.length === 1);
await page.getByRole('button', { name: 'Enviar mensagem' }).click(); await sleep(900);
fx = await fixture();
check('3.6 envio só com o clique: 1 envio novo, com o texto aprovado', fx.sent.length === 2 && /cinco dias/.test(fx.sent[1].text));
const draftCalls = () => fixture().then((f) => f.agyPrompts.filter((p) => p.includes('Escreva o rascunho:')).length);
const draftsBefore = await draftCalls();
await page.getByRole('button', { name: 'Assumir' }).click();
await page.getByTestId('ai-status').filter({ hasText: 'Assumida por humano' }).waitFor();
await api('/__push', { jid: J3, text: 'Mensagem com humano assumindo' }); await sleep(4500);
check('3.7 conversa assumida por humano não gera sugestão', (await draftCalls()) === draftsBefore && (await page.getByTestId('reply-suggestion').count()) === 0);
await page.getByRole('button', { name: 'Devolver para a IA' }).click();
await page.getByRole('button', { name: 'Desligar sugestões' }).click();
await page.getByTestId('ai-status').filter({ hasText: 'IA desligada nesta conversa' }).waitFor();
await api('/__push', { jid: J3, text: 'Mensagem com IA desligada' }); await sleep(4500);
check('3.8 conversa com IA desligada não gera sugestão', (await draftCalls()) === draftsBefore && (await page.getByTestId('reply-suggestion').count()) === 0);
await page.getByRole('button', { name: 'Ligar sugestões' }).click(); await sleep(400);
await api('/__push', { jid: J3, text: 'Posso pagar no cartão?' }); await sleep(4500);
check('3.8b tema bloqueado (cartão) não gera sugestão mesmo com IA ligada', (await draftCalls()) === draftsBefore && (await page.getByTestId('reply-suggestion').count()) === 0);
await page.getByRole('button', { name: 'Desligar sugestões' }).click(); await sleep(400);
check('3.9 sem loop: rascunhos == mensagens do cliente com IA ligada (2, uma no burst)', draftsBefore === 2, `rascunhos=${draftsBefore}`);

// ---------- ESCOPO 2: PAINEL ANTIGRAVITY ----------
await page.getByRole('button', { name: 'Ligar sugestões' }).click(); await sleep(500);
await page.getByLabel('Antigravity Copilot').click();
await page.getByTestId('antigravity-panel').waitFor();
const sel = await page.locator('#ag-target').evaluate((s) => s.options[s.selectedIndex].text);
check('2.1 aberto pelo menu: usa a última conversa ativa', /99999-0003/.test(sel), sel);
await page.getByTestId('ag-ai-state').filter({ hasText: 'Sugestão' }).waitFor({ timeout: 5000 });
check('2.2 mostra o estado da IA da conversa', true, await page.getByTestId('ag-ai-state').innerText());
const hdr = await page.getByTestId('antigravity-panel').innerText();
check('2.3 cabeçalho em pt-BR, sem "WhatsApp · WA" e sem caminho', /Assistente interno/.test(hdr) && !/WhatsApp · WA/.test(hdr) && !/\/srv\//.test(hdr));
await page.getByRole('button', { name: 'Resumir conversa' }).click();
await page.getByText(/Pendência: informar o prazo/).waitFor({ timeout: 10000 });
const panelText = await page.getByTestId('antigravity-panel').innerText();
check('2.4 resumo em pt-BR e caminho interno mascarado', /Resumo:/.test(panelText) && !/\/srv\/stacks/.test(panelText) && /\[local interno\]/.test(panelText));
fx = await fixture();
const sumPrompt = fx.agyPrompts.filter((p) => p.includes('resuma a conversa')).at(-1);
check('2.5 prompt traz contexto real (contato, mensagens, estado da IA) e manda responder em pt-BR', /Qual o prazo de entrega/.test(sumPrompt) && /português do Brasil/.test(sumPrompt) && /IA em modo sugestão/.test(sumPrompt) && /Contato:/.test(sumPrompt));
check('2.5b prompt não vaza segredos nem caminhos', !/qa-only|segredo-de-qa|\/srv\//.test(sumPrompt));
const notesBefore = (await fixture()).state.notes.length;
await page.getByRole('button', { name: 'Criar nota interna' }).click();
await page.getByText('Nota interna proposta').waitFor({ timeout: 10000 });
check('2.6 nota proposta NÃO é salva sem confirmar', (await fixture()).state.notes.length === notesBefore);
await page.getByRole('button', { name: 'Salvar nota' }).click(); await sleep(600);
fx = await fixture();
check('2.7 nota salva só após confirmar, autoria IA', fx.state.notes.length === notesBefore + 1 && fx.state.notes.at(-1).author === 'ia', JSON.stringify(fx.state.notes.at(-1)).slice(0, 100));
await page.getByRole('button', { name: 'Sugerir estágio' }).click();
await page.getByText(/Estágio sugerido:/).waitFor({ timeout: 10000 });
const crmBefore = (await fixture()).state.sugs.filter((s) => s.kind === 'crm_stage').length;
check('2.8 estágio sugerido (do pipeline) sem gravar nada ainda', crmBefore === 0 && /Em contato/.test(await page.getByText(/Estágio sugerido:/).innerText()));
await page.getByRole('button', { name: 'Registrar sugestão' }).click(); await sleep(600);
fx = await fixture();
check('2.9 sugestão de estágio registrada após confirmar (pendente, não aplicada)', fx.state.sugs.filter((s) => s.kind === 'crm_stage' && s.status === 'pending').length === 1 && !fx.state.crm[J3]);
await page.getByRole('button', { name: 'Aguardando retorno' }).click();
const n0 = (await fixture()).state.notes.length;
await page.getByText(/Aguardando retorno do cliente" nesta conversa/).waitFor();
check('2.10 "aguardando retorno" pede confirmação antes de gravar', (await fixture()).state.notes.length === n0);
await page.getByRole('button', { name: 'Confirmar', exact: true }).click(); await sleep(600);
fx = await fixture();
check('2.11 "aguardando retorno" gravado após confirmar', fx.state.notes.length === n0 + 1 && /Aguardando retorno/.test(fx.state.notes.at(-1).text));
await page.getByRole('button', { name: 'Sugerir resposta' }).click();
await page.getByText(/só atua em contatos salvos/).waitFor({ timeout: 10000 });
check('2.12 sugerir resposta respeita as regras (contato não salvo: explica o bloqueio)', true);
await page.getByLabel('Pergunta para o Antigravity').fill('olá'); await page.getByLabel('Pergunta para o Antigravity').press('Enter');
await page.getByText(/Em que posso ajudar com esta conversa/).waitFor({ timeout: 15000 });
const t2 = await page.getByTestId('antigravity-panel').innerText();
fx = await fixture();
check('2.13 resposta em inglês do CLI é reescrita em pt-BR antes de aparecer', !/How can I help/.test(t2) && fx.agyPrompts.some((p) => p.includes('Reescreva o texto abaixo em português do Brasil')) && !/\/srv\/stacks/.test(t2));
await shot('antigravity-panel');
await page.getByTestId('antigravity-panel').getByRole('button', { name: 'Abrir conversa', exact: true }).click(); await sleep(600);
await page.getByTitle('Mais opções do chat').click();
await page.getByRole('menuitem', { name: 'Perguntar ao Antigravity' }).click();
await page.getByTestId('antigravity-panel').waitFor();
check('2.14 menu da conversa "Perguntar ao Antigravity" abre o painel com a conversa', /99999-0003/.test(await page.locator('#ag-target').evaluate((s) => s.options[s.selectedIndex].text)));
expectErrors = true; // as próximas respostas 503/502 são provocadas de propósito
await api('/__control', { set: { agy: 'down' } });
await page.getByRole('button', { name: 'Resumir conversa' }).click();
await page.getByText(/fora do ar/).first().waitFor({ timeout: 8000 });
check('2.15 agy fora do ar: erro claro em pt-BR', true);
await api('/__control', { set: { agy: 'fail' } });
await page.getByRole('button', { name: 'Resumir conversa' }).click();
await page.getByText(/não conseguiu responder agora/).waitFor({ timeout: 8000 });
const t3 = await page.getByTestId('antigravity-panel').innerText();
check('2.16 falha do agy: sem stderr/caminho/stack na tela', !/EACCES|\/home\/opc|stderr|\/srv\//.test(t3));
await api('/__control', { set: { agy: 'ok' } }); await sleep(300); expectErrors = false;
await page.locator('#ag-target').selectOption(''); await sleep(400);
check('2.17 sem conversa: ações dependentes desabilitadas e orientação visível', (await page.getByRole('button', { name: 'Resumir conversa' }).isDisabled()) && /Escolha uma conversa/.test(await page.getByTestId('antigravity-panel').innerText()));
await page.setViewportSize({ width: 390, height: 844 });
await page.locator('#ag-target').selectOption({ index: 1 }); await sleep(500);
check('2.18 layout de celular sem rolagem horizontal', !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)));
await shot('antigravity-mobile');
await page.setViewportSize({ width: 1280, height: 800 });

check('9.0 console limpo (sem console.error nem pageerror)', consoleIssues.length === 0, consoleIssues.slice(0, 5).join(' || '));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} verificações passaram`);
fs.writeFileSync('e2e-results.json', JSON.stringify({ results, consoleIssues }, null, 2));
process.exit(failed.length ? 1 : 0);
