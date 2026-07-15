import { describe, expect, it, vi } from 'vitest';
import type { ProviderConfig } from '../src/config/settings';
import type { EvidenceDebugData } from '../src/evidence/evidence-builder';
import {
  generateValidatedNote,
  identifyFocusTopics,
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

const outlineResponse = {
  article_core: {
    problem: '问题', method: '方法', conclusion: '结论', evidence_ids: ['E-PDF-1-01']
  },
  user_focus_relation: '关注方法',
  outline: [{
    id: 'S1', heading: '核心方法', purpose: '解释方法', source_plan: ['document'],
    evidence_ids: ['E-PDF-1-01'], annotation_ids: ['A1'], questions_to_answer: []
  }],
  missing_information: [], conflicts: [], warnings: []
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
    const responses = [outlineResponse, validNoteResponse, supportedReview];
    const client = { generateJson: vi.fn(async () => responses.shift()) };

    const result = await generateValidatedNote(
      config,
      data,
      [focus],
      [{ id: 'F1', priority: 1 }],
      '',
      client as never
    );

    expect(result.validation.valid).toBe(true);
    expect(result.note.markdownNote).not.toContain('E-PDF');
    expect(result.note.contentMappings[0].evidenceIds).toEqual(['E-PDF-1-01']);
    expect(client.generateJson).toHaveBeenCalledTimes(3);
  });

  it('automatically revises once when a number is unsupported', async () => {
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
      outlineResponse,
      invalidNote,
      invalidReview,
      validNoteResponse,
      supportedReview
    ];
    const client = { generateJson: vi.fn(async () => responses.shift()) };

    const result = await generateValidatedNote(
      config,
      data,
      [focus],
      [{ id: 'F1', priority: 1 }],
      '',
      client as never
    );

    expect(result.validation.valid).toBe(true);
    expect(result.note.markdownNote).not.toContain('999');
    expect(client.generateJson).toHaveBeenCalledTimes(5);
  });
});
