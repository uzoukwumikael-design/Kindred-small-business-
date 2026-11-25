import { featuresOf } from "@/lib/kindling/needs/features";
import { needsAbove, predict, type Head, type NeedModel, type Vector, vectorize } from "@/lib/kindling/needs/model";

export type Example = { text: string; needs: string[]; intent: string };

export type TrainOptions = {
  seed?: number;
  epochs?: number;
  lr?: number;
  l2?: number;
  minDf?: number;
  maxFeatures?: number;
  prune?: number;
  needs: string[];
  intents: string[];
  /** Held-out examples used only to choose each need's reporting threshold. */
  validation?: Example[];
};

/** A small deterministic random generator, so the same data and seed always give the same model. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], random: () => number): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export function trainNeedModel(examples: Example[], options: TrainOptions): NeedModel {
  const seed = options.seed ?? 7;
  const epochs = options.epochs ?? 25;
  const lr0 = options.lr ?? 0.6;
  const l2 = options.l2 ?? 1e-5;
  const minDf = options.minDf ?? 2;
  const maxFeatures = options.maxFeatures ?? 4000;
  const prune = options.prune ?? 0.03;
  const random = rng(seed);

  // 1. vocabulary and idf
  const df = new Map<string, number>();
  for (const ex of examples) for (const f of new Set(featuresOf(ex.text))) df.set(f, (df.get(f) ?? 0) + 1);
  const kept = [...df].filter(([, n]) => n >= minDf).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, maxFeatures);
  const features = kept.map(([f]) => f);
  const N = examples.length;
  const idf = kept.map(([, n]) => Math.log((N + 1) / (n + 1)) + 1);
  const skeleton: NeedModel = {
    version: 1,
    trainedAt: "",
    seed,
    examples: N,
    needs: options.needs,
    intents: options.intents,
    features,
    idf,
    needHeads: {},
    intentHeads: {},
    thresholds: {},
  };

  // 2. vectors
  const vectors: Vector[] = examples.map((ex) => vectorize(skeleton, ex.text));
  const dim = features.length;

  // 3. one logistic regression per need
  const needHeads: Record<string, Head> = {};
  for (const key of options.needs) {
    const y: number[] = examples.map((ex) => (ex.needs.includes(key) ? 1 : 0));
    const pos = y.reduce((a, b) => a + b, 0);
    const neg = N - pos;
    const posWeight = pos === 0 ? 1 : Math.min(6, Math.max(1, neg / pos));
    const w = new Float64Array(dim);
    let b = 0;
    const order = examples.map((_, i) => i);
    for (let epoch = 0; epoch < epochs; epoch += 1) {
      const lr = lr0 / (1 + epoch * 0.15);
      for (const i of shuffle(order, random)) {
        const v = vectors[i];
        let z = b;
        for (let k = 0; k < v.idx.length; k += 1) z += w[v.idx[k]] * v.val[k];
        const err = (sigmoid(z) - y[i]) * (y[i] === 1 ? posWeight : 1);
        b -= lr * err;
        for (let k = 0; k < v.idx.length; k += 1) {
          const j = v.idx[k];
          w[j] -= lr * (err * v.val[k] + l2 * w[j]);
        }
      }
    }
    needHeads[key] = sparse(w, b, prune);
  }

  // 4. one softmax head per intent
  const intentHeads: Record<string, Head> = {};
  const K = options.intents.length;
  const iw = options.intents.map(() => new Float64Array(dim));
  const ib = new Float64Array(K);
  const yi = examples.map((ex) => Math.max(0, options.intents.indexOf(ex.intent)));
  const order = examples.map((_, i) => i);
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const lr = lr0 / (1 + epoch * 0.15);
    for (const i of shuffle(order, random)) {
      const v = vectors[i];
      const z = options.intents.map((_, c) => {
        let s = ib[c];
        for (let k = 0; k < v.idx.length; k += 1) s += iw[c][v.idx[k]] * v.val[k];
        return s;
      });
      const max = Math.max(...z);
      const e = z.map((s) => Math.exp(s - max));
      const total = e.reduce((a, c) => a + c, 0);
      for (let c = 0; c < K; c += 1) {
        const err = e[c] / total - (c === yi[i] ? 1 : 0);
        ib[c] -= lr * err;
        for (let k = 0; k < v.idx.length; k += 1) {
          const j = v.idx[k];
          iw[c][j] -= lr * (err * v.val[k] + l2 * iw[c][j]);
        }
      }
    }
  }
  options.intents.forEach((key, c) => {
    intentHeads[key] = sparse(iw[c], ib[c], prune);
  });

  const model: NeedModel = { ...skeleton, trainedAt: new Date().toISOString(), needHeads, intentHeads };

  // 5. thresholds: the cut-off that gives the best F1 on held-out data (0.5 when there is none)
  for (const key of options.needs) model.thresholds[key] = 0.5;
  if (options.validation && options.validation.length > 0) {
    for (const key of options.needs) {
      const scored = options.validation.map((ex) => ({
        p: predict(model, ex.text).needs.find((n) => n.key === key)?.p ?? 0,
        y: ex.needs.includes(key),
      }));
      if (!scored.some((s) => s.y)) continue;
      let best = { t: 0.5, f1: -1 };
      for (let t = 0.2; t <= 0.8; t += 0.05) {
        const tp = scored.filter((s) => s.p >= t && s.y).length;
        const fp = scored.filter((s) => s.p >= t && !s.y).length;
        const fn = scored.filter((s) => s.p < t && s.y).length;
        const f1 = tp === 0 ? 0 : (2 * tp) / (2 * tp + fp + fn);
        if (f1 > best.f1 + 1e-9) best = { t: Math.round(t * 100) / 100, f1 };
      }
      model.thresholds[key] = best.t;
    }
  }
  return model;
}

function sparse(weights: Float64Array, bias: number, prune: number): Head {
  const w: Record<string, number> = {};
  for (let i = 0; i < weights.length; i += 1) if (Math.abs(weights[i]) >= prune) w[i] = Math.round(weights[i] * 1000) / 1000;
  return { b: Math.round(bias * 1000) / 1000, w };
}

/* ------------------------------------------------------------------ */
/* Evaluation                                                          */
/* ------------------------------------------------------------------ */

