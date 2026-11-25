import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { create } from "zustand";
import { isChannel } from "@/lib/kindling/channels";
import { isLanguage } from "@/lib/kindling/languages";
import { MAX_DELETED, mergeSnapshots, type Snapshot } from "@/lib/kindling/merge";
import { DEFAULT_SHOP, MATURITY, PAINS, TEAMS, TRADES, WORRIES } from "@/lib/kindling/catalog";
import { ensureHydrated, useKindling } from "@/lib/kindling/store";
import type { Fact, Intake, Learned, LogEntry, Shop } from "@/lib/kindling/types";

/**
 * Optional accounts and cross-device saving through Supabase.
 * With VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY unset, none of this runs and the app is browser-only.
 * The anon (or "publishable") key is meant to be public. Row Level Security in supabase/schema.sql is what
 * keeps each person's week private.
 */

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export type { Snapshot };
export { mergeSnapshots };

export const CLOUD_ENABLED = Boolean(URL && KEY);

/** Show "Continue with Google" only once Google is switched on in Supabase (set VITE_GOOGLE_AUTH=true). */
export const GOOGLE_ENABLED = CLOUD_ENABLED && import.meta.env.VITE_GOOGLE_AUTH === "true";

export type Workspace = { kind: "personal" } | { kind: "team"; id: string; name: string };

export type TeamInfo = {
  id: string;
  name: string;
  ownerId: string;
  members: { userId: string; email: string }[];
};

type Cloud = {
  user: { id: string; email: string } | null;
  status: "idle" | "saving" | "saved" | "error";
  syncing: boolean;
  conflict: Snapshot | null;
  message: string;
  workspace: Workspace;
  teams: TeamInfo[];
  notice: string;
  training: { consented: boolean; count: number; loaded: boolean };
  recovery: boolean;
};

export const useCloud = create<Cloud>(() => ({
  user: null,
  status: "idle",
  syncing: false,
  conflict: null,
  message: "",
  workspace: { kind: "personal" },
  teams: [],
  notice: "",
  training: { consented: false, count: 0, loaded: false },
  recovery: false,
}));

const PERSONAL: Workspace = { kind: "personal" };
const PENDING_JOIN_KEY = "kindling-pending-join";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (typeof window === "undefined" || !URL || !KEY) return null;
  client ??= createClient(URL, KEY);
  return client;
}

/* ---------------------------------------------------------------- */
/* Snapshots                                                         */
/* ---------------------------------------------------------------- */

export function snapshotOf(state: ReturnType<typeof useKindling.getState>): Snapshot {
  return {
    shop: state.shop,
    intake: state.intake,
    checks: state.checks,
    sharpened: state.sharpened,
    drafts: state.drafts,
    baselines: state.baselines,
    log: state.log,
    facts: state.facts,
    learned: state.learned,
    deleted: state.deleted,
  };
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function validIntake(value: unknown): value is Intake {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    TRADES.some((x) => x.id === v.trade) &&
    TEAMS.some((x) => x.id === v.team) &&
    PAINS.some((x) => x.id === v.pain) &&
    MATURITY.some((x) => x.id === v.maturity) &&
    WORRIES.some((x) => x.id === v.worry)
  );
}

function record<T>(value: unknown, test: (v: unknown) => boolean): Record<string, T> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) if (test(v)) out[k] = v as T;
  return out;
}

