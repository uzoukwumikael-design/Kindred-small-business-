import { Copy } from "lucide-react";
import { track } from "@/lib/kindling/events";
import { useState } from "react";
import {
  createTeam,
  deleteTeam,
  getInviteLink,
  leaveTeam,
  newInviteLink,
  removeMember,
  renameTeam,
  switchWorkspace,
  useCloud,
  type AuthResult,
  type TeamInfo,
} from "@/lib/kindling/cloud";
import { useKindling } from "@/lib/kindling/store";
import { fieldClass, primaryClass, secondaryClass } from "@/components/kindling/shell";

export function CrewPanel() {
  const user = useCloud((state) => state.user);
  const teams = useCloud((state) => state.teams);
  const workspace = useCloud((state) => state.workspace);
  const hasWeek = useKindling((state) => state.intake !== null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(action: () => Promise<AuthResult>) {
    setBusy(true);
    setError("");
    const result = await action();
    setBusy(false);
    if (!result.ok) setError(result.error);
  }

  if (!user) return null;
  const active = workspace.kind === "team" ? teams.find((team) => team.id === workspace.id) : undefined;

  return (
    <section className="mt-12 border-t border-line pt-6">
      <h2 className="font-display text-2xl font-medium text-ink">Your crew</h2>
      <p className="mt-2 max-w-xl text-base leading-relaxed text-muted">
        A crew shares one week. Everyone in it sees the same recipe and prompt, and everyone logs their own minutes.
        Anyone in the crew can edit the week. Only the person who made it can invite, remove people or delete it.
      </p>

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Which week to work on">
        <button
          type="button"
          aria-pressed={workspace.kind === "personal"}
          disabled={busy}
          onClick={() => void run(() => switchWorkspace({ kind: "personal" }))}
          className={
            "h-11 rounded-lg border px-4 text-sm font-medium " +
            (workspace.kind === "personal" ? "border-ink bg-ink text-on-ink" : "border-line bg-surface text-ink hover:border-ink")
          }
        >
          My own week
        </button>
        {teams.map((team) => (
          <button
            key={team.id}
            type="button"
            aria-pressed={workspace.kind === "team" && workspace.id === team.id}
            disabled={busy}
            onClick={() => void run(() => switchWorkspace({ kind: "team", id: team.id, name: team.name }))}
            className={
              "h-11 rounded-lg border px-4 text-sm font-medium " +
              (workspace.kind === "team" && workspace.id === team.id
                ? "border-ink bg-ink text-on-ink"
                : "border-line bg-surface text-ink hover:border-ink")
            }
          >
            {team.name}
          </button>
        ))}
      </div>

      {active ? <TeamAdmin team={active} meId={user.id} /> : null}

      {workspace.kind === "personal" ? (
        <div className="mt-6 rounded-xl border border-line bg-surface p-5">
          <p className="text-sm font-medium text-ink">Start a crew from the week you have now</p>
          <p className="mt-1 text-sm text-muted">
            {hasWeek
              ? "Your own copy stays as it is. The crew gets a copy to share."
              : "Build a week first, then start a crew from it."}
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <label className="block flex-1">
              <span className="sr-only">Crew name</span>
              <input
                className={fieldClass}
                value={name}
                maxLength={60}
                placeholder="Front desk team"
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <button
              type="button"
              className={primaryClass}
              disabled={busy || !hasWeek}
              onClick={() =>
                void run(async () => {
                  const made = await createTeam(name);
                  if (made.ok) track("crew_created");
                  return made;
                })
              }
            >
              Create crew
            </button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm leading-relaxed text-ember" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function TeamAdmin({ team, meId }: { team: TeamInfo; meId: string }) {
  const isOwner = team.ownerId === meId;
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [rename, setRename] = useState(team.name);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function guard(action: () => Promise<AuthResult>) {
    setBusy(true);
    setError("");
    const result = await action();
    setBusy(false);
    if (!result.ok) setError(result.error);
  }

  async function showLink(fresh: boolean) {
    setBusy(true);
    setError("");
    const result = fresh ? await newInviteLink(team.id) : await getInviteLink(team.id);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else setLink(result.link);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-line bg-surface p-5">
      <p className="font-display text-xl text-ink">{team.name}</p>
      <p className="mt-1 text-sm text-muted">
        {isOwner ? "You made this crew." : "You are a member."} Changes you make to the week are shared with everyone
        below.
      </p>

      <ul className="mt-4 grid gap-2">
        {team.members.map((member) => (
          <li key={member.userId} className="flex items-center justify-between gap-3 text-base text-ink">
            <span className="truncate">
              {member.email || "Member"}
              {member.userId === team.ownerId ? <span className="ml-2 text-sm text-muted">owner</span> : null}
              {member.userId === meId ? <span className="ml-2 text-sm text-muted">you</span> : null}
            </span>
            {isOwner && member.userId !== meId ? (
              <button
                type="button"
                disabled={busy}
                className="h-11 rounded-lg border border-line px-3 text-sm text-ink hover:border-ink"
                onClick={() => void guard(() => removeMember(team.id, member.userId))}
              >
                Remove
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {isOwner ? (
        <div className="mt-5 grid gap-4">
          <div>
            <p className="text-sm font-medium text-ink">Invite someone</p>
            {link ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input className={`${fieldClass} flex-1`} readOnly value={link} aria-label="Invite link" />
                <button type="button" className={secondaryClass} onClick={() => void copyLink()}>
                  <Copy className="size-4" aria-hidden="true" />
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            ) : (
              <button type="button" className={`${secondaryClass} mt-2`} disabled={busy} onClick={() => void showLink(false)}>
                Show the invite link
              </button>
            )}
            <p className="mt-2 text-sm text-muted">
              Anyone with this link who signs in can join. If it gets passed around, make a new one and the old one stops
              working.
            </p>
            <button type="button" className={`${secondaryClass} mt-2`} disabled={busy} onClick={() => void showLink(true)}>
              Make a new link
            </button>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-ink">Crew name</span>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                className={`${fieldClass} flex-1`}
                value={rename}
                maxLength={60}
                onChange={(event) => setRename(event.target.value)}
              />
              <button
                type="button"
                className={secondaryClass}
                disabled={busy || !rename.trim() || rename.trim() === team.name}
                onClick={() => void guard(() => renameTeam(team.id, rename))}
              >
                Rename
              </button>
            </div>
          </label>
        </div>
      ) : null}

      <div className="mt-5">
        {confirm ? (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={primaryClass}
              disabled={busy}
              onClick={() => void guard(() => (isOwner ? deleteTeam(team.id) : leaveTeam(team.id)))}
            >
              {isOwner ? "Yes, delete the crew for everyone" : "Yes, leave this crew"}
            </button>
            <button type="button" className={secondaryClass} onClick={() => setConfirm(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className={secondaryClass} onClick={() => setConfirm(true)}>
            {isOwner ? "Delete this crew" : "Leave this crew"}
          </button>
        )}
      </div>
      {error ? (
        <p className="mt-3 text-sm leading-relaxed text-ember" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
