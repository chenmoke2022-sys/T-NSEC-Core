/**
 * start-services.ts
 *
 * Compatibility launcher:
 * - Default: starts `dev-ollama` (draft/verify proxy ports)
 * - With `--enterprise`: starts `serve` (single production-style HTTP server)
 */

import { spawn } from 'node:child_process';

async function main() {
  const enterprise = process.argv.includes('--enterprise');
  const entry = enterprise ? 'src/cli/serve-enterprise.ts' : 'src/cli/dev-ollama.ts';

  const child = spawn('npx', ['tsx', entry], {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  const shutdown = () => {
    if (child.killed) return;
    child.kill('SIGINT');
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  const code: number = await new Promise((resolve) => child.on('exit', (c) => resolve(c ?? 0)));
  process.exit(code);
}

main().catch(console.error);

