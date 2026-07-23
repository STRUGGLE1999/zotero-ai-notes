import type { ProviderConfig } from '../config/settings';
import type { EvidenceDebugData, EvidenceUnit } from '../evidence/evidence-builder';
import {
  GeminiClient,
  isRequestCancelled,
  RequestCancelledError,
  type RequestCancellationSignal
} from './gemini-client';

export interface FocusTopic {
  id: string;
  title: string;
  description: string;
  reason: string;
  annotationIds: string[];
  confidence: 'high' | 'medium' | 'low';
  priority: number;
}

export interface FocusResult {
  focusTopics: FocusTopic[];
  userQuestions: Array<{ question: string; annotationIds: string[] }>;
  warnings: string[];
}

export interface SelectedFocus {
  id: string;
  priority: number;
}

export interface OutlineSection {
  id: string;
  heading: string;
  purpose: string;
  sourcePlan: Array<'document' | 'user_annotation' | 'synthesis'>;
  evidenceIds: string[];
  annotationIds: string[];
  questionsToAnswer: string[];
}

export interface OutlineResult {
  articleCore: {
    problem: string;
    method: string;
    conclusion: string;
    evidenceIds: string[];
  };
  userFocusRelation: string;
  outline: OutlineSection[];
  missingInformation: string[];
  conflicts: string[];
  warnings: string[];
}

export interface ContentMapping {
  id: string;
  generatedText: string;
  sourceKind: 'document' | 'user_annotation' | 'synthesis';
  evidenceIds: string[];
  confidence: 'high' | 'medium' | 'low';
  needsReview: boolean;
}

export interface GeneratedNote {
  title: string;
  markdownNote: string;
  contentMappings: ContentMapping[];
  unansweredQuestions: string[];
  warnings: string[];
}

export interface ReviewItem {
  mappingId: string;
  status: 'supported' | 'partially_supported' | 'unsupported' | 'misattributed';
  reason: string;
  validEvidenceIds: string[];
  invalidEvidenceIds: string[];
  recommendedAction: 'keep' | 'rewrite' | 'move_to_question' | 'remove';
}

export interface ReviewResult {
  reviewResults: ReviewItem[];
  overallRisk: 'low' | 'medium' | 'high';
  warnings: string[];
}

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  review: ReviewResult;
}

export interface NotePipelineResult {
  focusTopics: FocusTopic[];
  outline: OutlineResult;
  note: GeneratedNote;
  validation: ValidationResult;
}

export type NotePipelineStageId = 'outline' | 'note' | 'review' | 'revision' | 'rereview';

export type NotePipelineStageStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'skipped'
  | 'failed'
  | 'cancelled';

export interface NotePipelineStageReport {
  id: NotePipelineStageId;
  label: NotePipelineStage;
  status: NotePipelineStageStatus;
  durationMs: number;
  callCount: number;
  failureReason?: string;
}

export interface NotePipelineReport {
  stages: NotePipelineStageReport[];
  callCount: number;
  durationMs: number;
  currentStage: NotePipelineStageId | null;
  failureReason?: string;
  cancelled: boolean;
}

export interface NotePipelineCheckpoint {
  focusTopics: FocusTopic[];
  outline?: OutlineResult;
  note?: GeneratedNote;
  review?: ReviewResult;
  validation?: ValidationResult;
  nextStage: NotePipelineStageId;
  stages: NotePipelineStageReport[];
  callCount: number;
  durationMs: number;
}

export interface NotePipelineOptions {
  checkpoint?: NotePipelineCheckpoint;
  signal?: RequestCancellationSignal;
}

export type NotePipelineStage =
  | '正在本地整理笔记结构…'
  | '正在生成 Markdown 笔记…'
  | '正在审查并校正内容…'
  | '校验仍有问题，正在再次修订…'
  | '正在复核修订结果…';

const STAGE_LABELS: Record<NotePipelineStageId, NotePipelineStage> = {
  outline: '正在本地整理笔记结构…',
  note: '正在生成 Markdown 笔记…',
  review: '正在审查并校正内容…',
  revision: '校验仍有问题，正在再次修订…',
  rereview: '正在复核修订结果…'
};

function createStageReports(): NotePipelineStageReport[] {
  return (Object.keys(STAGE_LABELS) as NotePipelineStageId[]).map(id => ({
    id,
    label: STAGE_LABELS[id],
    status: 'pending',
    durationMs: 0,
    callCount: 0
  }));
}