/** Turns whatever came back from the database into a safe snapshot, or null if it is unusable. */
function readSnapshot(raw: unknown): Snapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const shopRaw = (r.shop && typeof r.shop === "object" ? r.shop : {}) as Record<string, unknown>;
  const current = useKindling.getState().shop;
  const shop: Shop = {
    name: typeof shopRaw.name === "string" ? shopRaw.name.slice(0, 80) : "",
    offer: typeof shopRaw.offer === "string" ? shopRaw.offer.slice(0, 240) : "",
    tone: shopRaw.tone === "plain" || shopRaw.tone === "formal" ? shopRaw.tone : "warm",
    hourly: typeof shopRaw.hourly === "number" ? Math.min(400, Math.max(8, shopRaw.hourly)) : current.hourly,
    voiceSample: typeof shopRaw.voiceSample === "string" ? shopRaw.voiceSample.slice(0, 800) : "",
    channel: isChannel(shopRaw.channel) ? shopRaw.channel : "whatsapp",
    language: isLanguage(shopRaw.language) ? shopRaw.language : "english",
  };
  const log = Array.isArray(r.log)
    ? (r.log as unknown[])
        .filter((e): e is LogEntry => {
          if (!e || typeof e !== "object") return false;
          const x = e as Record<string, unknown>;
          return (
            typeof x.id === "string" &&
            typeof x.day === "string" &&
            typeof x.workflowId === "string" &&
            typeof x.minutes === "number" &&
            (x.by === undefined || typeof x.by === "string")
          );
        })
        .slice(-200)
    : [];
  const facts: Fact[] = Array.isArray(r.facts)
    ? (r.facts as unknown[])
        .filter((f): f is Fact => {
          if (!f || typeof f !== "object") return false;
          const x = f as Record<string, unknown>;
          return (
            typeof x.id === "string" &&
            typeof x.key === "string" &&
            typeof x.label === "string" &&
            typeof x.value === "string" &&
            typeof x.checkedOn === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(x.checkedOn)
          );
        })
        .map((f) => ({ ...f, label: f.label.slice(0, 40), value: f.value.slice(0, 300) }))
        .slice(0, 20)
    : [];
  const learned: Learned[] = Array.isArray(r.learned)
    ? (r.learned as unknown[])
        .filter((l): l is Learned => {
          if (!l || typeof l !== "object") return false;
          const x = l as Record<string, unknown>;
          return typeof x.id === "string" && typeof x.text === "string" && typeof x.workflowId === "string" && typeof x.day === "string" && isChannel(x.channel);
        })
        .map((l) => ({ ...l, text: l.text.slice(0, 400) }))
        .slice(-8)
    : [];
  const deleted = Array.isArray(r.deleted)
    ? (r.deleted as unknown[]).filter((id): id is string => typeof id === "string" && id.length < 60).slice(-MAX_DELETED)
    : [];
  return {
    shop,
    facts,
    learned,
    deleted,
    intake: validIntake(r.intake) ? r.intake : null,
    checks: record<boolean>(r.checks, (v) => typeof v === "boolean"),
    sharpened: record<string>(r.sharpened, (v) => typeof v === "string"),
    drafts: record<string>(r.drafts, (v) => typeof v === "string"),
    baselines: record<number>(r.baselines, (v) => typeof v === "number"),
    log,
  };
}

let lastJson = "";
let syncedUser: string | null = null;
let knownVersion = 0; // 0 means "no saved row yet"
let pushing = false;
let pushAgain = false;


function emptySnapshot(): Snapshot {
  return { shop: DEFAULT_SHOP, intake: null, checks: {}, sharpened: {}, drafts: {}, baselines: {}, log: [], facts: [], learned: [], deleted: [] };
}

/** Where the active week is saved: the person's own row, or a crew's shared row. */
function target(userId: string): { table: string; keyCol: string; keyVal: string; key: string } {
  const ws = useCloud.getState().workspace;
  return ws.kind === "team"
    ? { table: "kindling_teams", keyCol: "id", keyVal: ws.id, key: `${userId}:team:${ws.id}` }
    : { table: "kindling_state", keyCol: "user_id", keyVal: userId, key: `${userId}:personal` };
}

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

/** Remember what this device last saved, so a reload can tell "I changed nothing" from "we both changed it". */
function remember(userId: string, json: string) {
  lastJson = json;
  try {
    localStorage.setItem(`kindling-sync:${target(userId).key}`, hash(json));
  } catch {
    // storage unavailable: worst case a reload may ask which copy to keep
  }
}

function unchangedSinceLastSync(userId: string, local: Snapshot): boolean {
  try {
    return localStorage.getItem(`kindling-sync:${target(userId).key}`) === hash(stable(local));
  } catch {
    return false;
  }
}

function apply(snapshot: Snapshot, userId?: string) {
  useKindling.setState({ ...snapshot });
  const json = stable(snapshotOf(useKindling.getState()));
  if (userId) remember(userId, json);
  else lastJson = json;
}

/* ---------------------------------------------------------------- */
/* Pull, push, conflicts                                             */
/* ---------------------------------------------------------------- */

function hasWeek(s: Snapshot): boolean {
  return s.intake !== null;
}

