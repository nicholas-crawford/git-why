const ENTER = 'enter';

export interface MenuOptions<T> {
  /** Map from key ('enter' or a single character) to the choice it selects. */
  keys: Record<string, T>;
  /** Choice for Ctrl+C or Esc. */
  cancel: T;
  timeout?: { ms: number; choice: T };
}

/**
 * Wait for a single keystroke. Raw mode delivers keys without Enter; stdin is
 * paused again afterwards so it doesn't compete with the claude child process
 * for terminal input.
 */
export function choose<T>(prompt: string, { keys, cancel, timeout }: MenuOptions<T>): Promise<T> {
  const stdin = process.stdin;
  process.stdout.write(prompt + ' ');
  if (!stdin.isTTY) return Promise.resolve(cancel);

  return new Promise((resolve) => {
    let timer: NodeJS.Timeout | undefined;
    const finish = (choice: T, echo: string): void => {
      if (timer) clearTimeout(timer);
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write(echo + '\n');
      resolve(choice);
    };
    const onData = (buf: Buffer): void => {
      const key = buf.toString();
      if (key === '\u0003' || key === '\u001b') return finish(cancel, '');
      const name = key === '\r' || key === '\n' ? ENTER : key.toLowerCase();
      if (name in keys) finish(keys[name], name === ENTER ? '' : name);
    };
    if (timeout) timer = setTimeout(() => finish(timeout.choice, '(no answer)'), timeout.ms);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}