export function createNotePipelineCheckpoint(focusTopics: FocusTopic[]): NotePipelineCheckpoint {
  return {
    focusTopics,
    nextStage: 'outline',
    stages: createStageReports(),
    callCount: 0,
    durationMs: 0
  };
}

export function notePipelineReport(checkpoint: NotePipelineCheckpoint): NotePipelineReport {
  const current = checkpoint.stages.find(stage =>
    stage.status === 'running' || stage.status === 'failed' || stage.status === 'cancelled'
  );
  return {
    stages: checkpoint.stages.map(stage => ({ ...stage })),
    callCount: checkpoint.callCount,
    durationMs: checkpoint.durationMs,
    currentStage: current?.id || null,
    failureReason: current?.failureReason,
    cancelled: current?.status === 'cancelled'
  };
}

interface RawFocusTopic {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  reason?: unknown;
  annotation_ids?: unknown;
  annotationIds?: unknown;
  confidence?: unknown;
  priority?: unknown;
}

interface RawFocusResult {
  focus_topics?: RawFocusTopic[];
  focusTopics?: RawFocusTopic[];
  user_questions?: Array<Record<string, unknown>>;
  userQuestions?: Array<Record<string, unknown>>;
  warnings?: unknown;
}

interface RawGeneratedNote {
  title?: unknown;
  markdown_note?: unknown;
  markdownNote?: unknown;
  content_mappings?: Array<Record<string, unknown>>;
  contentMappings?: Array<Record<string, unknown>>;
  unanswered_questions?: unknown;
  unansweredQuestions?: unknown;
  warnings?: unknown;
}

interface RawReviewResult {
  review_results?: Array<Record<string, unknown>>;
  reviewResults?: Array<Record<string, unknown>>;
  overall_risk?: unknown;
  overallRisk?: unknown;
  warnings?: unknown;
}

interface RawReviewedNote {
  final_note?: RawGeneratedNote;
  finalNote?: RawGeneratedNote;
  final_review?: RawReviewResult;
  finalReview?: RawReviewResult;
}

const EVIDENCE_ID_PATTERN = /\[?E-[A-Z0-9-]+\]?/gi;

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean)
    : [];
}

function identifierArray(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values
    .map(item => {
      if (typeof item === 'string') {
        return item.trim();
      }
      if (typeof item === 'number' && Number.isFinite(item)) {
        return String(item);
      }
      return '';
    })
    .filter(Boolean);
}

function warningArray(value: unknown): string[] {
  return stringArray(value);
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback;
}

function evidenceForPrompt(unit: EvidenceUnit) {
  return {
    id: unit.id,
    annotation_id: unit.annotationId,
    page: unit.pageLabel || unit.page || null,
    highlight: unit.annotationText,
    user_comment: unit.userComment,
    tags: unit.tags,
    context: unit.text
  };
}

function annotationForPrompt(unit: EvidenceUnit) {
  return {
    id: unit.annotationId,
    text: unit.annotationText,
    comment: unit.userComment,
    tags: unit.tags,
    page: unit.pageLabel || unit.page || null
  };
}

function uniqueAnnotations(data: EvidenceDebugData) {
  const annotations = new Map<string, ReturnType<typeof annotationForPrompt>>();
  for (const unit of data.evidenceUnits) {
    annotations.set(unit.annotationId, annotationForPrompt(unit));
  }
  return [...annotations.values()];
}

