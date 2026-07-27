export interface MindmapNode {
  id: string;
  text: string;
  children: MindmapNode[];
  note?: string;
}

export interface MindmapSheet {
  id: string;
  title: string;
  root: MindmapNode;
}

export interface MindmapDocument {
  title: string;
  sheets: MindmapSheet[];
  source: 'generated' | 'xmind';
}

export interface MindmapResult {
  document: MindmapDocument;
  tree: MindmapNode;
  nodeCount: number;
  maxDepth: number;
  warnings: string[];
}

const EVIDENCE_ID_PATTERN = /\s*\[(?:E-[A-Z0-9-]+)(?:\s*,\s*E-[A-Z0-9-]+)*\]/gi;
const MAX_NODE_LENGTH = 72;

function cleanInline(value: string): string {
  return value
    .replace(EVIDENCE_ID_PATTERN, '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^\s*>\s?/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function conciseNode(value: string): string {
  const cleaned = cleanInline(value);
  if (cleaned.length <= MAX_NODE_LENGTH) {
    return cleaned;
  }
  const candidate = cleaned.slice(0, MAX_NODE_LENGTH);
  const boundary = Math.max(
    ...['：', ':', '，', ',', '。', '；', ';', '！', '!', '？', '?']
      .map(character => candidate.lastIndexOf(character))
  );
  if (boundary >= 12) {
    return candidate.slice(0, boundary).trim();
  }
  const wordBoundary = candidate.lastIndexOf(' ');
  return wordBoundary >= 12 ? candidate.slice(0, wordBoundary).trim() : candidate.trim();
}

function appendNode(
  root: MindmapNode,
  stack: MindmapNode[],
  depth: number,
  value: string,
  seen: Set<string>,
  nextID: () => string
): boolean {
  const text = conciseNode(value);
  const safeDepth = Math.max(2, Math.min(5, depth));
  if (!text || seen.has(`${safeDepth}:${text}`)) {
    return false;
  }
  seen.add(`${safeDepth}:${text}`);
  const node: MindmapNode = { id: nextID(), text, children: [] };
  const parent = stack[safeDepth - 2] || root;
  parent.children.push(node);
  stack[safeDepth - 1] = node;
  stack.length = safeDepth;
  return true;
}

export function countMindmapNodes(node: MindmapNode): number {
  return 1 + node.children.reduce((total, child) => total + countMindmapNodes(child), 0);
}

export function mindmapDepth(node: MindmapNode): number {
  return node.children.length ? 1 + Math.max(...node.children.map(mindmapDepth)) : 1;
}

export function buildMindmapDocument(
  documentTitle: string,
  markdownNote: string
): MindmapResult {
  const title = conciseNode(documentTitle) || '文献笔记';
  let sequence = 0;
  const nextID = () => `generated-${++sequence}`;
  const root: MindmapNode = { id: nextID(), text: title, children: [] };
  const stack: MindmapNode[] = [root];
  const seen = new Set<string>();
  const warnings: string[] = [];
  const inputLines = markdownNote.replace(/\r\n?/g, '\n').split('\n');
  const headingLevels = inputLines
    .map(line => line.match(/^(#{1,6})\s+(.+)$/)?.[1].length)
    .filter((level): level is number => typeof level === 'number');
  const minimumHeading = headingLevels.length ? Math.min(...headingLevels) : 1;
  let currentDepth = 1;
  let paragraph: string[] = [];
  let inCode = false;

  const flushParagraph = () => {
    const value = paragraph.join(' ').trim();
    paragraph = [];
    if (value) {
      appendNode(root, stack, currentDepth + 1, value, seen, nextID);
    }
  };

  for (const line of inputLines) {
    if (/^```/.test(line.trim())) {
      flushParagraph();
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      currentDepth = Math.min(5, heading[1].length - minimumHeading + 2);
      appendNode(root, stack, currentDepth, heading[2], seen, nextID);
      continue;
    }
    const listItem = line.match(/^(\s*)(?:[-*+] |\d+[.)] )(.+)$/);
    if (listItem) {
      flushParagraph();
      const indentationDepth = Math.floor(listItem[1].replace(/\t/g, '  ').length / 2);
      appendNode(root, stack, currentDepth + 1 + indentationDepth, listItem[2], seen, nextID);
      continue;
    }
    if (!line.trim() || /^---+$/.test(line.trim())) {
      flushParagraph();
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();

  const nodeCount = countMindmapNodes(root);
  const maxDepth = mindmapDepth(root);
  if (nodeCount < 2) {
    warnings.push('笔记层级内容过少，思维导图只有根节点。');
  }
  if (documentTitle.trim().length > MAX_NODE_LENGTH) {
    warnings.push('文献标题已缩短为不超过 72 个字符的根节点。');
  }

  return {
    document: {
      title,
      source: 'generated',
      sheets: [{ id: 'generated-sheet-1', title, root }]
    },
    tree: root,
    nodeCount,
    maxDepth,
    warnings
  };
}
