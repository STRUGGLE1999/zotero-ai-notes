declare const Zotero: any;

export interface AnnotationTagData {
  name: string;
  type: number;
}

export interface AnnotationData {
  id: number;
  key: string;
  type: string;
  text: string;
  comment: string;
  color: string;
  tags: AnnotationTagData[];
  pageLabel: string | null;
  pageIndex: number | null;
  pageNumber: number | null;
  sortIndex: string;
  position: unknown;
  createdAt: string;
  modifiedAt: string;
}

export interface PdfAttachmentData {
  id: number;
  key: string;
  title: string;
  filename: string;
  contentType: string;
  linkMode: number;
  fileExists: boolean;
  filePath: string | null;
  annotations: AnnotationData[];
}

export interface SelectedDocumentData {
  generatedAt: string;
  document: {
    id: number;
    key: string;
    libraryID: number;
    itemType: string;
    title: string;
  };
  pdfAttachments: PdfAttachmentData[];
  annotationCount: number;
}

function parsePosition(rawPosition: string): unknown {
  if (!rawPosition) {
    return null;
  }

  try {
    return JSON.parse(rawPosition);
  } catch {
    return { raw: rawPosition };
  }
}

function getPageIndex(position: unknown): number | null {
  if (!position || typeof position !== 'object' || !('pageIndex' in position)) {
    return null;
  }

  const pageIndex = (position as { pageIndex?: unknown }).pageIndex;
  return typeof pageIndex === 'number' ? pageIndex : null;
}

function mapAnnotation(annotation: any): AnnotationData {
  const position = parsePosition(annotation.annotationPosition || '');
  const pageIndex = getPageIndex(position);

  return {
    id: annotation.id,
    key: annotation.key,
    type: annotation.annotationType || '',
    text: annotation.annotationText || '',
    comment: annotation.annotationComment || '',
    color: annotation.annotationColor || '',
    tags: annotation.getTags().map((tag: { tag: string; type: number }) => ({
      name: tag.tag,
      type: tag.type
    })),
    pageLabel: annotation.annotationPageLabel || null,
    pageIndex,
    pageNumber: pageIndex === null ? null : pageIndex + 1,
    sortIndex: String(annotation.annotationSortIndex || ''),
    position,
    createdAt: annotation.dateAdded || '',
    modifiedAt: annotation.dateModified || ''
  };
}

async function mapPdfAttachment(attachment: any): Promise<PdfAttachmentData> {
  await Zotero.Items.loadDataTypes([attachment]);

  const annotations = attachment.getAnnotations(false);
  if (annotations.length) {
    await Zotero.Items.loadDataTypes(annotations);
  }

  const sortedAnnotations = [...annotations].sort((a, b) =>
    String(a.annotationSortIndex || '').localeCompare(String(b.annotationSortIndex || ''))
  );
  const filePath = await attachment.getFilePathAsync();

  return {
    id: attachment.id,
    key: attachment.key,
    title: attachment.getField('title') || attachment.attachmentFilename || '(无标题 PDF)',
    filename: attachment.attachmentFilename || '',
    contentType: attachment.attachmentContentType || '',
    linkMode: attachment.attachmentLinkMode,
    fileExists: Boolean(filePath),
    filePath: filePath || null,
    annotations: sortedAnnotations.map(mapAnnotation)
  };
}

export async function collectSelectedDocumentData(): Promise<SelectedDocumentData> {
  const pane = Zotero.getActiveZoteroPane();
  if (!pane) {
    throw new Error('无法获取当前 Zotero 窗口。');
  }

  const selectedItems = pane.getSelectedItems();
  if (selectedItems.length === 0) {
    throw new Error('请先选择一篇文献。');
  }
  if (selectedItems.length > 1) {
    throw new Error('当前阶段只支持选择一篇文献。');
  }

  const selectedItem = selectedItems[0];
  await Zotero.Items.loadDataTypes([selectedItem]);

  let documentItem = selectedItem;
  let pdfAttachments: any[] = [];

  if (selectedItem.isPDFAttachment()) {
    pdfAttachments = [selectedItem];
    if (selectedItem.parentItem) {
      documentItem = selectedItem.parentItem;
      await Zotero.Items.loadDataTypes([documentItem]);
    }
  } else if (selectedItem.isRegularItem()) {
    const attachmentIDs = selectedItem.getAttachments(false);
    const attachments = attachmentIDs.length
      ? await Zotero.Items.getAsync(attachmentIDs)
      : [];
    pdfAttachments = attachments.filter((item: any) => item.isPDFAttachment());
  } else {
    throw new Error('请选择一篇文献或其 PDF 附件。');
  }

  if (pdfAttachments.length === 0) {
    throw new Error('当前文献没有 PDF 附件。');
  }

  const mappedAttachments = await Promise.all(pdfAttachments.map(mapPdfAttachment));

  return {
    generatedAt: new Date().toISOString(),
    document: {
      id: documentItem.id,
      key: documentItem.key,
      libraryID: documentItem.libraryID,
      itemType: documentItem.itemType,
      title: documentItem.getField('title') || '(无标题)'
    },
    pdfAttachments: mappedAttachments,
    annotationCount: mappedAttachments.reduce(
      (count, attachment) => count + attachment.annotations.length,
      0
    )
  };
}