function normalizeFocusResult(raw: RawFocusResult, data: EvidenceDebugData): FocusResult {
  const knownAnnotationIds = new Set(data.evidenceUnits.map(unit => unit.annotationId));
  const candidateTopics = raw.focus_topics || raw.focusTopics || [];
  const rawTopics = Array.isArray(candidateTopics) ? candidateTopics : [];
  const focusTopics = rawTopics.map((topic, index): FocusTopic => {
    const annotationIds = identifierArray(topic.annotation_ids || topic.annotationIds);
    const invalid = annotationIds.filter(id => !knownAnnotationIds.has(id));
    if (invalid.length) {
      throw new Error(`关注重点包含不存在的批注 ID：${invalid.join(', ')}`);
    }
    return {
      id: stringValue(topic.id, `F${index + 1}`),
      title: stringValue(topic.title, `关注重点 ${index + 1}`),
      description: stringValue(topic.description),
      reason: stringValue(topic.reason),
      annotationIds,
      confidence: enumValue(topic.confidence, ['high', 'medium', 'low'] as const, 'medium'),
      priority: typeof topic.priority === 'number' && Number.isFinite(topic.priority)
        ? Math.max(1, Math.round(topic.priority))
        : index + 1
    };
  }).filter(topic => topic.annotationIds.length > 0);

  if (!focusTopics.length) {
    throw new Error('模型没有返回可由真实批注支持的关注重点（可能遗漏了 annotation_ids）。');
  }

  const rawQuestions = raw.user_questions || raw.userQuestions || [];
  const userQuestions = rawQuestions.map(question => ({
    question: stringValue(question.question),
    annotationIds: identifierArray(question.annotation_ids || question.annotationIds)
      .filter(id => knownAnnotationIds.has(id))
  })).filter(question => question.question);

  return { focusTopics, userQuestions, warnings: warningArray(raw.warnings) };
}

function normalizeGeneratedNote(raw: RawGeneratedNote): GeneratedNote {
  const rawMappings = raw.content_mappings || raw.contentMappings || [];
  const contentMappings = rawMappings.map((mapping, index): ContentMapping => ({
    id: stringValue(mapping.id, `M${index + 1}`),
    generatedText: stringValue(mapping.generated_text || mapping.generatedText),
    sourceKind: enumValue(
      mapping.source_kind || mapping.sourceKind,
      ['document', 'user_annotation', 'synthesis'] as const,
      'document'
    ),
    evidenceIds: identifierArray(mapping.evidence_ids || mapping.evidenceIds),
    confidence: enumValue(mapping.confidence, ['high', 'medium', 'low'] as const, 'medium'),
    needsReview: mapping.needs_review === true || mapping.needsReview === true
  }));
  const markdown = stringValue(raw.markdown_note || raw.markdownNote);
  if (!markdown) {
    throw new Error('模型返回结果中没有自然 Markdown 笔记。');
  }
  return {
    title: stringValue(raw.title, 'AI 整理笔记'),
    markdownNote: stripInternalEvidenceIds(markdown),
    contentMappings,
    unansweredQuestions: stringArray(raw.unanswered_questions || raw.unansweredQuestions),
    warnings: warningArray(raw.warnings)
  };
}

function normalizeReviewResult(raw: RawReviewResult): ReviewResult {
  const rawItems = raw.review_results || raw.reviewResults || [];
  return {
    reviewResults: rawItems.map((item): ReviewItem => ({
      mappingId: stringValue(item.mapping_id || item.mappingId),
      status: enumValue(
        item.status,
        ['supported', 'partially_supported', 'unsupported', 'misattributed'] as const,
        'unsupported'
      ),
      reason: stringValue(item.reason),
      validEvidenceIds: identifierArray(item.valid_evidence_ids || item.validEvidenceIds),
      invalidEvidenceIds: identifierArray(item.invalid_evidence_ids || item.invalidEvidenceIds),
      recommendedAction: enumValue(
        item.recommended_action || item.recommendedAction,
        ['keep', 'rewrite', 'move_to_question', 'remove'] as const,
        'remove'
      )
    })),
    overallRisk: enumValue(raw.overall_risk || raw.overallRisk, ['low', 'medium', 'high'] as const, 'high'),
    warnings: warningArray(raw.warnings)
  };
}

function validateOutline(outline: OutlineResult, data: EvidenceDebugData) {
  const evidenceIds = new Set(data.evidenceUnits.map(unit => unit.id));
  if (!outline.outline.length) {
    throw new Error('模型返回的大纲为空。');
  }
  for (const section of outline.outline) {
    if (!section.evidenceIds.length) {
      throw new Error(`模型返回的大纲章节“${section.heading}”没有 Evidence。`);
    }
    const invalid = section.evidenceIds.filter(id => !evidenceIds.has(id));
    if (invalid.length) {
      throw new Error(`模型返回的大纲章节“${section.heading}”包含不存在的 Evidence：${invalid.join(', ')}`);
    }
  }
}

