var ZoteroAINotes_Preferences = {
  initialized: false,

  async init() {
    if (!this.initialized) {
      this.baseURL = document.getElementById('zotero-ai-notes-base-url');
      this.provider = document.getElementById('zotero-ai-notes-provider');
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
      this.provider.addEventListener('change', () => this.applyProviderPreset());
      this.initialized = true;
    }

    // Zotero applies preference bindings after the fragment's onload handler.
    // Refresh on the next task so explicit defaults are not overwritten with blanks.
    await new Promise(resolve => setTimeout(resolve, 0));
    await this.refresh();
  },

  async refresh() {
    const settings = await Zotero.ZoteroAINotes.settings.getPublicSettings();
    this.provider.value = settings.provider;
    this.baseURL.value = settings.baseURL;
    this.model.value = settings.model;
    this.apiKey.value = '';
    this.apiKey.placeholder = settings.hasApiKey
      ? '已安全保存；留空表示不修改'
      : '请输入 API Key';
    this.apiKeyStatus.textContent = settings.hasApiKey ? 'API Key 已保存' : '尚未配置 API Key';
  },

  async save(showResult = true) {
    try {
      await Zotero.ZoteroAINotes.settings.save({
        provider: this.provider.value,
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

  applyProviderPreset() {
    const presets = {
      gemini: ['https://generativelanguage.googleapis.com/v1beta/openai/', 'gemini-3.1-flash-lite'],
      openai: ['https://api.openai.com/v1/', 'gpt-4.1-mini'],
      deepseek: ['https://api.deepseek.com/v1/', 'deepseek-chat']
    };
    const preset = presets[this.provider.value];
    if (!preset) return;
    this.baseURL.value = preset[0];
    this.model.value = preset[1];
    this.showResult('已填入提供商预设；可继续修改 Base URL 和模型名称。', false);
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
