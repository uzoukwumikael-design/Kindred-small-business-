import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { AI_DAILY_CAP, DEFAULT_SHOP, EXAMPLE_INTAKE, EXAMPLE_SHOP } from "@/lib/kindling/catalog";
import { MAX_LEARNED } from "@/lib/kindling/facts";
import { MAX_DELETED } from "@/lib/kindling/merge";
import { localDay } from "@/lib/kindling/summary";
import type { Fact, Intake, Learned, LogEntry, PainId, Shop } from "@/lib/kindling/types";

type Memory = {
  shop: Shop;
  intake: Intake | null;
  checks: Record<string, boolean>;
  aiDay: string;
  aiUses: number;
  sharpened: Record<string, string>;
  drafts: Record<string, string>;
  baselines: Record<string, number>;
  log: LogEntry[];
  facts: Fact[];
  learned: Learned[];
  deleted: string[];
};

type Store = Memory & {
  ready: boolean;
  commit: (intake: Intake, shop: Shop) => void;
  updateVoice: (patch: Pick<Shop, "name" | "offer" | "tone" | "voiceSample" | "channel" | "language">) => void;
  setHourly: (hourly: number) => void;
  swapJob: (pain: PainId) => void;
  toggleCheck: (id: string) => void;
  remember: (bucket: "sharpened" | "drafts", key: string, text: string) => void;
  setBaseline: (workflowId: string, minutes: number) => void;
  addLog: (workflowId: string, minutes: number, day: string, by?: string) => void;
  removeLog: (id: string) => void;
  saveFact: (input: { id?: string; key: string; label: string; value: string }) => void;
  confirmFact: (id: string) => void;
  removeFact: (id: string) => void;
  addLearned: (entry: Omit<Learned, "id">) => void;
  removeLearned: (id: string) => void;
  aiRemaining: () => number;
  markAiUse: () => void;
  loadExample: () => void;
  reset: () => void;
};

const EMPTY: Memory = {
  shop: DEFAULT_SHOP,
  intake: null,
  checks: {},
  aiDay: "",
  aiUses: 0,
  sharpened: {},
  drafts: {},
  baselines: {},
  log: [],
  facts: [],
  learned: [],
  deleted: [],
};

const MAX_LOG = 200;

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function usesToday(memory: Memory): number {
  return memory.aiDay === todayKey() ? memory.aiUses : 0;
}

function forget(deleted: string[], ...ids: string[]): string[] {
  return Array.from(new Set([...deleted, ...ids])).slice(-MAX_DELETED);
}

