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

/**
 * Tokenize a query string.
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúüñ\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
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
 * Retrieve the top-K most relevant chunks for a query.
 *
 * @param {string} query  - The user's question (English or Spanish)
 * @param {number} k      - Number of chunks to return (default: 3)
 * @returns {Array}       - [{id, text, section, score}]
 */
export async function topK(query, k = 3) {
  const { chunks, index } = await loadRAG();
  const { idf, avgdl } = index;

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  // Pre-tokenize all chunks (cached implicitly by JS closure over chunks)
  const scored = chunks.map(chunk => {
    const chunkTokens = tokenize(chunk.text);
    return {
      ...chunk,
      score: scoreBM25(queryTokens, chunkTokens, idf, avgdl),
    };
  });

  // Sort descending by score, return top K with score > 0
  return scored
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
