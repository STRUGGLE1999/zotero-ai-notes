import type { MindmapDocument, MindmapNode } from './mindmap';

function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function outline(node: MindmapNode, depth: number): string[] {
  const indentation = '  '.repeat(depth);
  const text = escapeXmlAttribute(node.text);
  const note = node.note?.trim()
    ? ` _note="${escapeXmlAttribute(node.note.trim())}"`
    : '';
  if (!node.children.length) {
    return [`${indentation}<outline text="${text}"${note}/>`];
  }
  return [
    `${indentation}<outline text="${text}"${note}>`,
    ...node.children.flatMap(child => outline(child, depth + 1)),
    `${indentation}</outline>`
  ];
}

export function mindmapDocumentToOpml(document: MindmapDocument, sheetIndex = 0): string {
  const sheet = document.sheets[sheetIndex];
  if (!sheet) {
    throw new Error('没有可导出的思维导图画布。');
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    '  <head>',
    `    <title>${escapeXmlAttribute(sheet.title || document.title)}</title>`,
    '  </head>',
    '  <body>',
    ...outline(sheet.root, 2),
    '  </body>',
    '</opml>',
    ''
  ].join('\n');
}
