import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/zotero/annotation-reader', () => ({
  collectSelectedDocumentData: vi.fn(async () => ({
    generatedAt: '2026-07-14T00:00:00.000Z',
    document: {
      id: 1,
      key: 'TESTKEY',
      libraryID: 1,
      itemType: 'journalArticle',
      title: 'Test Paper'
    },
    pdfAttachments: [{ key: 'PDFKEY', annotations: [] }],
    annotationCount: 0
  }))
}));

vi.mock('../src/utils/debug-json', () => ({
  writeEvidenceDebugJson: vi.fn(async () => '/tmp/test-evidence.json')
}));

vi.mock('../src/utils/debug-markdown', () => ({
  writeGeneratedMarkdown: vi.fn(async () => '/tmp/test-generated.md')
}));

vi.mock('../src/llm/markdown-generator', () => ({
  generateGroundedMarkdown: vi.fn(async () => '# Test Paper')
}));

vi.mock('../src/evidence/evidence-builder', () => ({
  buildEvidenceData: vi.fn(async () => ({
    generatedAt: '2026-07-14T00:00:00.000Z',
    document: { key: 'TESTKEY', title: 'Test Paper' },
    stats: {
      pdfAttachmentCount: 1,
      annotationCount: 2,
      annotatedPageCount: 1,
      evidenceCount: 2,
      contextualizedCount: 2,
      annotationOnlyCount: 0
    },
    evidenceUnits: [],
    warnings: []
  }))
}));

import ContextMenu from '../src/zotero/context-menu';

type Listener = () => void;

function createElement() {
  const attributes = new Map<string, unknown>();
  const listeners = new Map<string, Listener>();

  return {
    attributes,
    listeners,
    parentNode: null as ReturnType<typeof createPopup> | null,
    setAttribute(name: string, value: unknown) {
      attributes.set(name, value);
    },
    addEventListener(name: string, listener: Listener) {
      listeners.set(name, listener);
    }
  };
}

function createPopup() {
  const children: ReturnType<typeof createElement>[] = [];

  return {
    children,
    appendChild(element: ReturnType<typeof createElement>) {
      element.parentNode = this;
      children.push(element);
    },
    removeChild(element: ReturnType<typeof createElement>) {
      const index = children.indexOf(element);
      if (index >= 0) {
        children.splice(index, 1);
        element.parentNode = null;
      }
    }
  };
}

describe('ContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('Zotero', { debug: vi.fn(), alert: vi.fn() });
  });

  it('registers in the Zotero 9 item menu and opens the phase-five preview', async () => {
    const popup = createPopup();
    const document = {
      getElementById: vi.fn((id: string) => id === 'zotero-itemmenu' ? popup : null),
      createXULElement: vi.fn(() => createElement())
    };
    const previewWindow = {
      addEventListener: vi.fn(),
      close: vi.fn()
    };
    const win = {
      document,
      openDialog: vi.fn(() => previewWindow)
    };
    const settings = {
      getProviderConfig: vi.fn(async () => ({
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        model: 'gemini-3.1-flash-lite',
        apiKey: 'secret'
      }))
    };
    const menu = new ContextMenu('root/', settings as never, '0.2.0');

    menu.register(win);

    expect(document.getElementById).toHaveBeenCalledWith('zotero-itemmenu');
    expect(popup.children).toHaveLength(2);
    expect(popup.children[1].attributes.get('label')).toBe('AI 整理批注');

    popup.children[1].listeners.get('command')?.();
    await vi.waitFor(() => {
      expect(win.openDialog).toHaveBeenCalledWith(
        'chrome://zotero-ai-notes/content/preview/preview.xhtml',
        'zotero-ai-notes-preview',
        'chrome,centerscreen,resizable,width=1280,height=780',
        expect.objectContaining({ wrappedJSObject: expect.any(Object) })
      );
    });
    expect(globalThis.Zotero.alert).not.toHaveBeenCalled();
  });
});
