const STORAGE_KEY = "storyStudio.appSession";

export type AppSession = {
  workPath: string;
  conversationId: string;
};

export function readAppSession(): AppSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as AppSession).workPath === "string" &&
      typeof (parsed as AppSession).conversationId === "string"
    ) {
      return parsed as AppSession;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveAppSession(session: AppSession) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore quota / private mode errors
  }
}

export function clearAppSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore quota / private mode errors
  }
}
