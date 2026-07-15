import type { ProviderConfig } from '../config/settings';

declare const Zotero: any;

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

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

function parseResponse(xhr: XMLHttpRequest): unknown {
  if (xhr.response && typeof xhr.response === 'object') {
    return xhr.response;
  }
  const text = xhr.responseText || '';
  return text ? JSON.parse(text) : {};
}

function safeErrorMessage(error: unknown, apiKey: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  const sanitized = apiKey ? raw.split(apiKey).join('[已隐藏]') : raw;
  return sanitized.length > 300 ? `${sanitized.slice(0, 300)}…` : sanitized;
}

export class GeminiClient {
  constructor(private request: HttpRequest = Zotero.HTTP.request.bind(Zotero.HTTP)) {}

  async testConnection(config: ProviderConfig): Promise<void> {
    const url = `${config.baseURL}chat/completions`;
    await this.send('POST', url, config, {
      model: config.model,
      messages: [{ role: 'user', content: 'Reply with OK.' }],
      temperature: 0,
      max_tokens: 2
    });
  }

  async generateMarkdown(
    config: ProviderConfig,
    messages: ChatMessage[]
  ): Promise<string> {
    const url = `${config.baseURL}chat/completions`;
    const xhr = await this.send('POST', url, config, {
      model: config.model,
      messages,
      temperature: 0.2
    });
    const response = parseResponse(xhr) as ChatCompletionResponse;
    const markdown = response.choices?.[0]?.message?.content?.trim();
    if (!markdown) {
      throw new Error('模型返回结果中没有可用的 Markdown 内容。');
    }
    return markdown;
  }

  async generateJson<T>(
    config: ProviderConfig,
    messages: ChatMessage[],
    temperature = 0.1
  ): Promise<T> {
    const url = `${config.baseURL}chat/completions`;
    const xhr = await this.send('POST', url, config, {
      model: config.model,
      messages,
      temperature
    });
    const response = parseResponse(xhr) as ChatCompletionResponse;
    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('模型返回结果中没有可用的 JSON 内容。');
    }
    return parseJsonContent<T>(content);
  }

  private async send(
    method: string,
    url: string,
    config: ProviderConfig,
    body?: unknown
  ): Promise<XMLHttpRequest> {
    try {
      return await this.request(method, url, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined,
        responseType: 'json',
        timeout: 60000,
        errorDelayMax: 0,
        debug: false,
        logBodyLength: 0
      });
    } catch (error) {
      throw new Error(`${config.providerLabel} 请求失败：${safeErrorMessage(error, config.apiKey)}`);
    }
  }
}
