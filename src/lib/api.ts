// API Helper com autenticação automática para o Mensageiro Pessoal

const TOKEN_KEY = 'mensageiro_admin_session';

export function getStoredAdminToken(): string | null {
  if (typeof window === 'undefined') return null;

  // 1. Tenta recuperar sessão própria do Mensageiro
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.access_token) return parsed.access_token;
      if (typeof parsed === 'string') return parsed;
    }
  } catch (e) {
    // ignore
  }

  // 2. Procura sessão ativa do Supabase compartilhada no TechAgenda
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('auth-token') || key.includes('techagenda'))) {
        const val = localStorage.getItem(key);
        if (val) {
          try {
            const parsed = JSON.parse(val);
            if (parsed?.access_token) return parsed.access_token;
            if (parsed?.currentSession?.access_token) return parsed.currentSession.access_token;
          } catch { /* Ignore unrelated local storage entries. */ }
        }
      }
    }
  } catch (e) {
    // ignore
  }

  return null;
}

export function setStoredAdminSession(data: { access_token: string; refresh_token?: string; user?: any }) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, JSON.stringify(data));
}

export function clearStoredAdminSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = getStoredAdminToken();
  const headers = new Headers(init?.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
