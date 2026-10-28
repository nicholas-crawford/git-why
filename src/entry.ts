export interface Decision {
  decision: string;
  why: string | null;
  rejected: string | null;
  tradeoff: string | null;
  tags: string[];
}

export interface EntryMeta {
  date: string;
  repo: string;
  sha: string;
  short: string;
  subject: string;
}

function isNullableString(v: unknown): v is string | null {
  return v === null || typeof v === 'string';
}

/** Narrow Claude's structured output. Returns null if it isn't the shape the schema promised. */
export function parseDecisions(raw: unknown): Decision[] | null {
  if (typeof raw !== 'object' || raw === null || !Array.isArray((raw as { decisions?: unknown }).decisions)) {
    return null;
  }
  const out: Decision[] = [];
  for (const d of (raw as { decisions: unknown[] }).decisions) {
    if (typeof d !== 'object' || d === null) return null;
    const r = d as Record<string, unknown>;
    if (typeof r.decision !== 'string' || !isNullableString(r.why) || !isNullableString(r.rejected) ||
        !isNullableString(r.tradeoff) || !Array.isArray(r.tags) || !r.tags.every((t) => typeof t === 'string')) {
      return null;
    }
    out.push({ decision: r.decision, why: r.why, rejected: r.rejected, tradeoff: r.tradeoff, tags: r.tags });
  }
  return out;
}

const blank = (s: string | null): boolean => s === null || s.trim() === '';

/** A decision with no why, rejected option or tradeoff is just a description of the diff, so it's dropped. */
export function keptDecisions(decisions: Decision[]): Decision[] {
  return decisions.filter((d) => !blank(d.decision) && !(blank(d.why) && blank(d.rejected) && blank(d.tradeoff)));
}

export function formatEntry(meta: EntryMeta, decisions: Decision[]): string {
  const lines = [
    `## ${meta.date} · ${meta.repo} · ${meta.short}`,
    `<!-- git-why ${meta.sha} -->`,
    meta.subject,
    '',
  ];
  for (const d of decisions) {
    lines.push(`- Decision: ${d.decision.trim()}`);
    if (!blank(d.why)) lines.push(`  - Why: ${d.why!.trim()}`);
    if (!blank(d.rejected)) lines.push(`  - Rejected: ${d.rejected!.trim()}`);
    if (!blank(d.tradeoff)) lines.push(`  - Tradeoff: ${d.tradeoff!.trim()}`);
    if (d.tags.length > 0) lines.push(`  - Tags: ${d.tags.join(', ')}`);
  }
  return lines.join('\n') + '\n';
}