function extractNumbers(text: string): Array<{ raw: string; normalized: string }> {
  const scaleByUnit: Record<string, number> = {
    '万': 10_000,
    '亿': 100_000_000,
    thousand: 1_000,
    million: 1_000_000,
    billion: 1_000_000_000
  };
  const claims = [...text.matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)]
    .map(match => {
      const value = Number(match[0].replace(/,/g, ''));
      const tail = text.slice((match.index || 0) + match[0].length);
      const unit = tail.match(/^\s*(%|％|万|亿|thousand|million|billion)(?![a-z])/i)?.[1];
      if (unit === '%' || unit === '％') {
        return { raw: `${match[0]}${unit}`, normalized: `percent:${value}` };
      }
      const scale = unit ? scaleByUnit[unit.toLowerCase()] : 1;
      return { raw: `${match[0]}${unit || ''}`, normalized: `number:${value * scale}` };
    });
  return claims.filter((claim, index) =>
    claims.findIndex(item => item.normalized === claim.normalized) === index
  );
}

function staticValidation(note: GeneratedNote, data: EvidenceDebugData): { errors: string[]; warnings: string[] } {
  const evidenceMap = new Map(data.evidenceUnits.map(unit => [unit.id, unit]));
  const errors: string[] = [];
  const warnings: string[] = [...note.warnings];
  if (!note.contentMappings.length) {
    errors.push('模型没有返回后台内容映射。');
  }
  if (EVIDENCE_ID_PATTERN.test(note.markdownNote)) {
    errors.push('正式 Markdown 中仍包含内部 Evidence ID。');
  }
  EVIDENCE_ID_PATTERN.lastIndex = 0;

  for (const mapping of note.contentMappings) {
    if (!mapping.generatedText || !mapping.evidenceIds.length) {
      errors.push(`内容映射 ${mapping.id} 缺少文本或 Evidence。`);
      continue;
    }
    const invalid = mapping.evidenceIds.filter(id => !evidenceMap.has(id));
    if (invalid.length) {
      errors.push(`内容映射 ${mapping.id} 引用了不存在的 Evidence：${invalid.join(', ')}`);
      continue;
    }
    const evidenceText = mapping.evidenceIds
      .map(id => {
        const unit = evidenceMap.get(id)!;
        return `${unit.text} ${unit.annotationText} ${unit.userComment}`;
      })
      .join(' ');
    const evidenceNumbers = new Set(extractNumbers(evidenceText).map(number => number.normalized));
    const unsupportedNumbers = extractNumbers(mapping.generatedText)
      .filter(number => !evidenceNumbers.has(number.normalized))
      .map(number => number.raw);
    if (unsupportedNumbers.length) {
      errors.push(`内容映射 ${mapping.id} 含证据中不存在的数字：${unsupportedNumbers.join(', ')}`);
    }
    if (mapping.needsReview) {
      warnings.push(`内容映射 ${mapping.id} 被模型标记为需要复核。`);
    }
  }
  return { errors, warnings };
}

function combineValidation(
  note: GeneratedNote,
  data: EvidenceDebugData,
  review: ReviewResult
): ValidationResult {
  const staticResult = staticValidation(note, data);
  const knownMappings = new Set(note.contentMappings.map(mapping => mapping.id));
  const reviewedMappings = new Set(review.reviewResults.map(item => item.mappingId));
  for (const id of knownMappings) {
    if (!reviewedMappings.has(id)) {
      staticResult.errors.push(`内容映射 ${id} 未经过模型审查。`);
    }
  }
  for (const item of review.reviewResults) {
    if (!knownMappings.has(item.mappingId)) {
      staticResult.errors.push(`审查结果包含不存在的映射 ${item.mappingId}。`);
    } else if (item.status !== 'supported') {
      staticResult.errors.push(`内容映射 ${item.mappingId} 未通过审查：${item.reason || item.status}`);
    }
  }
  if (review.overallRisk === 'high') {
    staticResult.errors.push('后台审查判定整体风险较高。');
  }
  return {
    valid: staticResult.errors.length === 0,
    errors: staticResult.errors,
    warnings: [...staticResult.warnings, ...review.warnings],
    review
  };
}

function localReview(note: GeneratedNote): ReviewResult {
  return {
    reviewResults: note.contentMappings.map(mapping => ({
      mappingId: mapping.id,
      status: 'supported',
      reason: '已通过本地结构、Evidence ID 与数字一致性检查',
      validEvidenceIds: mapping.evidenceIds,
      invalidEvidenceIds: [],
      recommendedAction: 'keep'
    })),
    overallRisk: 'low',
    warnings: ['未检测到需额外模型审查的风险信号，已跳过额外调用。']
  };
}

