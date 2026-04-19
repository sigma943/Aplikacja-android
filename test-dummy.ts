import { getDb } from './server/db.js';
const db = getDb();

const slotRow = db.prepare('SELECT id FROM slots LIMIT 1').get() as any;
const slotId = slotRow ? slotRow.id : null;

try {
  db.prepare(`
    INSERT INTO offers (
      slot_id, offer_id, title, price, currency, city, posted_at, url, 
      status, description, parameters, images_dir, images_count, lifetime_days, added_at, sold_detected_at
    )
    VALUES (
      @slotId,
      'TEST-FIKCJA-999',
      'Fikcyjny Laptop Testowy (DO USUNIĘCIA)',
      5000,
      'PLN',
      'Wirtualne',
      'Dzisiaj 10:00',
      'https://www.olx.pl/d/oferta/dummy-test-usun',
      'sold_or_removed',
      'To jest fikcyjna oferta wygenerowana bezpośrednio do bazy przez asystenta. Możesz wejść w Archiwum na platformie i przetestować na niej przycisk "Usuń", aby upewnić się, że po usunięciu natychmiastowo zniknie i więcej nie wróci.',
      '[{"label":"Stan","value":"Testowy"}]',
      '',
      0,
      14.5,
      datetime('now', '-15 days'),
      datetime('now')
    )
  `).run({ slotId });
  console.log('Dummy offer inserted');
} catch (e) {
  console.log('Error or duplicate:', e);
}
