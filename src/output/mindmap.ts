export interface MindmapNode {
  text: string;
  children: MindmapNode[];
}

export interface MermaidMindmapResult {
  source: string;
  markdown: string;
  tree: MindmapNode;
  nodeCount: number;
  maxDepth: number;
  warnings: string[];
}

const EVIDENCE_ID_PATTERN = /\s*\[(?:E-[A-Z0-9-]+)(?:\s*,\s*E-[A-Z0-9-]+)*\]/gi;
const MAX_NODE_LENGTH = 30;

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
  if (boundary >= 6) {
    return candidate.slice(0, boundary).trim();
  }
  const wordBoundary = candidate.lastIndexOf(' ');
  return wordBoundary >= 6 ? candidate.slice(0, wordBoundary).trim() : candidate.trim();
}

function mermaidLabel(value: string): string {
  return value
    .replace(/\(/g, '（')
    .replace(/\)/g, '）')
    .replace(/\[/g, '【')
    .replace(/\]/g, '】')
    .replace(/\{/g, '〔')
    .replace(/\}/g, '〕')
    .replace(/"/g, '“');
}

function appendNode(
  root: MindmapNode,
  stack: MindmapNode[],
  sourceLines: string[],
  depth: number,
  value: string,
  seen: Set<string>
): boolean {
  const text = conciseNode(value);
  const safeDepth = Math.max(2, Math.min(5, depth));
  if (!text || seen.has(`${safeDepth}:${text}`)) {
    return false;
  }
  seen.add(`${safeDepth}:${text}`);
  const node: MindmapNode = { text, children: [] };
  const parent = stack[safeDepth - 2] || root;
  parent.children.push(node);
  stack[safeDepth - 1] = node;
  stack.length = safeDepth;
  sourceLines.push(`${'  '.repeat(safeDepth)}${mermaidLabel(text)}`);
  return true;
}

export function buildMermaidMindmap(
  documentTitle: string,
  markdownNote: string
): MermaidMindmapResult {
  const title = conciseNode(documentTitle) || '文献笔记';
  const root: MindmapNode = { text: title, children: [] };
  const output = ['mindmap', `  root((${mermaidLabel(title)}))`];
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
      appendNode(root, stack, output, currentDepth + 1, value, seen);
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
      appendNode(root, stack, output, currentDepth, heading[2], seen);
      continue;
    }
    const listItem = line.match(/^(\s*)(?:[-*+] |\d+[.)] )(.+)$/);
    if (listItem) {
      flushParagraph();
      const indentationDepth = Math.floor(listItem[1].replace(/\t/g, '  ').length / 2);
      appendNode(root, stack, output, currentDepth + 1 + indentationDepth, listItem[2], seen);
      continue;
    }
    if (!line.trim() || /^---+$/.test(line.trim())) {
      flushParagraph();
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();

  const countNodes = (node: MindmapNode): number =>
    1 + node.children.reduce((total, child) => total + countNodes(child), 0);
  const treeDepth = (node: MindmapNode): number =>
    node.children.length ? 1 + Math.max(...node.children.map(treeDepth)) : 1;
  const nodeCount = countNodes(root);
  const maxDepth = treeDepth(root);

  if (nodeCount < 2) {
    warnings.push('笔记层级内容过少，思维导图只有根节点。');
  }
  if (documentTitle.trim().length > MAX_NODE_LENGTH) {
    warnings.push('文献标题已缩短为不超过 30 个字符的根节点。');
  }

  const source = output.join('\n');
  return {
    source,
    markdown: `\`\`\`mermaid\n${source}\n\`\`\``,
    tree: root,
    nodeCount,
    maxDepth,
    warnings
  };
}