async function pull(userId: string, opts: { replace?: boolean } = {}) {
  const sb = getClient();
  if (!sb) return;
  useCloud.setState({ syncing: true, message: "" });
  const t = target(userId);
  const { data, error } = await sb.from(t.table).select("state, version").eq(t.keyCol, t.keyVal).maybeSingle();
  if (error) {
    useCloud.setState({
      syncing: false,
      status: "error",
      message: "Could not reach your saved week. It is still on this device.",
    });
    return;
  }
  const row = data as { state: unknown; version?: number } | null;

  // A crew that no longer lets us in (removed, or deleted): go back to the personal week.
  if (!row && useCloud.getState().workspace.kind === "team") {
    const name = (useCloud.getState().workspace as { name: string }).name;
    setWorkspace(userId, PERSONAL);
    knownVersion = 0;
    syncedUser = null;
    useCloud.setState({ notice: `You no longer have access to ${name}. Showing your own week.` });
    await loadTeams();
    await pull(userId, { replace: true });
    return;
  }

  const local = snapshotOf(useKindling.getState());
  knownVersion = row ? Number(row.version ?? 1) : 0;
  const remote = row ? readSnapshot(row.state) : null;

  if (opts.replace) {
    apply(remote ?? emptySnapshot(), userId);
    syncedUser = userId;
    useCloud.setState({ syncing: false, status: "saved" });
    return;
  }
  if (!remote) {
    syncedUser = userId;
    useCloud.setState({ syncing: false });
    if (hasWeek(local)) await pushNow();
    return;
  }
  if (stable(remote) === stable(local)) {
    syncedUser = userId;
    remember(userId, stable(local));
    useCloud.setState({ syncing: false, status: "saved" });
    return;
  }
  if (!hasWeek(local) || unchangedSinceLastSync(userId, local)) {
    // Nothing of ours to lose: take the newer saved copy quietly.
    apply(remote, userId);
    syncedUser = userId;
    useCloud.setState({ syncing: false, status: "saved" });
    return;
  }
  if (!hasWeek(remote)) {
    syncedUser = userId;
    useCloud.setState({ syncing: false });
    await pushNow();
    return;
  }
  // Both sides changed: let the person choose, and do not save anything until they do.
  useCloud.setState({ syncing: false, conflict: remote });
  syncedUser = userId;
}

export async function resolveConflict(choice: "account" | "device") {
  const remote = useCloud.getState().conflict;
  useCloud.setState({ conflict: null });
  const uid = useCloud.getState().user?.id;
  if (choice === "account" && remote) {
    apply(remote, uid);
    useCloud.setState({ status: "saved" });
  } else {
    lastJson = "";
    await pushNow();
  }
}

async function fetchRemote(userId: string): Promise<{ snapshot: Snapshot | null; version: number } | null> {
  const sb = getClient();
  if (!sb) return null;
  const t = target(userId);
  const { data, error } = await sb.from(t.table).select("state, version").eq(t.keyCol, t.keyVal).maybeSingle();
  if (error) return null;
  if (!data) return { snapshot: null, version: 0 };
  const row = data as { state: unknown; version?: number };
  return { snapshot: readSnapshot(row.state), version: Number(row.version ?? 1) };
}

/**
 * Saves with a version check so one device can never silently overwrite another's newer save.
 * If the saved copy moved on, we merge it into this device's week and save the merged result.
 */