function requiresModelReview(note: GeneratedNote, data: EvidenceDebugData): boolean {
  const local = staticValidation(note, data);
  return local.errors.length > 0 || note.contentMappings.some(mapping =>
    mapping.needsReview || mapping.confidence !== 'high'
  );
}

export function stripInternalEvidenceIds(markdown: string): string {
  return markdown
    .replace(/\s*\[(?:E-[A-Z0-9-]+)(?:\s*,\s*E-[A-Z0-9-]+)*\]/gi, '')
    .replace(/\s+([。！？.!?,，])/g, '$1')
    .trim();
}

export async function identifyFocusTopics(
  config: ProviderConfig,
  data: EvidenceDebugData,
  client = new GeminiClient(),
  signal?: RequestCancellationSignal
): Promise<FocusResult> {
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    {
      role: 'system',
      content:
        '你是 Zotero 阅读痕迹分析助手。只根据真实批注识别用户关注重点，不得根据论文标题猜测兴趣。' +
        '用户评论权重最高，标签次之，高亮语义和同主题数量为基础信号。只输出 JSON。'
    },
    {
      role: 'user',
      content: JSON.stringify({
        task: '识别关注重点',
        rules: [
          '不得添加不存在的 annotation_id',
          'annotation_ids 必须逐字复制 annotations[].id；即使 id 看起来像数字，也必须作为字符串返回',
          '每个 focus_topic 至少包含一个 annotation_id',
          '单条且无评论无标签的高亮不得判为最高优先级',
          '合并语义相近批注',
          '输出 focus_topics、user_questions、warnings'
        ],
        annotations: uniqueAnnotations(data),
        output_schema: {
          focus_topics: [{
            id: 'F1',
            title: '',
            description: '',
            reason: '',
            annotation_ids: ['必须来自 annotations[].id'],
            confidence: 'high',
            priority: 1
          }],
          user_questions: [{ question: '', annotation_ids: [] }],
          warnings: []
        }
      })
    }
  ];
  const raw = await client.generateJson<RawFocusResult>(config, messages, 0.1, signal);
  try {
    return normalizeFocusResult(raw, data);
  } catch (error) {
    if (signal?.aborted || isRequestCancelled(error)) {
      throw new RequestCancelledError();
    }
    const reason = error instanceof Error ? error.message : String(error);
    const corrected = await client.generateJson<RawFocusResult>(config, [
      {
        role: 'system',
        content: '修正上一次关注重点 JSON。annotation_ids 只能从允许列表逐字复制。只输出 JSON。'
      },
      {
        role: 'user',
        content: JSON.stringify({
          task: '修正关注重点识别结果',
          previous_error: reason,
          previous_result: raw,
          allowed_annotation_ids: uniqueAnnotations(data).map(item => item.id),
          annotations: uniqueAnnotations(data),
          required_schema: {
            focus_topics: [{
              id: 'F1', title: '', description: '', reason: '',
              annotation_ids: ['必须来自 allowed_annotation_ids'], confidence: 'medium', priority: 1
            }],
            user_questions: [], warnings: []
          }
        })
      }
    ], 0.1, signal);
    return normalizeFocusResult(corrected, data);
  }
}

function buildOutline(
  data: EvidenceDebugData,
  focusTopics: FocusTopic[],
  extraRequirement: string
): Promise<OutlineResult> {
  const allEvidenceIds = data.evidenceUnits.map(unit => unit.id);
  const sections: OutlineSection[] = focusTopics.map((topic, index) => {
    const evidence = data.evidenceUnits.filter(unit => topic.annotationIds.includes(unit.annotationId));
    return {
      id: `S${index + 1}`,
      heading: topic.title,
      purpose: topic.description || topic.reason || '整理用户关注的内容',
      sourcePlan: evidence.some(unit => unit.userComment || unit.tags.length)
        ? ['document', 'user_annotation']
        : ['document'],
      evidenceIds: evidence.map(unit => unit.id),
      annotationIds: topic.annotationIds,
      questionsToAnswer: []
    };
  });
  if (!sections.length && extraRequirement.trim()) {
    sections.push({
      id: 'S1',
      heading: '本次补充要求',
      purpose: extraRequirement.trim(),
      sourcePlan: ['document'],
      evidenceIds: allEvidenceIds,
      annotationIds: [],
      questionsToAnswer: [extraRequirement.trim()]
    });
  }
  const result: OutlineResult = {
    articleCore: { problem: '', method: '', conclusion: '', evidenceIds: allEvidenceIds },
    userFocusRelation: focusTopics.map(topic => topic.title).join('、'),
    outline: sections,
    missingInformation: [],
    conflicts: [],
    warnings: []
  };
  validateOutline(result, data);
  return Promise.resolve(result);
}

