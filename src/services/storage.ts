import { z } from 'zod';

/**
 * localStorage wrapper. Storage can be missing, full, blocked (private mode, site data disabled)
 * or hold data from an older version, so every read falls back to a default and every write
 * reports failure instead of throwing. Nothing here leaves the device.
 */

const KEY_PREFIX = 'playchess:v1:';

function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readValue<T>(key: string, schema: z.ZodType<T>, fallback: T): T {
  const storage = getStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(KEY_PREFIX + key);
    if (raw === null) return fallback;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

export function writeValue<T>(key: string, schema: z.ZodType<T>, value: T): boolean {
  const storage = getStorage();
  if (!storage) return false;
  const parsed = schema.safeParse(value);
  if (!parsed.success) return false;
  try {
    storage.setItem(KEY_PREFIX + key, JSON.stringify(parsed.data));
    return true;
  } catch {
    return false;
  }
}

export function removeValue(key: string): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.removeItem(KEY_PREFIX + key);
    return true;
  } catch {
    return false;
  }
}

// ---------- App data ----------

export const progressSchema = z.object({
  lessons: z.record(
    z.string(),
    z.object({
      stars: z.number().int().min(0).max(3),
      completedAt: z.string(),
    }),
  ),
});
export type Progress = z.infer<typeof progressSchema>;

export const settingsSchema = z.object({
  muted: z.boolean(),
  volume: z.number().min(0).max(1),
});
export type Settings = z.infer<typeof settingsSchema>;

const PROGRESS_KEY = 'progress';
const SETTINGS_KEY = 'settings';

export const DEFAULT_SETTINGS: Settings = { muted: false, volume: 1 };

export function loadProgress(): Progress {
  return readValue(PROGRESS_KEY, progressSchema, { lessons: {} });
}

export function saveProgress(progress: Progress): boolean {
  return writeValue(PROGRESS_KEY, progressSchema, progress);
}

export function clearProgress(): boolean {
  return removeValue(PROGRESS_KEY);
}

export function loadSettings(): Settings {
  return readValue(SETTINGS_KEY, settingsSchema, DEFAULT_SETTINGS);
}

export function saveSettings(settings: Settings): boolean {
  return writeValue(SETTINGS_KEY, settingsSchema, settings);
}
