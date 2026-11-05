import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';

const projects = JSON.parse(await fs.readFile(new URL('../.vercel/arthub-projects.json', import.meta.url), 'utf8'));
const settings = dotenv.parse(await fs.readFile(new URL('../server/.env', import.meta.url)));
const frontendOnly = process.argv.includes('--frontend-only');
const backendOnly = process.argv.includes('--backend-only');
const preserveDatabase = process.argv.includes('--preserve-database');
if (frontendOnly && backendOnly) throw new Error('Choose one project, or omit the flags to configure both.');
async function api(endpoint, method = 'GET', input) {
  return new Promise((resolve, reject) => {
    const args = ['api', endpoint, '--method', method, '--scope', projects.scope];
    if (input) args.push('--input', '-');
    const child = spawn('vercel', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', chunk => { output += chunk; });
    // Neither API responses nor stderr are echoed: they can contain environment values.
    child.stderr.resume(); child.on('error', reject);
    child.on('exit', code => {
      if (code !== 0) return reject(new Error(`Vercel environment request failed (exit ${code}); no secret output was printed.`));
      try { resolve(JSON.parse(output)); } catch { reject(new Error('Vercel returned an invalid environment response.')); }
    });
    child.stdin.end(input ? JSON.stringify(input) : undefined);
  });
}
async function configure(project, entries) {
  const existing = await api(`/v9/projects/${project.id}/env`);
  const productionKeys = new Set(existing.envs.filter(env => env.target?.includes('production')).map(env => env.key));
  for (const [key, value, , preserve] of entries) {
    if (preserve && productionKeys.has(key)) continue;
    if (!value) throw new Error(`${project.name}: ${key} is missing; no environment values were changed.`);
  }
  for (const [key, value, secret, preserve] of entries) {
    if (preserve && productionKeys.has(key)) { console.log(`${project.name}: ${key} already configured`); continue; }
    await api(`/v10/projects/${project.id}/env?upsert=true`, 'POST', { key, value, type: secret ? 'sensitive' : 'plain', target: ['production'] });
    console.log(`${project.name}: ${key} configured`);
  }
}
if (!frontendOnly) {
  const uri = process.env.MONGODB_URI || settings.MONGODB_URI;
  if (!preserveDatabase && (!uri || /localhost|127\.0\.0\.1|\[::1\]/i.test(uri) || !/^mongodb(\+srv)?:\/\//.test(uri))) throw new Error('A remote MongoDB URI is required. Local database settings cannot be deployed.');
  const entries = [
    ['NODE_ENV', 'production', false],
    ['FRONTEND_URL', new URL(projects.frontend.url).origin, false],
    ['MONGODB_URI', preserveDatabase ? undefined : uri, true, preserveDatabase],
    ['JWT_SECRET', randomBytes(48).toString('base64url'), true, true],
    ['BETTER_AUTH_SECRET', randomBytes(48).toString('base64url'), true, true],
  ];
  if (process.argv.includes('--seed-demo')) {
    entries.push(
      ['SEED_DEMO_DATA', 'true', false],
      ['SEED_ADMIN_PASSWORD', process.env.SEED_ADMIN_PASSWORD || settings.SEED_ADMIN_PASSWORD || 'Admin@123', true, true],
      ['SEED_DEMO_PASSWORD', process.env.SEED_DEMO_PASSWORD || settings.SEED_DEMO_PASSWORD || 'ArtHub@123', true, true],
    );
  }
  for (const key of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'IMGBB_API_KEY']) {
    const value = process.env[key] || settings[key];
    if (value) entries.push([key, value, true]);
  }
  await configure(projects.backend, entries);
}
if (!backendOnly) await configure(projects.frontend, [['API_URL', new URL(projects.backend.url).origin, false]]);
