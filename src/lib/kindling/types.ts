export type TradeId =
  | "cafe"
  | "salon"
  | "retail"
  | "trades"
  | "clinic"
  | "professional"
  | "studio"
  | "local";

export type TeamId = "solo" | "crew" | "shop" | "floor";

export type PainId =
  | "replies"
  | "schedule"
  | "money"
  | "marketing"
  | "quotes"
  | "paperwork"
  | "stock"
  | "hiring"
  | "reviews";

export type MaturityId = "never" | "dabbling" | "shadow" | "one";

export type WorryId = "mistakes" | "privacy" | "cost" | "staff" | "time";

export type ToneId = "warm" | "plain" | "formal";

import type { ChannelId } from "@/lib/kindling/channels";
import type { LanguageId } from "@/lib/kindling/languages";

export type Shop = {
  name: string;
  offer: string;
  tone: ToneId;
  hourly: number;
  voiceSample: string;
  channel: ChannelId;
  language: LanguageId;
};

/** A fact the owner has checked. It is only used in drafts while it is fresh. */
export type Fact = {
  id: string;
  key: string; // a standard key such as "hours", or "custom"
  label: string;
  value: string;
  checkedOn: string; // YYYY-MM-DD
};

/** A message the owner kept as an example of how they write. */
export type Learned = {
  id: string;
  text: string;
  workflowId: string;
  channel: ChannelId;
  day: string;
};

export type LogEntry = {
  id: string;
  day: string;
  workflowId: string;
  minutes: number;
  by?: string;
};

export type Intake = {
  trade: TradeId;
  team: TeamId;
  pain: PainId;
  maturity: MaturityId;
  worry: WorryId;
};

export type Choice<T extends string> = {
  id: T;
  label: string;
  hint: string;
};