async function pushNow() {
  const sb = getClient();
  if (!sb) return;
  if (pushing) {
    pushAgain = true;
    return;
  }
  pushing = true;
  try {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { user, conflict } = useCloud.getState();
      if (!user || conflict || syncedUser !== user.id) return;
      const snap = snapshotOf(useKindling.getState());
      const json = stable(snap);
      if (json === lastJson) return;
      useCloud.setState({ status: "saving", message: "" });

      const t = target(user.id);
      let saved = false;
      let failed = false;
      if (knownVersion === 0 && t.table === "kindling_teams") {
        failed = true; // a crew's row always exists; if it does not, we have lost access
      } else if (knownVersion === 0) {
        const { error } = await sb
          .from("kindling_state")
          .insert({ user_id: user.id, state: snap, version: 1, updated_at: new Date().toISOString() });
        if (!error) {
          knownVersion = 1;
          saved = true;
        } else if (error.code !== "23505") failed = true;
      } else {
        const { data, error } = await sb
          .from(t.table)
          .update({ state: snap, version: knownVersion + 1, updated_at: new Date().toISOString() })
          .eq(t.keyCol, t.keyVal)
          .eq("version", knownVersion)
          .select("version");
        if (error) failed = true;
        else if (data && data.length > 0) {
          knownVersion += 1;
          saved = true;
        }
      }

      if (saved) {
        remember(user.id, json);
        useCloud.setState({ status: "saved" });
        return;
      }
      if (failed) {
        useCloud.setState({
          status: "error",
          message: "Could not save to your account. We will try again on your next change.",
        });
        return;
      }
      // Someone else saved first. Bring their changes in, then try again.
      const remote = await fetchRemote(user.id);
      if (!remote) {
        useCloud.setState({ status: "error", message: "Could not save to your account. We will try again soon." });
        return;
      }
      knownVersion = remote.version;
      if (remote.snapshot) useKindling.setState({ ...mergeSnapshots(snap, remote.snapshot) });
    }
    useCloud.setState({ status: "error", message: "Your account changed while saving. Reload to continue." });
  } finally {
    pushing = false;
    if (pushAgain) {
      pushAgain = false;
      schedulePush();
    }
  }
}

/** Looks for a newer save from another device. Called when the tab comes back into view and on a slow timer. */
async function refreshFromCloud() {
  const { user, conflict } = useCloud.getState();
  if (!user || conflict || syncedUser !== user.id || pushing) return;
  const remote = await fetchRemote(user.id);
  if (remote && !remote.snapshot && remote.version === 0 && useCloud.getState().workspace.kind === "team") {
    syncedUser = null; // we lost access to the crew: pull() handles the way back
    await pull(user.id);
    return;
  }
  if (!remote || !remote.snapshot || remote.version === knownVersion) return;
  const local = snapshotOf(useKindling.getState());
  if (stable(local) === lastJson) {
    knownVersion = remote.version;
    apply(remote.snapshot, user.id);
    useCloud.setState({ status: "saved" });
    return;
  }
  knownVersion = remote.version;
  useKindling.setState({ ...mergeSnapshots(local, remote.snapshot) });
}

let timer: ReturnType<typeof setTimeout> | undefined;
function schedulePush() {
  const { user, conflict } = useCloud.getState();
  if (!user || conflict || syncedUser !== user.id) return;
  clearTimeout(timer);
  timer = setTimeout(() => void pushNow(), 1500);
}

/* ---------------------------------------------------------------- */
/* Session                                                           */
/* ---------------------------------------------------------------- */

function setWorkspace(userId: string, ws: Workspace) {
  useCloud.setState({ workspace: ws });
  try {
    localStorage.setItem(`kindling-workspace:${userId}`, JSON.stringify(ws));
  } catch {
    // ignore: the person just lands in their personal week next time
  }
}

function storedWorkspace(userId: string): Workspace {
  try {
    const raw = localStorage.getItem(`kindling-workspace:${userId}`);
    if (!raw) return PERSONAL;
    const v = JSON.parse(raw) as { kind?: string; id?: string; name?: string };
    if (v.kind === "team" && typeof v.id === "string") return { kind: "team", id: v.id, name: String(v.name ?? "Crew") };
  } catch {
    // fall through
  }
  return PERSONAL;
}

async function onSession(session: { user: { id: string; email?: string | null } } | null) {
  if (!session) {
    syncedUser = null;
    lastJson = "";
    knownVersion = 0;
    useCloud.setState({
      user: null,
      status: "idle",
      syncing: false,
      conflict: null,
      message: "",
      workspace: PERSONAL,
      teams: [],
      training: { consented: false, count: 0, loaded: false },
    });
    return;
  }
  const user = { id: session.user.id, email: session.user.email ?? "" };
  useCloud.setState({ user });
  if (syncedUser === user.id) return;
  useCloud.setState({ syncing: true });
  await loadTeams();
  const stored = storedWorkspace(user.id);
  const stillMember = stored.kind === "team" && useCloud.getState().teams.some((team) => team.id === stored.id);
  if (stored.kind === "team" && !stillMember) {
    // The crew is gone or we were removed: never carry its week into our own account.
    setWorkspace(user.id, PERSONAL);
    useCloud.setState({ notice: `You no longer have access to ${stored.name}. Showing your own week.` });
    await pull(user.id, { replace: true });
  } else {
    useCloud.setState({ workspace: stillMember ? stored : PERSONAL });
    await pull(user.id);
  }
  await processPendingJoin();
  void loadTraining();
}

