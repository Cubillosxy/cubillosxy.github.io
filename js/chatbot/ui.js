import { triggerDownloadCV } from './actions.js';

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
        this.setLoading(true);
        break;

      case 'action':
        this.setLoading(false);
        this.appendMessage('assistant', data.message);
        if (data.action === 'DOWNLOAD_CV') {
          triggerDownloadCV();
        }
        break;

      case 'complete':
      case 'error':
        this.setLoading(false);
        this.appendMessage(data.status === 'error' ? 'system' : 'assistant', data.message);
        break;
    }
  }

  sendMessage() {
    const text = this.input.value.trim();
    if (!text || !this.worker) return;

    this.input.value = '';
    this.appendMessage('user', text);
    this.setLoading(true);
    this.worker.postMessage({ text });
  }

  appendMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('chat-message', 'chat-' + role);
    msgDiv.innerText = text;
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
