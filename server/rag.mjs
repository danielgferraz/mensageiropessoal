// Base de conhecimento somente leitura (NebrIA). Nunca grava, nunca segue links simbólicos para fora da raiz.
import fs from 'node:fs';
import path from 'node:path';

// Pastas elegíveis por padrão. 06_Referencias (inspirações) e 07_RAG (planejamento) não são fonte de resposta.
export const DEFAULT_RAG_FOLDERS = ['01_Marca', '02_Servicos', '03_Comercial', '04_Processos', '05_Perguntas_Frequentes'];
const EXTENSIONS = new Set(['.md', '.txt']);
const MAX_FILE_BYTES = 200 * 1024;
const MAX_FILES = 500;
const SECRET_LINE = /(senha|password|api[_ -]?key|token|secret|chave\s+pix)\s*[:=]/i;

const STOPWORDS = new Set(('a o as os um uma uns umas de do da dos das em no na nos nas por para com sem e ou que se ao aos à às é são foi ser ter tem '
  + 'como mais mas muito já não sim isso isto esse essa este esta você voce vocês voces quero queria gostaria pode podem').split(' '));

export function tokenize(text) {
  return String(text).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

/** Documento só é elegível com a linha exata "Status: Aprovado" (regra do próprio README da NebrIA). */
export function isApproved(text) {
  return /^\s*status\s*:\s*aprovado\s*$/im.test(text.split(/\r?\n/).slice(0, 40).join('\n'));
}

function* walk(dir, depth = 0) {
  if (depth > 4) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!entry.name.startsWith('.')) yield* walk(full, depth + 1); }
    else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name).toLowerCase())) yield full;
  }
}

function chunks(relPath, text) {
  const title = (text.match(/^#\s+(.+)$/m) || [])[1] || path.basename(relPath);
  const version = (text.match(/^\s*(?:versão|versao|version)\s*:\s*(.+)$/im) || [])[1]?.trim();
  const updated = (text.match(/^\s*atualizado em\s*:\s*(.+)$/im) || [])[1]?.trim();
  const sections = text.split(/\n(?=#{1,3}\s)/);
  return sections.map((section) => section.split(/\r?\n/).filter((line) => !SECRET_LINE.test(line)).join('\n').trim())
    .filter((body) => body.length > 40)
    .map((body, index) => ({ source: relPath.split(path.sep).join('/'), title, version, updated, index, text: body.slice(0, 1500), tokens: tokenize(body) }));
}

/** Lê somente `root/<pasta permitida>`; retorna trechos aprovados e a lista de documentos ignorados (com o motivo). */
export function loadKnowledge(root, folders = DEFAULT_RAG_FOLDERS) {
  const result = { chunks: [], documents: [], skipped: [], root: root || null, available: false };
  if (!root) return result;
  let resolvedRoot;
  try { resolvedRoot = fs.realpathSync(root); } catch { return result; }
  result.available = true;
  let files = 0;
  for (const folder of folders) {
    if (folder.includes('..') || path.isAbsolute(folder)) continue;
    const base = path.join(resolvedRoot, folder);
    for (const file of walk(base)) {
      if (++files > MAX_FILES) return result;
      const rel = path.relative(resolvedRoot, file);
      let real;
      try { real = fs.realpathSync(file); } catch { continue; }
      if (!real.startsWith(resolvedRoot + path.sep)) { result.skipped.push({ path: rel, reason: 'fora da raiz' }); continue; }
      const stat = fs.statSync(real);
      if (stat.size > MAX_FILE_BYTES) { result.skipped.push({ path: rel, reason: 'arquivo grande demais' }); continue; }
      const text = fs.readFileSync(real, 'utf8');
      if (!isApproved(text)) { result.skipped.push({ path: rel, reason: 'sem "Status: Aprovado"' }); continue; }
      result.documents.push(rel.split(path.sep).join('/'));
      result.chunks.push(...chunks(rel, text));
    }
  }
  return result;
}

/** Busca por palavras (TF simples com peso de título). Retorna no máximo `limit` trechos com fonte. */
export function searchKnowledge(knowledge, query, limit = 4) {
  const terms = [...new Set(tokenize(query))];
  if (!terms.length) return [];
  const scored = knowledge.chunks.map((chunk) => {
    const titleTokens = new Set(tokenize(chunk.title));
    let score = 0;
    for (const term of terms) {
      const hits = chunk.tokens.filter((token) => token === term || (term.length > 4 && token.startsWith(term.slice(0, -1)))).length;
      score += Math.min(hits, 3) + (titleTokens.has(term) ? 2 : 0);
    }
    return { chunk, score };
  }).filter((entry) => entry.score >= 2).sort((a, b) => b.score - a.score).slice(0, limit);
  return scored.map(({ chunk, score }) => ({ source: chunk.source, title: chunk.title, version: chunk.version, updated: chunk.updated, text: chunk.text, score }));
}
