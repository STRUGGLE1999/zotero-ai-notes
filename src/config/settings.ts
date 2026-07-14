import { CredentialStore } from './credential-store';

declare const Zotero: any;

export const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
export const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

const BASE_URL_PREF = 'aiNotes.baseURL';
const MODEL_PREF = 'aiNotes.model';

export interface PublicSettings {
  baseURL: string;
  model: string;
  hasApiKey: boolean;
}

export interface ProviderConfig {
  baseURL: string;
  model: string;
  apiKey: string;
}

export interface SettingsUpdate {
  baseURL: string;
  model: string;
  apiKey?: string;
}

function getStringPreference(name: string, fallback: string): string {
  const value = Zotero.Prefs.get(name);
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function normalizeBaseURL(value: string): string {
  const trimmed = value.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('Base URL 格式无效。');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Base URL 必须使用 http 或 https。');
  }
  return `${trimmed.replace(/\/+$/, '')}/`;
}

export class SettingsService {
  private credentials = new CredentialStore();

  async getPublicSettings(): Promise<PublicSettings> {
    return {
      baseURL: getStringPreference(BASE_URL_PREF, DEFAULT_BASE_URL),
      model: getStringPreference(MODEL_PREF, DEFAULT_MODEL),
      hasApiKey: Boolean(await this.credentials.getApiKey())
    };
  }

  async getProviderConfig(): Promise<ProviderConfig> {
    const settings = await this.getPublicSettings();
    const apiKey = await this.credentials.getApiKey();
    if (!apiKey) {
      throw new Error('尚未配置 Gemini API Key，请先打开 Zotero 设置 → Zotero AI Notes。');
    }
    return {
      baseURL: normalizeBaseURL(settings.baseURL),
      model: settings.model,
      apiKey
    };
  }

  async save(update: SettingsUpdate): Promise<PublicSettings> {
    const baseURL = normalizeBaseURL(update.baseURL);
    const model = update.model.trim();
    if (!model) {
      throw new Error('模型名称不能为空。');
    }

    Zotero.Prefs.set(BASE_URL_PREF, baseURL);
    Zotero.Prefs.set(MODEL_PREF, model);
    if (typeof update.apiKey === 'string' && update.apiKey.trim()) {
      await this.credentials.setApiKey(update.apiKey.trim());
    }
    return this.getPublicSettings();
  }

  async clearApiKey(): Promise<PublicSettings> {
    await this.credentials.clearApiKey();
    return this.getPublicSettings();
  }
}
