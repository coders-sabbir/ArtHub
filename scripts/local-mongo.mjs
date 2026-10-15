import { MongoClient } from 'mongodb';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
const directory = path.resolve('.data/mongo'); const uri = 'mongodb://127.0.0.1:27018/?directConnection=true';
async function inspect() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 700 });
  try { await client.connect(); const hello = await client.db('admin').command({ hello: 1 }); return hello; } catch { return null; } finally { await client.close(); }
}
const existing = await inspect();
if (existing) { if (existing.setName !== 'arthub') throw new Error('Port 27018 belongs to a different MongoDB instance. Choose another URI in server/.env.'); console.log('ArtHub MongoDB is already running at 127.0.0.1:27018.'); process.exit(0); }
await fs.mkdir(directory, { recursive: true });
const child = spawn('mongod', ['--dbpath', directory, '--port', '27018', '--bind_ip', '127.0.0.1', '--replSet', 'arthub', '--logpath', path.resolve('.data/mongo.log')], { stdio: 'inherit' });
child.on('error', error => { console.error(`MongoDB could not start: ${error.message}. Install MongoDB or use docker compose up -d.`); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code || 0; });
process.on('SIGINT', () => child.kill('SIGINT')); process.on('SIGTERM', () => child.kill('SIGTERM'));
for (let i = 0; i < 30; i++) {
  if (child.exitCode !== null) break;
  if (await inspect()) {
    const client = new MongoClient(uri); await client.connect();
    try { await client.db('admin').command({ replSetInitiate: { _id: 'arthub', members: [{ _id: 0, host: '127.0.0.1:27018' }] } }); } catch (error) { if (error.codeName !== 'AlreadyInitialized') throw error; } finally { await client.close(); }
    console.log('ArtHub MongoDB is ready. Leave this terminal running, then run npm run seed and npm run dev in another terminal.'); break;
  }
  await new Promise(resolve => setTimeout(resolve, 250));
}
