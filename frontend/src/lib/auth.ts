const TOKEN_KEY = "orchestra.token";
const USER_KEY = "orchestra.user";

export const auth = {
  token: () => localStorage.getItem(TOKEN_KEY),
  user: () => localStorage.getItem(USER_KEY),
  isAuthed: () => Boolean(localStorage.getItem(TOKEN_KEY)),
  set: (token: string, user: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, user);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  async login(username: string, password: string): Promise<{ token: string; user: string }> {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.detail || "Sign in failed");
    }
    const data = await r.json();
    auth.set(data.token, data.user);
    return data;
  },
};