let started = false;

export function initCloud() {
  const sb = getClient();
  if (!sb || started) return;
  started = true;
  void ensureHydrated().then(async () => {
    const { data } = await sb.auth.getSession();
    await onSession(data.session);
    // Never await Supabase calls inside this callback; hop to the next tick.
    sb.auth.onAuthStateChange((event, session) => {
      // A password reset link signs the person in briefly and says so with this event.
      if (event === "PASSWORD_RECOVERY") useCloud.setState({ recovery: true });
      setTimeout(() => void onSession(session), 0);
    });
  });
  useKindling.subscribe(() => schedulePush());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refreshFromCloud();
  });
  setInterval(() => {
    if (document.visibilityState === "visible") void refreshFromCloud();
  }, 45_000);
}

/* ---------------------------------------------------------------- */
/* Actions used by the account page                                  */
/* ---------------------------------------------------------------- */

export type AuthResult = { ok: true; note?: string } | { ok: false; error: string };

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("captcha")) return "The security check did not pass. Wait a moment and try again.";
  if (m.includes("invalid login")) return "That email and password do not match.";
  if (m.includes("already registered")) return "If that address can be used, check your inbox. Otherwise try signing in.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many tries. Wait a minute and try again.";
  if (m.includes("password") && m.includes("least")) return "Use a password of at least 8 characters.";
  if (m.includes("email not confirmed")) return "Confirm your email first. The link is in your inbox.";
  return "That did not work. Check the details and try again.";
}

export async function sendMagicLink(email: string, captchaToken?: string): Promise<AuthResult> {
  const sb = getClient();
  if (!sb) return { ok: false, error: "Accounts are not switched on yet." };
  const { error } = await sb.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: `${window.location.origin}/studio`, shouldCreateUser: true, ...(captchaToken ? { captchaToken } : {}) },
  });
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true, note: "Check your inbox for a sign-in link. It works on any device." };
}

