/**
 * Generates the seed training set for the need model, deterministically (same seed, same file).
 *   npx tsx scripts/generate-seed.mts
 * Writes data/seed/needs.jsonl. Every example is tagged with the template "family" it came from, and whole
 * families are held out for validation, so validation measures new phrasings, not memorised ones.
 * This is synthetic data written by hand-made templates. It gets the model started. Real, consented customer
 * messages from the data layer should replace most of it over time (see docs/TRAINING.md).
 */
import fs from "node:fs";
import { rng } from "../src/lib/kindling/needs/train";

type Family = { need: string; intent: "reply" | "schedule" | "quote"; text: string; pidgin?: boolean };

const F: Family[] = [];
const add = (need: string, intent: Family["intent"], list: string[], pidgin = false) => list.forEach((text) => F.push({ need, intent, text, pidgin }));

add("hours", "reply", [
  "what time do you open", "are you open on {day}", "what time do you close today", "do you open on sundays", "till what time are you open",
  "when are you open this week", "what are your opening hours", "are you still open", "is the shop open now", "what time can I come in on {day}",
  "do you work on public holidays", "at what time do you start", "how late are you open", "do you close for lunch",
]);
add("hours", "reply", ["una dey open {day}?", "wetin be your closing time", "which time una dey open", "una go open tomorrow?", "una don close?", "which time una dey close"], true);
add("location", "reply", [
  "where are you located", "what is your address", "how do I get to your shop", "can you send me your location", "where exactly is your place",
  "which street are you on", "is it close to {landmark}", "please drop your address", "send the pin", "what is the nearest landmark to you",
  "are you inside {landmark}", "i am coming from {area}, how do i find you",
]);
add("location", "reply", ["where una dey", "abeg where be your shop", "which side una dey", "wetin be your address", "drop location abeg", "how I go reach una place"], true);
add("payment", "reply", [
  "how do I pay", "can I pay by transfer", "do you accept card", "send me your account number", "do you have a payment link", "can I pay on delivery",
  "can I pay cash when I come", "do you take POS", "I want to make payment", "can I pay part now and the rest later", "which bank should I send to",
  "do you accept online payment",
]);
add("payment", "reply", ["how I go take pay", "abeg send account", "I wan pay, where I go send money", "una dey take transfer?", "I fit pay when I reach?", "una get POS?"], true);
add("delivery", "reply", [
  "do you deliver", "how much is delivery to {area}", "how long will delivery take", "can I pick it up myself", "do you ship outside the city",
  "when will my order arrive", "do you do same day delivery", "is there a pickup option", "do you deliver to {area}", "how many days for delivery",
  "can someone bring it to my house",
]);
add("delivery", "reply", ["una dey deliver?", "una fit bring am come my house", "how long e go take reach me", "I go come pick am", "una dey send to {area}?"], true);
add("prices", "reply", [
  "how much is {product}", "what is the price of {product}", "what do you charge for {product}", "how much for {product}", "can you send your price list",
  "what are your rates", "is {product} expensive", "what's the cost of {product}", "do you have anything cheaper than {product}", "price of {product} please",
  "how much do you sell {product}", "what is the least you can do for {product}",
]);
add("prices", "reply", ["how much be {product}", "abeg wetin be the price", "how much una dey sell {product}", "make you tell me the price", "e cost well?", "{product} how much"], true);
add("prices", "quote", [
  "can you give me a quote for {job}", "how much would it cost to do {job}", "I need an estimate for {job}", "what would you charge for {job}",
  "can you tell me the price for {job}", "how much do you charge for {job}", "i want a price for {job}",
]);
add("prices", "quote", ["how much e go cost make you do {job}", "abeg how much for {job}"], true);
add("booking", "schedule", [
  "I want to book {service}", "do you have space on {day}", "can I move my appointment to {day}", "I need to cancel my booking", "is there any slot this week",
  "how much is the deposit", "can I reschedule", "i'd like to make an appointment", "what time is my appointment", "are you free on {day}",
  "can I come in on {day} for {service}", "please book me for {service} on {day}", "i can't make it on {day}, can we change it",
]);
add("booking", "schedule", ["I wan book for {day}", "una get space {day}?", "abeg I no fit come again, I wan change the day", "I wan cancel am", "I wan make appointment"], true);
add("returns", "reply", [
  "can I return this", "I want a refund", "what is your return policy", "this item is damaged, what can you do", "I received the wrong item",
  "can I exchange it for another size", "it does not fit, can I swap it", "do you give money back", "i am not happy with it, i want my money back",
  "what happens if i don't like it", "the product is faulty",
]);
add("returns", "reply", ["I wan return am", "abeg refund me", "dem send me wrong thing", "e no fit, make I change am", "una go give me my money back?"], true);
add("contact", "reply", [
  "can I call you", "what is your phone number", "is there a number I can whatsapp", "who can I speak to about my order", "do you have an email address",
  "can someone call me back", "how do I reach the owner", "please send your number", "is this your only number", "who do i talk to about a complaint",
]);
add("contact", "reply", ["abeg drop your number", "make I call you?", "who I go talk to?", "which number I fit call"], true);
add("none", "reply", [
  "thank you so much, I love it", "good morning", "hello", "great job on the last one", "ok noted", "i will tell my friends about you", "thanks, see you then",
  "just checking in", "have a blessed day", "that was lovely", "how are you today", "i got it, thanks", "noted, will do", "happy new month",
]);
add("none", "reply", [
  "thank you so much", "thanks so much", "thank you very much", "thanks a lot", "much appreciated", "i really appreciate it", "God bless you", "you are the best",
  "see you soon", "okay thanks", "alright", "good evening", "good night", "received, thanks", "i'm on my way", "i love it so much", "that is so kind of you",
  "very nice, thank you so much", "it was great, many thanks", "no problem", "sure, that works", "perfect, thank you", "wonderful, see you", "i'm happy with it",
  "ok i will wait", "got it", "thank you for your help", "thanks for the quick reply", "i am grateful", "have a nice weekend",
]);
add("none", "reply", [
  "thank you o", "I don receive am, thank you", "e sweet me well well", "ok na", "how far", "I dey come", "thank you well well", "God bless you o", "I don see am",
  "e don reach me", "no wahala", "I dey hear you", "una try well well", "thank you sir",
], true);

