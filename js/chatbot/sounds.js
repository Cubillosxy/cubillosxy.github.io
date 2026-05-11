/**
 * sounds.js
 * Synthetic UI sounds via Web Audio API — no audio files needed.
 * AudioContext is created lazily on first user gesture to comply with
 * browser autoplay policies.
 */

let _ctx = null;

function getCtx() {
  if (!_ctx || _ctx.state === 'closed') {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

/**
 * Core tone generator with envelope shaping.
 * @param {object} opts
 */
function tone({ freq = 440, type = 'sine', duration = 0.12, vol = 0.25, delay = 0 }) {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);

    // Soft attack → exponential decay
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.start(t);
    osc.stop(t + duration + 0.02);
  } catch (_) { /* Audio API not available */ }
}

/**
 * 🔵 Send sound — short sharp click when user sends a message.
 */
export function playSend() {
  tone({ freq: 880, type: 'sine', duration: 0.06, vol: 0.18 });
  tone({ freq: 660, type: 'triangle', duration: 0.09, vol: 0.10, delay: 0.04 });
}

/**
 * ⏳ Thinking sound — subtle low pulse when the AI starts processing.
 */
export function playThinking() {
  tone({ freq: 320, type: 'sine', duration: 0.18, vol: 0.08 });
}

/**
 * 🟢 Receive sound — pleasant two-note chime when the AI replies.
 */
export function playReceive() {
  tone({ freq: 523, type: 'sine', duration: 0.18, vol: 0.22 });           // C5
  tone({ freq: 784, type: 'sine', duration: 0.22, vol: 0.18, delay: 0.12 }); // G5
}