async function generateNaturalNote(
  config: ProviderConfig,
  data: EvidenceDebugData,
  focusTopics: FocusTopic[],
  outline: OutlineResult,
  extraRequirement: string,
  client: GeminiClient,
  signal?: RequestCancellationSignal
): Promise<GeneratedNote> {
  const raw = await client.generateJson<RawGeneratedNote>(config, [
    {
      role: 'system',
      content:
        '你是可靠的中文文献笔记助手。先在内部规划，再严格依据大纲、Evidence 和用户批注生成自然 Markdown。' +
        '正式 markdown_note 中不得显示 Evidence ID、Mapping ID、来源类型或“AI 推断”等技术标签。' +
        '不得编造数字、作者结论、适用场景或用户观点。用户问题不能改写为确定结论。' +
        '输出前在内部逐条核对所有陈述；找不到直接 Evidence 的内容必须删除，不要留给后续审查修复。' +
        'Markdown 必须使用 ## 分节，段落之间留空行，每段 2–4 句。只输出 JSON。'
    },
    {
      role: 'user',
      content: JSON.stringify({
        task: '生成结构清晰的自然笔记和后台内容映射',
        document_title: data.document.title,
        confirmed_focus_topics: focusTopics,
        focus_priority_semantics: {
          1: '用户标记的重点主题：优先呈现，并在证据允许范围内更详细展开',
          2: '用户选择的普通主题：正常覆盖'
        },
        approved_outline: outline,
        extra_requirement: extraRequirement,
        evidence_units: data.evidenceUnits.map(evidenceForPrompt),
        rules: [
          'markdown_note 可直接阅读，不显示任何 E-... 内部编号',
          'markdown_note 至少包含两个 ## 二级标题，标题和段落前后使用真实换行',
          '不要把整篇笔记写成一个超长段落',
          'content_mappings 仅供后台校验',
          'generated_text 必须是 markdown_note 中对应内容的原文片段',
          '每个实质性内容映射至少一个真实 Evidence ID',
          '仅保留可标记为 confidence=high 且 needs_review=false 的陈述；无法确认的内容改写为未解答问题或删除'
        ],
        output_schema: {
          title: '', markdown_note: '',
          content_mappings: [{
            id: 'M1', generated_text: '', source_kind: 'document', evidence_ids: [],
            confidence: 'high', needs_review: false
          }],
          unanswered_questions: [], warnings: []
        }
      })
    }
  ], 0.2, signal);
  return normalizeGeneratedNote(raw);
}

async function reviewAndCorrectNote(
  config: ProviderConfig,
  data: EvidenceDebugData,
  note: GeneratedNote,
  client: GeminiClient,
  previousErrors: string[] = [],
  signal?: RequestCancellationSignal
): Promise<{ note: GeneratedNote; review: ReviewResult }> {
  const raw = await client.generateJson<RawReviewedNote>(config, [
    {
      role: 'system',
      content:
        '你是独立的文献事实审查员。检查初稿的每条内容映射，并在同一次任务中直接修正无依据内容。' +
        '重点检查数字、归因、用户观点和被误写为结论的问题。最终笔记必须使用 ## 分节和空行分段。' +
        '只对修正后的 final_note 逐条审查，只输出 JSON。'
    },
    {
      role: 'user',
      content: JSON.stringify({
        task: '审查并直接校正初稿',
        draft_note: note,
        previous_validation_errors: previousErrors,
        evidence_units: data.evidenceUnits.map(evidenceForPrompt),
        output_schema: {
          final_note: {
            title: '', markdown_note: '',
            content_mappings: [{
              id: 'M1', generated_text: '', source_kind: 'document', evidence_ids: [],
              confidence: 'high', needs_review: false
            }],
            unanswered_questions: [], warnings: []
          },
          final_review: {
            review_results: [{
              mapping_id: 'M1', status: 'supported', reason: '', valid_evidence_ids: [],
              invalid_evidence_ids: [], recommended_action: 'keep'
            }],
            overall_risk: 'low', warnings: []
          }
        }
      })
    }
  ], 0.1, signal);
  const finalNote = raw.final_note || raw.finalNote;
  const finalReview = raw.final_review || raw.finalReview;
  if (!finalNote || !finalReview) {
    throw new Error('审查结果缺少修正后的笔记或最终审查。');
  }
  return { note: normalizeGeneratedNote(finalNote), review: normalizeReviewResult(finalReview) };
}

