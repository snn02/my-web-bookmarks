import { getDefaultModelId } from '@my-web-bookmarks/shared';
import { DEFAULT_SUMMARY_PROMPT, DEFAULT_TAGS_PROMPT } from '../ai/ai-prompts';
import type { AppDatabase } from '../../db/database';
import { nowIso } from '../time';

export interface PublicSettings {
  openRouter: {
    apiKeyConfigured: boolean;
    model: string;
    summaryPrompt: string;
    tagsPrompt: string;
  };
  chromeProfilePath: string | null;
}

export interface OpenRouterSettingsPatch {
  apiKey?: string;
  model?: string;
  summaryPrompt?: string;
  tagsPrompt?: string;
}

const OPENROUTER_API_KEY = 'openrouter_api_key';
const OPENROUTER_MODEL = 'openrouter_model';
const OPENROUTER_SUMMARY_PROMPT = 'openrouter_summary_prompt';
const OPENROUTER_TAGS_PROMPT = 'openrouter_tags_prompt';
const OPENROUTER_SUMMARY_MODEL_LEGACY = 'openrouter_summary_model';
const OPENROUTER_TAGS_MODEL_LEGACY = 'openrouter_tags_model';
const CHROME_PROFILE_PATH = 'chrome_profile_path';

interface SettingRow {
  value: string;
}

export function createSettingsRepository(db: AppDatabase) {
  function setSetting(key: string, value: string): void {
    db.prepare(
      `
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `
    ).run(key, value, nowIso());
  }

  function deleteSetting(key: string): void {
    db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  }

  function getSetting(key: string): string | null {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | SettingRow
      | undefined;
    return row?.value ?? null;
  }

  function updateOpenRouterSettings(patch: OpenRouterSettingsPatch): void {
    if (patch.apiKey !== undefined) {
      if (patch.apiKey === '') {
        deleteSetting(OPENROUTER_API_KEY);
      } else {
        setSetting(OPENROUTER_API_KEY, patch.apiKey);
      }
    }

    if (patch.model !== undefined) {
      if (patch.model === '') {
        deleteSetting(OPENROUTER_MODEL);
      } else {
        setSetting(OPENROUTER_MODEL, patch.model);
      }
    }

    if (patch.summaryPrompt !== undefined) {
      if (patch.summaryPrompt === '') {
        deleteSetting(OPENROUTER_SUMMARY_PROMPT);
      } else {
        setSetting(OPENROUTER_SUMMARY_PROMPT, patch.summaryPrompt);
      }
    }

    if (patch.tagsPrompt !== undefined) {
      if (patch.tagsPrompt === '') {
        deleteSetting(OPENROUTER_TAGS_PROMPT);
      } else {
        setSetting(OPENROUTER_TAGS_PROMPT, patch.tagsPrompt);
      }
    }
  }

  function getOpenRouterApiKey(): string | null {
    return getSetting(OPENROUTER_API_KEY);
  }

  function setChromeProfilePath(path: string): void {
    if (path === '') {
      deleteSetting(CHROME_PROFILE_PATH);
    } else {
      setSetting(CHROME_PROFILE_PATH, path);
    }
  }

  function getChromeProfilePath(): string | null {
    return getSetting(CHROME_PROFILE_PATH);
  }

  function getPublicSettings(): PublicSettings {
    const model =
      getSetting(OPENROUTER_MODEL) ??
      getSetting(OPENROUTER_SUMMARY_MODEL_LEGACY) ??
      getSetting(OPENROUTER_TAGS_MODEL_LEGACY) ??
      getDefaultModelId();
    const summaryPrompt = getSetting(OPENROUTER_SUMMARY_PROMPT) ?? DEFAULT_SUMMARY_PROMPT;
    const tagsPrompt = getSetting(OPENROUTER_TAGS_PROMPT) ?? DEFAULT_TAGS_PROMPT;

    return {
      chromeProfilePath: getChromeProfilePath(),
      openRouter: {
        apiKeyConfigured: Boolean(getOpenRouterApiKey()),
        model,
        summaryPrompt,
        tagsPrompt
      }
    };
  }

  return {
    getChromeProfilePath,
    getOpenRouterApiKey,
    getPublicSettings,
    setChromeProfilePath,
    updateOpenRouterSettings
  };
}
