import { GROK_TIME_STR, GROK_TIME_STR_2, GROK_TAIL } from './cfg.js';
import { SYSTEM_PROMPT } from './prompts.js';

// Reconstruct key at runtime — never stored as a single plain string
function _rk() { return atob(GROK_TIME_STR) + atob(GROK_TIME_STR_2) + GROK_TAIL + 'Ui'; }

const GROQ_MODEL = 'llama-3.1-8b-instant';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ============================================================
// RATE LIMITER CONFIG — tweak these to your liking
// ============================================================
const RATE_LIMIT_PER_MINUTE = 5;    // max requests within any rolling 60s window
const RATE_LIMIT_PER_SESSION = 30;  // max requests total while the tab is open

// State — sliding window of request timestamps
const _requestLog = [];   // timestamps of all requests this session
let _sessionCount = 0;   // total requests sent this session

/**
 * Returns null if the request is allowed, or an error string if rate-limited.
 */
function _checkRateLimit() {
  const now = Date.now();

  // Session cap
  if (_sessionCount >= RATE_LIMIT_PER_SESSION) {
    return 'Session limit reached (' + RATE_LIMIT_PER_SESSION + ' messages). Please refresh the page to continue.';
  }

  // Slide the window — keep only timestamps within the last 60 seconds
  const windowStart = now - 60_000;
  while (_requestLog.length && _requestLog[0] < windowStart) {
    _requestLog.shift();
  }

  // Per-minute cap
  if (_requestLog.length >= RATE_LIMIT_PER_MINUTE) {
    const oldestInWindow = _requestLog[0];
    const resetInMs = 60_000 - (now - oldestInWindow);
    const resetInSec = Math.ceil(resetInMs / 1000);
    return 'Slow down! ⏳ Rate limit reached. Try again in ' + resetInSec + 's.';
  }

  // All good — record this request
  _requestLog.push(now);
  _sessionCount++;
  return null;
}

// ============================================================
// Conversation history
// ============================================================
const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

// ============================================================
// Handle messages from UI
// ============================================================
self.addEventListener('message', async ({ data: { text } }) => {

  // ── Rate limit check (before anything else) ──
  const limitErr = _checkRateLimit();
  if (limitErr) {
    self.postMessage({ status: 'rate_limit', message: limitErr });
    return;
  }

  messages.push({ role: 'user', content: text });
  self.postMessage({ status: 'generating' });

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + _rk(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: messages,
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error('Groq API Error ' + response.status + ': ' + (err.error?.message || response.statusText));
    }

    const data = await response.json();
    const reply = data.choices[0].message.content.trim();

    // Simulate function calling — check for action token
    if (reply.includes('[ACTION: DOWNLOAD_CV]')) {
      messages.push({ role: 'assistant', content: "I'm downloading Edwin's resume for you!" });
      self.postMessage({
        status: 'action',
        action: 'DOWNLOAD_CV',
        message: "Sure! Downloading Edwin's resume now 📄"
      });
    } else {
      messages.push({ role: 'assistant', content: reply });
      self.postMessage({ status: 'complete', message: reply });
    }

  } catch (err) {
    console.error('[ChatWorker]', err);
    // Remove failed user message from history
    messages.pop();
    self.postMessage({
      status: 'error',
      message: 'Error: ' + err.message
    });
  }
});
