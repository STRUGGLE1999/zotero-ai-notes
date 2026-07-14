import type {
  AnnotationData,
  PdfAttachmentData,
  SelectedDocumentData
} from '../zotero/annotation-reader';

declare const Zotero: any;

const MAX_CONTEXT_LENGTH = 2500;

export type EvidenceMatchMethod =
  | 'exact'
  | 'fuzzy'
  | 'adjacent_annotation'
  | 'annotation_only';

export interface EvidenceUnit {
  id: string;
  sourceType: 'annotation' | 'annotation_context';
  attachmentKey: string;
  annotationId: string;
  annotationKey: string;
  annotationType: string;
  annotationText: string;
  userComment: string;
  tags: string[];
  page?: number;
  pageLabel?: string;
  text: string;
  matchMethod: EvidenceMatchMethod;
  contentHash: string;
  warning?: string;
}

export interface EvidenceDebugData {
  generatedAt: string;
  document: SelectedDocumentData['document'];
  stats: {
    pdfAttachmentCount: number;
    annotationCount: number;
    annotatedPageCount: number;
    evidenceCount: number;
    contextualizedCount: number;
    annotationOnlyCount: number;
  };
  evidenceUnits: EvidenceUnit[];
  warnings: string[];
}

interface ContextMatch {
  text: string;
  method: 'exact' | 'fuzzy' | 'adjacent_annotation';
}

interface PendingEvidence {
  attachment: PdfAttachmentData;
  annotation: AnnotationData;
  id: string;
  context: ContextMatch | null;
  warning?: string;
}

interface PdfFullTextResult {
  text: string;
  extractedPages: number;
  totalPages: number;
}

function normalizeText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/\u00ad/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitParagraphs(pageText: string): string[] {
  return pageText
    .split(/\n+/)
    .map(normalizeText)
    .filter(Boolean);
}

function buildParagraphContext(
  paragraphs: string[],
  startIndex: number,
  endIndex: number,
  annotationText: string
): string {
  let start = startIndex;
  let end = endIndex;
  let context = paragraphs.slice(start, end + 1).join('\n\n');

  if (start > 0) {
    const candidate = `${paragraphs[start - 1]}\n\n${context}`;
    if (candidate.length <= MAX_CONTEXT_LENGTH) {
      context = candidate;
      start--;
    }
  }

  if (end < paragraphs.length - 1) {
    const candidate = `${context}\n\n${paragraphs[end + 1]}`;
    if (candidate.length <= MAX_CONTEXT_LENGTH) {
      context = candidate;
      end++;
    }
  }

  if (context.length <= MAX_CONTEXT_LENGTH) {
    return context;
  }

  const sentences = context.split(/(?<=[.!?。！？])\s+/);
  const normalizedAnnotation = normalizeText(annotationText).toLocaleLowerCase();
  const sentenceIndex = sentences.findIndex(sentence =>
    normalizeText(sentence).toLocaleLowerCase().includes(normalizedAnnotation)
  );
  if (sentenceIndex === -1) {
    return normalizeText(annotationText);
  }

  let sentenceStart = sentenceIndex;
  let sentenceEnd = sentenceIndex;
  let sentenceContext = sentences[sentenceIndex];
  while (sentenceStart > 0) {
    const candidate = `${sentences[sentenceStart - 1]} ${sentenceContext}`;
    if (candidate.length > MAX_CONTEXT_LENGTH) {
      break;
    }
    sentenceContext = candidate;
    sentenceStart--;
  }
  while (sentenceEnd < sentences.length - 1) {
    const candidate = `${sentenceContext} ${sentences[sentenceEnd + 1]}`;
    if (candidate.length > MAX_CONTEXT_LENGTH) {
      break;
    }
    sentenceContext = candidate;
    sentenceEnd++;
  }
  return sentenceContext;
}

function paragraphContainsQuery(paragraph: string, query: string): boolean {
  const normalizedParagraph = paragraph.toLocaleLowerCase();
  if (!/^[a-z0-9]{1,2}$/i.test(query)) {
    return normalizedParagraph.includes(query);
  }

  const tokens = normalizedParagraph.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return tokens.includes(query);
}

