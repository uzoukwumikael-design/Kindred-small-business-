import { FAQ } from "@/lib/kindling/seo";

export function FaqList() {
  return (
    <div className="mt-6 grid gap-3">
      {FAQ.map((item) => (
        <details key={item.question} className="group rounded-xl border border-line bg-surface p-5">
          <summary className="cursor-pointer list-none font-display text-xl font-medium text-ink">{item.question}</summary>
          <p className="mt-3 text-base leading-relaxed text-muted">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