async function reviewNote(
  config: ProviderConfig,
  data: EvidenceDebugData,
  note: GeneratedNote,
  client: GeminiClient,
  signal?: RequestCancellationSignal
): Promise<ReviewResult> {
  const raw = await client.generateJson<RawReviewResult>(config, [
    {
      role: 'system',
      content:
        '你是严格的事实审查员。只审查用户编辑后的内容映射，不修改 Markdown。' +
        '检查数字、用户观点、问题是否被误写为结论以及外部常识混入。只输出 JSON。'
    },
    {
      role: 'user',
      content: JSON.stringify({
        task: '审查内容映射',
        content_mappings: note.contentMappings,
        evidence_units: data.evidenceUnits.map(evidenceForPrompt),
        output_schema: {
          review_results: [{
            mapping_id: 'M1', status: 'supported', reason: '', valid_evidence_ids: [],
            invalid_evidence_ids: [], recommended_action: 'keep'
          }],
          overall_risk: 'low', warnings: []
        }
      })
    }
  ], 0.1, signal);
  return normalizeReviewResult(raw);
}

export async function generateValidatedNote(
  config: ProviderConfig,
  data: EvidenceDebugData,
  allFocusTopics: FocusTopic[],
  selectedFocus: SelectedFocus[],
  extraRequirement: string,
  onProgress?: (stage: NotePipelineStage, report: NotePipelineReport) => void,
  client = new GeminiClient(),
  options: NotePipelineOptions = {}
): Promise<NotePipelineResult> {
  const selectedMap = new Map(selectedFocus.map(item => [item.id, item.priority]));
  const focusTopics = allFocusTopics
    .filter(topic => selectedMap.has(topic.id))
    .map(topic => ({ ...topic, priority: selectedMap.get(topic.id)! }))
    .sort((first, second) => first.priority - second.priority);
  if (!focusTopics.length && !extraRequirement.trim()) {
    throw new Error('请至少选择一个关注重点，或填写本次特别关注的问题。');
  }

  const checkpoint = options.checkpoint || createNotePipelineCheckpoint(focusTopics);
  checkpoint.focusTopics = focusTopics;
  const reportProgress = (stage: NotePipelineStage) => {
    onProgress?.(stage, notePipelineReport(checkpoint));
  };
  const runStage = async <T>(id: NotePipelineStageId, task: () => Promise<T>): Promise<T> => {
    const stage = checkpoint.stages.find(item => item.id === id)!;
    stage.status = 'running';
    stage.failureReason = undefined;
    stage.callCount += 1;
    checkpoint.callCount += 1;
    reportProgress(stage.label);
    const startedAt = Date.now();
    try {
      const result = await task();
      const elapsed = Date.now() - startedAt;
      stage.durationMs += elapsed;
      checkpoint.durationMs += elapsed;
      stage.status = 'completed';
      reportProgress(stage.label);
      return result;
    } catch (error) {
      const elapsed = Date.now() - startedAt;
      stage.durationMs += elapsed;
      checkpoint.durationMs += elapsed;
      const cancelled = options.signal?.aborted || isRequestCancelled(error);
      stage.status = cancelled ? 'cancelled' : 'failed';
      stage.failureReason = cancelled
        ? '用户已取消生成。'
        : error instanceof Error ? error.message : String(error);
      reportProgress(stage.label);
      if (cancelled) throw new RequestCancelledError();
      throw error;
    }
  };
  const runLocalStage = async <T>(id: NotePipelineStageId, task: () => Promise<T>): Promise<T> => {
    const stage = checkpoint.stages.find(item => item.id === id)!;
    stage.status = 'running';
    stage.failureReason = undefined;
    reportProgress(stage.label);
    const startedAt = Date.now();
    try {
      const result = await task();
      const elapsed = Date.now() - startedAt;
      stage.durationMs += elapsed;
      stage.status = 'completed';
      reportProgress(stage.label);
      return result;
    } catch (error) {
      const elapsed = Date.now() - startedAt;
      stage.durationMs += elapsed;
      stage.status = 'failed';
      stage.failureReason = error instanceof Error ? error.message : String(error);
      reportProgress(stage.label);
      throw error;
    }
  };

  while (true) {
    switch (checkpoint.nextStage) {
      case 'outline':
        checkpoint.outline = await runLocalStage('outline', () => buildOutline(
          data, focusTopics, extraRequirement
        ));
        checkpoint.nextStage = 'note';
        break;
      case 'note':
        checkpoint.note = await runStage('note', () => generateNaturalNote(
          config,
          data,
          focusTopics,
          checkpoint.outline!,
          extraRequirement,
          client,
          options.signal
        ));
        if (!requiresModelReview(checkpoint.note, data)) {
          checkpoint.review = localReview(checkpoint.note);
          checkpoint.validation = combineValidation(checkpoint.note, data, checkpoint.review);
          for (const stage of checkpoint.stages.filter(item =>
            item.id === 'review' || item.id === 'revision' || item.id === 'rereview'
          )) {
            stage.status = 'skipped';
          }
          reportProgress(STAGE_LABELS.review);
          return {
            focusTopics,
            outline: checkpoint.outline!,
            note: checkpoint.note,
            validation: checkpoint.validation
          };
        }
        checkpoint.nextStage = 'review';
        break;
      case 'review': {
        const reviewed = await runStage('review', () => reviewAndCorrectNote(
          config, data, checkpoint.note!, client, [], options.signal
        ));
        checkpoint.note = reviewed.note;
        checkpoint.review = reviewed.review;
        checkpoint.validation = combineValidation(checkpoint.note!, data, checkpoint.review);
        if (checkpoint.validation.valid) {
          for (const stage of checkpoint.stages.filter(item =>
            item.id === 'revision' || item.id === 'rereview'
          )) {
            stage.status = 'skipped';
          }
          return {
            focusTopics,
            outline: checkpoint.outline!,
            note: checkpoint.note!,
            validation: checkpoint.validation
          };
        }
        checkpoint.nextStage = 'revision';
        break;
      }
      case 'revision': {
        const reviewed = await runStage('revision', () => reviewAndCorrectNote(
          config, data, checkpoint.note!, client, checkpoint.validation!.errors, options.signal
        ));
        checkpoint.note = reviewed.note;
        checkpoint.review = reviewed.review;
        checkpoint.validation = combineValidation(checkpoint.note!, data, checkpoint.review);
        checkpoint.stages.find(stage => stage.id === 'rereview')!.status = 'skipped';
        return {
          focusTopics,
          outline: checkpoint.outline!,
          note: checkpoint.note!,
          validation: checkpoint.validation
        };
      }
      case 'rereview':
        checkpoint.stages.find(stage => stage.id === 'rereview')!.status = 'skipped';
        checkpoint.validation = combineValidation(checkpoint.note!, data, checkpoint.review!);
        return {
          focusTopics,
          outline: checkpoint.outline!,
          note: checkpoint.note!,
          validation: checkpoint.validation
        };
    }
  }
}

