import { triggerDownloadCV, triggerWhatsApp } from './actions.js';
import { playSend, playThinking, playReceive } from './sounds.js';

// ── Lightweight Markdown → HTML renderer ────────────────────
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMarkdown(text) {
  // 1. Escape HTML first to prevent XSS
  let html = escapeHtml(text);

  // 2. Tables  (must run BEFORE line-break conversion)
  //    Matches a block of lines that all start and end with |
  html = html.replace(/((?:\|.+\|\n?)+)/g, (block) => {
    const lines = block.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return block; // need at least header + separator

    // Check 2nd line is a separator row (| --- | --- |)
    const isSeparator = (line) => /^\|[\s\-:|]+\|$/.test(line.trim());
    if (!isSeparator(lines[1])) return block;

    const parseRow = (line) =>
      line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());

    const headers = parseRow(lines[0]);
    const bodyRows = lines.slice(2); // skip header + separator

    const thead = '<thead><tr>' +
      headers.map(h => '<th>' + h + '</th>').join('') +
      '</tr></thead>';

    const tbody = '<tbody>' +
      bodyRows.map(row =>
        '<tr>' + parseRow(row).map(c => '<td>' + c + '</td>').join('') + '</tr>'
      ).join('') +
      '</tbody>';

    return '<div class="chat-table-wrap"><table class="chat-table">' + thead + tbody + '</table></div>';
  });

  // 3. Numbered list blocks
  html = html.replace(/((?:^\d+\.\s+.+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(line =>
      '<li>' + line.replace(/^\d+\.\s+/, '') + '</li>'
    ).join('');
    return '<ol>' + items + '</ol>';
  });

  // 4. Bullet list blocks
  html = html.replace(/((?:^[-*]\s+.+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(line =>
      '<li>' + line.replace(/^[-*]\s+/, '') + '</li>'
    ).join('');
    return '<ul>' + items + '</ul>';
  });

  // 5. Bold  **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_, a, b) =>
    '<strong>' + (a || b) + '</strong>'
  );

  // 6. Italic  *text* or _text_
  html = html.replace(/(?<![*_])\*([^*\n]+)\*(?![*])|(?<![*_])_([^_\n]+)_(?![_])/g, (_, a, b) =>
    '<em>' + (a || b) + '</em>'
  );

  // 7. Inline code  `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 8. Remaining line breaks → <br>
  html = html.replace(/\n/g, '<br>');

  return html;
}


class ChatBotUI {
  constructor() {
    this.worker = null;
    this.isOpen = false;

    // UI Elements
    this.fab = document.getElementById('aiChatFab');
    this.modal = document.getElementById('aiChatModal');
    this.closeBtn = document.getElementById('aiChatClose');
    this.messagesContainer = document.getElementById('aiChatMessages');
    this.input = document.getElementById('aiChatInput');
    this.sendBtn = document.getElementById('aiChatSend');
    this.progressContainer = document.getElementById('aiChatProgress');
    this.progressBar = document.getElementById('aiChatProgressBar');
    this.progressText = document.getElementById('aiChatProgressText');

    this.initEventListeners();
  }

  initEventListeners() {
    this.fab.addEventListener('click', () => this.toggleChat());
    this.closeBtn.addEventListener('click', () => this.toggleChat());
    this.sendBtn.addEventListener('click', () => this.sendMessage());
    this.input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });
  }

  toggleChat() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.modal.classList.add('open');
      this.fab.classList.add('hidden');

      // Lazy load the worker only when opened for the first time
      if (!this.worker) {
        this.initWorker();
      }

      setTimeout(() => this.input.focus(), 300);
    } else {
      this.modal.classList.remove('open');
      this.fab.classList.remove('hidden');
    }
  }

  initWorker() {
    this.appendMessage('assistant', "Hello! I am Edwin's AI Assistant powered by Llama 3. How can I help you today?");

    try {
      this.worker = new Worker('js/chatbot/worker.js', { type: 'module' });
      this.worker.addEventListener('message', (e) => this.handleWorkerMessage(e.data));
      this.worker.addEventListener('error', (e) => {
        console.error('Worker error:', e);
        this.appendMessage('system', 'Error initializing AI. Check browser console.');
      });
    } catch (err) {
      console.error('Failed to create worker:', err);
      this.appendMessage('system', 'Your browser may not support module Web Workers.');
    }
  }

  handleWorkerMessage(data) {
    switch (data.status) {
      case 'progress':
        this.progressContainer.style.display = 'block';
        if (data.progress && data.progress.status === 'downloading') {
          const pct = Math.round(data.progress.progress || 0);
          this.progressBar.style.width = pct + '%';
          this.progressText.innerText = 'Downloading AI Model (' + pct + '%)';
        } else if (data.progress && data.progress.status === 'done') {
          this.progressBar.style.width = '100%';
          this.progressText.innerText = 'Model Loaded!';
          setTimeout(() => {
            this.progressContainer.style.display = 'none';
          }, 1000);
        }
        break;

      case 'rate_limit':
        this.setLoading(false);
        this.appendMessage('system', data.message);
        break;

      case 'loading':
      case 'generating':
        playThinking();
        this.setLoading(true);
        break;

      case 'action':
        this.setLoading(false);
        playReceive();
        this.appendMessage('assistant', data.message);
        if (data.action === 'DOWNLOAD_CV') {
          triggerDownloadCV();
        } else if (data.action === 'OPEN_WHATSAPP') {
          triggerWhatsApp(data.name || '');
        }
        break;

      case 'complete':
      case 'error':
        this.setLoading(false);
        playReceive();
        this.appendMessage(data.status === 'error' ? 'system' : 'assistant', data.message);
        break;
    }
  }

  sendMessage() {
    const text = this.input.value.trim();
    if (!text || !this.worker) return;

    playSend();
    this.input.value = '';
    this.appendMessage('user', text);
    this.setLoading(true);
    this.worker.postMessage({ text });
  }

  appendMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('chat-message', 'chat-' + role);
    // Only render markdown for assistant messages
    msgDiv.innerHTML = role === 'assistant' ? renderMarkdown(text) : escapeHtml(text);
    this.messagesContainer.appendChild(msgDiv);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  setLoading(isLoading) {
    if (isLoading) {
      this.sendBtn.disabled = true;
      if (!document.getElementById('chat-typing')) {
        const typing = document.createElement('div');
        typing.id = 'chat-typing';
        typing.classList.add('chat-message', 'chat-assistant', 'typing');
        typing.innerHTML = '<span>.</span><span>.</span><span>.</span>';
        this.messagesContainer.appendChild(typing);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      }
    } else {
      this.sendBtn.disabled = false;
      const typing = document.getElementById('chat-typing');
      if (typing) typing.remove();
    }
  }
}

// Initialize immediately — module scripts run after DOM is parsed
function initChatbot() {
  if (!window.chatbotUI) {
    window.chatbotUI = new ChatBotUI();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChatbot);
} else {
  initChatbot();
}