const SLOTS = {
  day: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "tomorrow", "this weekend", "friday evening", "next week"],
  product: ["knotless braids", "the blue ankara", "a 3 tier cake", "size 42 sneakers", "a plain wig", "an oil change", "bridal makeup", "the jollof tray", "school uniform", "a bag of rice", "the black dress", "a full set"],
  service: ["a wash and style", "a haircut", "a fitting", "a table for 6", "a car service", "a massage", "a pedicure", "a consultation"],
  area: ["Lekki", "Rumuola", "Garki", "Ikeja", "town", "the island", "Wuse", "GRA", "Ajah"],
  landmark: ["the market", "the main road", "Shoprite", "the church", "the bus stop", "the filling station"],
  job: ["fixing a leaking pipe", "painting two rooms", "building a wardrobe", "installing a ceiling fan", "tiling a small kitchen", "repairing a generator"],
};
const NAMES = ["Maria", "Tola", "Ada", "Sam", "Bola", "Kemi", "Chidi", "Fatima", "Emeka", "Ngozi", "Yusuf", "Amaka"];
const PREFIX = ["", "", "", "hi, ", "hello, ", "good morning, ", "good afternoon ma, ", "hello good evening, ", "pls ", "please ", "quick question, ", "hi it's {name}, ", "hey, ", "sorry to disturb, "];
const PREFIX_P = ["", "", "abeg ", "oga ", "good afternoon ma, ", "hello, ", "pls ", "how far, "];
const SUFFIX = ["", "", "", "?", " thanks", " pls", " please", " ma", " sir", " thank you", " asap"];
const SUFFIX_P = ["", "", " abeg", " o", " na", " ma", " pls"];

