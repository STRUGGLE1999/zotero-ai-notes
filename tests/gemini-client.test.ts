import { describe, expect, it, vi } from 'vitest';
import { GeminiClient } from '../src/llm/gemini-client';
import type { ProviderConfig } from '../src/config/settings';

const config: ProviderConfig = {
  provider: 'gemini',
  providerLabel: 'Google Gemini',
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  model: 'gemini-3.1-flash-lite',
  apiKey: 'test-secret-key'
};

describe('GeminiClient', () => {
  it('tests the configured model with a minimal compatible chat request', async () => {
    const request = vi.fn(async () => ({
      response: { choices: [{ message: { content: 'OK' } }] }
    } as XMLHttpRequest));
    const client = new GeminiClient(request);

    await client.testConnection(config);

    expect(request).toHaveBeenCalledWith(
      'POST',
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-secret-key' }),
        body: expect.stringContaining('Reply with OK.'),
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

  it('accepts content arrays returned by OpenAI-compatible providers', async () => {
    const request = vi.fn(async () => ({
      response: {
        choices: [{ message: { content: [{ type: 'text', text: '{"focus_topics":[]}' }] } }]
      }
    } as XMLHttpRequest));
    const client = new GeminiClient(request);

    const result = await client.generateJson<{ focus_topics: unknown[] }>(config, [
      { role: 'user', content: 'JSON only' }
    ]);

    expect(result).toEqual({ focus_topics: [] });
  });

  it('accepts a single content object returned by a compatible gateway', async () => {
    const request = vi.fn(async () => ({
      response: {
        choices: [{ message: { content: { type: 'text', text: '{"focus_topics":[]}' } } }]
      }
    } as XMLHttpRequest));
    const client = new GeminiClient(request);

    await expect(client.generateJson(config, [{ role: 'user', content: 'JSON only' }]))
      .resolves.toEqual({ focus_topics: [] });
  });

  it('accepts Responses API output content from compatible gateways', async () => {
    const request = vi.fn(async () => ({
      response: { output: [{ content: [{ type: 'output_text', text: '# 笔记' }] }] }
    } as XMLHttpRequest));
    const client = new GeminiClient(request);

    await expect(client.generateMarkdown(config, [{ role: 'user', content: 'note' }]))
      .resolves.toBe('# 笔记');
  });

  it('accepts output_text nested directly in a Responses API output item', async () => {
    const request = vi.fn(async () => ({
      response: { output: [{ type: 'message', output_text: '# 兼容笔记' }] }
    } as XMLHttpRequest));
    const client = new GeminiClient(request);

    await expect(client.generateMarkdown(config, [{ role: 'user', content: 'note' }]))
      .resolves.toBe('# 兼容笔记');
  });

  it('uses a longer timeout for generation than for connection checks', async () => {
    const request = vi.fn(async () => ({
      response: { choices: [{ message: { content: 'OK' } }] }
    } as XMLHttpRequest));
    const client = new GeminiClient(request);

    await client.testConnection(config);
    await client.generateMarkdown(config, [{ role: 'user', content: 'note' }]);

    expect(request.mock.calls[0][2]).toEqual(expect.objectContaining({ timeout: 30000 }));
    expect(request.mock.calls[1][2]).toEqual(expect.objectContaining({ timeout: 180000 }));
  });

  it('falls back to the Responses API when chat completions returns an empty message', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({
        response: { choices: [{ message: { role: 'assistant' }, finish_reason: 'stop' }] }
      } as XMLHttpRequest)
      .mockResolvedValueOnce({
        response: { output: [{ content: [{ type: 'output_text', text: '{"focus_topics":[]}' }] }] }
      } as XMLHttpRequest);
    const client = new GeminiClient(request);

    await expect(client.generateJson(config, [{ role: 'user', content: 'JSON only' }]))
      .resolves.toEqual({ focus_topics: [] });

    expect(request.mock.calls[0][1]).toContain('/chat/completions');
    expect(request.mock.calls[1][1]).toContain('/responses');
    expect(request.mock.calls[1][2]).toEqual(expect.objectContaining({
      body: expect.stringContaining('"input"')
    }));
  });
});
