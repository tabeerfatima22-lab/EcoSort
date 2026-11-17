/**
 * Saves tagged items to a JSON file in a GitHub repository, using the GitHub
 * contents API from the browser. The token is a fine-grained personal access
 * token with "Contents: Read and write" on that one repository; it is kept in
 * this browser only (localStorage) and is sent only to api.github.com.
 *
 * GitHub is the shared copy: every change is applied to the latest file on
 * GitHub and written back, so two phones see each other's items.
 */
import type { TaughtItem } from "../core/memory";

export interface GitHubConfig {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  token: string;
}

const KEY = "ecosort.github.v1";
const PENDING_KEY = "ecosort.github.pending.v1";

export const DEFAULT_GITHUB: GitHubConfig = {
  owner: "tabeerfatima22-lab",
  repo: "EcoSort",
  branch: "main",
  path: "data/my-items.json",
  token: "",
};

export function readGitHubConfig(): GitHubConfig {
  try {
    return { ...DEFAULT_GITHUB, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULT_GITHUB;
  }
}

export function writeGitHubConfig(c: GitHubConfig): void {
  localStorage.setItem(KEY, JSON.stringify(c));
}

export const isConnected = (c: GitHubConfig) => Boolean(c.token.trim() && c.owner.trim() && c.repo.trim() && c.path.trim());

/** True when a change was saved in this browser but could not reach GitHub yet. */
export const hasPending = () => localStorage.getItem(PENDING_KEY) === "1";
export const setPending = (v: boolean) => (v ? localStorage.setItem(PENDING_KEY, "1") : localStorage.removeItem(PENDING_KEY));

export class GitHubError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

function url(c: GitHubConfig): string {
  const path = c.path.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/");
  return `https://api.github.com/repos/${encodeURIComponent(c.owner.trim())}/${encodeURIComponent(c.repo.trim())}/contents/${path}`;
}

function headers(c: GitHubConfig, accept = "application/vnd.github+json"): HeadersInit {
  return { Accept: accept, Authorization: `Bearer ${c.token.trim()}`, "X-GitHub-Api-Version": "2022-11-28" };
}

function explain(status: number, body: string): GitHubError {
  if (status === 401) return new GitHubError("GitHub did not accept the token. It may be mistyped or expired. Paste a new one in My items > Save to GitHub.", status);
  if (status === 403 || status === 404) {
    return new GitHubError("GitHub refused access. Check the repository name, and that the token has Contents: Read and write on that repository.", status);
  }
  if (status === 409 || status === 422) return new GitHubError("The file on GitHub changed at the same time. Try again.", status);
  return new GitHubError(`GitHub returned an error (${status}). ${body.slice(0, 160)}`, status);
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function parseItems(text: string): TaughtItem[] {
  const parsed = JSON.parse(text) as { items?: unknown };
  return Array.isArray(parsed.items) ? (parsed.items as TaughtItem[]) : [];
}

/** Reads the items file. A file that does not exist yet reads as no items. */
export async function pull(c: GitHubConfig): Promise<{ items: TaughtItem[]; sha: string | null }> {
  const u = `${url(c)}?ref=${encodeURIComponent(c.branch.trim() || "main")}`;
  let res: Response;
  try {
    res = await fetch(u, { headers: headers(c), cache: "no-store" });
  } catch {
    throw new GitHubError("Could not reach GitHub. Check the internet connection.");
  }
  if (res.status === 404) {
    // 404 is also what GitHub says for a repo the token cannot see; tell them apart.
    const repo = await fetch(`https://api.github.com/repos/${encodeURIComponent(c.owner.trim())}/${encodeURIComponent(c.repo.trim())}`, { headers: headers(c) }).catch(() => null);
    if (repo && repo.ok) return { items: [], sha: null };
    throw explain(404, "");
  }
  if (!res.ok) throw explain(res.status, await res.text());
  const meta = (await res.json()) as { sha: string; content?: string; encoding?: string };
  let text: string;
  if (meta.encoding === "base64" && meta.content) {
    text = fromBase64(meta.content);
  } else {
    // Files over 1 MB come back without content; fetch the raw bytes instead.
    const raw = await fetch(u, { headers: headers(c, "application/vnd.github.raw+json"), cache: "no-store" });
    if (!raw.ok) throw explain(raw.status, await raw.text());
    text = await raw.text();
  }
  try {
    return { items: parseItems(text), sha: meta.sha };
  } catch {
    throw new GitHubError(`The file ${c.path} on GitHub is not an EcoSort items file.`);
  }
}

async function push(c: GitHubConfig, items: TaughtItem[], sha: string | null, message: string): Promise<void> {
  const content = JSON.stringify({ app: "EcoSort AI", version: 1, saved: new Date().toISOString(), items }, null, 1);
  const body: Record<string, string> = { message, content: toBase64(content), branch: c.branch.trim() || "main" };
  if (sha) body.sha = sha;
  let res: Response;
  try {
    res = await fetch(url(c), { method: "PUT", headers: { ...headers(c), "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new GitHubError("Could not reach GitHub. Check the internet connection.");
  }
  if (!res.ok) throw explain(res.status, await res.text());
}

/**
 * Applies a change to the latest copy on GitHub and writes it back.
 * Retries once if someone else saved in between. Returns the new list.
 */
export async function applyRemote(c: GitHubConfig, change: (items: TaughtItem[]) => TaughtItem[], message: string): Promise<TaughtItem[]> {
  for (let attempt = 0; ; attempt++) {
    const { items, sha } = await pull(c);
    const next = change(items);
    try {
      await push(c, next, sha, message);
      return next;
    } catch (e) {
      if (attempt === 0 && e instanceof GitHubError && (e.status === 409 || e.status === 422)) continue;
      throw e;
    }
  }
}

/** Joins two lists: items matched by id, photos within an item joined by id. Nothing is removed. */
export function union(a: TaughtItem[], b: TaughtItem[]): TaughtItem[] {
  const byId = new Map(a.map((i) => [i.id, { ...i, examples: [...i.examples] }]));
  for (const item of b) {
    const have = byId.get(item.id);
    if (!have) {
      byId.set(item.id, { ...item, examples: [...item.examples] });
      continue;
    }
    const seen = new Set(have.examples.map((e) => e.id));
    for (const e of item.examples) if (!seen.has(e.id)) have.examples.push(e);
  }
  return [...byId.values()];
}

/* ---------- Easy setup: pre-filled key page and a connect link for other phones ---------- */

/**
 * Opens GitHub's "new fine-grained token" page with the name, expiry and
 * permission (Contents: read and write) already filled in. GitHub cannot
 * pre-select the repository, so the owner still picks EcoSort there.
 */
export function tokenCreateUrl(c: GitHubConfig): string {
  const q = new URLSearchParams({
    name: "EcoSort app",
    description: `Lets the EcoSort app save tagged items to ${c.owner}/${c.repo}.`,
    target_name: c.owner,
    expires_in: "366",
    contents: "write",
  });
  return `https://github.com/settings/personal-access-tokens/new?${q.toString()}`;
}

const LINK_KEY = "connect";

function b64url(text: string): string {
  return toBase64(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * A link that connects another phone in one tap. The key travels after "#",
 * which browsers never send to the web server; treat the link like a password.
 */
export function makeConnectLink(c: GitHubConfig, base = `${location.origin}${location.pathname}`): string {
  const payload = { t: c.token.trim(), o: c.owner.trim(), r: c.repo.trim(), b: c.branch.trim(), p: c.path.trim() };
  return `${base}#${LINK_KEY}=${b64url(JSON.stringify(payload))}`;
}

/** Reads a connect link from the address bar hash, or returns null. */
export function readConnectLink(hash: string): GitHubConfig | null {
  const m = hash.match(new RegExp(`[#&]${LINK_KEY}=([A-Za-z0-9_-]+)`));
  if (!m) return null;
  try {
    const raw = JSON.parse(fromBase64(m[1].replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, string>;
    if (!raw.t || !raw.o || !raw.r) return null;
    return { owner: raw.o, repo: raw.r, branch: raw.b || DEFAULT_GITHUB.branch, path: raw.p || DEFAULT_GITHUB.path, token: raw.t };
  } catch {
    return null;
  }
}

/** Checks a key by reading the items file; returns null when it works, otherwise the problem. */
export async function testConnection(c: GitHubConfig): Promise<string | null> {
  try {
    await pull(c);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
