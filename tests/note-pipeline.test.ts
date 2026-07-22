import { describe, expect, it, vi } from 'vitest';
import type { ProviderConfig } from '../src/config/settings';
import type { EvidenceDebugData } from '../src/evidence/evidence-builder';
import { RequestCancellationController } from '../src/llm/gemini-client';
import {
  generateValidatedNote,
  identifyFocusTopics,
  createNotePipelineCheckpoint,
  stripInternalEvidenceIds,
  type FocusTopic
} from '../src/llm/note-pipeline';

const config: ProviderConfig = {
  provider: 'gemini',
  providerLabel: 'Google Gemini',
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  model: 'gemini-test',
  apiKey: 'secret'
};

const data: EvidenceDebugData = {
  generatedAt: '2026-07-14T00:00:00.000Z',
  document: {
    id: 1,
    key: 'DOC',
    libraryID: 1,
    itemType: 'journalArticle',
    title: 'Test Paper'
  },
  stats: {
    pdfAttachmentCount: 1,
    annotationCount: 1,
    annotatedPageCount: 1,
    evidenceCount: 1,
    contextualizedCount: 1,
    annotationOnlyCount: 0
  },
  evidenceUnits: [{
    id: 'E-PDF-1-01',
    sourceType: 'annotation_context',
    attachmentKey: 'PDF',
    annotationId: 'A1',
    annotationKey: 'ANN',
    annotationType: 'highlight',
    annotationText: 'method improved in 2015',
    userComment: '重点关注方法',
    tags: ['方法'],
    page: 1,
    pageLabel: '1',
    text: 'The method improved in 2015.',
    matchMethod: 'exact',
    contentHash: 'hash'
  }],
  warnings: []
};

const focus: FocusTopic = {
  id: 'F1',
  title: '方法',
  description: '关注方法',
  reason: '有用户评论',
  annotationIds: ['A1'],
  confidence: 'high',
  priority: 1
};

const validNoteResponse = {
  title: '自然笔记',
  markdown_note: '# 自然笔记\n\n方法在 2015 年得到改进 [E-PDF-1-01]。',
  content_mappings: [{
    id: 'M1',
    generated_text: '方法在 2015 年得到改进。',
    source_kind: 'document',
    evidence_ids: ['E-PDF-1-01'],
    confidence: 'high',
    needs_review: false
  }],
  unanswered_questions: [], warnings: []
};

const supportedReview = {
  review_results: [{
    mapping_id: 'M1', status: 'supported', reason: '原文支持',
    valid_evidence_ids: ['E-PDF-1-01'], invalid_evidence_ids: [], recommended_action: 'keep'
  }],
  overall_risk: 'low', warnings: []
};

const reviewedValidNote = {
  final_note: validNoteResponse,
  final_review: supportedReview
};

