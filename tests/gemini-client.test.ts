import { describe, expect, it, vi } from 'vitest';
import { GeminiClient } from '../src/llm/gemini-client';
import type { ProviderConfig } from '../src/config/settings';

const config: ProviderConfig = {
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  model: 'gemini-3.1-flash-lite',
  apiKey: 'test-secret-key'
};

describe('GeminiClient', () => {
  it('tests the configured model without sending document content', async () => {
    const request = vi.fn(async () => ({ response: { id: config.model } } as XMLHttpRequest));
    const client = new GeminiClient(request);

    await client.testConnection(config);

    expect(request).toHaveBeenCalledWith(
      'GET',
      'https://generativelanguage.googleapis.com/v1beta/openai/models/gemini-3.1-flash-lite',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-secret-key' }),
        body: undefined,
        debug: false,
        logBodyLength: 0
      })
    );
  });

  it('returns Markdown from an OpenAI-compatible chat completion', async () => {
    const request = vi.fn(async () => ({
      response: { choices: [{ message: { content: '  # 笔记\n\n内容 [E-1]  ' } }] }
    } as XMLHttpRequest));
    const client = new GeminiClient(request);

    const markdown = await client.generateMarkdown(config, [
      { role: 'user', content: 'Evidence' }
    ]);

    expect(markdown).toBe('# 笔记\n\n内容 [E-1]');
    expect(request).toHaveBeenCalledWith(
      'POST',
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      expect.objectContaining({ body: expect.stringContaining('Evidence') })
    );
  });

  it('does not leak the API key in request errors', async () => {
    const request = vi.fn(async () => {
      throw new Error(`Authorization failed for ${config.apiKey}`);
    });
    const client = new GeminiClient(request);

    await expect(client.testConnection(config)).rejects.toThrow('[已隐藏]');
    await expect(client.testConnection(config)).rejects.not.toThrow(config.apiKey);
  });

  it('parses JSON returned in a Markdown code fence', async () => {
    const request = vi.fn(async () => ({
      response: {
        choices: [{ message: { content: '```json\n{"focus_topics":[]}\n```' } }]
      }
    } as XMLHttpRequest));
    const client = new GeminiClient(request);

    const result = await client.generateJson<{ focus_topics: unknown[] }>(config, [
      { role: 'user', content: 'JSON only' }
    ]);

    expect(result).toEqual({ focus_topics: [] });
  });
});
