import {
  byId,
  houseRules,
  laterWorkflows,
  MATURITY,
  PAINS,
  promptFor,
  STAGES,
  TEAMS,
  TRADES,
  workflowFor,
  WORRIES,
  WORRY_NOTE,
} from "@/lib/kindling/catalog";
import type { Intake, PainId, Shop } from "@/lib/kindling/types";

export type ResolvedWorkflow = {
  id: string;
  pain: PainId;
  title: string;
  dek: string;
  fit: string;
  setupMinutes: number;
  minutes: number;
  lowMinutes: number;
  highMinutes: number;
  cadence: string;
  measure: string;
  steps: { title: string; body: string }[];
  monday: string[];
  promptTemplate: string;
};

export type Plan = {
  stageName: string;
  stageLine: string;
  worryNote: string;
  tradeLabel: string;
  teamLabel: string;
  painLabel: string;
  maturityLabel: string;
  worryLabel: string;
  primary: ResolvedWorkflow;
  queue: ResolvedWorkflow[];
  rules: string;
};

function resolve(workflowIdPain: Parameters<typeof workflowFor>[0], intake: Intake): ResolvedWorkflow {
  const workflow = workflowFor(workflowIdPain);
  const minutes = workflow.minutesPerWeek[intake.team];
  return {
    id: workflow.id,
    pain: workflow.pain,
    title: workflow.title,
    dek: workflow.dek,
    fit: workflow.fit,
    setupMinutes: workflow.setupMinutes,
    minutes,
    lowMinutes: Math.round(minutes * 0.7),
    highMinutes: Math.round(minutes * 1.25),
    cadence: workflow.cadence,
    measure: workflow.measure,
    steps: workflow.steps,
    monday: workflow.monday,
    promptTemplate: promptFor(workflow, intake.trade),
  };
}

export function buildPlan(intake: Intake, shop: Shop): Plan {
  const primary = resolve(intake.pain, intake);
  return {
    stageName: STAGES[intake.maturity].name,
    stageLine: STAGES[intake.maturity].line,
    worryNote: WORRY_NOTE[intake.worry],
    tradeLabel: byId(TRADES, intake.trade).label,
    teamLabel: byId(TEAMS, intake.team).label,
    painLabel: byId(PAINS, intake.pain).label,
    maturityLabel: byId(MATURITY, intake.maturity).label,
    worryLabel: byId(WORRIES, intake.worry).label,
    primary,
    queue: laterWorkflows(intake.trade, intake.pain).map((item) => resolve(item.pain, intake)),
    rules: houseRules(intake, shop, primary.title),
  };
}

export function monthDollars(minutesPerWeek: number, hourly: number): number {
  const safe = Number.isFinite(hourly) ? hourly : 0;
  return Math.round((minutesPerWeek / 60) * safe * 4.3);
}
