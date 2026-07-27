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

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const pad = (part: number) => String(part).padStart(2, '0');
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  ].join(' ');
}

export function buildZoteroNoteHtml(markdown: string, metadata: NoteMetadata): string {
  const noteTitle = `AI 整理笔记 - ${formatDateTime(metadata.generatedAt)}`;
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

const MAX_XMIND_FILE_BYTES = 25 * 1024 * 1024;

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
  opml: string,
  dependencies: ExportDependencies = {}
): Promise<string | null> {
  return exportTextFile(
    parentWindow,
    documentTitle,
    opml,
    '导出 OPML 思维导图',
    'AI思维导图',
    dependencies,
    { extension: 'opml', filterLabel: 'OPML', filterPattern: '*.opml' }
  );
}

export async function selectXmindFile(
  parentWindow: any,
  dependencies: ExportDependencies = {}
): Promise<{ path: string; data: Uint8Array } | null> {
  const zotero = dependencies.zotero || Zotero;
  const FilePickerClass = dependencies.FilePicker
    || ChromeUtils.importESModule('chrome://zotero/content/modules/filePicker.mjs').FilePicker;
  const picker = new FilePickerClass();
  picker.init(parentWindow, '导入 XMind 思维导图', picker.modeOpen);
  picker.appendFilter('XMind', '*.xmind');
  const result = await picker.show();
  if (result !== picker.returnOK) {
    return null;
  }
  const file = picker.file;
  const binary = await zotero.File.getBinaryContentsAsync(file, MAX_XMIND_FILE_BYTES + 1);
  if (binary.length > MAX_XMIND_FILE_BYTES) {
    throw new Error('XMind 文件超过 25 MB 安全上限。');
  }
  const data = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    data[index] = binary.charCodeAt(index) & 0xff;
  }
  return {
    path: typeof file === 'string' ? file : file.path,
    data
  };
}

async function exportTextFile(
  parentWindow: any,
  documentTitle: string,
  content: string,
  dialogTitle: string,
  suffix: string,
  dependencies: ExportDependencies,
  format: { extension: string; filterLabel: string; filterPattern: string } = {
    extension: 'md',
    filterLabel: 'Markdown',
    filterPattern: '*.md'
  }
): Promise<string | null> {
  const zotero = dependencies.zotero || Zotero;
  const FilePickerClass = dependencies.FilePicker
    || ChromeUtils.importESModule('chrome://zotero/content/modules/filePicker.mjs').FilePicker;
  const picker = new FilePickerClass();
  picker.init(parentWindow, dialogTitle, picker.modeSave);
  const fallbackName = `${safeFileBaseName(documentTitle)}_${suffix}.${format.extension}`;
  picker.defaultString = zotero.File.getValidFileName
    ? zotero.File.getValidFileName(fallbackName)
    : fallbackName;
  picker.defaultExtension = format.extension;
  picker.appendFilter(format.filterLabel, format.filterPattern);
  const result = await picker.show();
  if (result !== picker.returnOK && result !== picker.returnReplace) {
    return null;
  }
  await zotero.File.putContentsAsync(picker.file, content);
  return picker.file;
}
