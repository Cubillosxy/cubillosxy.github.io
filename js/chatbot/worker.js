import { GROK_TIME_STR, GROK_TIME_STR_2, GROK_TAIL } from './cfg.js';
import { topK } from '../rag/retriever.js';

// Reconstruct key at runtime — never stored as a single plain string
function _rk() { return atob(GROK_TIME_STR) + atob(GROK_TIME_STR_2) + GROK_TAIL + 'Ui'; }

const GROQ_MODEL = 'llama-3.1-8b-instant';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ── Rate Limiter Config ───────────────────────────────────────
const RATE_LIMIT_PER_MINUTE = 5;   // max requests in any rolling 60s window
const RATE_LIMIT_PER_SESSION = 30; // max requests while tab is open

const _requestLog = [];
let _sessionCount = 0;

function _checkRateLimit() {
  const now = Date.now();
  if (_sessionCount >= RATE_LIMIT_PER_SESSION) {
    return 'Session limit reached (' + RATE_LIMIT_PER_SESSION + ' messages). Please refresh the page to continue.';
  }
  const windowStart = now - 60_000;
  while (_requestLog.length && _requestLog[0] < windowStart) _requestLog.shift();
  if (_requestLog.length >= RATE_LIMIT_PER_MINUTE) {
    const resetInSec = Math.ceil((60_000 - (now - _requestLog[0])) / 1000);
    return 'Slow down! ⏳ Rate limit reached. Try again in ' + resetInSec + 's.';
  }
  _requestLog.push(now);
  _sessionCount++;
  return null;
}

// ── Base system prompt ────────────────────────────────────────
const BASE_SYSTEM_PROMPT = `You are Edwin Cubillos' AI Assistant embedded in his portfolio website.
Your job is to answer questions from recruiters, hiring managers, and developers about Edwin's background, skills, experience, and personal interests.
Include his hobbies: reading about AI technology, testing new AI tools, running, CrossFit, and traveling.
When asked about a typical workday, respond with: "I start with a coffee, review my email and calendar, then prioritize and work on assigned tasks."

CRITICAL BEHAVIOR — PROACTIVE SCHEDULING:
- Whenever a user asks about Edwin's availability, if he's open to work, if he's looking for a job, or if they express interest in working with him — ALWAYS end your reply by naturally inviting them to schedule a quick call. Example endings: "Would you like to schedule a quick coffee chat to discuss further? ☕", "You can book a 15-minute call directly on his calendar — want me to open it?", or "Interested in connecting? Edwin's calendar is open for a quick coffee chat!"
- If the user then says yes, agrees, or asks to schedule/book/meet — reply EXACTLY with: [ACTION: BOOK_MEETING]

RULES:
- Always respond in the SAME language the user writes in. If Spanish → answer in Spanish. If English → answer in English.
- Be warm, professional, concise, and helpful.
- Always refer to Edwin in the third person.
- Use ONLY the provided context and your knowledge. Do not invent facts.
- Keep responses short (2-4 sentences) unless the user asks for details.
- Dont include the portfolio link in the response as the user is already on it.

ACTIONS — reply EXACTLY with the token and NO other text:
- User asks for resume or CV → [ACTION: DOWNLOAD_CV]
- User asks to contact via WhatsApp → [ACTION: OPEN_WHATSAPP]
- User confirms they want to schedule a call, meet, or book → [ACTION: BOOK_MEETING]

Edwin's contact:
- Email: cubillos.dev.bk@gmail.com
- WhatsApp: +573185229619
- LinkedIn: https://www.linkedin.com/in/cubillosxy
- GitHub: https://github.com/Cubillosxy
- Calendar / Book a coffee chat: https://calendly.com/cubillos-dev-bk/coffee-with-edwin`;

/**
 * Build a full system prompt with RAG context injected.
 * @param {Array} ragChunks - top-K chunks from the retriever
 */
function buildSystemPrompt(ragChunks) {
  if (!ragChunks || ragChunks.length === 0) return BASE_SYSTEM_PROMPT;

  const contextBlock = ragChunks
    .map((c, i) => `[Context ${i + 1} — ${c.section}]\n${c.text}`)
    .join('\n\n');

  return BASE_SYSTEM_PROMPT + '\n\n---\nRELEVANT CONTEXT (use this to answer accurately):\n\n' + contextBlock;
}

// ── Conversation history (messages rotate with each call) ─────
const chatHistory = [];

// ── Handle messages from UI ───────────────────────────────────
self.addEventListener('message', async ({ data: { text } }) => {

  // 1. Rate limit check
  const limitErr = _checkRateLimit();
  if (limitErr) {
    self.postMessage({ status: 'rate_limit', message: limitErr });
    return;
  }

  self.postMessage({ status: 'generating' });

  try {
    // 2. Retrieve relevant chunks from the BM25 index
    let ragChunks = [];
    try {
      ragChunks = await topK(text, 5);
    } catch (ragErr) {
      console.warn('[RAG] retrieval skipped:', ragErr.message);
    }

    // 3. Build the dynamic system prompt with injected context
    const systemPrompt = buildSystemPrompt(ragChunks);

    // ── DEBUG (remove when satisfied) ──────────────────────────
    console.group('[RAG] "' + text + '"');
    ragChunks.forEach((c, i) =>
      console.log('[' + i + '] score=' + c.score.toFixed(3) + ' | ' + c.section + '\n    ' + c.text.slice(0, 100))
    );
    if (!ragChunks.length) console.warn('⚠️ No chunks retrieved');
    console.groupEnd();
    // ──────────────────────────────────────────────────────────

    // 4. Build message list for the API call
    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory,
      { role: 'user', content: text },
    ];

    // 5. Call Groq API
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + _rk(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error('Groq API ' + response.status + ': ' + (err.error?.message || response.statusText));
    }

    const data = await response.json();
    const reply = data.choices[0].message.content.trim();

    // 6. Update conversation history (keep last 6 turns to avoid token bloat)
    chatHistory.push({ role: 'user', content: text });
    chatHistory.push({ role: 'assistant', content: reply });
    if (chatHistory.length > 12) chatHistory.splice(0, 2);

    // 7. Check for function calling action token (handle both [ACTION: X] and [ACTION:X])
    const normalizedReply = reply.replace(/\[ACTION:\s*/g, '[ACTION:');
    if (normalizedReply.includes('[ACTION:DOWNLOAD_CV]')) {
      chatHistory[chatHistory.length - 1].content = "I'm downloading Edwin's resume for you!";
      self.postMessage({
        status: 'action',
        action: 'DOWNLOAD_CV',
        message: "Sure! Downloading Edwin's resume now 📄"
      });
    } else if (normalizedReply.includes('[ACTION:OPEN_WHATSAPP]')) {
      chatHistory[chatHistory.length - 1].content = "Opening WhatsApp for you!";
      self.postMessage({
        status: 'action',
        action: 'OPEN_WHATSAPP',
        message: "Sure! Opening WhatsApp now 📱"
      });
    } else if (normalizedReply.includes('[ACTION:BOOK_MEETING]')) {
      chatHistory[chatHistory.length - 1].content = "Opening Edwin's scheduler!";
      self.postMessage({
        status: 'action',
        action: 'BOOK_MEETING',
        message: "Great! Opening Edwin's calendar so you can pick a time that works for you ☕"
      });
    } else {
      self.postMessage({ status: 'complete', message: reply });
    }

  } catch (err) {
    console.error('[ChatWorker]', err);
    self.postMessage({ status: 'error', message: 'Error: ' + err.message });
  }
});