export async function signInGoogle(): Promise<AuthResult> {
  const sb = getClient();
  if (!sb || !GOOGLE_ENABLED) return { ok: false, error: "Google sign-in is not switched on yet." };
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/studio` },
  });
  if (error) return { ok: false, error: "Could not start Google sign-in. Try the email link instead." };
  return { ok: true };
}

export async function signInPassword(email: string, password: string, captchaToken?: string): Promise<AuthResult> {
  const sb = getClient();
  if (!sb) return { ok: false, error: "Accounts are not switched on yet." };
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password, ...(captchaToken ? { options: { captchaToken } } : {}) });
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true };
}

export async function signUpPassword(email: string, password: string, captchaToken?: string): Promise<AuthResult> {
  const sb = getClient();
  if (!sb) return { ok: false, error: "Accounts are not switched on yet." };
  const { data, error } = await sb.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: `${window.location.origin}/studio`, ...(captchaToken ? { captchaToken } : {}) },
  });
  if (error) return { ok: false, error: friendly(error.message) };
  if (!data.session) return { ok: true, note: "Account created. Open the confirmation link we emailed you, then sign in." };
  return { ok: true };
}

export async function signOut(clearDevice: boolean) {
  const sb = getClient();
  if (!sb) return;
  clearTimeout(timer);
  await sb.auth.signOut();
  if (clearDevice) useKindling.getState().reset();
}

export async function deleteCloudData(): Promise<AuthResult> {
  const sb = getClient();
  const user = useCloud.getState().user;
  if (!sb || !user) return { ok: false, error: "Sign in first." };
  clearTimeout(timer);
  const { error } = await sb.from("kindling_state").delete().eq("user_id", user.id);
  if (error) return { ok: false, error: "Could not delete your saved week. Try again." };
  knownVersion = 0;
  await sb.auth.signOut(); // stops any later change from quietly re-creating the deleted copy
  return { ok: true, note: "Your saved copy is deleted and you are signed out. The week on this device is untouched." };
}

/* ---------------------------------------------------------------- */
/* Crews                                                             */
/* ---------------------------------------------------------------- */

function rpcError(error: { message?: string; code?: string }): string {
  const known = ["28000", "P0001", "P0002", "42501"];
  if (error.code && known.includes(error.code) && error.message) {
    const text = error.message;
    return text.charAt(0).toUpperCase() + text.slice(1) + (text.endsWith(".") ? "" : ".");
  }
  return "That did not work. Check your connection and try again.";
}

export async function loadTeams() {
  const sb = getClient();
  if (!sb) return;
  const [teams, members] = await Promise.all([
    sb.from("kindling_teams").select("id, name, owner_id"),
    sb.from("kindling_members").select("team_id, user_id, email"),
  ]);
  if (teams.error || members.error) return;
  const people = (members.data ?? []) as { team_id: string; user_id: string; email: string }[];
  const list: TeamInfo[] = ((teams.data ?? []) as { id: string; name: string; owner_id: string }[]).map((t) => ({
    id: t.id,
    name: t.name,
    ownerId: t.owner_id,
    members: people.filter((p) => p.team_id === t.id).map((p) => ({ userId: p.user_id, email: p.email })),
  }));
  useCloud.setState({ teams: list });
}

async function flush() {
  clearTimeout(timer);
  for (let i = 0; i < 30 && pushing; i += 1) await new Promise((r) => setTimeout(r, 100));
  await pushNow();
}

/** Moves between the personal week and a crew's shared week. Saves what is open first. */
export async function switchWorkspace(ws: Workspace): Promise<AuthResult> {
  const user = useCloud.getState().user;
  if (!getClient() || !user) return { ok: false, error: "Sign in first." };
  await flush();
  setWorkspace(user.id, ws);
  syncedUser = null;
  knownVersion = 0;
  lastJson = "";
  useCloud.setState({ conflict: null, status: "idle", notice: "" });
  await pull(user.id, { replace: true });
  return { ok: true };
}

export async function createTeam(name: string): Promise<AuthResult> {
  const sb = getClient();
  const user = useCloud.getState().user;
  if (!sb || !user) return { ok: false, error: "Sign in first." };
  await flush();
  const { data, error } = await sb.rpc("create_team", {
    team_name: name.trim() || "My crew",
    initial_state: snapshotOf(useKindling.getState()),
  });
  if (error) return { ok: false, error: rpcError(error) };
  await loadTeams();
  const id = String(data);
  const team = useCloud.getState().teams.find((item) => item.id === id);
  return switchWorkspace({ kind: "team", id, name: team?.name ?? (name.trim() || "My crew") });
}

export async function joinTeam(code: string): Promise<AuthResult & { name?: string }> {
  const sb = getClient();
  const user = useCloud.getState().user;
  if (!sb || !user) return { ok: false, error: "Sign in first." };
  const { data, error } = await sb.rpc("join_team", { code: code.trim() });
  if (error) return { ok: false, error: rpcError(error) };
  await loadTeams();
  const id = String(data);
  const team = useCloud.getState().teams.find((item) => item.id === id);
  const result = await switchWorkspace({ kind: "team", id, name: team?.name ?? "Crew" });
  return result.ok ? { ok: true, name: team?.name ?? "the crew" } : result;
}

export function rememberPendingJoin(code: string) {
  try {
    localStorage.setItem(PENDING_JOIN_KEY, code.slice(0, 64));
  } catch {
    // ignore
  }
}

export function pendingJoinCode(): string {
  try {
    return localStorage.getItem(PENDING_JOIN_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Finishes an invite the person opened before they were signed in. */
export async function processPendingJoin() {
  const code = pendingJoinCode();
  if (!code || !useCloud.getState().user) return;
  try {
    localStorage.removeItem(PENDING_JOIN_KEY);
  } catch {
    // ignore
  }
  const result = await joinTeam(code);
  useCloud.setState({
    notice: result.ok ? `You joined ${result.name}. This is the crew's shared week.` : result.error,
  });
}

async function owned(action: () => PromiseLike<{ error: { message?: string; code?: string } | null }>): Promise<AuthResult> {
  const { error } = await action();
  if (error) return { ok: false, error: rpcError(error) };
  await loadTeams();
  return { ok: true };
}

