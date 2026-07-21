import type { ProviderConfig } from '../config/settings';

declare const Zotero: any;

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    text?: string;
    delta?: { content?: unknown };
    message?: {
      content?: unknown;
      reasoning_content?: string;
      reasoning?: string;
      analysis?: string;
      output_text?: string;
    };
  }>;
  output_text?: string;
  output?: unknown;
}

const CONNECTION_TIMEOUT_MS = 30000;
const GENERATION_TIMEOUT_MS = 180000;

function parseJsonContent<T>(content: string): T {
  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');
  if (start === -1 || end < start) {
    throw new Error('模型返回结果中没有可解析的 JSON 对象。');
  }
  try {
    return JSON.parse(withoutFence.slice(start, end + 1)) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`模型返回的 JSON 格式无效：${message}`);
  }
}

export type HttpRequest = (
  method: string,
  url: string,
  options: Record<string, unknown>
) => Promise<XMLHttpRequest>;

export interface RequestCancellationSignal {
  readonly aborted: boolean;
  subscribe(listener: () => void): () => void;
}

class RequestCancellationSignalImpl implements RequestCancellationSignal {
  aborted = false;
  private listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    if (this.aborted) {
      listener();
      return () => undefined;
    }
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  abort() {
    if (this.aborted) return;
    this.aborted = true;
    for (const listener of [...this.listeners]) listener();
    this.listeners.clear();
  }
}

export class RequestCancellationController {
  readonly signal = new RequestCancellationSignalImpl();

  abort() {
    this.signal.abort();
  }
}

export class RequestCancelledError extends Error {
  constructor() {
    super('生成已取消。');
    this.name = 'RequestCancelledError';
  }
}

export function isRequestCancelled(error: unknown): boolean {
  return error instanceof RequestCancelledError ||
    (error instanceof Error && error.name === 'RequestCancelledError');
}

function parseResponse(xhr: XMLHttpRequest): unknown {
  if (xhr.response && typeof xhr.response === 'object') {
    return xhr.response;
  }
  const text = xhr.responseText || '';
  return text ? JSON.parse(text) : {};
}

function textFromParts(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const item = value as Record<string, unknown>;
    for (const key of ['text', 'output_text', 'content', 'value', 'summary']) {
      const field = item[key];
      if (typeof field === 'string' && field.trim()) return field.trim();
      if (field && typeof field === 'object') {
        const nestedText = textFromParts(field);
        if (nestedText) return nestedText;
      }
    }
    if (item.text && typeof item.text === 'object') {
      const nestedText = textFromParts(item.text);
      if (nestedText) return nestedText;
    }
    return '';
  }
  if (!Array.isArray(value)) {
    return '';
  }
  return value.map(part => {
    if (typeof part === 'string') return part;
    return textFromParts(part);
  }).join('').trim();
}

function responseContent(response: ChatCompletionResponse): string {
  const choice = response.choices?.[0];
  const messageContent = textFromParts(choice?.message?.content);
  if (messageContent) return messageContent;
  if (typeof choice?.text === 'string' && choice.text.trim()) return choice.text.trim();
  const deltaContent = textFromParts(choice?.delta?.content);
  if (deltaContent) return deltaContent;
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }
  const outputContent = textFromParts(response.output);
  if (outputContent) return outputContent;
  for (const fallback of [
    choice?.message?.output_text,
    choice?.message?.reasoning_content,
    choice?.message?.reasoning,
    choice?.message?.analysis
  ]) {
    if (typeof fallback === 'string' && fallback.trim()) return fallback.trim();
  }
  return '';
}

function responseShape(response: unknown): string {
  if (!response || typeof response !== 'object') return typeof response;
  const keys = Object.keys(response as Record<string, unknown>).slice(0, 8);
  const result = response as ChatCompletionResponse;
  const choice = result.choices?.[0] as Record<string, unknown> | undefined;
  const message = choice?.message as Record<string, unknown> | undefined;
  const outputItems = Array.isArray(result.output) ? result.output.slice(0, 3) : [];
  const outputShapes = outputItems.map((item, index) => {
    if (!item || typeof item !== 'object') return `output[${index}]: ${typeof item}`;
    const record = item as Record<string, unknown>;
    const type = typeof record.type === 'string' ? ` (${record.type})` : '';
    const content = Array.isArray(record.content) && record.content[0] &&
      typeof record.content[0] === 'object'
      ? `；content: ${Object.keys(record.content[0] as Record<string, unknown>).slice(0, 8).join(', ')}`
      : '';
    return `output[${index}]: ${Object.keys(record).slice(0, 8).join(', ')}${type}${content}`;
  });
  const details = [
    keys.length ? keys.join(', ') : '空对象',
    choice
      ? `choice: ${Object.keys(choice).slice(0, 8).join(', ') || '空对象'}` +
        (choice.finish_reason ? ` (${String(choice.finish_reason)})` : '')
      : '',
    message ? `message: ${Object.keys(message).slice(0, 10).join(', ') || '空对象'}` : '',
    ...outputShapes
  ].filter(Boolean);
  return details.join('；');
}