function findExactContext(paragraphs: string[], annotationText: string): ContextMatch | null {
  const query = normalizeText(annotationText).toLocaleLowerCase();
  if (!query) {
    return null;
  }

  const directMatches = paragraphs
    .map((paragraph, index) => ({ paragraph, index }))
    .filter(({ paragraph }) => paragraphContainsQuery(paragraph, query));

  if (directMatches.length === 1 || (directMatches.length > 0 && query.length >= 8)) {
    const index = directMatches[0].index;
    return {
      text: buildParagraphContext(paragraphs, index, index, annotationText),
      method: 'exact'
    };
  }

  if (directMatches.length > 1) {
    return null;
  }

  for (let windowSize = 2; windowSize <= 3; windowSize++) {
    for (let start = 0; start + windowSize <= paragraphs.length; start++) {
      const end = start + windowSize - 1;
      const joined = paragraphs.slice(start, end + 1).join(' ').toLocaleLowerCase();
      if (paragraphContainsQuery(joined, query)) {
        return {
          text: buildParagraphContext(paragraphs, start, end, annotationText),
          method: 'exact'
        };
      }
    }
  }

  return null;
}

function findFuzzyContext(paragraphs: string[], annotationText: string): ContextMatch | null {
  const queryTokens = normalizeText(annotationText)
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(token => token.length > 2);
  if (queryTokens.length < 3) {
    return null;
  }

  const uniqueTokens = [...new Set(queryTokens)];
  let bestIndex = -1;
  let bestCoverage = 0;
  for (let index = 0; index < paragraphs.length; index++) {
    const paragraph = paragraphs[index].toLocaleLowerCase();
    const matched = uniqueTokens.filter(token => paragraph.includes(token)).length;
    const coverage = matched / uniqueTokens.length;
    if (coverage > bestCoverage) {
      bestCoverage = coverage;
      bestIndex = index;
    }
  }

  if (bestIndex === -1 || bestCoverage < 0.6) {
    return null;
  }

  return {
    text: buildParagraphContext(paragraphs, bestIndex, bestIndex, annotationText),
    method: 'fuzzy'
  };
}

function findContext(pageText: string, annotationText: string): ContextMatch | null {
  const paragraphs = splitParagraphs(pageText);
  if (!paragraphs.length) {
    return null;
  }

  return findExactContext(paragraphs, annotationText)
    || findFuzzyContext(paragraphs, annotationText);
}

function getRects(annotation: AnnotationData): number[][] {
  const position = annotation.position;
  if (!position || typeof position !== 'object' || !('rects' in position)) {
    return [];
  }

  const rects = (position as { rects?: unknown }).rects;
  if (!Array.isArray(rects)) {
    return [];
  }

  return rects.filter(rect =>
    Array.isArray(rect)
      && rect.length >= 4
      && rect.every(value => typeof value === 'number')
  ) as number[][];
}

function rectDistance(first: number[], second: number[]): number {
  const horizontalGap = Math.max(0, Math.max(first[0], second[0]) - Math.min(first[2], second[2]));
  const verticalGap = Math.max(0, Math.max(first[1], second[1]) - Math.min(first[3], second[3]));
  return Math.hypot(horizontalGap, verticalGap);
}

function areAnnotationsAdjacent(first: AnnotationData, second: AnnotationData): boolean {
  if (first.pageIndex === null || first.pageIndex !== second.pageIndex) {
    return false;
  }

  const firstRects = getRects(first);
  const secondRects = getRects(second);
  return firstRects.some(firstRect =>
    secondRects.some(secondRect => rectDistance(firstRect, secondRect) <= 36)
  );
}

async function getAnnotatedPageTexts(
  attachment: PdfAttachmentData
): Promise<Map<number, string>> {
  const pageIndexes = [...new Set(
    attachment.annotations
      .map(annotation => annotation.pageIndex)
      .filter((pageIndex): pageIndex is number => pageIndex !== null)
  )].sort((first, second) => first - second);

  const pageTexts = new Map<number, string>();
  for (const pageIndex of pageIndexes) {
    try {
      const result = await Zotero.PDFWorker.getFullText(
        attachment.id,
        [pageIndex],
        true
      ) as PdfFullTextResult;
      pageTexts.set(pageIndex, result.text || '');
    } catch (error) {
      Zotero.debug(
        `Zotero AI Notes: failed to extract PDF page ${pageIndex + 1} `
          + `from ${attachment.key}: ${error}`,
        2
      );
      pageTexts.set(pageIndex, '');
    }
  }

  return pageTexts;
}

