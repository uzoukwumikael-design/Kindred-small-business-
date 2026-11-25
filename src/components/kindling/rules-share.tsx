import { Link } from "@tanstack/react-router";
import { Link2, Printer } from "lucide-react";
import { useState } from "react";
import { encodeRules } from "@/lib/kindling/share";
import { secondaryClass } from "@/components/kindling/shell";

export function RulesShare({ rules, name, job }: { rules: string; name: string; job: string }) {
  const [copied, setCopied] = useState(false);
  const d = encodeRules({ name, job, rules });

  async function copyLink() {
    try {
      const url = `${window.location.origin}/rules?d=${d}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-5 flex flex-wrap gap-3 print:hidden">
      <button type="button" className={secondaryClass} onClick={() => void copyLink()}>
        <Link2 className="size-4" aria-hidden="true" />
        {copied ? "Link copied" : "Copy a link for the crew"}
      </button>
      <Link to="/rules" search={{ d }} className={secondaryClass}>
        <Printer className="size-4" aria-hidden="true" />
        Open the printable page
      </Link>
    </div>
  );
}
