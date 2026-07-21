import type { ProviderConfig } from '../config/settings';
import type { EvidenceDebugData } from '../evidence/evidence-builder';
import {
  auditEditedMarkdown,
  createNotePipelineCheckpoint,
  generateValidatedNote,
  identifyFocusTopics,
  notePipelineReport,
  type FocusResult,
  type NotePipelineCheckpoint,
  type NotePipelineReport,
  type NotePipelineStage,
  type SelectedFocus
} from '../llm/note-pipeline';
import { markdownToSafeHtml } from '../output/markdown';
import { buildMermaidMindmap } from '../output/mindmap';
import {
  createZoteroChildNote,
  exportMindmapFile,
  exportMarkdownFile,
  type NoteMetadata
} from '../output/zotero-output';

export class PreviewController {
  private focusResult: FocusResult | null = null;
  private lastMarkdown = '';
  private activeAbortController: AbortController | null = null;
  private checkpoint: NotePipelineCheckpoint | null = null;
  private generationKey = '';
  private generationComplete = false;

  constructor(
    private parentWindow: any,
    private config: ProviderConfig,
    private data: EvidenceDebugData,
    private pluginVersion: string
  ) {}

  getInitialState() {
    return {
      documentTitle: this.data.document.title,
      annotationCount: this.data.stats.annotationCount,
      evidenceCount: this.data.stats.evidenceCount,
      contextualizedCount: this.data.stats.contextualizedCount,
      model: this.config.model
    };
  }

  async identifyFocus() {
    const abortController = this.beginRequest();
    try {
      this.focusResult = await identifyFocusTopics(
        this.config,
        this.data,
        undefined,
        abortController.signal
      );
      return this.focusResult;
    } finally {
      this.finishRequest(abortController);
    }
  }

  async generate(
    selectedFocus: SelectedFocus[],
    extraRequirement: string,
    onProgress?: (stage: NotePipelineStage, report: NotePipelineReport) => void
  ) {
    if (!this.focusResult) {
      throw new Error('请先完成关注重点识别。');
    }
    const key = JSON.stringify({ selectedFocus, extraRequirement });
    if (!this.checkpoint || this.generationKey !== key || this.generationComplete) {
      const selectedMap = new Map(selectedFocus.map(item => [item.id, item.priority]));
      const focusTopics = this.focusResult.focusTopics
        .filter(topic => selectedMap.has(topic.id))
        .map(topic => ({ ...topic, priority: selectedMap.get(topic.id)! }))
        .sort((first, second) => first.priority - second.priority);
      if (!focusTopics.length && !extraRequirement.trim()) {
        throw new Error('请至少选择一个关注重点，或填写本次特别关注的问题。');
      }
      this.checkpoint = createNotePipelineCheckpoint(focusTopics);
      this.generationKey = key;
      this.generationComplete = false;
    }
    const abortController = this.beginRequest();
    try {
      const result = await generateValidatedNote(
        this.config,
        this.data,
        this.focusResult.focusTopics,
        selectedFocus,
        extraRequirement,
        onProgress,
        undefined,
        { checkpoint: this.checkpoint, signal: abortController.signal }
      );
      this.lastMarkdown = result.note.markdownNote;
      this.generationComplete = true;
      return result;
    } finally {
      this.finishRequest(abortController);
    }
  }

  cancelActiveRequest() {
    this.activeAbortController?.abort();
  }

  getGenerationState() {
    return {
      report: this.checkpoint ? notePipelineReport(this.checkpoint) : null,
      noteMarkdown: this.checkpoint?.note?.markdownNote || '',
      hasOutline: Boolean(this.checkpoint?.outline),
      canRetry: Boolean(this.checkpoint && !this.generationComplete),
      nextStage: this.checkpoint?.nextStage || null
    };
  }

  renderMarkdown(markdown: string) {
    return markdownToSafeHtml(markdown);
  }

  buildMindmap(markdown: string) {
    if (!markdown.trim()) {
      throw new Error('没有可生成思维导图的已校验笔记。');
    }
    return buildMermaidMindmap(this.data.document.title, markdown);
  }

  async validateEdited(markdown: string) {
    const result = await auditEditedMarkdown(this.config, this.data, markdown);
    this.lastMarkdown = markdown;
    return result.validation;
  }

  async saveToZotero(markdown: string) {
    if (!markdown.trim()) {
      throw new Error('没有可写回的 Markdown 内容。');
    }
    const noteID = await createZoteroChildNote(
      this.data.document,
      markdown,
      this.metadata()
    );
    return { noteID };
  }

  async exportMarkdown(markdown: string) {
    if (!markdown.trim()) {
      throw new Error('没有可导出的 Markdown 内容。');
    }
    const path = await exportMarkdownFile(
      this.parentWindow,
      this.data.document.title,
      markdown
    );
    return { path };
  }

  async exportMindmap(markdown: string) {
    const mindmap = this.buildMindmap(markdown);
    const path = await exportMindmapFile(
      this.parentWindow,
      this.data.document.title,
      mindmap.markdown
    );
    return { path };
  }

  private metadata(): NoteMetadata {
    return {
      generatedAt: new Date().toISOString(),
      model: this.config.model,
      template: '通用学习笔记',
      mode: '批注 + 相邻上下文',
      evidenceCount: this.data.stats.evidenceCount,
      pluginVersion: this.pluginVersion
    };
  }

  private beginRequest(): AbortController {
    if (this.activeAbortController) {
      throw new Error('已有任务正在执行，请先取消或等待完成。');
    }
    const controller = new AbortController();
    this.activeAbortController = controller;
    return controller;
  }

  private finishRequest(controller: AbortController) {
    if (this.activeAbortController === controller) {
      this.activeAbortController = null;
    }
  }
}

export function openPreviewWindow(
  parentWindow: any,
  _rootURI: string,
  controller: PreviewController
): any {
  const availableWidth = Number(parentWindow.screen?.availWidth) || 1360;
  const availableHeight = Number(parentWindow.screen?.availHeight) || 860;
  const width = Math.max(760, Math.min(1280, availableWidth - 80));
  const height = Math.max(480, Math.min(780, availableHeight - 80));
  return parentWindow.openDialog(
    'chrome://zotero-ai-notes/content/preview/preview.xhtml',
    'zotero-ai-notes-preview',
    `chrome,centerscreen,resizable,width=${width},height=${height}`,
    { wrappedJSObject: { controller } }
  );
}
