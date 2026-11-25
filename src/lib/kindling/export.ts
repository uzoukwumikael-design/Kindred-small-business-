import { snapshotOf } from "@/lib/kindling/cloud";
import { useKindling } from "@/lib/kindling/store";

/** Downloads everything Kindling holds for this browser as a JSON file. */
export function downloadMyData() {
  const data = {
    exportedAt: new Date().toISOString(),
    note: "Everything Kindling saved in this browser. Drafts you did not copy are included.",
    ...snapshotOf(useKindling.getState()),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "kindling-my-data.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