const random = rng(20261014);
const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)];
const fill = (text: string) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => (key === "name" ? pick(NAMES) : pick((SLOTS as Record<string, string[]>)[key] ?? [key])));

function noise(text: string): string {
  let t = text;
  const r = random();
  if (r < 0.15) {
    const words = t.split(" ");
    const i = Math.floor(random() * words.length);
    const w = words[i];
    if (w.length > 4) words[i] = w.slice(0, 2) + w[3] + w[2] + w.slice(4); // swap two letters
    t = words.join(" ");
  } else if (r < 0.28) {
    t = t.replace(/\byou\b/g, "u").replace(/\bplease\b/g, "pls").replace(/\bare\b/g, "r").replace(/\byour\b/g, "ur");
  } else if (r < 0.38) {
    t = t.replace(/[?.,!']/g, "");
  }
  const c = random();
  if (c < 0.2) t = t.charAt(0).toUpperCase() + t.slice(1);
  else if (c < 0.27) t = t.toUpperCase();
  return t.trim();
}

function realise(f: Family): string {
  const base = fill(f.text);
  const text = (f.pidgin ? pick(PREFIX_P) : fill(pick(PREFIX))) + base + (f.pidgin ? pick(SUFFIX_P) : pick(SUFFIX));
  return noise(text.replace(/\?\s*\?/g, "?"));
}

// hold out whole families
const famId = (f: Family, i: number) => `${f.need}-${i}`;
const val = new Set<number>();
const byNeed = new Map<string, number[]>();
F.forEach((f, i) => byNeed.set(f.need, [...(byNeed.get(f.need) ?? []), i]));
for (const [, idxs] of byNeed) {
  const n = Math.max(2, Math.round(idxs.length * 0.2));
  const shuffled = idxs.slice().sort(() => random() - 0.5);
  shuffled.slice(0, n).forEach((i) => val.add(i));
}

type Row = { text: string; needs: string[]; intent: string; family: string; split: "train" | "val"; language: string };
const rows: Row[] = [];
F.forEach((f, i) => {
  const reps = f.pidgin ? 9 : 12;
  for (let k = 0; k < reps; k += 1) {
    rows.push({ text: realise(f), needs: f.need === "none" ? [] : [f.need], intent: f.intent, family: famId(f, i), split: val.has(i) ? "val" : "train", language: f.pidgin ? "pidgin" : "english" });
  }
});

// two-question messages
const real = F.map((f, i) => ({ f, i })).filter(({ f }) => f.need !== "none");
for (let k = 0; k < 420; k += 1) {
  const a = pick(real);
  let b = pick(real);
  let guard = 0;
  while ((b.f.need === a.f.need || b.f.pidgin !== a.f.pidgin) && guard++ < 50) b = pick(real);
  if (b.f.need === a.f.need) continue;
  const joiner = pick(a.f.pidgin ? [" and ", ". ", ", "] : [" and ", ". Also, ", ", and ", ". "]);
  const text = noise(fill(a.f.text) + joiner + fill(b.f.text) + (a.f.pidgin ? pick(SUFFIX_P) : pick(SUFFIX)));
  const isVal = val.has(a.i) || val.has(b.i);
  rows.push({ text, needs: [a.f.need, b.f.need], intent: a.f.intent, family: `${famId(a.f, a.i)}+${famId(b.f, b.i)}`, split: isVal ? "val" : "train", language: a.f.pidgin ? "pidgin" : "english" });
}

fs.mkdirSync("data/seed", { recursive: true });
fs.writeFileSync("data/seed/needs.jsonl", rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
const train = rows.filter((r) => r.split === "train").length;
console.log(`wrote data/seed/needs.jsonl: ${rows.length} examples (${train} train, ${rows.length - train} validation) from ${F.length} template families`);
