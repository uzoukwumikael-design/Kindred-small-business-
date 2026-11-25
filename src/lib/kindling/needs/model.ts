import { featuresOf } from "@/lib/kindling/needs/features";

/** A small linear model: sparse weights, so the whole file stays a few tens of kilobytes. */
export type Head = { b: number; w: Record<string, number> };

export type NeedModel = {
  version: number;
  trainedAt: string;
  seed: number;
  examples: number;
  needs: string[];
  intents: string[];
  features: string[];
  idf: number[];
  needHeads: Record<string, Head>;
  intentHeads: Record<string, Head>;
  /** Per-need probability above which the need is reported. Tuned on validation data. */
  thresholds: Record<string, number>;
  notes?: string;
};

export type Vector = { idx: number[]; val: number[] };

const indexCache = new WeakMap<NeedModel, Map<string, number>>();

function indexOf(model: NeedModel): Map<string, number> {
  let map = indexCache.get(model);
  if (!map) {
    map = new Map(model.features.map((feature, i) => [feature, i]));
    indexCache.set(model, map);
  }
  return map;
}

/** Sub-linear term frequency times idf, then length-normalised. */
export function vectorize(model: NeedModel, text: string): Vector {
  const counts = new Map<number, number>();
  const index = indexOf(model);
  for (const feature of featuresOf(text)) {
    const i = index.get(feature);
    if (i !== undefined) counts.set(i, (counts.get(i) ?? 0) + 1);
  }
  const idx: number[] = [];
  const val: number[] = [];
  let norm = 0;
  for (const [i, count] of counts) {
    const v = (1 + Math.log(count)) * model.idf[i];
    idx.push(i);
    val.push(v);
    norm += v * v;
  }
  norm = Math.sqrt(norm) || 1;
  return { idx, val: val.map((v) => v / norm) };
}

function score(head: Head, vector: Vector): number {
  let sum = head.b;
  for (let k = 0; k < vector.idx.length; k += 1) {
    const w = head.w[vector.idx[k]];
    if (w !== undefined) sum += w * vector.val[k];
  }
  return sum;
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export type Prediction = {
  needs: { key: string; p: number }[];
  intent: { key: string; p: number }[];
};

export function predict(model: NeedModel, text: string): Prediction {
  const vector = vectorize(model, text);
  const needs = model.needs
    .map((key) => ({ key, p: sigmoid(score(model.needHeads[key], vector)) }))
    .sort((a, b) => b.p - a.p);
  const raw = model.intents.map((key) => score(model.intentHeads[key], vector));
  const max = Math.max(...raw);
  const exps = raw.map((v) => Math.exp(v - max));
  const total = exps.reduce((a, b) => a + b, 0);
  const intent = model.intents.map((key, i) => ({ key, p: exps[i] / total })).sort((a, b) => b.p - a.p);
  return { needs, intent };
}

/** The needs the model is confident about, strongest first. */
export function needsAbove(model: NeedModel, prediction: Prediction): { key: string; p: number }[] {
  return prediction.needs.filter((item) => item.p >= (model.thresholds[item.key] ?? 0.5));
}