export type Metrics = {
  n: number;
  microF1: number;
  exactMatch: number;
  intentAccuracy: number;
  perNeed: Record<string, { precision: number; recall: number; f1: number; support: number }>;
};

export function score(predictor: (text: string) => { needs: string[]; intent?: string }, examples: Example[], needs: string[]): Metrics {
  const tp: Record<string, number> = {};
  const fp: Record<string, number> = {};
  const fn: Record<string, number> = {};
  const support: Record<string, number> = {};
  for (const key of needs) [tp[key], fp[key], fn[key], support[key]] = [0, 0, 0, 0];
  let exact = 0;
  let intentRight = 0;
  let intentTotal = 0;
  for (const ex of examples) {
    const got = predictor(ex.text);
    const gotSet = new Set(got.needs);
    const wantSet = new Set(ex.needs);
    for (const key of needs) {
      if (wantSet.has(key)) support[key] += 1;
      if (gotSet.has(key) && wantSet.has(key)) tp[key] += 1;
      else if (gotSet.has(key)) fp[key] += 1;
      else if (wantSet.has(key)) fn[key] += 1;
    }
    if (gotSet.size === wantSet.size && [...wantSet].every((k) => gotSet.has(k))) exact += 1;
    if (got.intent !== undefined) {
      intentTotal += 1;
      if (got.intent === ex.intent) intentRight += 1;
    }
  }
  const perNeed: Metrics["perNeed"] = {};
  let TP = 0;
  let FP = 0;
  let FN = 0;
  for (const key of needs) {
    const p = tp[key] + fp[key] === 0 ? 0 : tp[key] / (tp[key] + fp[key]);
    const r = tp[key] + fn[key] === 0 ? 0 : tp[key] / (tp[key] + fn[key]);
    perNeed[key] = { precision: p, recall: r, f1: p + r === 0 ? 0 : (2 * p * r) / (p + r), support: support[key] };
    TP += tp[key];
    FP += fp[key];
    FN += fn[key];
  }
  const microF1 = TP === 0 ? 0 : (2 * TP) / (2 * TP + FP + FN);
  return {
    n: examples.length,
    microF1,
    exactMatch: examples.length ? exact / examples.length : 0,
    intentAccuracy: intentTotal ? intentRight / intentTotal : 0,
    perNeed,
  };
}

export function modelPredictor(model: NeedModel) {
  return (text: string) => {
    const prediction = predict(model, text);
    return { needs: needsAbove(model, prediction).map((n) => n.key), intent: prediction.intent[0].key };
  };
}
