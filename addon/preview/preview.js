var ZoteroAINotes_Preview = {
  controller: null,
  valid: false,
  dirty: false,
  busy: false,
  cancellable: false,
  mindmap: null,

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
    this.documentSummary = document.getElementById('document-summary');
    this.globalStatus = document.getElementById('global-status');
    this.focusLoading = document.getElementById('focus-loading');
    this.retryFocusButton = document.getElementById('retry-focus-button');
    this.focusList = document.getElementById('focus-list');
    this.focusWarnings = document.getElementById('focus-warnings');
    this.extraRequirement = document.getElementById('extra-requirement');
    this.generateButton = document.getElementById('generate-button');
    this.generationDetails = document.getElementById('generation-details');
    this.generationSummary = document.getElementById('generation-summary');
    this.generationStages = document.getElementById('generation-stages');
    this.generationFailure = document.getElementById('generation-failure');
    this.validateButton = document.getElementById('validate-button');
    this.editor = document.getElementById('markdown-editor');
    this.preview = document.getElementById('rendered-preview');
    this.notePreviewPanel = document.getElementById('note-preview-panel');
    this.mindmapPreviewPanel = document.getElementById('mindmap-preview-panel');
    this.noteTab = document.getElementById('note-tab');
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
  },

  bindEvents() {
    this.generateButton.addEventListener('click', () => this.generate());
    this.retryFocusButton.addEventListener('click', () => this.loadFocusTopics());
    this.validateButton.addEventListener('click', () => this.validateEdited());
    this.saveButton.addEventListener('click', () => this.save());
    this.exportButton.addEventListener('click', () => this.export());
    this.exportMindmapButton.addEventListener('click', () => this.exportMindmap());
    this.noteTab.addEventListener('click', () => this.showPreview('note'));
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
      this.updateActions();
    });
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
      this.generateButton.disabled = false;
      this.setGlobalStatus('请确认关注重点', 'success');
    } catch (error) {
      this.focusLoading.textContent = `识别失败原因：${this.errorMessage(error)}`;
      this.focusLoading.className = 'loading error';
      this.retryFocusButton.hidden = false;
      this.setGlobalStatus('识别失败', 'error');
    } finally {
      this.setBusy(false);
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

      const content = html('div');
      const title = html('strong');
      title.textContent = topic.title;
      const description = html('small');
      description.textContent = topic.description || topic.reason;
      content.append(title, description);

      const priorityRow = html('div');
      priorityRow.className = 'priority-row';
      const label = html('span');
      label.textContent = '优先级';
      const select = html('select');
      select.className = 'topic-priority';
      for (let value = 1; value <= Math.max(3, topics.length); value++) {
        const option = html('option');
        option.value = String(value);
        option.textContent = value === 1 ? '1（最高）' : String(value);
        option.selected = value === topic.priority;
        select.append(option);
      }
      priorityRow.append(label, select);
      card.append(checkbox, content, priorityRow);
      this.focusList.append(card);
    }
  },

  selectedFocus() {
    return [...this.focusList.querySelectorAll('.focus-topic')]
      .filter(card => card.querySelector('.topic-enabled').checked)
      .map(card => ({
        id: card.dataset.topicId,
        priority: Number(card.querySelector('.topic-priority').value)
      }));
  },

  async generate() {
    if (this.busy) return;
    this.actionMessage.textContent = '';
    this.setBusy(true, '正在规划、生成并执行后台审查…', true);
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
      this.applyValidation(result.validation);
      this.generateButton.textContent = '重新生成';
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
    } finally {
      this.setBusy(false);
      this.generateButton.disabled = false;
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
    if (!this.busy) window.close();
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
      outline: '规划笔记结构',
      note: '生成 Markdown 笔记',
      review: '审查内容与原文依据',
      revision: '自动修订',
      rereview: '复核修订结果'
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
    const html = this.controller.renderMarkdown(this.editor.value);
    this.preview.innerHTML = html || '<p class="placeholder">暂无内容</p>';
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
    this.showPreview('note');
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
    this.notePreviewPanel.hidden = showMindmap;
    this.mindmapPreviewPanel.hidden = !showMindmap;
    this.noteTab.classList.toggle('active', !showMindmap);
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
    } finally {
      this.setBusy(false);
      this.updateActions();
    }
  },

  applyValidation(validation) {
    this.valid = validation.valid;
    const messages = [];
    if (validation.valid) {
      messages.push('后台校验通过，可以写回或导出。');
    } else {
      messages.push('后台校验未通过，暂不允许写回或导出。');
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
    if (!this.valid || this.dirty || this.busy) return;
    this.setBusy(true, '正在写回 Zotero…');
    try {
      const result = await this.controller.saveToZotero(this.editor.value);
      this.actionMessage.textContent = `已创建新的 Zotero 子笔记（ID：${result.noteID}），未覆盖已有笔记。`;
      this.actionMessage.className = 'action-message success';
    } catch (error) {
      this.actionMessage.textContent = this.errorMessage(error);
      this.actionMessage.className = 'action-message error';
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
    } catch (error) {
      this.actionMessage.textContent = this.errorMessage(error);
      this.actionMessage.className = 'action-message error';
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
    } catch (error) {
      this.actionMessage.textContent = this.errorMessage(error);
      this.actionMessage.className = 'action-message error';
    } finally {
      this.setBusy(false);
      this.updateActions();
    }
  },

  setBusy(value, message, cancellable = false) {
    this.busy = value;
    this.cancellable = value && cancellable;
    this.cancelButton.textContent = this.cancellable ? '取消生成' : '关闭';
    this.cancelButton.disabled = value && !this.cancellable;
    if (value && message) this.setGlobalStatus(message, 'neutral');
    this.updateActions();
  },

  updateActions() {
    const canOutput = this.valid && !this.dirty && !this.busy;
    this.saveButton.disabled = !canOutput;
    this.exportButton.disabled = !canOutput;
    this.exportMindmapButton.disabled = !canOutput || !this.mindmap;
    this.mindmapTab.disabled = !canOutput || !this.mindmap;
    this.copyMindmapButton.disabled = !canOutput || !this.mindmap;
    this.validateButton.disabled = this.busy || !this.dirty || !this.editor.value.trim();
    if (this.busy) this.generateButton.disabled = true;
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
