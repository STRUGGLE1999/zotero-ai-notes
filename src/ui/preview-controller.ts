import type { ProviderConfig } from '../config/settings';
import type { EvidenceDebugData } from '../evidence/evidence-builder';
import {
  auditEditedMarkdown,
  generateValidatedNote,
  identifyFocusTopics,
  type FocusResult,
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
    this.focusResult = await identifyFocusTopics(this.config, this.data);
    return this.focusResult;
  }

  async generate(selectedFocus: SelectedFocus[], extraRequirement: string) {
    if (!this.focusResult) {
      throw new Error('请先完成关注重点识别。');
    }
    const result = await generateValidatedNote(
      this.config,
      this.data,
      this.focusResult.focusTopics,
      selectedFocus,
      extraRequirement
    );
    this.lastMarkdown = result.note.markdownNote;
    return result;
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
}

export function openPreviewWindow(
  parentWindow: any,
  _rootURI: string,
  controller: PreviewController
): any {
  return parentWindow.openDialog(
    'chrome://zotero-ai-notes/content/preview/preview.xhtml',
    'zotero-ai-notes-preview',
    'chrome,centerscreen,resizable,width=1280,height=780',
    { wrappedJSObject: { controller } }
  );
}