export async function getInviteLink(teamId: string): Promise<{ ok: true; link: string } | { ok: false; error: string }> {
  const sb = getClient();
  if (!sb) return { ok: false, error: "Accounts are not switched on yet." };
  const { data, error } = await sb.rpc("get_invite", { t: teamId });
  if (error) return { ok: false, error: rpcError(error) };
  return { ok: true, link: `${window.location.origin}/join?code=${String(data)}` };
}

export async function newInviteLink(teamId: string) {
  const sb = getClient();
  if (!sb) return { ok: false as const, error: "Accounts are not switched on yet." };
  const { data, error } = await sb.rpc("regenerate_invite", { t: teamId });
  if (error) return { ok: false as const, error: rpcError(error) };
  return { ok: true as const, link: `${window.location.origin}/join?code=${String(data)}` };
}

export async function renameTeam(teamId: string, name: string): Promise<AuthResult> {
  const sb = getClient();
  if (!sb) return { ok: false, error: "Accounts are not switched on yet." };
  const result = await owned(() => sb.rpc("rename_team", { t: teamId, new_name: name }));
  const ws = useCloud.getState().workspace;
  if (result.ok && ws.kind === "team" && ws.id === teamId) {
    const user = useCloud.getState().user;
    const fresh = useCloud.getState().teams.find((item) => item.id === teamId);
    if (user && fresh) setWorkspace(user.id, { kind: "team", id: teamId, name: fresh.name });
  }
  return result;
}

export async function removeMember(teamId: string, memberId: string): Promise<AuthResult> {
  const sb = getClient();
  if (!sb) return { ok: false, error: "Accounts are not switched on yet." };
  return owned(() => sb.rpc("remove_member", { t: teamId, member: memberId }));
}

export async function leaveTeam(teamId: string): Promise<AuthResult> {
  const sb = getClient();
  if (!sb) return { ok: false, error: "Accounts are not switched on yet." };
  await flush();
  const result = await owned(() => sb.rpc("leave_team", { t: teamId }));
  if (result.ok) return switchWorkspace(PERSONAL);
  return result;
}

export async function deleteTeam(teamId: string): Promise<AuthResult> {
  const sb = getClient();
  if (!sb) return { ok: false, error: "Accounts are not switched on yet." };
  clearTimeout(timer);
  const result = await owned(() => sb.rpc("delete_team", { t: teamId }));
  if (result.ok) return switchWorkspace(PERSONAL);
  return result;
}

export function dismissNotice() {
  useCloud.setState({ notice: "" });
}

/* ---------------------------------------------------------------- */
/* Weekly email preferences and account deletion                      */
/* ---------------------------------------------------------------- */

export type WeeklyPrefs = { weekly: boolean; weekday: number };

export async function loadPrefs(): Promise<WeeklyPrefs> {
  const sb = getClient();
  const user = useCloud.getState().user;
  if (!sb || !user) return { weekly: false, weekday: 1 };
  const { data } = await sb.from("kindling_prefs").select("weekly_email, weekday").eq("user_id", user.id).maybeSingle();
  const row = data as { weekly_email?: boolean; weekday?: number } | null;
  return { weekly: Boolean(row?.weekly_email), weekday: typeof row?.weekday === "number" ? row.weekday : 1 };
}

