/**
 * retriever.js
 * BM25-based retrieval engine — pure JS, no model download.
 * Supports queries in English or Spanish (bilingual stopwords).
 */

import { loadRAG } from './loader.js';

// ── BM25 parameters (must match chunk_and_index.py) ──────────
const K1 = 1.5;
const B  = 0.75;

// EN + ES stopwords
const STOPWORDS = new Set([
  // English
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "by","from","is","was","are","were","be","been","being","have","has",
  "had","do","does","did","will","would","could","should","may","might",
  "his","her","he","she","they","we","you","i","it","its","this","that",
  "these","those","as","if","not","no","so","up","out","about","into",
  "also","than","then","there","when","where","which","who","how","what",
  "all","more","some","any","can","just","over","after","before",
  // Spanish
  "el","la","los","las","un","una","unos","unas","y","o","pero","en",
  "de","del","al","con","por","para","a","que","se","su","sus","lo",
  "le","les","es","son","fue","era","una","más","mi","tu","si","no",
  "como","cuando","donde","quien","hay","ya","así","muy","también",
  "porque","sobre","entre","desde","hasta","hacia","sin","con",
]);

// ── Spanish → English query expansion map ────────────────────
const EXPAND_ES = {
  // Languages / Idiomas
  'idiomas':          ['languages', 'spoken', 'english', 'spanish', 'portuguese'],
  'idioma':           ['language', 'spoken'],
  'habla':            ['speaks', 'spoken', 'languages'],
  'lenguajes':        ['languages', 'programming', 'python', 'go'],
  'lenguaje':         ['language', 'programming'],
  'ingles':           ['english', 'language', 'spoken', 'c1'],
  'espanol':          ['spanish', 'language', 'native'],
  'portugues':        ['portuguese', 'language', 'spoken'],

  // Work / Experience — most important block
  'experiencia':      ['experience', 'work', 'career', 'companies', 'jobs', 'positions', 'roles', 'history'],
  'trabajo':          ['work', 'experience', 'job', 'career', 'role', 'position', 'company'],
  'trabajos':         ['jobs', 'work', 'experience', 'roles', 'positions', 'career', 'companies'],
  'trabajó':          ['worked', 'experience', 'companies', 'roles'],
  'empresa':          ['company', 'companies', 'work', 'employer', 'employer'],
  'empresas':         ['companies', 'experience', 'work', 'employers', 'jobs'],
  'posicion':         ['position', 'role', 'job', 'work', 'company'],
  'posiciones':       ['positions', 'roles', 'jobs', 'work', 'companies', 'experience'],
  'rol':              ['role', 'position', 'job', 'work', 'title'],
  'roles':            ['roles', 'positions', 'jobs', 'work', 'companies'],
  'cargo':            ['role', 'position', 'title', 'job'],
  'cargos':           ['roles', 'positions', 'titles', 'jobs'],
  'ultimos':          ['last', 'recent', 'latest', 'current', 'previous'],
  'ultimas':          ['last', 'recent', 'latest', 'current', 'previous'],
  'ultimo':           ['last', 'recent', 'latest', 'current'],
  'ultima':           ['last', 'recent', 'latest', 'current'],
  'reciente':         ['recent', 'last', 'latest', 'current', 'now'],
  'recientes':        ['recent', 'latest', 'last', 'current'],
  'actual':           ['current', 'present', 'now', 'latest', 'recent'],
  'actualmente':      ['currently', 'present', 'now', 'working'],
  'carrera':          ['career', 'experience', 'work', 'history', 'jobs'],
  'historial':        ['history', 'experience', 'career', 'work', 'jobs'],

  // Skills / Tech
  'habilidades':      ['skills', 'technologies', 'tech', 'stack', 'expertise'],
  'tecnologias':      ['technologies', 'skills', 'frameworks', 'cloud', 'tools'],
  'herramientas':     ['tools', 'technologies', 'stack', 'frameworks'],
  'conocimientos':    ['knowledge', 'skills', 'expertise', 'technologies'],

  // Education
  'educacion':        ['education', 'university', 'degree', 'study'],
  'universidad':      ['university', 'education', 'degree', 'bachelor'],
  'estudios':         ['education', 'university', 'study', 'degree'],
  'titulo':           ['degree', 'education', 'university', 'bachelor'],

  // Certifications
  'certificaciones':  ['certifications', 'certificates', 'courses'],
  'certificacion':    ['certification', 'certificate'],
  'cursos':           ['courses', 'certifications', 'learning', 'training'],

  // Contact
  'contacto':         ['contact', 'email', 'phone', 'whatsapp'],
  'telefono':         ['phone', 'whatsapp', 'contact'],
  'correo':           ['email', 'contact', 'gmail'],

  // Projects / Repos
  'proyectos':        ['projects', 'github', 'repositories', 'repos'],
  'proyecto':         ['project', 'github', 'repository'],
  'repositorios':     ['repositories', 'github', 'projects'],

  // Cloud / DB
  'nube':             ['cloud', 'aws', 'azure', 'infrastructure'],
  'bases':            ['databases', 'postgresql', 'mongodb'],
  'datos':            ['data', 'databases', 'bigquery'],

  // AI
  'inteligencia':     ['intelligence', 'ai', 'machine', 'learning', 'llm'],
  'artificial':       ['artificial', 'ai', 'machine', 'learning'],
  'agentes':          ['agents', 'ai', 'llm', 'autonomous'],

  // Location / Availability
  'disponible':       ['available', 'opportunities', 'remote', 'open'],
  'ubicacion':        ['location', 'colombia', 'remote', 'bogota'],
  'salario':          ['salary', 'compensation'],

  // Profile
  'perfil':           ['profile', 'about', 'summary', 'bio'],
  'resumen':          ['summary', 'profile', 'about', 'experience'],
  'sobre':            ['about', 'profile', 'bio', 'summary'],
  'quien':            ['who', 'about', 'profile', 'bio'],
  'anos':             ['years', 'experience', 'decade'],
};