function buildEvidenceId(
  attachmentKey: string,
  pageNumber: number | null,
  sequence: number
): string {
  const page = pageNumber === null ? 'unknown' : pageNumber;
  return `E-${attachmentKey}-${page}-${String(sequence).padStart(2, '0')}`;
}

function buildPendingEvidence(
  attachment: PdfAttachmentData,
  pageTexts: Map<number, string>
): PendingEvidence[] {
  const pageSequences = new Map<number | null, number>();
  return attachment.annotations.map(annotation => {
    const sequence = (pageSequences.get(annotation.pageIndex) || 0) + 1;
    pageSequences.set(annotation.pageIndex, sequence);
    const id = buildEvidenceId(attachment.key, annotation.pageNumber, sequence);

    if (annotation.pageIndex === null) {
      return {
        attachment,
        annotation,
        id,
        context: null,
        warning: `${id} 缺少可用页码，只保留批注本身。`
      };
    }

    const pageText = pageTexts.get(annotation.pageIndex) || '';
    if (!pageText.trim()) {
      return {
        attachment,
        annotation,
        id,
        context: null,
        warning: `${id} 所在 PDF 页面没有可提取文本，只保留批注本身。`
      };
    }

    const context = findContext(pageText, annotation.text);
    return {
      attachment,
      annotation,
      id,
      context,
      warning: context
        ? undefined
        : `${id} 无法唯一定位高亮原文，只保留批注本身。`
    };
  });
}

function reuseAdjacentContexts(pending: PendingEvidence[]): void {
  for (const item of pending) {
    if (item.context) {
      continue;
    }

    const adjacent = pending.find(candidate =>
      candidate.context
        && areAnnotationsAdjacent(item.annotation, candidate.annotation)
    );
    if (!adjacent?.context) {
      continue;
    }

    item.context = {
      text: adjacent.context.text,
      method: 'adjacent_annotation'
    };
    item.warning = undefined;
  }
}

function toEvidenceUnit(item: PendingEvidence): EvidenceUnit {
  const contextText = item.context?.text || normalizeText(item.annotation.text);
  const matchMethod: EvidenceMatchMethod = item.context
    ? item.context.method
    : 'annotation_only';

  return {
    id: item.id,
    sourceType: item.context ? 'annotation_context' : 'annotation',
    attachmentKey: item.attachment.key,
    annotationId: String(item.annotation.id),
    annotationKey: item.annotation.key,
    annotationType: item.annotation.type,
    annotationText: item.annotation.text,
    userComment: item.annotation.comment,
    tags: item.annotation.tags.map(tag => tag.name),
    page: item.annotation.pageNumber ?? undefined,
    pageLabel: item.annotation.pageLabel ?? undefined,
    text: contextText,
    matchMethod,
    contentHash: Zotero.Utilities.Internal.md5(normalizeText(contextText)),
    warning: item.warning
  };
}

export async function buildEvidenceData(
  data: SelectedDocumentData
): Promise<EvidenceDebugData> {
  if (data.annotationCount === 0) {
    throw new Error('当前文献尚无批注，请先添加高亮或评论。');
  }

  const pending: PendingEvidence[] = [];
  let annotatedPageCount = 0;
  for (const attachment of data.pdfAttachments) {
    const pageTexts = await getAnnotatedPageTexts(attachment);
    annotatedPageCount += pageTexts.size;
    pending.push(...buildPendingEvidence(attachment, pageTexts));
  }

  reuseAdjacentContexts(pending);
  const evidenceUnits = pending.map(toEvidenceUnit);
  const warnings = evidenceUnits
    .map(evidence => evidence.warning)
    .filter((warning): warning is string => Boolean(warning));
  const contextualizedCount = evidenceUnits.filter(
    evidence => evidence.sourceType === 'annotation_context'
  ).length;

  return {
    generatedAt: new Date().toISOString(),
    document: data.document,
    stats: {
      pdfAttachmentCount: data.pdfAttachments.length,
      annotationCount: data.annotationCount,
      annotatedPageCount,
      evidenceCount: evidenceUnits.length,
      contextualizedCount,
      annotationOnlyCount: evidenceUnits.length - contextualizedCount
    },
    evidenceUnits,
    warnings
  };
}
