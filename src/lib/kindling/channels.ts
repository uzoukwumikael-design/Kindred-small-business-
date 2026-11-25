/** Where a message will be sent, how it should be shaped, and how to hand it to the right app safely. */

export type ChannelId = "whatsapp" | "text" | "email" | "dm";

export const CHANNELS: { id: ChannelId; label: string; rules: string }[] = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    rules:
      "A WhatsApp message. Two to five short lines, conversational, one idea per line. No subject line, no formal sign-off, no markdown or asterisks. Emoji only if the voice allows.",
  },
  {
    id: "text",
    label: "Text (SMS)",
    rules:
      "An SMS text. Under about 300 characters, plain words, one short paragraph. No subject line, no links unless the note gives one.",
  },
  {
    id: "email",
    label: "Email",
    rules:
      "An email. Start with a first line that reads 'Subject: ' and a short subject, then a blank line, a short greeting, short paragraphs, and a plain sign-off with the business name.",
  },
  {
    id: "dm",
    label: "Instagram or Facebook DM",
    rules:
      "A direct message on Instagram or Facebook. One to three very short lines, casual, no subject line and no formal greeting or sign-off.",
  },
];

export function channelRules(id: ChannelId | undefined): string {
  return (CHANNELS.find((item) => item.id === id) ?? CHANNELS[0]).rules;
}

export function channelLabel(id: ChannelId | undefined): string {
  return (CHANNELS.find((item) => item.id === id) ?? CHANNELS[0]).label;
}

export function isChannel(value: unknown): value is ChannelId {
  return CHANNELS.some((item) => item.id === value);
}

/** Only jobs that produce a message to one customer use a channel. Posts, lists and ads do not. */
const MESSAGE_PAINS = new Set(["replies", "schedule", "money", "quotes", "reviews"]);

export function usesChannel(pain: string): boolean {
  return MESSAGE_PAINS.has(pain);
}

/** Every unresolved [CHECK: ...] marker left in a draft. */
export function findChecks(text: string): string[] {
  return text.match(/\[CHECK[^\]]*\]/gi) ?? [];
}

export function splitEmail(text: string): { subject: string; body: string } {
  const match = text.match(/^\s*subject:\s*(.*)\n?/i);
  if (!match) return { subject: "", body: text.trim() };
  return { subject: match[1].trim(), body: text.slice(match[0].length).trim() };
}

export type SendTarget = { href: string | null; label: string; tooLong: boolean };

const WHATSAPP_SAFE_LENGTH = 1800;

/** The link that opens the right app with the message filled in. A DM has no such link, so it is copy only. */
export function sendTarget(channel: ChannelId | undefined, text: string): SendTarget {
  const body = text.trim();
  switch (channel) {
    case "text":
      return { href: `sms:?&body=${encodeURIComponent(body)}`, label: "Open in Messages", tooLong: false };
    case "email": {
      const { subject, body: rest } = splitEmail(body);
      return {
        href: `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(rest)}`,
        label: "Open in email",
        tooLong: false,
      };
    }
    case "dm":
      return { href: null, label: "Copy for your DM", tooLong: false };
    default:
      return {
        href: `https://wa.me/?text=${encodeURIComponent(body)}`,
        label: "Open in WhatsApp",
        tooLong: body.length > WHATSAPP_SAFE_LENGTH,
      };
  }
}
