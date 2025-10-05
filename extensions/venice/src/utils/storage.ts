import { LocalStorage } from "@raycast/api";

/**
 * Generic utility to get a value from LocalStorage with a default fallback.
 *
 * @param key - The storage key
 * @param defaultValue - The default value to return if key doesn't exist or parsing fails
 * @returns The stored value or default
 */
export const getStoredValue = async <T>(key: string, defaultValue: T): Promise<T> => {
  try {
    const stored = await LocalStorage.getItem<string>(key);
    if (!stored) {
      return defaultValue;
    }
    return JSON.parse(stored) as T;
  } catch {
    return defaultValue;
  }
};

/**
 * Generic utility to set a value in LocalStorage.
 *
 * @param key - The storage key
 * @param value - The value to store (will be JSON stringified)
 */
export const setStoredValue = async <T>(key: string, value: T): Promise<void> => {
  await LocalStorage.setItem(key, JSON.stringify(value));
};

/**
 * Removes a value from LocalStorage.
 *
 * @param key - The storage key to remove
 */
export const removeStoredValue = async (key: string): Promise<void> => {
  await LocalStorage.removeItem(key);
};

/**
 * Gets a simple string value from LocalStorage.
 *
 * @param key - The storage key
 * @param defaultValue - Optional default value
 * @returns The stored string or default
 */
export const getStoredString = async (key: string, defaultValue?: string): Promise<string | undefined> => {
  try {
    const value = await LocalStorage.getItem<string>(key);
    return value ?? defaultValue;
  } catch {
    return defaultValue;
  }
};

/**
 * Sets a simple string value in LocalStorage.
 *
 * @param key - The storage key
 * @param value - The string value to store
 */
export const setStoredString = async (key: string, value: string): Promise<void> => {
  await LocalStorage.setItem(key, value);
};