/** Turning it on records when and that the person agreed. Turning it off is just as easy. */
export async function savePrefs(prefs: WeeklyPrefs): Promise<AuthResult> {
  const sb = getClient();
  const user = useCloud.getState().user;
  if (!sb || !user) return { ok: false, error: "Sign in first." };
  const now = new Date().toISOString();
  const { error } = await sb.from("kindling_prefs").upsert(
    {
      user_id: user.id,
      email: user.email,
      weekly_email: prefs.weekly,
      weekday: prefs.weekday,
      ...(prefs.weekly ? { consented_at: now } : {}),
      updated_at: now,
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, error: "Could not save that. Try again." };
  return { ok: true };
}

export async function accessToken(): Promise<string> {
  const sb = getClient();
  if (!sb) return "";
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? "";
}

/** After the server has deleted the account, clear this browser too. */
export async function afterAccountDeleted() {
  const sb = getClient();
  clearTimeout(timer);
  syncedUser = null;
  knownVersion = 0;
  lastJson = "";
  try {
    await sb?.auth.signOut();
  } catch {
    // the account is already gone, so a failed sign-out call changes nothing
  }
  useKindling.getState().reset();
  useCloud.setState({ user: null, workspace: PERSONAL, teams: [], status: "idle", conflict: null, message: "" });
}

/* ---------------------------------------------------------------- */
/* Optional training data layer                                       */
/* ---------------------------------------------------------------- */

export async function loadTraining(): Promise<{ consented: boolean; count: number; loaded: boolean }> {
  const sb = getClient();
  const user = useCloud.getState().user;
  if (!sb || !user) return { consented: false, count: 0, loaded: false };
  const consent = await sb.from("kindling_training_consent").select("consented").eq("user_id", user.id).maybeSingle();
  const consented = Boolean((consent.data as { consented?: boolean } | null)?.consented);
  const rows = await sb.from("kindling_training_examples").select("id", { count: "exact", head: true });
  const training = { consented, count: rows.count ?? 0, loaded: true };
  useCloud.setState({ training });
  return training;
}

/** Turning it off deletes everything shared. The database does this too, so it cannot be skipped. */
export async function setTrainingConsent(on: boolean): Promise<AuthResult> {
  const sb = getClient();
  const user = useCloud.getState().user;
  if (!sb || !user) return { ok: false, error: "Sign in first." };
  const now = new Date().toISOString();
  const { error } = await sb.from("kindling_training_consent").upsert(
    { user_id: user.id, consented: on, ...(on ? { consented_at: now } : {}), policy_version: 1, updated_at: now },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, error: "Could not save that. Try again." };
  await loadTraining();
  return { ok: true, note: on ? undefined : "Switched off. Everything you shared has been deleted." };
}

export async function shareExample(row: Record<string, unknown>): Promise<AuthResult> {
  const sb = getClient();
  const user = useCloud.getState().user;
  if (!sb || !user) return { ok: false, error: "Sign in first." };
  const { error } = await sb.from("kindling_training_examples").insert({ ...row, user_id: user.id });
  if (error) {
    return { ok: false, error: error.code === "42501" ? "Switch on sharing in your account first, or you have reached the limit of 200." : "Could not share that. Try again." };
  }
  await loadTraining();
  return { ok: true };
}

export async function deleteContributions(): Promise<AuthResult> {
  const sb = getClient();
  const user = useCloud.getState().user;
  if (!sb || !user) return { ok: false, error: "Sign in first." };
  const { error } = await sb.from("kindling_training_examples").delete().eq("user_id", user.id);
  if (error) return { ok: false, error: "Could not delete them. Try again." };
  await loadTraining();
  return { ok: true, note: "Everything you shared has been deleted." };
}


/* ---------------------------------------------------------------- */
/* Password reset                                                     */
/* ---------------------------------------------------------------- */

/** Always reports success, so the page never reveals which addresses have accounts. */
export async function sendPasswordReset(email: string, captchaToken?: string): Promise<AuthResult> {
  const sb = getClient();
  if (!sb) return { ok: false, error: "Accounts are not switched on yet." };
  const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
    ...(captchaToken ? { captchaToken } : {}),
  });
  if (error && /captcha|rate|too many/i.test(error.message)) return { ok: false, error: friendly(error.message) };
  return { ok: true, note: "If that address has an account, a reset link is on its way. It works once and expires soon." };
}

export async function setNewPassword(password: string): Promise<AuthResult> {
  const sb = getClient();
  if (!sb) return { ok: false, error: "Accounts are not switched on yet." };
  if (password.length < 8) return { ok: false, error: "Use a password of at least 8 characters." };
  const { error } = await sb.auth.updateUser({ password });
  if (error) {
    const m = error.message.toLowerCase();
    const code = String((error as { code?: string }).code ?? "");
    if (code === "same_password" || m.includes("different from the old password") || m.includes("same"))
      return { ok: false, error: "Choose a password you have not used for this account before." };
    if (code === "weak_password" || m.includes("weak") || m.includes("pwned") || m.includes("easy to guess"))
      return { ok: false, error: "That password is too easy to guess. Choose a longer or less common one." };
    if (m.includes("session") || m.includes("jwt") || m.includes("expired")) return { ok: false, error: "This reset link has expired. Ask for a new one." };
    return { ok: false, error: "Could not change the password. Try again, or ask for a new link." };
  }
  useCloud.setState({ recovery: false });
  return { ok: true, note: "Your password is changed." };
}

export function endRecovery() {
  useCloud.setState({ recovery: false });
}