export async function auditEditedMarkdown(
  config: ProviderConfig,
  data: EvidenceDebugData,
  markdown: string,
  client = new GeminiClient()
): Promise<{ note: GeneratedNote; validation: ValidationResult }> {
  const raw = await client.generateJson<RawGeneratedNote>(config, [
    {
      role: 'system',
      content:
        '你是内容映射助手。不得修改用户的 Markdown，只为其中每段实质性内容建立 Evidence 映射。' +
        '找不到依据的内容必须 needs_review=true。只输出 JSON。'
    },
    {
      role: 'user',
      content: JSON.stringify({
        task: '为编辑后的 Markdown 重建后台映射',
        markdown_note: stripInternalEvidenceIds(markdown),
        evidence_units: data.evidenceUnits.map(evidenceForPrompt),
        output_schema: {
          title: '', markdown_note: stripInternalEvidenceIds(markdown),
          content_mappings: [{
            id: 'M1', generated_text: '', source_kind: 'document', evidence_ids: [],
            confidence: 'high', needs_review: false
          }],
          unanswered_questions: [], warnings: []
        }
      })
    }
  ]);
  const note = normalizeGeneratedNote(raw);
  note.markdownNote = stripInternalEvidenceIds(markdown);
  const review = await reviewNote(config, data, note, client);
  return { note, validation: combineValidation(note, data, review) };
}
