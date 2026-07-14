import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  normalizeBaseURL
} from '../src/config/settings';

describe('Gemini defaults', () => {
  it('uses the official OpenAI-compatible Gemini endpoint and stable model ID', () => {
    expect(DEFAULT_BASE_URL).toBe('https://generativelanguage.googleapis.com/v1beta/openai/');
    expect(DEFAULT_MODEL).toBe('gemini-3.1-flash-lite');
  });

  it('normalizes a custom compatible endpoint', () => {
    expect(normalizeBaseURL('https://example.com/v1///')).toBe('https://example.com/v1/');
  });

  it('rejects non-HTTP endpoint schemes', () => {
    expect(() => normalizeBaseURL('file:///tmp/key')).toThrow('http 或 https');
  });
});
