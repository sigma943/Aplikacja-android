import { getDb, initDb } from './server/db';
initDb();
const db = getDb();
console.log('Slots:', db.prepare('SELECT count(*) as c FROM slots').get());
console.log('Active slots:', db.prepare('SELECT count(*) as c FROM slots WHERE active = 1').get());
console.log('Offers:', db.prepare('SELECT count(*) as c FROM offers').get());
