import { describe, expect, it, vi } from 'vitest';
import { markdownToSafeHtml, safeFileBaseName } from '../src/output/markdown';
import {
  buildZoteroNoteHtml,
  createZoteroChildNote,
  exportMindmapFile,
  exportMarkdownFile
} from '../src/output/zotero-output';

const metadata = {
  generatedAt: '2026-07-14T00:00:00.000Z',
  model: 'gemini-test',
  template: '通用学习笔记',
  mode: '批注 + 相邻上下文',
  evidenceCount: 4,
  pluginVersion: '0.2.0'
};

describe('Markdown output', () => {
  it('renders useful Markdown while escaping raw HTML and unsafe links', () => {
    const html = markdownToSafeHtml(
      '# 标题\n\n- **重点**\n\n<script>alert(1)</script>\n\n[安全](https://example.com) [危险](javascript:alert(1))'
    );

    expect(html).toContain('<h1>标题</h1>');
    expect(html).toContain('<strong>重点</strong>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('href="https://example.com"');
    expect(html).not.toContain('href="javascript:');
  });

  it('renders escaped model newlines as Markdown blocks', () => {
    const html = markdownToSafeHtml('## 标题\\n\\n- **重点**\\n- 第二项');

    expect(html).toContain('<h2>标题</h2>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<strong>重点</strong>');
  });

  it('creates a new child note without overwriting existing notes', async () => {
    const saveTx = vi.fn(async () => 42);
    const setNote = vi.fn();
    const Item = vi.fn(function (this: Record<string, unknown>) {
      this.setNote = setNote;
      this.saveTx = saveTx;
    });
    const zotero = { Item, Notes: { AUTO_SYNC_DELAY: 10 } };

    const noteID = await createZoteroChildNote(
      { id: 7, libraryID: 1 },
      '# 原标题\n\n正文',
      metadata,
      zotero
    );

    expect(noteID).toBe(42);
    expect(Item).toHaveBeenCalledWith('note');
    const item = Item.mock.instances[0] as unknown as { parentItemID: number; libraryID: number };
    expect(item.parentItemID).toBe(7);
    expect(item.libraryID).toBe(1);
    expect(setNote).toHaveBeenCalledWith(expect.stringContaining('AI 整理笔记 - 2026-07-14'));
    expect(saveTx).toHaveBeenCalledTimes(1);
  });

  it('exports UTF-8 Markdown to the user-selected path with a safe filename', async () => {
    const putContentsAsync = vi.fn(async () => undefined);
    class FilePicker {
      modeSave = 1;
      returnOK = 0;
      returnReplace = 2;
      file = 'C:\\Notes\\Paper_AI整理笔记.md';
      defaultString = '';
      defaultExtension = '';
      init = vi.fn();
      appendFilter = vi.fn();
      show = vi.fn(async () => this.returnOK);
    }
    const zotero = {
      File: {
        getValidFileName: vi.fn((value: string) => value),
        putContentsAsync
      }
    };

    const path = await exportMarkdownFile({}, 'Paper: A/B?', '# 内容', {
      FilePicker,
      zotero
    });

    expect(path).toBe('C:\\Notes\\Paper_AI整理笔记.md');
    expect(putContentsAsync).toHaveBeenCalledWith(path, '# 内容');
    expect(safeFileBaseName('Paper: A/B?')).toBe('Paper_ A_B_');
  });

  it('escapes user-configurable metadata before writing note HTML', () => {
    const html = buildZoteroNoteHtml('# 标题', { ...metadata, model: '<img src=x>' });
    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).not.toContain('<img src=x>');
  });

  it('exports a Mermaid mindmap with a distinct cross-platform filename', async () => {
    const putContentsAsync = vi.fn(async () => undefined);
    class FilePicker {
      modeSave = 1;
      returnOK = 0;
      returnReplace = 2;
      file = '/Notes/Paper_AI思维导图.md';
      defaultString = '';
      defaultExtension = '';
      init = vi.fn();
      appendFilter = vi.fn();
      show = vi.fn(async () => this.returnOK);
    }
    const zotero = {
      File: {
        getValidFileName: vi.fn((value: string) => value),
        putContentsAsync
      }
    };
    const mermaid = '```mermaid\nmindmap\n  root((Paper))\n```';

    const path = await exportMindmapFile({}, 'Paper', mermaid, { FilePicker, zotero });

    expect(path).toBe('/Notes/Paper_AI思维导图.md');
    expect(putContentsAsync).toHaveBeenCalledWith(path, mermaid);
  });
});
