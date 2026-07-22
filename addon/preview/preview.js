var ZoteroAINotes_Preview = {
  controller: null,
  valid: false,
  dirty: false,
  busy: false,
  cancellable: false,
  mindmap: null,
  flowStage: 'focus',
  savedMarkdown: '',

  async init() {
    const payload = window.arguments?.[0]?.wrappedJSObject;
    if (!payload?.controller) {
      this.setGlobalStatus('无法读取生成任务。', 'error');
      return;
    }
    this.controller = payload.controller;
    this.cacheElements();
    this.bindEvents();

    const state = this.controller.getInitialState();
    this.documentSummary.textContent =
      `${state.documentTitle} · ${state.annotationCount} 条批注 · ` +
      `${state.contextualizedCount}/${state.evidenceCount} 条原文已定位 · ${state.model}`;
    await this.loadFocusTopics();
  },

  cacheElements() {
    this.appShell = document.getElementById('app-shell');
    this.documentSummary = document.getElementById('document-summary');
    this.globalStatus = document.getElementById('global-status');
    this.focusLoading = document.getElementById('focus-loading');
    this.retryFocusButton = document.getElementById('retry-focus-button');
    this.focusList = document.getElementById('focus-list');
    this.focusWarnings = document.getElementById('focus-warnings');
    this.focusSelectionSummary = document.getElementById('focus-selection-summary');
    this.focusNotice = document.getElementById('focus-notice');
    this.focusResultSummary = document.getElementById('focus-result-summary');
    this.extraRequirement = document.getElementById('extra-requirement');
    this.generateButton = document.getElementById('generate-button');
    this.retryGenerationButton = document.getElementById('retry-generation-button');
    this.adjustFocusButton = document.getElementById('adjust-focus-button');
    this.focusStage = document.getElementById('focus-stage');
    this.generationStage = document.getElementById('generation-stage');
    this.resultStage = document.getElementById('result-stage');
    this.generationDetails = document.getElementById('generation-details');
    this.generationSummary = document.getElementById('generation-summary');
    this.generationStages = document.getElementById('generation-stages');
    this.generationFailure = document.getElementById('generation-failure');
    this.validateButton = document.getElementById('validate-button');
    this.editor = document.getElementById('markdown-editor');
    this.preview = document.getElementById('rendered-preview');
    this.notePreviewPanel = document.getElementById('note-preview-panel');
    this.editorPreviewPanel = document.getElementById('editor-preview-panel');
    this.mindmapPreviewPanel = document.getElementById('mindmap-preview-panel');
    this.noteTab = document.getElementById('note-tab');
    this.editorTab = document.getElementById('editor-tab');
    this.mindmapTab = document.getElementById('mindmap-tab');
    this.mindmapSummary = document.getElementById('mindmap-summary');
    this.mindmapSvg = document.getElementById('mindmap-svg');
    this.mindmapTree = document.getElementById('mindmap-tree');
    this.mindmapSource = document.getElementById('mindmap-source');
    this.copyMindmapButton = document.getElementById('copy-mindmap-button');
    this.mindmapRenderFrame = document.getElementById('mindmap-render-frame');
    this.validationSummary = document.getElementById('validation-summary');
    this.actionMessage = document.getElementById('action-message');
    this.saveButton = document.getElementById('save-button');
    this.exportButton = document.getElementById('export-button');
    this.exportMindmapButton = document.getElementById('export-mindmap-button');
    this.cancelButton = document.getElementById('cancel-button');
    this.flowSteps = {
      focus: document.getElementById('step-focus'),
      generation: document.getElementById('step-generation'),
      result: document.getElementById('step-result')
    };
  },

  bindEvents() {
    this.generateButton.addEventListener('click', () => this.generate());
    this.retryGenerationButton.addEventListener('click', () => this.generate());
    this.adjustFocusButton.addEventListener('click', () => this.switchStage('focus'));
    this.retryFocusButton.addEventListener('click', () => this.loadFocusTopics());
    this.validateButton.addEventListener('click', () => this.validateEdited());
    this.saveButton.addEventListener('click', () => this.save());
    this.exportButton.addEventListener('click', () => this.export());
    this.exportMindmapButton.addEventListener('click', () => this.exportMindmap());
    this.noteTab.addEventListener('click', () => this.showPreview('note'));
    this.editorTab.addEventListener('click', () => this.showPreview('editor'));
    this.mindmapTab.addEventListener('click', () => this.showPreview('mindmap'));
    this.copyMindmapButton.addEventListener('click', () => this.copyMindmap());
    this.cancelButton.addEventListener('click', () => this.cancelOrClose());
    document.getElementById('close-button').addEventListener('click', () => {
      this.controller?.cancelActiveRequest();
      window.close();
    });
    window.addEventListener('beforeunload', () => this.controller?.cancelActiveRequest());
    this.editor.addEventListener('input', () => {
      this.render();
      this.dirty = true;
      this.valid = false;
      this.clearMindmap();
      this.validationSummary.textContent = '内容已修改，请重新执行后台校验后再保存或导出。';
      this.validationSummary.className = 'validation warning';
      this.setGlobalStatus('内容已修改，等待重新校验', 'warning');
      this.updateActions();
    });
    this.extraRequirement.addEventListener('input', () => this.updateFocusSelection());
  },

  async loadFocusTopics() {
    if (this.busy) return;
    this.focusLoading.hidden = false;
    this.focusLoading.textContent = '正在根据批注识别关注重点…';
    this.focusLoading.className = 'loading';
    this.retryFocusButton.hidden = true;
    this.focusWarnings.textContent = '';
    this.generateButton.disabled = true;
    this.setBusy(true, '正在识别关注重点…', true);
    try {
      const result = await this.controller.identifyFocus();
      this.focusLoading.hidden = true;
      this.focusWarnings.textContent = result.warnings.join('\n');
      this.renderFocusTopics(result.focusTopics);
      this.setGlobalStatus('请确认关注重点', 'success');
    } catch (error) {
      this.focusLoading.textContent = `识别失败原因：${this.errorMessage(error)}`;
      this.focusLoading.className = 'loading error';
      this.retryFocusButton.hidden = false;
      this.setGlobalStatus('识别失败', 'error');
    } finally {
      this.setBusy(false);
      this.updateFocusSelection();
    }
  },

  renderFocusTopics(topics) {
    this.focusList.replaceChildren();
    const html = name => document.createElementNS('http://www.w3.org/1999/xhtml', name);
    for (const topic of topics) {
      const card = html('div');
      card.className = 'focus-topic';
      card.dataset.topicId = topic.id;

      const checkbox = html('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      checkbox.className = 'topic-enabled';
      checkbox.setAttribute('aria-label', `选择主题：${topic.title}`);

      const content = html('div');
      const title = html('strong');
      title.textContent = topic.title;
      const description = html('small');
      description.textContent = topic.description || topic.reason;
      content.append(title, description);

      const emphasisButton = html('button');
      emphasisButton.type = 'button';
      emphasisButton.className = 'topic-emphasis';
      emphasisButton.textContent = '☆ 设为重点';
      emphasisButton.setAttribute('aria-pressed', 'false');
      emphasisButton.addEventListener('click', () => this.toggleTopicEmphasis(card));
      checkbox.addEventListener('change', () => {
        if (!checkbox.checked) this.setTopicEmphasis(card, false);
        this.updateFocusSelection();
      });
      card.append(checkbox, content, emphasisButton);
      this.focusList.append(card);
    }
    this.updateFocusSelection();
  },

  toggleTopicEmphasis(card) {
    const emphasized = card.classList.contains('emphasized');
    if (!emphasized) {
      const count = this.focusList.querySelectorAll('.focus-topic.emphasized').length;
      if (count >= 2) {
        this.focusNotice.textContent = '最多选择 2 个重点主题。请先取消一个已有重点。';
        this.focusNotice.className = 'message-list warning';
        return;
      }
      card.querySelector('.topic-enabled').checked = true;
    }
    this.setTopicEmphasis(card, !emphasized);
    this.focusNotice.textContent = '';
    this.updateFocusSelection();
  },

  setTopicEmphasis(card, emphasized) {
    card.classList.toggle('emphasized', emphasized);
    const button = card.querySelector('.topic-emphasis');
    button.textContent = emphasized ? '★ 重点主题' : '☆ 设为重点';
    button.setAttribute('aria-pressed', String(emphasized));
  },

  updateFocusSelection() {
    const selectedCards = [...this.focusList.querySelectorAll('.focus-topic')]
      .filter(card => card.querySelector('.topic-enabled').checked);
    const emphasizedCount = selectedCards.filter(card => card.classList.contains('emphasized')).length;
    this.focusSelectionSummary.textContent =
      `已选择 ${selectedCards.length} 个主题 · ${emphasizedCount} 个重点`;
    this.generateButton.disabled = this.busy ||
      (!selectedCards.length && !this.extraRequirement.value.trim());
  },

  selectedFocus() {
    return [...this.focusList.querySelectorAll('.focus-topic')]
      .filter(card => card.querySelector('.topic-enabled').checked)
      .map(card => ({
        id: card.dataset.topicId,
        priority: card.classList.contains('emphasized') ? 1 : 2
      }));
  },

  async generate() {
    if (this.busy) return;
    this.actionMessage.textContent = '';
    this.retryGenerationButton.hidden = true;
    this.switchStage('generation');
    this.setBusy(true, '正在生成笔记并执行风险校验…', true);
    this.generateButton.textContent = '正在生成…';
    try {
      const result = await this.controller.generate(
        this.selectedFocus(),
        this.extraRequirement.value.trim(),
        (stage, report) => {
          this.setGlobalStatus(stage, 'neutral');
          this.renderGenerationReport(report);
        }
      );
      this.renderGenerationReport(this.controller.getGenerationState().report);
      this.editor.value = result.note.markdownNote;
      this.render();
      this.dirty = false;
      this.savedMarkdown = '';
      this.applyValidation(result.validation);
      this.generateButton.textContent = '重新生成';
      this.focusResultSummary.textContent = this.focusSelectionSummary.textContent;
      this.switchStage('result');
      this.showPreview('note');
      this.setGlobalStatus(result.validation.valid ? '生成并校验通过' : '需要复核',
        result.validation.valid ? 'success' : 'warning');
    } catch (error) {
      const state = this.controller.getGenerationState();
      this.renderGenerationReport(state.report);
      if (state.noteMarkdown) {
        this.editor.value = state.noteMarkdown;
        this.render();
        this.dirty = false;
        this.valid = false;
        this.validationSummary.textContent =
          '已保留生成完成的笔记内容；当前结果尚未完成审查，请从失败阶段重试。';
        this.validationSummary.className = 'validation warning';
      }
      const cancelled = state.report?.cancelled;
      const preserved = state.noteMarkdown
        ? '已保留生成完成的笔记内容。'
        : state.hasOutline
        ? '已保留生成完成的大纲。'
        : '当前阶段可以重新尝试。';
      this.actionMessage.textContent = cancelled
        ? `生成已取消，${preserved}`
        : `失败原因：${this.errorMessage(error)}`;
      this.actionMessage.className = 'action-message error';
      this.setGlobalStatus(cancelled ? '生成已取消' : '生成失败', 'error');
      this.generateButton.textContent = state.canRetry ? '从当前阶段重试' : '重新生成';
      this.retryGenerationButton.textContent = this.generateButton.textContent;
      this.retryGenerationButton.hidden = false;
    } finally {
      this.setBusy(false);
      this.updateFocusSelection();
      this.updateActions();
    }
  },

  cancelOrClose() {
    if (this.busy && this.cancellable) {
      this.controller.cancelActiveRequest();
      this.cancelButton.disabled = true;
      this.cancelButton.textContent = '正在取消…';
      this.setGlobalStatus('正在取消当前请求…', 'warning');
      return;
    }
  },

  switchStage(stage) {
    this.flowStage = stage;
    this.appShell.dataset.stage = stage;
    this.focusStage.hidden = stage !== 'focus';
    this.generationStage.hidden = stage !== 'generation';
    this.resultStage.hidden = stage !== 'result';
    const order = ['focus', 'generation', 'result'];
    const currentIndex = order.indexOf(stage);
    for (const [name, element] of Object.entries(this.flowSteps)) {
      const index = order.indexOf(name);
      element.classList.toggle('active', name === stage);
      element.classList.toggle('completed', index < currentIndex);
    }
    this.updateActions();
  },

  renderGenerationReport(report) {
    if (!report) return;
    this.generationDetails.hidden = false;
    this.generationSummary.textContent =
      `本次已调用模型 ${report.callCount} 次 · 累计耗时 ${this.formatDuration(report.durationMs)}`;
    this.generationStages.replaceChildren();
    const icons = {
      pending: '○', running: '◌', completed: '✓', skipped: '–', failed: '×', cancelled: '■'
    };
    const labels = {
      outline: '整理笔记结构（本地）',
      note: '生成 Markdown 笔记',
      review: '风险触发时模型审查',
      revision: '再次修订（仅必要时）',
      rereview: '额外复核'
    };
    for (const stage of report.stages) {
      const row = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      row.className = `generation-stage ${stage.status}`;
      const icon = document.createElementNS('http://www.w3.org/1999/xhtml', 'span');
      icon.className = 'stage-icon';
      icon.textContent = icons[stage.status];
      const name = document.createElementNS('http://www.w3.org/1999/xhtml', 'span');
      name.textContent = labels[stage.id];
      const meta = document.createElementNS('http://www.w3.org/1999/xhtml', 'span');
      meta.className = 'stage-meta';
      meta.textContent = stage.status === 'skipped'
        ? '无需执行'
        : stage.status === 'completed' && !stage.callCount
        ? `${this.formatDuration(stage.durationMs)} · 本地`
        : stage.callCount
        ? `${this.formatDuration(stage.durationMs)} · ${stage.callCount} 次`
        : '未开始';
      row.append(icon, name, meta);
      this.generationStages.append(row);
    }
    this.generationFailure.hidden = !report.failureReason;
    this.generationFailure.textContent = report.failureReason
      ? `失败原因：${report.failureReason}`
      : '';
  },

  formatDuration(durationMs) {
    if (durationMs < 1000) return `${durationMs} 毫秒`;
    return `${(durationMs / 1000).toFixed(1)} 秒`;
  },

  render() {
    const rendered = this.controller.renderMarkdown(this.editor.value);
    if (!rendered) {
      const placeholder = document.createElementNS(
        'http://www.w3.org/1999/xhtml',
        'p'
      );
      placeholder.className = 'placeholder';
      placeholder.textContent = '暂无内容';
      this.preview.replaceChildren(placeholder);
      return;
    }

    // In a XUL document, assigning innerHTML can create XUL elements named
    // "h2" and "p". Import parsed HTML nodes so headings and paragraphs keep
    // their XHTML namespace and block layout.
    const parsed = new DOMParser().parseFromString(rendered, 'text/html');
    const nodes = [...parsed.body.childNodes]
      .map(node => document.importNode(node, true));
    this.preview.replaceChildren(...nodes);
  },

  async refreshMindmap() {
    const mindmap = this.controller.buildMindmap(this.editor.value);
    this.mindmap = null;
    this.mindmapSource.value = mindmap.source;
    this.mindmapSvg.replaceChildren();
    this.mindmapTree.hidden = true;
    this.updateActions();
    const warnings = mindmap.warnings.length
      ? ` · ${mindmap.warnings.join('；')}`
      : '';
    this.mindmapSummary.textContent =
      `正在使用 Mermaid 校验并渲染 ${mindmap.nodeCount} 个节点…`;
    this.mindmapSummary.className = 'hint';
    try {
      const rendered = await this.renderMindmapInFrame(
        `zotero-ai-mindmap-${Date.now()}`,
        mindmap.source
      );
      this.mindmapSvg.innerHTML = rendered.svg;
      this.mindmap = mindmap;
      this.mindmapSummary.textContent =
        `Mermaid mindmap · ${mindmap.nodeCount} 个节点 · ${mindmap.maxDepth} 层${warnings}`;
      this.mindmapSummary.className = 'hint';
      this.renderMindmapTree(mindmap.tree);
    } catch (error) {
      // Mermaid source is still a valid, exportable deliverable when Zotero's
      // embedded browser cannot render the SVG. Keep the tree/source preview
      // available so a renderer-specific failure does not block phase 6.
      this.mindmap = mindmap;
      this.mindmapSummary.textContent =
        `Mermaid SVG 渲染失败，已显示结构预览：${this.errorMessage(error)}`;
      this.mindmapSummary.className = 'error';
      this.renderMindmapTree(mindmap.tree);
      this.mindmapTree.hidden = false;
    } finally {
      this.updateActions();
    }
  },

  async renderMindmapInFrame(id, source) {
    const frame = this.mindmapRenderFrame;
    const getRenderer = () => frame?.contentWindow?.renderMermaidMindmap;
    if (!getRenderer()) {
      await new Promise((resolve, reject) => {
        const timeout = window.setTimeout(
          () => reject(new Error('Mermaid 渲染帧加载超时。')),
          5000
        );
        frame.addEventListener('load', () => {
          window.clearTimeout(timeout);
          resolve();
        }, { once: true });
      });
    }
    const renderer = getRenderer();
    if (typeof renderer !== 'function') {
      throw new Error('Mermaid 渲染帧未正确初始化。');
    }
    return renderer(id, source);
  },

  clearMindmap() {
    this.mindmap = null;
    this.mindmapSource.value = '';
    this.mindmapSvg.replaceChildren();
    this.mindmapTree.replaceChildren();
    this.mindmapSummary.textContent = '笔记校验通过后生成 Mermaid 思维导图。';
    this.mindmapSummary.className = 'hint';
  },

  renderMindmapTree(tree) {
    this.mindmapTree.replaceChildren();
    const buildList = nodes => {
      const list = document.createElementNS('http://www.w3.org/1999/xhtml', 'ul');
      for (const node of nodes) {
        const item = document.createElementNS('http://www.w3.org/1999/xhtml', 'li');
        const label = document.createElementNS('http://www.w3.org/1999/xhtml', 'span');
        label.className = 'mindmap-node';
        label.textContent = node.text;
        item.append(label);
        if (node.children.length) item.append(buildList(node.children));
        list.append(item);
      }
      return list;
    };
    this.mindmapTree.append(buildList([tree]));
  },

  showPreview(kind) {
    const showMindmap = kind === 'mindmap' && Boolean(this.mindmap);
    const showEditor = kind === 'editor';
    this.notePreviewPanel.hidden = showMindmap || showEditor;
    this.editorPreviewPanel.hidden = !showEditor;
    this.mindmapPreviewPanel.hidden = !showMindmap;
    this.noteTab.classList.toggle('active', !showMindmap && !showEditor);
    this.editorTab.classList.toggle('active', showEditor);
    this.mindmapTab.classList.toggle('active', showMindmap);
  },

  async copyMindmap() {
    if (!this.mindmap || this.busy) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(this.mindmap.source);
      } else {
        this.mindmapSource.focus();
        this.mindmapSource.select();
        document.execCommand('copy');
      }
      this.actionMessage.textContent = 'Mermaid 源码已复制。';
      this.actionMessage.className = 'action-message success';
    } catch (error) {
      this.actionMessage.textContent = this.errorMessage(error);
      this.actionMessage.className = 'action-message error';
    }
  },

  async validateEdited() {
    if (this.busy || !this.editor.value.trim()) return;
    this.setBusy(true, '正在重新建立映射并校验…');
    try {
      const validation = await this.controller.validateEdited(this.editor.value);
      this.dirty = false;
      this.applyValidation(validation);
      this.setGlobalStatus(validation.valid ? '校验通过' : '需要复核',
        validation.valid ? 'success' : 'warning');
    } catch (error) {
      this.validationSummary.textContent = this.errorMessage(error);
      this.validationSummary.className = 'validation error';
      this.valid = false;
      this.setGlobalStatus('校验失败', 'error');
    } finally {
      this.setBusy(false);
      this.updateActions();
    }
  },

  applyValidation(validation) {
    this.valid = validation.valid;
    const messages = [];
    if (validation.valid) {
      messages.push('内容已通过依据检查，可以写回或导出。');
    } else {
      messages.push('内容依据检查未通过，暂不允许写回或导出。');
    }
    if (validation.errors.length) messages.push(...validation.errors.map(item => `错误：${item}`));
    if (validation.warnings.length) messages.push(...validation.warnings.map(item => `提示：${item}`));
    this.validationSummary.textContent = messages.join('\n');
    this.validationSummary.className = `validation ${validation.valid ? 'success' : 'warning'}`;
    if (validation.valid) {
      this.refreshMindmap();
    } else {
      this.clearMindmap();
    }
    this.updateActions();
  },

  async save() {
    if (!this.valid || this.dirty || this.busy || this.savedMarkdown === this.editor.value) return;
    this.setBusy(true, '正在写回 Zotero…');
    try {
      const result = await this.controller.saveToZotero(this.editor.value);
      this.savedMarkdown = this.editor.value;
      this.actionMessage.textContent = `已创建新的 Zotero 子笔记（ID：${result.noteID}），未覆盖已有笔记。`;
      this.actionMessage.className = 'action-message success';
      this.setGlobalStatus('已写回 Zotero', 'success');
    } catch (error) {
      this.actionMessage.textContent = this.errorMessage(error);
      this.actionMessage.className = 'action-message error';
      this.setGlobalStatus('写回失败', 'error');
    } finally {
      this.setBusy(false);
      this.updateActions();
    }
  },

  async export() {
    if (!this.valid || this.dirty || this.busy) return;
    this.setBusy(true, '请选择 Markdown 保存位置…');
    try {
      const result = await this.controller.exportMarkdown(this.editor.value);
      this.actionMessage.textContent = result.path ? `Markdown 已导出：${result.path}` : '已取消导出。';
      this.actionMessage.className = `action-message ${result.path ? 'success' : 'neutral'}`;
      this.setGlobalStatus(result.path ? 'Markdown 已导出' : '已取消导出',
        result.path ? 'success' : 'neutral');
    } catch (error) {
      this.actionMessage.textContent = this.errorMessage(error);
      this.actionMessage.className = 'action-message error';
      this.setGlobalStatus('导出失败', 'error');
    } finally {
      this.setBusy(false);
      this.updateActions();
    }
  },

  async exportMindmap() {
    if (!this.valid || this.dirty || this.busy || !this.mindmap) return;
    this.setBusy(true, '请选择 Mermaid 思维导图保存位置…');
    try {
      const result = await this.controller.exportMindmap(this.editor.value);
      this.actionMessage.textContent = result.path
        ? `Mermaid 思维导图已导出：${result.path}`
        : '已取消导出。';
      this.actionMessage.className = `action-message ${result.path ? 'success' : 'neutral'}`;
      this.setGlobalStatus(result.path ? '思维导图已导出' : '已取消导出',
        result.path ? 'success' : 'neutral');
    } catch (error) {
      this.actionMessage.textContent = this.errorMessage(error);
      this.actionMessage.className = 'action-message error';
      this.setGlobalStatus('导出失败', 'error');
    } finally {
      this.setBusy(false);
      this.updateActions();
    }
  },

  setBusy(value, message, cancellable = false) {
    this.busy = value;
    this.cancellable = value && cancellable;
    this.cancelButton.hidden = !this.cancellable;
    this.cancelButton.textContent = this.flowStage === 'focus' ? '取消识别' : '取消生成';
    this.cancelButton.disabled = false;
    if (value && message) this.setGlobalStatus(message, 'neutral');
    this.updateActions();
  },

  updateActions() {
    const canOutput = this.valid && !this.dirty && !this.busy;
    const alreadySaved = canOutput && this.savedMarkdown === this.editor.value;
    this.saveButton.textContent = alreadySaved ? '已写回 Zotero' : '写回 Zotero';
    this.saveButton.disabled = !canOutput || alreadySaved;
    this.exportButton.disabled = !canOutput;
    this.exportMindmapButton.disabled = !canOutput || !this.mindmap;
    this.mindmapTab.disabled = !canOutput || !this.mindmap;
    this.copyMindmapButton.disabled = !canOutput || !this.mindmap;
    this.validateButton.disabled = this.busy || !this.dirty || !this.editor.value.trim();
    this.adjustFocusButton.disabled = this.busy;
    for (const control of this.focusList.querySelectorAll('input, button')) {
      control.disabled = this.busy;
    }
    this.extraRequirement.disabled = this.busy;
    if (this.busy) {
      this.generateButton.disabled = true;
      this.retryGenerationButton.disabled = true;
    } else {
      this.retryGenerationButton.disabled = false;
      const hasSelectedFocus = [...this.focusList.querySelectorAll('.focus-topic')]
        .some(card => card.querySelector('.topic-enabled').checked);
      this.generateButton.disabled = !hasSelectedFocus && !this.extraRequirement.value.trim();
    }
    const showResultActions = this.flowStage === 'result';
    this.saveButton.hidden = !showResultActions;
    this.exportButton.hidden = !showResultActions;
    this.exportMindmapButton.hidden = !showResultActions;
  },

  setGlobalStatus(message, state) {
    this.globalStatus.textContent = message;
    this.globalStatus.className = `status ${state}`;
  },

  errorMessage(error) {
    return error?.message || String(error);
  }
};

window.addEventListener('load', () => ZoteroAINotes_Preview.init(), { once: true });
