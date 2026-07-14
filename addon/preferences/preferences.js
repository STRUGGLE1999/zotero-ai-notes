var ZoteroAINotes_Preferences = {
  initialized: false,

  async init() {
    if (!this.initialized) {
      this.baseURL = document.getElementById('zotero-ai-notes-base-url');
      this.apiKey = document.getElementById('zotero-ai-notes-api-key');
      this.apiKeyStatus = document.getElementById('zotero-ai-notes-api-key-status');
      this.model = document.getElementById('zotero-ai-notes-model');
      this.result = document.getElementById('zotero-ai-notes-result');

      document.getElementById('zotero-ai-notes-save')
        .addEventListener('command', () => this.save());
      document.getElementById('zotero-ai-notes-test')
        .addEventListener('command', () => this.testConnection());
      document.getElementById('zotero-ai-notes-clear-key')
        .addEventListener('command', () => this.clearApiKey());
      this.initialized = true;
    }

    // Zotero applies preference bindings after the fragment's onload handler.
    // Refresh on the next task so explicit defaults are not overwritten with blanks.
    await new Promise(resolve => setTimeout(resolve, 0));
    await this.refresh();
  },

  async refresh() {
    const settings = await Zotero.ZoteroAINotes.settings.getPublicSettings();
    this.baseURL.value = settings.baseURL;
    this.model.value = settings.model;
    this.apiKey.value = '';
    this.apiKey.placeholder = settings.hasApiKey
      ? '已安全保存；留空表示不修改'
      : '请输入 Gemini API Key';
    this.apiKeyStatus.textContent = settings.hasApiKey ? 'API Key 已保存' : '尚未配置 API Key';
  },

  async save(showResult = true) {
    try {
      await Zotero.ZoteroAINotes.settings.save({
        baseURL: this.baseURL.value,
        model: this.model.value,
        apiKey: this.apiKey.value || undefined
      });
      await this.refresh();
      if (showResult) {
        this.showResult('配置已保存。', false);
      }
      return true;
    } catch (error) {
      this.showResult(error.message || String(error), true);
      return false;
    }
  },

  async testConnection() {
    this.showResult('正在测试连接…', false);
    if (!await this.save(false)) {
      return;
    }
    try {
      await Zotero.ZoteroAINotes.settings.testConnection();
      this.showResult('连接成功，API Key 和模型可用。', false);
    } catch (error) {
      this.showResult(error.message || String(error), true);
    }
  },

  async clearApiKey() {
    try {
      await Zotero.ZoteroAINotes.settings.clearApiKey();
      await this.refresh();
      this.showResult('API Key 已从本机凭据库清除。', false);
    } catch (error) {
      this.showResult(error.message || String(error), true);
    }
  },

  showResult(message, isError) {
    this.result.textContent = message;
    this.result.setAttribute('data-error', isError ? 'true' : 'false');
  }
};

document.addEventListener('showing', (event) => {
  if (event.target.id === 'zotero-ai-notes-preferences-pane') {
    ZoteroAINotes_Preferences.init();
  }
}, true);
