import { escapeHtml, markdownToSafeHtml, safeFileBaseName } from './markdown';

declare const Zotero: any;
declare const ChromeUtils: any;

export interface NoteMetadata {
  generatedAt: string;
  model: string;
  template: string;
  mode: string;
  evidenceCount: number;
  pluginVersion: string;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toISOString().slice(0, 10);
}

export function buildZoteroNoteHtml(markdown: string, metadata: NoteMetadata): string {
  const noteTitle = `AI 整理笔记 - ${formatDate(metadata.generatedAt)}`;
  const rendered = markdownToSafeHtml(markdown).replace(/^<h1>.*?<\/h1>\s*/s, '');
  return [
    `<h1>${escapeHtml(noteTitle)}</h1>`,
    '<p><strong>生成信息</strong></p>',
    '<ul>',
    `<li>生成时间：${escapeHtml(metadata.generatedAt)}</li>`,
    `<li>模型：${escapeHtml(metadata.model)}</li>`,
    `<li>模板：${escapeHtml(metadata.template)}</li>`,
    `<li>模式：${escapeHtml(metadata.mode)}</li>`,
    `<li>证据数量：${metadata.evidenceCount}</li>`,
    `<li>插件版本：${escapeHtml(metadata.pluginVersion)}</li>`,
    '</ul>',
    rendered
  ].join('\n');
}

export async function createZoteroChildNote(
  document: { id: number; libraryID: number },
  markdown: string,
  metadata: NoteMetadata,
  zotero: any = Zotero
): Promise<number> {
  const note = new zotero.Item('note');
  note.libraryID = document.libraryID;
  note.parentItemID = document.id;
  note.setNote(buildZoteroNoteHtml(markdown, metadata));
  return note.saveTx({
    notifierData: { autoSyncDelay: zotero.Notes?.AUTO_SYNC_DELAY }
  });
}

interface ExportDependencies {
  FilePicker?: new () => any;
  zotero?: any;
}

export async function exportMarkdownFile(
  parentWindow: any,
  documentTitle: string,
  markdown: string,
  dependencies: ExportDependencies = {}
): Promise<string | null> {
  return exportTextFile(
    parentWindow,
    documentTitle,
    markdown,
    '导出 Markdown',
    'AI整理笔记',
    dependencies
  );
}

export async function exportMindmapFile(
  parentWindow: any,
  documentTitle: string,
  markmapMarkdown: string,
  dependencies: ExportDependencies = {}
): Promise<string | null> {
  return exportTextFile(
    parentWindow,
    documentTitle,
    markmapMarkdown,
    '导出 Mermaid 思维导图',
    'AI思维导图',
    dependencies
  );
}

async function exportTextFile(
  parentWindow: any,
  documentTitle: string,
  content: string,
  dialogTitle: string,
  suffix: string,
  dependencies: ExportDependencies
): Promise<string | null> {
  const zotero = dependencies.zotero || Zotero;
  const FilePickerClass = dependencies.FilePicker
    || ChromeUtils.importESModule('chrome://zotero/content/modules/filePicker.mjs').FilePicker;
  const picker = new FilePickerClass();
  picker.init(parentWindow, dialogTitle, picker.modeSave);
  const fallbackName = `${safeFileBaseName(documentTitle)}_${suffix}.md`;
  picker.defaultString = zotero.File.getValidFileName
    ? zotero.File.getValidFileName(fallbackName)
    : fallbackName;
  picker.defaultExtension = 'md';
  picker.appendFilter('Markdown', '*.md');
  const result = await picker.show();
  if (result !== picker.returnOK && result !== picker.returnReplace) {
    return null;
  }
  await zotero.File.putContentsAsync(picker.file, content);
  return picker.file;
}
