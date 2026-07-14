import type { SelectedDocumentData } from '../zotero/annotation-reader';
import type { EvidenceDebugData } from '../evidence/evidence-builder';

declare const Zotero: any;

export async function writeDebugJson(data: SelectedDocumentData): Promise<string> {
  const fileName = `zotero-ai-notes-${data.document.key}-annotations.json`;
  const filePath = PathUtils.join(PathUtils.tempDir, fileName);
  const json = JSON.stringify(data, null, 2);

  await Zotero.File.putContentsAsync(filePath, json, 'utf-8');
  Zotero.debug(`Zotero AI Notes annotation data:\n${json}`, 1);

  return filePath;
}

export async function writeEvidenceDebugJson(data: EvidenceDebugData): Promise<string> {
  const fileName = `zotero-ai-notes-${data.document.key}-evidence.json`;
  const filePath = PathUtils.join(PathUtils.tempDir, fileName);
  const json = JSON.stringify(data, null, 2);

  await Zotero.File.putContentsAsync(filePath, json, 'utf-8');
  Zotero.debug(`Zotero AI Notes evidence data:\n${json}`, 1);

  return filePath;
}
