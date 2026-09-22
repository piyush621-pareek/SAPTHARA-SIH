// Minimal JWT auth for the command dashboard.
const TOKEN_KEY = "ner_dash_token";
const NAME_KEY = "ner_dash_name";
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getName(): string | null {
  try {
    return localStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

function store(token: string, name: string | null) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    if (name) localStorage.setItem(NAME_KEY, name);
  } catch {
    /* private mode */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(NAME_KEY);
  } catch {
    /* ignore */
  }
}

/** Authorization header for API calls when signed in. */
export function authHeader(): Record<string, string> {
  const t = getToken();
  return t ? { authorization: `Bearer ${t}` } : {};
}

export async function login(phone: string, password: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });
  if (!res.ok) throw new Error("Invalid phone or password");
  const body = (await res.json()) as {
    data?: { token?: string; user?: { full_name?: string } };
  };
  const token = body.data?.token;
  if (!token) throw new Error("Unexpected server response");
  store(token, body.data?.user?.full_name ?? null);
  return token;
}
