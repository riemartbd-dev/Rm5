/**
 * Safe Storage Helpers
 * Prevents SecurityError / DOMException crashes when running inside sandboxed or cross-origin iframes
 * where localStorage/sessionStorage access is blocked by browser policies.
 */

const getSafeLocalStorage = (): Storage => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.getItem("__test_support__");
      return window.localStorage;
    }
  } catch (e) {
    console.warn("[SafeStorage] LocalStorage is blocked, using in-memory fallback:", e);
  }
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => (store[key] !== undefined ? store[key] : null),
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; },
    key: (index: number) => Object.keys(store)[index] || null,
    get length() { return Object.keys(store).length; }
  } as Storage;
};

const getSafeSessionStorage = (): Storage => {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.getItem("__test_support__");
      return window.sessionStorage;
    }
  } catch (e) {
    console.warn("[SafeStorage] SessionStorage is blocked, using in-memory fallback:", e);
  }
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => (store[key] !== undefined ? store[key] : null),
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; },
    key: (index: number) => Object.keys(store)[index] || null,
    get length() { return Object.keys(store).length; }
  } as Storage;
};

export const safeLocalStorage = getSafeLocalStorage();
export const safeSessionStorage = getSafeSessionStorage();