describe('note pipeline', () => {
  it('removes internal Evidence IDs from the user-facing Markdown', () => {
    expect(stripInternalEvidenceIds('内容 [E-A-1-01, E-A-1-02]。')).toBe('内容。');
  });

  it('rejects focus topics that invent annotation IDs', async () => {
    const client = {
      generateJson: vi.fn(async () => ({
        focus_topics: [{
          id: 'F1', title: '伪造', annotation_ids: ['MISSING'], confidence: 'high', priority: 1
        }]
      }))
    };

    await expect(identifyFocusTopics(config, data, client as never))
      .rejects.toThrow('不存在的批注 ID');
  });

  it('accepts numeric annotation IDs returned by Gemini for Zotero item IDs', async () => {
    const numericData: EvidenceDebugData = {
      ...data,
      evidenceUnits: [{ ...data.evidenceUnits[0], annotationId: '5' }]
    };
    const client = {
      generateJson: vi.fn(async () => ({
        focus_topics: [{
          id: 'F1',
          title: '方法',
          annotation_ids: [5],
          confidence: 'high',
          priority: 1
        }]
      }))
    };

    const result = await identifyFocusTopics(config, numericData, client as never);

    expect(result.focusTopics[0].annotationIds).toEqual(['5']);
  });

  it('automatically asks the model to correct a malformed focus result once', async () => {
    const responses = [
      { focus_topics: [{ id: 'F1', title: '方法', annotation_ids: [] }] },
      { focus_topics: [{ id: 'F1', title: '方法', annotation_ids: 'A1', priority: 1 }] }
    ];
    const client = { generateJson: vi.fn(async () => responses.shift()) };

    const result = await identifyFocusTopics(config, data, client as never);

    expect(result.focusTopics[0].annotationIds).toEqual(['A1']);
    expect(client.generateJson).toHaveBeenCalledTimes(2);
  });

  it('generates a natural note, validates mappings, and keeps IDs backstage', async () => {
    const responses = [validNoteResponse];
    const client = { generateJson: vi.fn(async () => responses.shift()) };

    const result = await generateValidatedNote(
      config,
      data,
      [focus],
      [{ id: 'F1', priority: 1 }],
      '',
      undefined,
      client as never
    );

    expect(result.validation.valid).toBe(true);
    expect(result.note.markdownNote).not.toContain('E-PDF');
    expect(result.note.contentMappings[0].evidenceIds).toEqual(['E-PDF-1-01']);
    expect(client.generateJson).toHaveBeenCalledTimes(1);
    expect(result.validation.warnings).toContain(
      '未检测到需额外模型审查的风险信号，已跳过额外调用。'
    );
  });

  it('reviews and corrects an unsupported number without extra model rounds', async () => {
    const invalidNote = {
      ...validNoteResponse,
      markdown_note: '# 笔记\n\n方法提升了 999%。',
      content_mappings: [{
        ...validNoteResponse.content_mappings[0],
        generated_text: '方法提升了 999%。'
      }]
    };
    const responses = [invalidNote, reviewedValidNote];
    const client = { generateJson: vi.fn(async () => responses.shift()) };

    const result = await generateValidatedNote(
      config,
      data,
      [focus],
      [{ id: 'F1', priority: 1 }],
      '',
      undefined,
      client as never
    );

    expect(result.validation.valid).toBe(true);
    expect(result.note.markdownNote).not.toContain('999');
    expect(client.generateJson).toHaveBeenCalledTimes(2);
  });

  it('uses only one fallback correction when the reviewed result is still invalid', async () => {
    const invalidNote = {
      ...validNoteResponse,
      markdown_note: '# 笔记\n\n方法提升了 999%。',
      content_mappings: [{
        ...validNoteResponse.content_mappings[0],
        generated_text: '方法提升了 999%。'
      }]
    };
    const invalidReview = {
      review_results: [{
        mapping_id: 'M1', status: 'unsupported', reason: '无此数字',
        valid_evidence_ids: [], invalid_evidence_ids: [], recommended_action: 'remove'
      }],
      overall_risk: 'high', warnings: []
    };
    const responses = [
      invalidNote,
      { final_note: invalidNote, final_review: invalidReview },
      reviewedValidNote
    ];
    const client = { generateJson: vi.fn(async () => responses.shift()) };

    const result = await generateValidatedNote(
      config,
      data,
      [focus],
      [{ id: 'F1', priority: 1 }],
      '',
      undefined,
      client as never
    );

    expect(result.validation.valid).toBe(true);
    expect(result.note.markdownNote).not.toContain('999');
    expect(client.generateJson).toHaveBeenCalledTimes(3);
  });

  it('accepts equivalent localized numeric units in generated text', async () => {
    const localizedData: EvidenceDebugData = {
      ...data,
      evidenceUnits: [{
        ...data.evidenceUnits[0],
        text: 'ImageNet contains more than 15 million labeled images and the network has 60 million parameters.'
      }]
    };
    const localizedNote = {
      ...validNoteResponse,
      markdown_note: '# 笔记\n\nImageNet 包含超过 1,500万张标注图像，网络有 6,000万个参数。',
      content_mappings: [{
        ...validNoteResponse.content_mappings[0],
        generated_text: 'ImageNet 包含超过 1,500万张标注图像，网络有 6,000万个参数。'
      }]
    };
    const responses = [localizedNote];
    const client = { generateJson: vi.fn(async () => responses.shift()) };

    const result = await generateValidatedNote(
      config,
      localizedData,
      [focus],
      [{ id: 'F1', priority: 1 }],
      '',
      undefined,
      client as never
    );

    expect(result.validation.valid).toBe(true);
    expect(client.generateJson).toHaveBeenCalledTimes(1);
  });

  it('reports each long-running generation stage', async () => {
    const responses = [validNoteResponse];
    const client = { generateJson: vi.fn(async () => responses.shift()) };
    const progress = vi.fn();

    await generateValidatedNote(
      config,
      data,
      [focus],
      [{ id: 'F1', priority: 1 }],
      '',
      progress,
      client as never
    );

    expect(progress.mock.calls.map(call => call[0])).toEqual([
      '正在本地整理笔记结构…',
      '正在本地整理笔记结构…',
      '正在生成 Markdown 笔记…',
      '正在生成 Markdown 笔记…',
      '正在审查并校正内容…'
    ]);
    const finalReport = progress.mock.calls.at(-1)?.[1];
    expect(finalReport.callCount).toBe(1);
    expect(finalReport.stages.slice(0, 3).map((stage: { status: string }) => stage.status))
      .toEqual(['completed', 'completed', 'skipped']);
  });

  it('retries from the failed review and preserves the completed outline and note', async () => {
    const reviewFailure = new Error('审查服务暂时不可用');
    const riskyNote = {
      ...validNoteResponse,
      content_mappings: [{
        ...validNoteResponse.content_mappings[0],
        confidence: 'medium'
      }]
    };
    const responses: unknown[] = [riskyNote, reviewFailure, reviewedValidNote];
    const client = {
      generateJson: vi.fn(async () => {
        const response = responses.shift();
        if (response instanceof Error) throw response;
        return response;
      })
    };
    const checkpoint = createNotePipelineCheckpoint([focus]);

    await expect(generateValidatedNote(
      config,
      data,
      [focus],
      [{ id: 'F1', priority: 1 }],
      '',
      undefined,
      client as never,
      { checkpoint }
    )).rejects.toThrow('审查服务暂时不可用');

    expect(checkpoint.nextStage).toBe('review');
    expect(checkpoint.outline).toBeDefined();
    expect(checkpoint.note?.markdownNote).toContain('2015');
    expect(checkpoint.stages.find(stage => stage.id === 'review')?.status).toBe('failed');

    const result = await generateValidatedNote(
      config,
      data,
      [focus],
      [{ id: 'F1', priority: 1 }],
      '',
      undefined,
      client as never,
      { checkpoint }
    );

    expect(result.validation.valid).toBe(true);
    expect(client.generateJson).toHaveBeenCalledTimes(3);
    expect(checkpoint.stages.find(stage => stage.id === 'outline')?.callCount).toBe(0);
    expect(checkpoint.stages.find(stage => stage.id === 'note')?.callCount).toBe(1);
    expect(checkpoint.stages.find(stage => stage.id === 'review')?.callCount).toBe(2);
    expect(checkpoint.callCount).toBe(3);
  });

  it('marks the current stage as cancelled and keeps it available for retry', async () => {
    const abortController = new RequestCancellationController();
    const client = {
      generateJson: vi.fn(
        (_config, _messages, _temperature, signal) =>
          new Promise((_resolve, reject) => {
            signal.subscribe(() => reject(new Error('request cancelled')));
          })
      )
    };
    const checkpoint = createNotePipelineCheckpoint([focus]);
    const pending = generateValidatedNote(
      config,
      data,
      [focus],
      [{ id: 'F1', priority: 1 }],
      '',
      undefined,
      client as never,
      { checkpoint, signal: abortController.signal }
    );

    abortController.abort();

    await expect(pending).rejects.toThrow('生成已取消');
    expect(checkpoint.nextStage).toBe('note');
    expect(checkpoint.stages[1].status).toBe('cancelled');
    expect(checkpoint.stages[1].failureReason).toBe('用户已取消生成。');
  });
});
