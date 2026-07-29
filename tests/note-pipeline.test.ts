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
    content_role: 'context_explanation',
    focus_topic_ids: ['F1'],
    annotation_ids: ['A1'],
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

  it('compacts repeated annotation locations while preserving distinct comments', async () => {
    const repeatedLocationData: EvidenceDebugData = {
      ...data,
      evidenceUnits: [
        {
          ...data.evidenceUnits[0],
          annotationId: 'A1',
          annotationKey: 'ANN-1',
          userComment: '[AI压力测试 001/083] 为什么这种方法有效？'
        },
        {
          ...data.evidenceUnits[0],
          id: 'E-PDF-1-02',
          annotationId: 'A2',
          annotationKey: 'ANN-2',
          userComment: '[AI压力测试 002/083] 是否有独立消融证据？'
        }
      ]
    };
    const client = {
      generateJson: vi.fn(async (...args: unknown[]) => {
        const messages = args[1] as Array<{ role: string; content: string }>;
        const request = JSON.parse(messages[1].content);
        expect(request.annotations).toHaveLength(1);
        expect(request.annotations[0].comment)
          .toBe('为什么这种方法有效？\n是否有独立消融证据？');
        return {
          focus_topics: [{
            id: 'F1', title: '方法', annotation_ids: ['A1'], confidence: 'high', priority: 1
          }]
        };
      })
    };

    const result = await identifyFocusTopics(config, repeatedLocationData, client as never);

    expect(result.focusTopics[0].annotationIds).toEqual(['A1']);
    expect(client.generateJson).toHaveBeenCalledTimes(1);
  });

  it('compacts a 101-annotation stress case to its 15 distinct source locations', async () => {
    const evidenceUnits = Array.from({ length: 101 }, (_, index) => {
      const location = index % 15;
      return {
        ...data.evidenceUnits[0],
        id: `E-PDF-${String(index + 1).padStart(3, '0')}`,
        annotationId: `A${index + 1}`,
        annotationKey: `ANN-${index + 1}`,
        annotationText: `highlight ${location}`,
        userComment:
          `[AI压力测试 ${String(index + 1).padStart(3, '0')}/101] `
          + (index % 2 === 0 ? '为什么这种方法有效？' : '是否有独立消融证据？'),
        page: Math.floor(location / 5) + 1,
        pageLabel: String(Math.floor(location / 5) + 1),
        text: `context for location ${location}`,
        contentHash: `hash-${location}`
      };
    });
    const stressData: EvidenceDebugData = {
      ...data,
      stats: {
        ...data.stats,
        annotationCount: 101,
        evidenceCount: 101,
        contextualizedCount: 101
      },
      evidenceUnits
    };
    const client = {
      generateJson: vi.fn(async (...args: unknown[]) => {
        const messages = args[1] as Array<{ role: string; content: string }>;
        const request = JSON.parse(messages[1].content);
        expect(request.annotations).toHaveLength(15);
        expect(request.annotations.every((annotation: { comment: string }) =>
          annotation.comment.includes('为什么这种方法有效？')
          && annotation.comment.includes('是否有独立消融证据？')
        )).toBe(true);
        return {
          focus_topics: [{
            id: 'F1',
            title: '压力测试主题',
            annotation_ids: request.annotations.map((annotation: { id: string }) => annotation.id),
            confidence: 'high',
            priority: 1
          }]
        };
      })
    };

    const result = await identifyFocusTopics(config, stressData, client as never);

    expect(result.focusTopics[0].annotationIds).toHaveLength(15);
    expect(client.generateJson).toHaveBeenCalledTimes(1);
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

  it('does not let an extra requirement replace a real annotation-backed focus', async () => {
    const client = { generateJson: vi.fn() };

    await expect(generateValidatedNote(
      config,
      data,
      [focus],
      [],
      '总结整篇论文',
      undefined,
      client as never
    )).rejects.toThrow('特别要求只能补充已选重点');
    expect(client.generateJson).not.toHaveBeenCalled();
  });

  it('sends only evidence belonging to user-selected focus topics', async () => {
    const dataWithUnselectedEvidence: EvidenceDebugData = {
      ...data,
      stats: { ...data.stats, annotationCount: 2, evidenceCount: 2 },
      evidenceUnits: [
        data.evidenceUnits[0],
        {
          ...data.evidenceUnits[0],
          id: 'E-PDF-1-02',
          annotationId: 'A2',
          annotationKey: 'ANN2',
          annotationText: 'unselected experiment result',
          userComment: '',
          tags: ['实验']
        }
      ]
    };
    const client = { generateJson: vi.fn(async () => validNoteResponse) };

    await generateValidatedNote(
      config,
      dataWithUnselectedEvidence,
      [focus, { ...focus, id: 'F2', title: '实验', annotationIds: ['A2'], priority: 2 }],
      [{ id: 'F1', priority: 1 }],
      '',
      undefined,
      client as never
    );

    const messages = client.generateJson.mock.calls[0][1] as Array<{ content: string }>;
    const payload = JSON.parse(messages[1].content);
    expect(payload.evidence_units.map((unit: { annotation_id: string }) => unit.annotation_id))
      .toEqual(['A1']);
    expect(payload.approved_outline.articleCore.evidenceIds).toEqual(['E-PDF-1-01']);
    expect(messages[0].content).toContain('不是总结整篇论文，也不是改写高亮');
  });

  it('requires contextual interpretation instead of annotation-only restatement', async () => {
    const restatement = {
      ...validNoteResponse,
      content_mappings: [{
        ...validNoteResponse.content_mappings[0],
        content_role: 'annotation_summary'
      }]
    };
    const responses = [restatement, reviewedValidNote];
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
    expect(client.generateJson).toHaveBeenCalledTimes(2);
    const reviewMessages = client.generateJson.mock.calls[1][1] as Array<{ content: string }>;
    expect(reviewMessages[1].content).toContain('只有批注复述');
    expect(client.generateJson.mock.calls[1][4]).toBe(8192);
  });

  it('does not allow invented user opinions when an annotation has no comment', async () => {
    const noCommentData: EvidenceDebugData = {
      ...data,
      evidenceUnits: [{ ...data.evidenceUnits[0], userComment: '', tags: [] }]
    };
    const inventedOpinion = {
      ...validNoteResponse,
      markdown_note: '# 笔记\n\n用户认为该方法更重要。',
      content_mappings: [{
        ...validNoteResponse.content_mappings[0],
        generated_text: '用户认为该方法更重要。',
        source_kind: 'user_annotation',
        content_role: 'user_comment'
      }]
    };
    const responses = [inventedOpinion, reviewedValidNote];
    const client = { generateJson: vi.fn(async () => responses.shift()) };

    const result = await generateValidatedNote(
      config,
      noCommentData,
      [focus],
      [{ id: 'F1', priority: 1 }],
      '',
      undefined,
      client as never
    );

    expect(result.validation.valid).toBe(true);
    expect(client.generateJson).toHaveBeenCalledTimes(2);
    expect(result.note.markdownNote).not.toContain('用户认为');
  });

  it('preserves a user question as a question in the final note', async () => {
    const questionData: EvidenceDebugData = {
      ...data,
      evidenceUnits: [{
        ...data.evidenceUnits[0],
        userComment: '为什么这种方法能够降低过拟合？'
      }]
    };
    const answeredAsConclusion = {
      ...validNoteResponse,
      markdown_note: '# 笔记\n\n这种方法能够降低过拟合。'
    };
    const questionNote = {
      ...validNoteResponse,
      markdown_note: '# 笔记\n\n## 方法解释\n\n原文说明了方法的作用。\n\n仍需追问：为什么这种方法能够降低过拟合？',
      content_mappings: [
        validNoteResponse.content_mappings[0],
        {
          ...validNoteResponse.content_mappings[0],
          id: 'M2',
          generated_text: '仍需追问：为什么这种方法能够降低过拟合？',
          source_kind: 'user_annotation',
          content_role: 'open_question'
        }
      ]
    };
    const questionReview = {
      review_results: ['M1', 'M2'].map(id => ({
        mapping_id: id,
        status: 'supported',
        reason: '原文或用户问题支持',
        valid_evidence_ids: ['E-PDF-1-01'],
        invalid_evidence_ids: [],
        recommended_action: 'keep'
      })),
      overall_risk: 'low',
      warnings: []
    };
    const responses = [
      answeredAsConclusion,
      { final_note: questionNote, final_review: questionReview }
    ];
    const client = { generateJson: vi.fn(async () => responses.shift()) };

    const result = await generateValidatedNote(
      config,
      questionData,
      [focus],
      [{ id: 'F1', priority: 1 }],
      '',
      undefined,
      client as never
    );

    expect(result.validation.valid).toBe(true);
    expect(result.note.markdownNote).toContain('为什么这种方法能够降低过拟合？');
    expect(result.note.contentMappings.some(mapping => mapping.contentRole === 'open_question'))
      .toBe(true);
  });

  it('does not treat an instruction containing an embedded question word as an open question', async () => {
    const instructionData: EvidenceDebugData = {
      ...data,
      evidenceUnits: [{
        ...data.evidenceUnits[0],
        userComment: '需要结合上下文解释为什么深度能够改善分类效果，同时区分原文与后续解释。'
      }]
    };
    const client = { generateJson: vi.fn(async () => validNoteResponse) };

    const result = await generateValidatedNote(
      config,
      instructionData,
      [focus],
      [{ id: 'F1', priority: 1 }],
      '',
      undefined,
      client as never
    );

    expect(result.validation.valid).toBe(true);
    expect(client.generateJson).toHaveBeenCalledTimes(1);
  });

  it('accepts a semantically equivalent visible question when its internal mapping is omitted', async () => {
    const questionData: EvidenceDebugData = {
      ...data,
      evidenceUnits: [{
        ...data.evidenceUnits[0],
        userComment: '作者是否有充分消融实验支持各因素的独立贡献？'
      }]
    };
    const paraphrasedQuestionNote = {
      ...validNoteResponse,
      markdown_note:
        '# 笔记\n\n## 方法解释\n\n方法在 2015 年得到改进。\n\n' +
        '论文是否提供了足够的独立消融实验，分别估计各项因素的贡献？'
    };
    const client = { generateJson: vi.fn(async () => paraphrasedQuestionNote) };

    const result = await generateValidatedNote(
      config,
      questionData,
      [focus],
      [{ id: 'F1', priority: 1 }],
      '',
      undefined,
      client as never
    );

    expect(result.validation.valid).toBe(true);
    expect(client.generateJson).toHaveBeenCalledTimes(1);
  });

  it('treats repeated copies of the same user question as one question', async () => {
    const repeatedQuestionData: EvidenceDebugData = {
      ...data,
      stats: {
        ...data.stats,
        annotationCount: 2,
        evidenceCount: 2,
        contextualizedCount: 2
      },
      evidenceUnits: [
        {
          ...data.evidenceUnits[0],
          annotationId: 'A1',
          annotationKey: 'ANN-1',
          userComment: '[AI压力测试 001/083] 用户问题：为什么这种方法能够降低过拟合？关联高亮：method improved'
        },
        {
          ...data.evidenceUnits[0],
          id: 'E-PDF-1-02',
          annotationId: 'A2',
          annotationKey: 'ANN-2',
          annotationText: 'another method detail',
          userComment: '[AI压力测试 002/083] 用户问题：为什么这种方法能够降低过拟合？关联高亮：another detail'
        }
      ]
    };
    const repeatedQuestionFocus: FocusTopic = {
      ...focus,
      annotationIds: ['A1', 'A2']
    };
    const noteWithOneQuestion = {
      ...validNoteResponse,
      markdown_note: '# 笔记\n\n## 方法解释\n\n原文说明了方法的作用。\n\n仍需追问：为什么这种方法能够降低过拟合？',
      content_mappings: [
        validNoteResponse.content_mappings[0],
        {
          ...validNoteResponse.content_mappings[0],
          id: 'M2',
          generated_text: '仍需追问：为什么这种方法能够降低过拟合？',
          source_kind: 'user_annotation',
          content_role: 'open_question'
        }
      ]
    };
    const client = { generateJson: vi.fn(async (..._args: unknown[]) => noteWithOneQuestion) };

    const result = await generateValidatedNote(
      config,
      repeatedQuestionData,
      [repeatedQuestionFocus],
      [{ id: 'F1', priority: 1 }],
      '',
      undefined,
      client as never
    );

    expect(result.validation.valid).toBe(true);
    expect(client.generateJson).toHaveBeenCalledTimes(1);
    const messages = client.generateJson.mock.calls[0][1] as Array<{
      role: string;
      content: string;
    }>;
    const request = JSON.parse(messages[1].content);
    expect(request.approved_outline.outline[0].questionsToAnswer)
      .toEqual(['为什么这种方法能够降低过拟合？']);
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

  it('reconciles blank review mapping IDs only when every missing mapping has a review item', async () => {
    const questionData: EvidenceDebugData = {
      ...data,
      evidenceUnits: [{
        ...data.evidenceUnits[0],
        userComment: '为什么这种方法能够降低过拟合？'
      }]
    };
    const questionNote = {
      ...validNoteResponse,
      markdown_note: '# 笔记\n\n方法在 2015 年得到改进。\n\n为什么这种方法能够降低过拟合？',
      content_mappings: [
        validNoteResponse.content_mappings[0],
        {
          ...validNoteResponse.content_mappings[0],
          id: 'M2',
          generated_text: '为什么这种方法能够降低过拟合？',
          source_kind: 'user_annotation',
          content_role: 'open_question'
        }
      ]
    };
    const responses = [
      validNoteResponse,
      {
        final_note: questionNote,
        final_review: {
          review_results: [
            supportedReview.review_results[0],
            {
              ...supportedReview.review_results[0],
              mapping_id: ''
            }
          ],
          overall_risk: 'low',
          warnings: []
        }
      }
    ];
    const client = { generateJson: vi.fn(async () => responses.shift()) };

    const result = await generateValidatedNote(
      config,
      questionData,
      [focus],
      [{ id: 'F1', priority: 1 }],
      '',
      undefined,
      client as never
    );

    expect(result.validation.valid).toBe(true);
    expect(result.validation.review.reviewResults.map(item => item.mappingId))
      .toEqual(['M1', 'M2']);
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