/**
 * Tokenize + expand Spanish terms to English equivalents.
 */
function tokenize(text) {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúüñ\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));

  const expanded = [];
  for (const token of base) {
    expanded.push(token);
    // Strip accents for lookup: "idiomas" matches "idiomas"
    const normalized = token.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const synonyms = EXPAND_ES[token] || EXPAND_ES[normalized] || [];
    expanded.push(...synonyms);
  }
  return expanded;
}


/**
 * Compute term frequency map for a list of tokens.
 */
function termFreq(tokens) {
  const tf = {};
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
  return tf;
}

/**
 * BM25 score for a single chunk.
 */
function scoreBM25(queryTerms, chunkTokens, idf, avgdl) {
  const dl = chunkTokens.length;
  const tf = termFreq(chunkTokens);
  let score = 0;
  for (const term of queryTerms) {
    if (!idf[term]) continue;
    const f    = tf[term] || 0;
    const num  = f * (K1 + 1);
    const denom = f + K1 * (1 - B + B * (dl / avgdl));
    score += idf[term] * (num / denom);
  }
  return score;
}

/**
 * Topic detection — scans raw query for intent and boosts matching sections.
 * Works even with typos because we use partial regex (trabaj → trabajos/trabajaos).
 */
const TOPIC_BOOSTS = [
  {
    // Work / Experience queries (EN + ES, typo-tolerant)
    pattern: /\b(job|jobs|work|career|experience|position|role|company|companies|employer|last|recent|latest|current|hist|trabaj|experienci|posici|empres|carrer|histor|ultim|recient|actual|founding|engineer|architect)\b/i,
    sectionKeyword: 'work experience',
    multiplier: 3.0,
  },
  {
    // Skills / Tech queries
    pattern: /\b(skill|tech|framework|language|stack|tool|habilidad|tecnolog|lenguaj|conocim|programm)\b/i,
    sectionKeyword: 'skills',
    multiplier: 2.5,
  },
  {
    // Education queries
    pattern: /\b(study|degree|university|education|certif|cours|educat|estudi|universid|certific|titul)\b/i,
    sectionKeyword: ['education', 'certif'],
    multiplier: 2.5,
  },
  {
    // Projects / repos
    pattern: /\b(project|repo|github|code|built|creat|proyect|reposit)\b/i,
    sectionKeyword: 'project',
    multiplier: 2.0,
  },
  {
    // Contact queries
    pattern: /\b(contact|email|phone|whatsapp|reach|linkedin|contacto|correo|telefon|alcanz)\b/i,
    sectionKeyword: 'contact',
    multiplier: 2.0,
  },
];

/**
 * Retrieve the top-K most relevant chunks for a query.
 *
 * @param {string} query  - The user's question (English or Spanish)
 * @param {number} k      - Number of chunks to return (default: 5)
 * @returns {Array}       - [{id, text, section, score}]
 */
export async function topK(query, k = 5) {
  const { chunks, index } = await loadRAG();
  const { idf, avgdl } = index;

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const rawQuery = query.toLowerCase();

  // Detect active topic boosts from the raw query (typo-tolerant via partial regex)
  const activeBoosts = TOPIC_BOOSTS.filter(b => b.pattern.test(rawQuery));

  // Score all chunks
  const scored = chunks.map(chunk => {
    const chunkTokens = tokenize(chunk.text);
    let score = scoreBM25(queryTokens, chunkTokens, idf, avgdl);

    // Apply section boosts
    const sec = (chunk.section || '').toLowerCase();
    for (const boost of activeBoosts) {
      const keywords = Array.isArray(boost.sectionKeyword) ? boost.sectionKeyword : [boost.sectionKeyword];
      if (keywords.some(kw => sec.includes(kw))) {
        score = Math.max(score, 0.1) * boost.multiplier;
        break; // only apply the strongest matching boost
      }
    }

    return { ...chunk, score };
  });

  // Sort descending by score, return top K with score > 0
  return scored
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
