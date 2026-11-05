import app from './app.js';
import { config } from './config.js';
import { client, indexes } from './db.js';

try {
  await indexes();
  app.listen(config.port, config.production ? '0.0.0.0' : '127.0.0.1', () => console.log(`ArtHub API ready at http://127.0.0.1:${config.port}`));
} catch (error) {
  if (error.name === 'MongoServerSelectionError') {
    console.error('ArtHub API could not connect to MongoDB. The API has not started.');
    if (!config.production) {
      console.error('For the local database, run npm run db:start from the project root in a separate terminal (or docker compose up -d).');
      console.error('Wait for MongoDB to be ready, then restart npm run dev. For another database, check MONGODB_URI in server/.env and its network access.');
    } else {
      console.error('Check MONGODB_URI and database network access.');
    }
  } else {
    console.error('ArtHub API startup failed:', error);
  }
  await client.close();
  process.exitCode = 1;
}
