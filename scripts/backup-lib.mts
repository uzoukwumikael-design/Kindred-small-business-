import crypto from "node:crypto";

/** Shared by backup.mts and restore.mts: the tables, the order to restore them in, and encryption. */

export type TableSpec = { name: string; conflict: string };

/** Parents before children, so foreign keys are satisfied when restoring. */
export const TABLES: TableSpec[] = [
  { name: "kindling_state", conflict: "user_id" },
  { name: "kindling_teams", conflict: "id" },
  { name: "kindling_members", conflict: "team_id,user_id" },
  { name: "kindling_prefs", conflict: "user_id" },
  { name: "kindling_training_consent", conflict: "user_id" },
  { name: "kindling_training_examples", conflict: "id" },
  { name: "kindling_event_counts", conflict: "day,event" },
];

export type Backup = { version: 1; createdAt: string; counts: Record<string, number>; tables: Record<string, Record<string, unknown>[]> };

export type Sealed = { sealed: true; kdf: "scrypt"; salt: string; iv: string; tag: string; data: string };

const key = (passphrase: string, salt: Buffer) => crypto.scryptSync(passphrase, salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });

/** AES-256-GCM with a key derived from the passphrase. A wrong passphrase or any change to the file makes decryption fail. */
export function seal(plain: string, passphrase: string): Sealed {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(passphrase, salt), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return { sealed: true, kdf: "scrypt", salt: salt.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}

export function unseal(box: Sealed, passphrase: string): string {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(passphrase, Buffer.from(box.salt, "base64")), Buffer.from(box.iv, "base64"));
  decipher.setAuthTag(Buffer.from(box.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(box.data, "base64")), decipher.final()]).toString("utf8");
}

export function isSealed(value: unknown): value is Sealed {
  return Boolean(value) && typeof value === "object" && (value as Sealed).sealed === true;
}

export function batches<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

export type RestorePlan = { table: string; conflict: string; rows: number; batches: number }[];

export function planRestore(backup: Backup, size = 200): RestorePlan {
  return TABLES.map((t) => {
    const rows = backup.tables[t.name]?.length ?? 0;
    return { table: t.name, conflict: t.conflict, rows, batches: Math.ceil(rows / size) };
  });
}

/** Sends the rows to Supabase, merging by primary key so it can be run twice safely. Returns a count per table and any errors. */
export async function applyRestore(
  backup: Backup,
  url: string,
  serviceKey: string,
  fetcher: typeof fetch = fetch,
  size = 200,
): Promise<{ restored: Record<string, number>; errors: string[] }> {
  const restored: Record<string, number> = {};
  const errors: string[] = [];
  for (const t of TABLES) {
    restored[t.name] = 0;
    for (const chunk of batches(backup.tables[t.name] ?? [], size)) {
      const response = await fetcher(`${url}/rest/v1/${t.name}?on_conflict=${t.conflict}`, {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(chunk),
      });
      if (response.ok) restored[t.name] += chunk.length;
      else errors.push(`${t.name}: HTTP ${response.status}. Rows that point at accounts that no longer exist cannot be restored.`);
    }
  }
  return { restored, errors };
}