function safeErrorMessage(error: unknown, apiKey: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  const sanitized = apiKey ? raw.split(apiKey).join('[已隐藏]') : raw;
  return sanitized.length > 300 ? `${sanitized.slice(0, 300)}…` : sanitized;
}

export class GeminiClient {
  constructor(private request: HttpRequest = Zotero.HTTP.request.bind(Zotero.HTTP)) {}

  async testConnection(config: ProviderConfig): Promise<void> {
    await this.requestContent(
      config,
      [{ role: 'user', content: 'Reply with OK.' }],
      0,
      CONNECTION_TIMEOUT_MS,
      16
    );
  }

  async generateMarkdown(
    config: ProviderConfig,
    messages: ChatMessage[],
    signal?: RequestCancellationSignal
  ): Promise<string> {
    return this.requestContent(config, messages, 0.2, GENERATION_TIMEOUT_MS, undefined, signal);
  }

  async generateJson<T>(
    config: ProviderConfig,
    messages: ChatMessage[],
    temperature = 0.1,
    signal?: RequestCancellationSignal
  ): Promise<T> {
    const content = await this.requestContent(
      config,
      messages,
      temperature,
      GENERATION_TIMEOUT_MS,
      undefined,
      signal
    );
    return parseJsonContent<T>(content);
  }

  private async requestContent(
    config: ProviderConfig,
    messages: ChatMessage[],
    temperature: number,
    timeout = GENERATION_TIMEOUT_MS,
    maxTokens?: number,
    signal?: RequestCancellationSignal
  ): Promise<string> {
    const chatXhr = await this.send('POST', `${config.baseURL}chat/completions`, config, {
      model: config.model,
      messages,
      temperature,
      ...(maxTokens ? { max_tokens: maxTokens } : {})
    }, timeout, signal);
    const chatResponse = parseResponse(chatXhr) as ChatCompletionResponse;
    const chatContent = responseContent(chatResponse);
    if (chatContent) return chatContent;

    const chatShape = responseShape(chatResponse);
    try {
      const responsesXhr = await this.send('POST', `${config.baseURL}responses`, config, {
        model: config.model,
        input: messages,
        ...(maxTokens ? { max_output_tokens: maxTokens } : {})
      }, timeout, signal);
      const responsesResponse = parseResponse(responsesXhr) as ChatCompletionResponse;
      const responsesContent = responseContent(responsesResponse);
      if (responsesContent) return responsesContent;
      throw new Error(`Responses API 也没有返回正文（响应字段：${responseShape(responsesResponse)}）`);
    } catch (error) {
      throw new Error(
        `Chat Completions 返回空正文（响应字段：${chatShape}）；` +
        `Responses API 回退失败：${safeErrorMessage(error, config.apiKey)}`
      );
    }
  }

  private async send(
    method: string,
    url: string,
    config: ProviderConfig,
    body?: unknown,
    timeout = GENERATION_TIMEOUT_MS,
    signal?: RequestCancellationSignal
  ): Promise<XMLHttpRequest> {
    if (signal?.aborted) {
      throw new RequestCancelledError();
    }
    let cancelRequest: (() => void) | undefined;
    const cancel = () => cancelRequest?.();
    const unsubscribe = signal?.subscribe(cancel);
    try {
      return await this.request(method, url, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined,
        responseType: 'json',
        timeout,
        cancellerReceiver: (canceller: () => void) => {
          cancelRequest = canceller;
          if (signal?.aborted) canceller();
        },
        errorDelayMax: 0,
        debug: false,
        logBodyLength: 0
      });
    } catch (error) {
      if (signal?.aborted || isRequestCancelled(error)) {
        throw new RequestCancelledError();
      }
      throw new Error(`${config.providerLabel} 请求失败：${safeErrorMessage(error, config.apiKey)}`);
    } finally {
      unsubscribe?.();
    }
  }
}
