import { getDefaultSummaryModelId, getDefaultTagModelId } from '@my-web-bookmarks/shared';
import type { AppDatabase } from '../../db/database';
import { nowIso } from '../time';

export interface PublicSettings {
  openRouter: {
    apiKeyConfigured: boolean;
    summaryModel: string;
    tagsModel: string;
  };
  chromeProfilePath: string | null;
}

export interface OpenRouterSettingsPatch {
  apiKey?: string;
  summaryModel?: string;
  tagsModel?: string;
  model?: string;
}

const OPENROUTER_API_KEY = 'openrouter_api_key';
const OPENROUTER_MODEL_LEGACY = 'openrouter_model';
const OPENROUTER_SUMMARY_MODEL = 'openrouter_summary_model';
const OPENROUTER_TAGS_MODEL = 'openrouter_tags_model';
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

    if (patch.summaryModel !== undefined) {
      if (patch.summaryModel === '') {
        deleteSetting(OPENROUTER_SUMMARY_MODEL);
      } else {
        setSetting(OPENROUTER_SUMMARY_MODEL, patch.summaryModel);
      }
    }

    if (patch.tagsModel !== undefined) {
      if (patch.tagsModel === '') {
        deleteSetting(OPENROUTER_TAGS_MODEL);
      } else {
        setSetting(OPENROUTER_TAGS_MODEL, patch.tagsModel);
      }
    }

    if (patch.model !== undefined) {
      if (patch.model === '') {
        deleteSetting(OPENROUTER_MODEL_LEGACY);
      } else {
        setSetting(OPENROUTER_MODEL_LEGACY, patch.model);
      }

      if (patch.summaryModel === undefined) {
        if (patch.model === '') {
          deleteSetting(OPENROUTER_SUMMARY_MODEL);
        } else {
          setSetting(OPENROUTER_SUMMARY_MODEL, patch.model);
        }
      }

      if (patch.tagsModel === undefined) {
        if (patch.model === '') {
          deleteSetting(OPENROUTER_TAGS_MODEL);
        } else {
          setSetting(OPENROUTER_TAGS_MODEL, patch.model);
        }
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
    const legacyModel = getSetting(OPENROUTER_MODEL_LEGACY);
    const summaryModel =
      getSetting(OPENROUTER_SUMMARY_MODEL) ?? legacyModel ?? getDefaultSummaryModelId();
    const tagsModel = getSetting(OPENROUTER_TAGS_MODEL) ?? legacyModel ?? getDefaultTagModelId();

    return {
      chromeProfilePath: getChromeProfilePath(),
      openRouter: {
        apiKeyConfigured: Boolean(getOpenRouterApiKey()),
        summaryModel,
        tagsModel
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
