import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEvidenceData } from '../src/evidence/evidence-builder';
import type {
  AnnotationData,
  PdfAttachmentData,
  SelectedDocumentData
} from '../src/zotero/annotation-reader';

function createAnnotation(overrides: Partial<AnnotationData> = {}): AnnotationData {
  return {
    id: 101,
    key: 'ANNOTATION1',
    type: 'highlight',
    text: 'the highlighted source text',
    comment: 'My comment',
    color: '#ffd400',
    tags: [{ name: '重点', type: 0 }],
    pageLabel: '2',
    pageIndex: 1,
    pageNumber: 2,
    sortIndex: '00001|000100|00000',
    position: { pageIndex: 1, rects: [[10, 10, 80, 20]] },
    createdAt: '2026-07-14 10:00:00',
    modifiedAt: '2026-07-14 10:00:00',
    ...overrides
  };
}

function createAttachment(annotations: AnnotationData[]): PdfAttachmentData {
  return {
    id: 10,
    key: 'PDFKEY',
    title: 'PDF',
    filename: 'paper.pdf',
    contentType: 'application/pdf',
    linkMode: 0,
    fileExists: true,
    filePath: '/tmp/paper.pdf',
    annotations
  };
}

function createData(annotations: AnnotationData[]): SelectedDocumentData {
  return {
    generatedAt: '2026-07-14T00:00:00.000Z',
    document: {
      id: 1,
      key: 'ITEMKEY',
      libraryID: 1,
      itemType: 'journalArticle',
      title: 'Test Paper'
    },
    pdfAttachments: [createAttachment(annotations)],
    annotationCount: annotations.length
  };
}

describe('buildEvidenceData', () => {
  const getFullText = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('Zotero', {
      PDFWorker: { getFullText },
      Utilities: { Internal: { md5: vi.fn((text: string) => `hash:${text.length}`) } },
      debug: vi.fn()
    });
  });

  it('extracts only annotated pages and builds paragraph context', async () => {
    getFullText.mockResolvedValue({
      text: [
        'Previous paragraph.',
        'This paragraph contains the highlighted source text and its explanation.',
        'Following paragraph.'
      ].join('\n'),
      extractedPages: 1,
      totalPages: 10
    });

    const result = await buildEvidenceData(createData([createAnnotation()]));

    expect(getFullText).toHaveBeenCalledWith(10, [1], true);
    expect(result.stats).toMatchObject({
      annotationCount: 1,
      annotatedPageCount: 1,
      contextualizedCount: 1,
      annotationOnlyCount: 0
    });
    expect(result.evidenceUnits[0]).toMatchObject({
      id: 'E-PDFKEY-2-01',
      sourceType: 'annotation_context',
      page: 2,
      pageLabel: '2',
      annotationText: 'the highlighted source text',
      userComment: 'My comment',
      tags: ['重点'],
      matchMethod: 'exact'
    });
    expect(result.evidenceUnits[0].text).toContain('Previous paragraph.');
    expect(result.evidenceUnits[0].text).toContain('Following paragraph.');
  });

  it('reuses context for a spatially adjacent split annotation', async () => {
    const longAnnotation = createAnnotation({
      key: 'LONG',
      text: 'conditional probability of a target sentence',
      position: { pageIndex: 1, rects: [[10, 10, 90, 20]] }
    });
    const splitAnnotation = createAnnotation({
      id: 102,
      key: 'SHORT',
      text: 'y',
      sortIndex: '00001|000101|00001',
      position: { pageIndex: 1, rects: [[92, 10, 96, 20]] }
    });
    getFullText.mockResolvedValue({
      text: [
        'The conditional probability of a target sentence y is maximized here.',
        'Another paragraph also uses the variable y.'
      ].join('\n'),
      extractedPages: 1,
      totalPages: 10
    });

    const result = await buildEvidenceData(createData([longAnnotation, splitAnnotation]));

    expect(result.stats.contextualizedCount).toBe(2);
    expect(result.evidenceUnits[1]).toMatchObject({
      annotationKey: 'SHORT',
      sourceType: 'annotation_context',
      matchMethod: 'adjacent_annotation'
    });
    expect(result.warnings).toEqual([]);
  });

  it('keeps annotation-only evidence when a page has no extractable text', async () => {
    getFullText.mockResolvedValue({ text: '', extractedPages: 1, totalPages: 1 });

    const result = await buildEvidenceData(createData([createAnnotation()]));

    expect(result.stats.annotationOnlyCount).toBe(1);
    expect(result.evidenceUnits[0]).toMatchObject({
      sourceType: 'annotation',
      matchMethod: 'annotation_only',
      text: 'the highlighted source text'
    });
    expect(result.warnings).toHaveLength(1);
  });

  it('rejects a document without annotations', async () => {
    await expect(buildEvidenceData(createData([]))).rejects.toThrow('当前文献尚无批注');
    expect(getFullText).not.toHaveBeenCalled();
  });
});
