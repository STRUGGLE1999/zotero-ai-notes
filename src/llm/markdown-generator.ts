import type { EvidenceDebugData, EvidenceUnit } from '../evidence/evidence-builder';
import type { ProviderConfig } from '../config/settings';
import { GeminiClient } from './gemini-client';

function serializeEvidence(unit: EvidenceUnit) {
  return {
    id: unit.id,
    page: unit.pageLabel || unit.page || null,
    highlight: unit.annotationText,
    userComment: unit.userComment,
    tags: unit.tags,
    context: unit.text
  };
}

export async function generateGroundedMarkdown(
  config: ProviderConfig,
  data: EvidenceDebugData,
  client = new GeminiClient()
): Promise<string> {
  const evidence = data.evidenceUnits.map(serializeEvidence);
  return client.generateMarkdown(config, [
    {
      role: 'system',
      content:
        '你是 Zotero 文献批注整理助手。只能使用用户提供的 Evidence，不得补充或猜测原文中没有的信息。' +
        '将批注整理成结构清晰、自然的中文 Markdown 笔记。每个事实或观点后标注对应 Evidence ID，格式为 [E-...]。' +
        '保留用户评论和标签的含义；证据不足时明确说明。只输出 Markdown，不要输出解释或代码围栏。'
    },
    {
      role: 'user',
      content: JSON.stringify({
        documentTitle: data.document.title,
        evidence
      })
    }
  ]);
}
