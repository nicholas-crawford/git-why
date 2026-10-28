import { spawnSync } from 'node:child_process';

// --safe-mode skips CLAUDE.md, hooks, MCP servers, plugins and skills, and
// --tools '' removes every tool. The interview only sees what this script
// sends it, and it can't touch the filesystem.
const LOCKDOWN = ['--safe-mode', '--tools', ''];

export interface SessionOptions {
  /** Neutral working directory, so no repo CLAUDE.md or trust prompt is involved. */
  cwd: string;
  sessionId: string;
  model: string;
}

/** Run the interactive interview on the inherited terminal. Resolves to the exit status, or an error message. */
export function runInterview(
  opts: SessionOptions & { systemPrompt: string; firstMessage: string },
): { ok: true; status: number | null } | { ok: false; error: string } {
  const r = spawnSync(
    'claude',
    [...LOCKDOWN, '--model', opts.model, '--session-id', opts.sessionId,
      '--system-prompt', opts.systemPrompt, opts.firstMessage],
    { cwd: opts.cwd, stdio: 'inherit' },
  );
  if (r.error) return { ok: false, error: r.error.message };
  return { ok: true, status: r.status };
}

/** Resume the finished interview in print mode and get the entry back as schema-validated JSON. */
export function extract(
  opts: SessionOptions & { schema: string; prompt: string },
): { ok: true; output: unknown } | { ok: false; error: string } {
  const r = spawnSync(
    'claude',
    ['-p', ...LOCKDOWN, '--model', opts.model, '--resume', opts.sessionId,
      '--output-format', 'json', '--json-schema', opts.schema, opts.prompt],
    { cwd: opts.cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 },
  );
  if (r.error) return { ok: false, error: r.error.message };
  try {
    const result = JSON.parse(r.stdout) as { is_error?: boolean; result?: string; structured_output?: unknown };
    if (result.is_error || result.structured_output === undefined) {
      return { ok: false, error: result.result || `claude exited with status ${r.status}` };
    }
    return { ok: true, output: result.structured_output };
  } catch {
    return { ok: false, error: (r.stderr || r.stdout || `claude exited with status ${r.status}`).trim() };
  }
}
