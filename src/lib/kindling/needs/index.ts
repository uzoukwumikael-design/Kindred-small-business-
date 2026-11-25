import raw from "@/lib/kindling/needs/need-model.json";
import { needsAbove, predict, type NeedModel } from "@/lib/kindling/needs/model";
import { regexNeeds } from "@/lib/kindling/needs/regex";

const model = raw as unknown as NeedModel;

export type Analysis = {
  /** Shop facts the message seems to need, most likely first. */
  needs: { key: string; p: number }[];
  /** What kind of job the message is. */
  intent: "reply" | "schedule" | "quote";
  source: "model" | "rules" | "none";
};

export function modelReady(): boolean {
  return model.features.length > 0;
}

/**
 * Reads a customer message. The trained model goes first. If it finds nothing, the older keyword rules get a
 * turn, because they are cheap and sometimes catch what a small model misses.
 */
export function analyze(text: string): Analysis {
  const clean = text.trim().slice(0, 1500);
  if (!clean) return { needs: [], intent: "reply", source: "none" };
  if (modelReady()) {
    const prediction = predict(model, clean);
    const intent = (prediction.intent[0]?.key ?? "reply") as Analysis["intent"];
    const found = needsAbove(model, prediction);
    if (found.length > 0) return { needs: found, intent, source: "model" };
    const rules = regexNeeds(clean);
    if (rules.length > 0) return { needs: rules.map((key) => ({ key, p: 0.5 })), intent, source: "rules" };
    return { needs: [], intent, source: "none" };
  }
  const rules = regexNeeds(clean);
  return { needs: rules.map((key) => ({ key, p: 0.5 })), intent: "reply", source: rules.length ? "rules" : "none" };
}

export function modelInfo(): { trained: boolean; trainedAt: string; examples: number; notes: string } {
  return { trained: modelReady(), trainedAt: model.trainedAt, examples: model.examples, notes: model.notes ?? "" };
}
