declare const Zotero: any;

export async function writeGeneratedMarkdown(
  documentKey: string,
  markdown: string
): Promise<string> {
  const fileName = `zotero-ai-notes-${documentKey}-generated.md`;
  const filePath = PathUtils.join(PathUtils.tempDir, fileName);
  await Zotero.File.putContentsAsync(filePath, markdown, 'utf-8');
  Zotero.debug(`Zotero AI Notes generated Markdown:\n${markdown}`, 1);
  return filePath;
}
