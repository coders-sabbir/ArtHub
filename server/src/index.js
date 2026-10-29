import app from './app.js';
import { config } from './config.js';
import { indexes } from './db.js';
await indexes();
app.listen(config.port, config.production ? '0.0.0.0' : '127.0.0.1', () => console.log(`ArtHub API ready at http://127.0.0.1:${config.port}`));
