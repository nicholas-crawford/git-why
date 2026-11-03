import type { Config } from './config.ts';

const MODE_FLAGS = new Map<string, Config['mode']>([['--template', 'template'], ['--interview', 'interview']]);

export function parseArgs(argv: string[]): { mode: Config['mode'] | null; args: string[] } {
  const modes = new Set(argv.flatMap((a) => MODE_FLAGS.get(a) ?? []));
  if (modes.size > 1) throw new Error("--template and --interview can't be used together");
  return { mode: [...modes][0] ?? null, args: argv.filter((a) => !MODE_FLAGS.has(a)) };
}