function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** An in-memory stand-in for browsers that block storage (private modes, strict settings). The app then still works until the tab closes. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => Array.from(data.keys())[index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

function safeStorage(): Storage {
  try {
    const probe = "__kindling_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return memoryStorage();
  }
}

export const useKindling = create<Store>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      ready: false,
      commit: (intake, shop) =>
        set({
          intake,
          shop,
          checks: {},
          sharpened: {},
          drafts: {},
        }),
      updateVoice: (patch) =>
        set((state) => ({
          shop: { ...state.shop, ...patch },
          sharpened: {},
        })),
      setHourly: (hourly) =>
        set((state) => ({
          shop: { ...state.shop, hourly },
        })),
      swapJob: (pain) => set((state) => (state.intake ? { intake: { ...state.intake, pain }, checks: {} } : {})),
      toggleCheck: (id) =>
        set((state) => ({
          checks: { ...state.checks, [id]: !state.checks[id] },
        })),
      remember: (bucket, key, text) =>
        set((state) => ({
          [bucket]: { ...state[bucket], [key]: text },
        })),
      setBaseline: (workflowId, minutes) =>
        set((state) => ({
          baselines: { ...state.baselines, [workflowId]: Math.max(0, Math.min(600, Math.round(minutes))) },
        })),
      addLog: (workflowId, minutes, day, by) =>
        set((state) => ({
          log: [
            ...state.log,
            {
              id: newId(),
              day,
              workflowId,
              minutes: Math.max(0, Math.min(600, Math.round(minutes))),
              ...(by ? { by: by.slice(0, 40) } : {}),
            },
          ].slice(-MAX_LOG),
        })),
      removeLog: (id) => set((state) => ({ log: state.log.filter((entry) => entry.id !== id), deleted: forget(state.deleted, id) })),
      saveFact: ({ id, key, label, value }) =>
        set((state) => {
          const text = value.trim().slice(0, 300);
          const today = localDay();
          const existing = state.facts.find((fact) => (id ? fact.id === id : key !== "custom" && fact.key === key));
          if (existing) {
            if (!text) return { facts: state.facts.filter((fact) => fact.id !== existing.id), deleted: forget(state.deleted, existing.id) };
            return {
              facts: state.facts.map((fact) =>
                fact.id === existing.id ? { ...fact, label: label.slice(0, 40), value: text, checkedOn: today } : fact,
              ),
            };
          }
          if (!text || state.facts.length >= 20) return {};
          return { facts: [...state.facts, { id: newId(), key, label: label.slice(0, 40), value: text, checkedOn: today }] };
        }),
      confirmFact: (id) =>
        set((state) => ({ facts: state.facts.map((fact) => (fact.id === id ? { ...fact, checkedOn: localDay() } : fact)) })),
      removeFact: (id) => set((state) => ({ facts: state.facts.filter((fact) => fact.id !== id), deleted: forget(state.deleted, id) })),
      addLearned: (entry) =>
        set((state) => {
          const text = entry.text.trim().slice(0, 400);
          if (text.length < 8 || state.learned.some((item) => item.text === text)) return {};
          return { learned: [...state.learned, { ...entry, text, id: newId() }].slice(-MAX_LEARNED) };
        }),
      removeLearned: (id) => set((state) => ({ learned: state.learned.filter((item) => item.id !== id), deleted: forget(state.deleted, id) })),
      aiRemaining: () => Math.max(0, AI_DAILY_CAP - usesToday(get())),
      markAiUse: () => {
        const day = todayKey();
        set((state) => ({
          aiDay: day,
          aiUses: state.aiDay === day ? state.aiUses + 1 : 1,
        }));
      },
      loadExample: () =>
        set({
          shop: EXAMPLE_SHOP,
          intake: EXAMPLE_INTAKE,
          checks: {},
          sharpened: {},
          drafts: {},
          baselines: {},
          log: [],
        }),
      reset: () =>
        set({
          ...EMPTY,
          shop: DEFAULT_SHOP,
        }),
    }),
    {
      name: "kindling-bench-v1",
      skipHydration: true,
      storage: createJSONStorage(() => safeStorage()),
      partialize: (state) => ({
        shop: state.shop,
        intake: state.intake,
        checks: state.checks,
        aiDay: state.aiDay,
        aiUses: state.aiUses,
        sharpened: state.sharpened,
        drafts: state.drafts,
        baselines: state.baselines,
        log: state.log,
        facts: state.facts,
        learned: state.learned,
        deleted: state.deleted,
      }),
      // Older saved weeks have no voiceSample, baselines or log: fill the gaps instead of crashing.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<Memory>;
        return {
          ...current,
          ...saved,
          shop: { ...DEFAULT_SHOP, ...(saved.shop ?? {}) },
          baselines: saved.baselines ?? {},
          log: Array.isArray(saved.log) ? saved.log : [],
          facts: Array.isArray(saved.facts) ? saved.facts : [],
          learned: Array.isArray(saved.learned) ? saved.learned : [],
          deleted: Array.isArray(saved.deleted) ? saved.deleted : [],
        };
      },
    },
  ),
);

let hydratePromise: Promise<void> | null = null;

export function ensureHydrated(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (useKindling.getState().ready) return Promise.resolve();
  if (!hydratePromise) {
    hydratePromise = Promise.resolve(useKindling.persist.rehydrate()).then(() => {
      useKindling.setState({ ready: true });
    });
  }
  return hydratePromise;
}
