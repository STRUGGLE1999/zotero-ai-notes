import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectSelectedDocumentData } from '../src/zotero/annotation-reader';

function createAnnotation(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    key: 'ANNOTATION1',
    annotationType: 'highlight',
    annotationText: 'Highlighted text',
    annotationComment: 'My comment',
    annotationColor: '#ffd400',
    annotationPageLabel: '8',
    annotationSortIndex: '00008|000001|00000',
    annotationPosition: JSON.stringify({ pageIndex: 7, rects: [[1, 2, 3, 4]] }),
    dateAdded: '2026-07-14 09:00:00',
    dateModified: '2026-07-14 09:01:00',
    getTags: vi.fn(() => [{ tag: '重点', type: 0 }]),
    ...overrides
  };
}

function createAttachment(annotations: ReturnType<typeof createAnnotation>[]) {
  return {
    id: 10,
    key: 'PDFKEY',
    attachmentFilename: 'paper.pdf',
    attachmentContentType: 'application/pdf',
    attachmentLinkMode: 0,
    parentItem: undefined,
    isPDFAttachment: vi.fn(() => true),
    getField: vi.fn(() => 'Paper PDF'),
    getFilePathAsync: vi.fn(async () => '/tmp/paper.pdf'),
    getAnnotations: vi.fn(() => annotations)
  };
}

function createDocument(attachmentIDs: number[]) {
  return {
    id: 1,
    key: 'ITEMKEY',
    libraryID: 1,
    itemType: 'journalArticle',
    isPDFAttachment: vi.fn(() => false),
    isRegularItem: vi.fn(() => true),
    getAttachments: vi.fn(() => attachmentIDs),
    getField: vi.fn(() => 'Test Paper')
  };
}

describe('collectSelectedDocumentData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads PDF attachments and normalizes sorted annotations', async () => {
    const later = createAnnotation({
      id: 102,
      key: 'ANNOTATION2',
      annotationSortIndex: '00009|000001|00000',
      annotationPageLabel: '9',
      annotationPosition: JSON.stringify({ pageIndex: 8, rects: [] })
    });
    const earlier = createAnnotation();
    const attachment = createAttachment([later, earlier]);
    const document = createDocument([attachment.id]);

    vi.stubGlobal('Zotero', {
      getActiveZoteroPane: vi.fn(() => ({ getSelectedItems: () => [document] })),
      Items: {
        loadDataTypes: vi.fn(async () => undefined),
        getAsync: vi.fn(async () => [attachment])
      }
    });

    const result = await collectSelectedDocumentData();

    expect(result.document.title).toBe('Test Paper');
    expect(result.pdfAttachments).toHaveLength(1);
    expect(result.annotationCount).toBe(2);
    expect(result.pdfAttachments[0].fileExists).toBe(true);
    expect(result.pdfAttachments[0].annotations[0]).toMatchObject({
      key: 'ANNOTATION1',
      text: 'Highlighted text',
      comment: 'My comment',
      pageLabel: '8',
      pageIndex: 7,
      pageNumber: 8,
      tags: [{ name: '重点', type: 0 }]
    });
  });

  it('supports selecting a PDF attachment directly', async () => {
    const document = createDocument([10]);
    const attachment = createAttachment([]);
    attachment.parentItem = document;

    vi.stubGlobal('Zotero', {
      getActiveZoteroPane: vi.fn(() => ({ getSelectedItems: () => [attachment] })),
      Items: { loadDataTypes: vi.fn(async () => undefined) }
    });

    const result = await collectSelectedDocumentData();

    expect(result.document.key).toBe('ITEMKEY');
    expect(result.pdfAttachments[0].key).toBe('PDFKEY');
  });

  it('rejects a document without a PDF attachment', async () => {
    const document = createDocument([]);

    vi.stubGlobal('Zotero', {
      getActiveZoteroPane: vi.fn(() => ({ getSelectedItems: () => [document] })),
      Items: {
        loadDataTypes: vi.fn(async () => undefined),
        getAsync: vi.fn(async () => [])
      }
    });

    await expect(collectSelectedDocumentData()).rejects.toThrow('当前文献没有 PDF 附件。');
  });
});
