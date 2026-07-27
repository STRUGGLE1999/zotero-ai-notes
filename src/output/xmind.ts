import JSZip from 'jszip';
import {
  countMindmapNodes,
  mindmapDepth,
  type MindmapDocument,
  type MindmapNode,
  type MindmapResult,
  type MindmapSheet
} from './mindmap';

const MAX_XMIND_FILE_BYTES = 25 * 1024 * 1024;
const MAX_CONTENT_BYTES = 12 * 1024 * 1024;
const MAX_NODES = 5000;
const MAX_DEPTH = 32;

interface ImmediateRuntime {
  setImmediate?: (callback: (...args: unknown[]) => void, ...args: unknown[]) => number;
}

function ensureSetImmediate(): void {
  const runtime = globalThis as unknown as ImmediateRuntime;
  if (typeof runtime.setImmediate === 'function') {
    return;
  }
  runtime.setImmediate = (callback, ...args) =>
    setTimeout(() => callback(...args), 0) as unknown as number;
}

interface XmindTopic {
  id?: unknown;
  title?: unknown;
  notes?: { plain?: { content?: unknown } };
  children?: { attached?: unknown };
}

interface XmindSheet {
  id?: unknown;
  title?: unknown;
  rootTopic?: unknown;
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asTopic(value: unknown): XmindTopic {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('XMind 主题结构无效。');
  }
  return value as XmindTopic;
}

function parseTopic(value: unknown, depth: number, state: { count: number }): MindmapNode {
  if (depth > MAX_DEPTH) {
    throw new Error(`XMind 层级超过安全上限（${MAX_DEPTH} 层）。`);
  }
  if (++state.count > MAX_NODES) {
    throw new Error(`XMind 节点超过安全上限（${MAX_NODES} 个）。`);
  }
  const topic = asTopic(value);
  const rawChildren = topic.children?.attached;
  const attached = Array.isArray(rawChildren) ? rawChildren : [];
  const note = topic.notes?.plain?.content;
  return {
    id: text(topic.id, `xmind-node-${state.count}`),
    text: text(topic.title, '未命名主题'),
    children: attached.map(child => parseTopic(child, depth + 1, state)),
    ...(typeof note === 'string' && note.trim() ? { note: note.trim() } : {})
  };
}

function parseContent(content: unknown): MindmapDocument {
  if (!Array.isArray(content) || !content.length) {
    throw new Error('XMind 文件中没有可用画布。');
  }
  const state = { count: 0 };
  const sheets: MindmapSheet[] = content.map((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('XMind 画布结构无效。');
    }
    const sheet = value as XmindSheet;
    const title = text(sheet.title, `画布 ${index + 1}`);
    return {
      id: text(sheet.id, `xmind-sheet-${index + 1}`),
      title,
      root: parseTopic(sheet.rootTopic, 1, state)
    };
  });
  return {
    title: sheets[0].title,
    source: 'xmind',
    sheets
  };
}

export async function parseXmindFile(data: Uint8Array | ArrayBuffer): Promise<MindmapResult> {
  ensureSetImmediate();
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (!bytes.byteLength) {
    throw new Error('XMind 文件为空。');
  }
  if (bytes.byteLength > MAX_XMIND_FILE_BYTES) {
    throw new Error('XMind 文件超过 25 MB 安全上限。');
  }
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new Error('无法打开 XMind 文件：文件不是有效的 ZIP 容器。');
  }
  const entry = zip.file('content.json');
  if (!entry) {
    if (zip.file('content.xml')) {
      throw new Error('这是旧版 XMind 文件，当前版本暂不支持 content.xml。');
    }
    throw new Error('XMind 文件缺少 content.json。');
  }
  const internalSize = (entry as unknown as { _data?: { uncompressedSize?: number } })
    ._data?.uncompressedSize;
  if (typeof internalSize === 'number' && internalSize > MAX_CONTENT_BYTES) {
    throw new Error('XMind 内容超过 12 MB 安全上限。');
  }
  const source = await entry.async('string');
  if (new TextEncoder().encode(source).byteLength > MAX_CONTENT_BYTES) {
    throw new Error('XMind 内容超过 12 MB 安全上限。');
  }
  let content: unknown;
  try {
    content = JSON.parse(source);
  } catch {
    throw new Error('XMind content.json 不是有效 JSON。');
  }
  const document = parseContent(content);
  const tree = document.sheets[0].root;
  return {
    document,
    tree,
    nodeCount: document.sheets.reduce((total, sheet) => total + countMindmapNodes(sheet.root), 0),
    maxDepth: Math.max(...document.sheets.map(sheet => mindmapDepth(sheet.root))),
    warnings: document.sheets.length > 1
      ? [`文件包含 ${document.sheets.length} 个画布，当前显示第一个画布。`]
      : []
  };
}
