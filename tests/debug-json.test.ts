import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writeDebugJson, writeEvidenceDebugJson } from '../src/utils/debug-json';
import type { EvidenceDebugData } from '../src/evidence/evidence-builder';
import type { SelectedDocumentData } from '../src/zotero/annotation-reader';

const data: SelectedDocumentData = {
  generatedAt: '2026-07-14T00:00:00.000Z',
  document: {
    id: 1,
    key: 'ITEMKEY',
    libraryID: 1,
    itemType: 'journalArticle',
    title: 'Test Paper'
  },
  pdfAttachments: [],
  annotationCount: 0
};

describe('writeDebugJson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the Zotero platform path API for a Windows temporary directory', async () => {
    const windowsTempDir = 'C:\\Users\\Tester\\AppData\\Local\\Temp';
    const windowsOutputPath = `${windowsTempDir}\\zotero-ai-notes-ITEMKEY-annotations.json`;
    const join = vi.fn(() => windowsOutputPath);
    const putContentsAsync = vi.fn(async () => undefined);

    vi.stubGlobal('PathUtils', { tempDir: windowsTempDir, join });
    vi.stubGlobal('Zotero', {
      File: { putContentsAsync },
      debug: vi.fn()
    });

    const result = await writeDebugJson(data);

    expect(join).toHaveBeenCalledWith(
      windowsTempDir,
      'zotero-ai-notes-ITEMKEY-annotations.json'
    );
    expect(putContentsAsync).toHaveBeenCalledWith(
      windowsOutputPath,
      expect.stringContaining('"title": "Test Paper"'),
      'utf-8'
    );
    expect(result).toBe(windowsOutputPath);
  });

  it('writes Evidence JSON with a distinct file name', async () => {
    const join = vi.fn(() => '/tmp/zotero-ai-notes-ITEMKEY-evidence.json');
    const putContentsAsync = vi.fn(async () => undefined);
    const evidenceData: EvidenceDebugData = {
      generatedAt: '2026-07-14T00:00:00.000Z',
      document: data.document,
      stats: {
        pdfAttachmentCount: 1,
        annotationCount: 1,
        annotatedPageCount: 1,
        evidenceCount: 1,
        contextualizedCount: 1,
        annotationOnlyCount: 0
      },
      evidenceUnits: [],
      warnings: []
    };

    vi.stubGlobal('PathUtils', { tempDir: '/tmp', join });
    vi.stubGlobal('Zotero', {
      File: { putContentsAsync },
      debug: vi.fn()
    });

    const result = await writeEvidenceDebugJson(evidenceData);

    expect(join).toHaveBeenCalledWith('/tmp', 'zotero-ai-notes-ITEMKEY-evidence.json');
    expect(putContentsAsync).toHaveBeenCalledWith(
      '/tmp/zotero-ai-notes-ITEMKEY-evidence.json',
      expect.stringContaining('"contextualizedCount": 1'),
      'utf-8'
    );
    expect(result).toBe('/tmp/zotero-ai-notes-ITEMKEY-evidence.json');
  });
});
