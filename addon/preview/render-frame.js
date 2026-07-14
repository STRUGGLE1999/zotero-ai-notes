var ZoteroAINotes_MermaidFrame = {
  initialized: false,

  initialize() {
    if (this.initialized) return;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'default'
    });
    this.initialized = true;
  },

  async render(id, source) {
    this.initialize();
    await mermaid.parse(source);
    const host = document.getElementById('mermaid-render-host');
    if (!host) throw new Error('Mermaid 渲染容器不存在。');
    return mermaid.render(id, source, host);
  }
};

window.renderMermaidMindmap = (id, source) =>
  ZoteroAINotes_MermaidFrame.render(id, source);
