import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'db.sqlite');
const db = new Database(dbPath);

console.log('Deleting old offers...');
db.prepare('DELETE FROM price_history').run();
db.prepare('DELETE FROM offers').run();
console.log('Done.');
