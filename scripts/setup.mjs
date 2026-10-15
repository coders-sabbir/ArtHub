import fs from 'node:fs/promises';
import crypto from 'node:crypto';
for (const [sample, target] of [['server/.env.example', 'server/.env'], ['client/.env.example', 'client/.env.local']]) {
  try { await fs.access(target); console.log(`Preserved ${target}`); }
  catch {
    const content = (await fs.readFile(sample, 'utf8')).replace('replace-with-a-random-secret-of-at-least-32-characters', crypto.randomBytes(32).toString('hex')).replace('replace-with-another-random-secret-of-at-least-32-characters', crypto.randomBytes(32).toString('hex'));
    await fs.writeFile(target, content, { mode: 0o600 }); console.log(`Created ${target}`);
  }
}
console.log('Local configuration is ready. Connect external service keys in server/.env when needed.');
