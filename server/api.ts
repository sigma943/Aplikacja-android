import { Router } from 'express';
import { getDb } from './db';
import { runCollect, stopCollect, activeProcesses } from './scraper';
import { runCheck, stopCheck, isChecking } from './checker';
import { exportCsv, exportXlsx } from './exporter';
import { getNextRunTime } from './scheduler';

const router = Router();

// Slots
router.get('/slots', (req, res) => {
  const db = getDb();
  const slots = db.prepare('SELECT * FROM slots').all();
  
  // Add running status
  const slotsWithStatus = slots.map((slot: any) => ({
    ...slot,
    is_running: activeProcesses.has(slot.id) || activeProcesses.has('all')
  }));
  
  res.json(slotsWithStatus);
});

router.post('/slots', async (req, res) => {
  try {
    const { name, url, max_offers, exclude_words } = req.body;
    if (!url || !url.includes('olx.pl')) {
      return res.status(400).json({ error: 'Błędny lub nieobsługiwany URL. Wymagany link do olx.pl' });
    }
    console.log(`Dodawanie nowego slotu: ${name}`);
    const db = getDb();
    const result = db.prepare('INSERT INTO slots (name, url, max_offers, exclude_words) VALUES (?, ?, ?, ?)').run(name, url, max_offers || 200, exclude_words || '');
    const newId = result.lastInsertRowid;
    
    // Trigger initial collect for the new slot
    runCollect(Number(newId)).catch(err => console.error('Initial collect error:', err));
    
    res.json({ id: newId });
  } catch (err) {
    console.error('Error adding slot:', err);
    res.status(500).json({ error: 'Failed to add slot' });
  }
});

router.delete('/slots/:id', (req, res) => {
  const db = getDb();
  const slotId = req.params.id;
  console.log(`Usuwanie slotu ID: ${slotId}`);
  
  try {
    const deleteTransaction = db.transaction(() => {
      db.prepare('DELETE FROM price_history WHERE offer_id IN (SELECT offer_id FROM offers WHERE slot_id = ?)').run(slotId);
      db.prepare('DELETE FROM offers WHERE slot_id = ?').run(slotId);
      db.prepare('DELETE FROM run_logs WHERE slot_id = ?').run(slotId);
      db.prepare('DELETE FROM slots WHERE id = ?').run(slotId);
    });
    
    deleteTransaction();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting slot:', error);
    res.status(500).json({ error: 'Failed to delete slot' });
  }
});

router.patch('/slots/:id/toggle', (req, res) => {
  try {
    const db = getDb();
    const slot = db.prepare('SELECT active FROM slots WHERE id = ?').get(req.params.id) as any;
    if (slot) {
      console.log(`Przełączanie slotu ${req.params.id} na: ${!slot.active}`);
      db.prepare('UPDATE slots SET active = ? WHERE id = ?').run(slot.active ? 0 : 1, req.params.id);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error toggling slot:', err);
    res.status(500).json({ error: 'Failed to toggle slot' });
  }
});

router.patch('/slots/:id', (req, res) => {
  try {
    const { name, url, max_offers, exclude_words } = req.body;
    if (!url || !url.includes('olx.pl')) {
      return res.status(400).json({ error: 'Błędny lub nieobsługiwany URL. Wymagany link do olx.pl' });
    }
    const db = getDb();
    console.log(`Aktualizacja slotu ID: ${req.params.id}`);
    
    db.prepare(`
      UPDATE slots 
      SET name = ?, url = ?, max_offers = ?, exclude_words = ? 
      WHERE id = ?
    `).run(name, url, max_offers, exclude_words, req.params.id);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating slot:', err);
    res.status(500).json({ error: 'Failed to update slot' });
  }
});

// Offers
router.delete('/offers/:id', (req, res) => {
  const db = getDb();
  const offerId = req.params.id;
  try {
    const deleteTransaction = db.transaction(() => {
      // price_history cascade is setup in DB schema, but we can do it explicitly or grab the offer_id
      const row = db.prepare('SELECT offer_id FROM offers WHERE id = ?').get(offerId) as any;
      if (row) {
        db.prepare('DELETE FROM price_history WHERE offer_id = ?').run(row.offer_id);
        db.prepare('DELETE FROM offers WHERE id = ?').run(offerId);
      }
    });
    deleteTransaction();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting offer:', error);
    res.status(500).json({ error: 'Failed to delete offer' });
  }
});

router.delete('/archive/clear', (req, res) => {
  const db = getDb();
  try {
    const deleteTransaction = db.transaction(() => {
      // Find all offer_id for cascade cleanup
      const archived = db.prepare("SELECT offer_id FROM offers WHERE status IN ('sold_or_removed', 'retired')").all() as any[];
      for (const row of archived) {
        db.prepare('DELETE FROM price_history WHERE offer_id = ?').run(row.offer_id);
      }
      db.prepare("DELETE FROM offers WHERE status IN ('sold_or_removed', 'retired')").run();
    });
    deleteTransaction();
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing archive:', error);
    res.status(500).json({ error: 'Failed to clear archive' });
  }
});

router.get('/offers', (req, res) => {
  const { slot_id, status, city, price_min, price_max, sort, search, date_from, date_to, page = 1, limit = 24 } = req.query;
  const db = getDb();
  
  const offset = (Number(page) - 1) * Number(limit);
  
  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (slot_id) { whereClause += ' AND o.slot_id = ?'; params.push(slot_id); }
  if (status) { whereClause += ' AND o.status = ?'; params.push(status); }
  if (city) { whereClause += " AND o.city LIKE '%' || ? || '%'"; params.push(city); }
  if (price_min) { whereClause += ' AND o.price >= ?'; params.push(price_min); }
  if (price_max) { whereClause += ' AND o.price <= ?'; params.push(price_max); }
  if (date_from) { whereClause += ' AND o.added_at >= ?'; params.push(date_from); }
  if (date_to) { whereClause += ' AND o.added_at <= ?'; params.push(date_to + 'T23:59:59.999Z'); }
  if (search) { whereClause += " AND (o.title LIKE '%' || ? || '%' OR o.description LIKE '%' || ? || '%')"; params.push(search, search); }

  let orderBy = 'ORDER BY o.id DESC';
  if (sort === 'price_asc') orderBy = 'ORDER BY o.price ASC';
  else if (sort === 'price_desc') orderBy = 'ORDER BY o.price DESC';
  else if (sort === 'added_at_desc') orderBy = 'ORDER BY o.added_at DESC';
  else if (sort === 'added_at_asc') orderBy = 'ORDER BY o.added_at ASC';

  const countQuery = `SELECT COUNT(*) as total_count FROM offers o ${whereClause}`;
  const totalCount = (db.prepare(countQuery).get(...params) as any).total_count;

  const query = `
    SELECT o.*, 
           (SELECT price FROM price_history ph WHERE ph.offer_id = o.offer_id ORDER BY checked_at ASC LIMIT 1) as initial_price
    FROM offers o 
    ${whereClause}
    ${orderBy}
    LIMIT ? OFFSET ?
  `;
  
  const offers = db.prepare(query).all(...params, Number(limit), offset);
  
  res.json({
    offers,
    pagination: {
      total: totalCount,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(totalCount / Number(limit))
    }
  });
});

// Recent price drops for dashboard
router.get('/stats/price-drops', (req, res) => {
  const db = getDb();
  const drops = db.prepare(`
    WITH InitialPrices AS (
      SELECT offer_id, price as initial_price
      FROM price_history ph1
      WHERE checked_at = (SELECT MIN(checked_at) FROM price_history ph2 WHERE ph2.offer_id = ph1.offer_id)
    ),
    LatestPrices AS (
      SELECT offer_id, price as current_price, checked_at as dropped_at
      FROM price_history ph1
      WHERE id = (SELECT id FROM price_history ph2 WHERE ph2.offer_id = ph1.offer_id ORDER BY checked_at DESC LIMIT 1)
    )
    SELECT o.*, ip.initial_price, lp.current_price, lp.dropped_at
    FROM offers o
    JOIN InitialPrices ip ON o.offer_id = ip.offer_id
    JOIN LatestPrices lp ON o.offer_id = lp.offer_id
    WHERE o.status = 'active' AND lp.current_price < ip.initial_price
    ORDER BY lp.dropped_at DESC
    LIMIT 5
  `).all();
  res.json(drops);
});

router.get('/cities', (req, res) => {
  const db = getDb();
  const cities = db.prepare("SELECT DISTINCT city FROM offers WHERE city IS NOT NULL AND city != '' ORDER BY city ASC").all();
  res.json(cities.map((c: any) => c.city));
});

router.get('/offers/:id', (req, res) => {
  const db = getDb();
  const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(req.params.id);
  res.json(offer);
});

router.get('/offers/:id/price-history', (req, res) => {
  const db = getDb();
  const offer = db.prepare('SELECT offer_id FROM offers WHERE id = ?').get(req.params.id) as any;
  if (!offer) return res.status(404).json({ error: 'Not found' });
  
  const history = db.prepare('SELECT * FROM price_history WHERE offer_id = ? ORDER BY checked_at ASC').all(offer.offer_id);
  res.json(history);
});

// Archive Stats
router.get('/archive/stats', (req, res) => {
  const db = getDb();
  const { slot_id } = req.query;
  
  let baseQuery = "FROM offers WHERE status IN ('sold_or_removed', 'retired')";
  const params: any[] = [];
  if (slot_id) {
    baseQuery += " AND slot_id = ?";
    params.push(slot_id);
  }

  const avgPrice = db.prepare(`SELECT AVG(price) as avg ${baseQuery}`).get(...params) as any;
  const avgLifetime = db.prepare(`SELECT AVG(lifetime_days) as avg ${baseQuery}`).get(...params) as any;
  
  const cities = db.prepare(`SELECT city, COUNT(*) as count ${baseQuery} GROUP BY city ORDER BY count DESC LIMIT 10`).all(...params);

  res.json({
    avgPrice: avgPrice?.avg || 0,
    avgLifetime: avgLifetime?.avg || 0,
    cities
  });
});

// Run
router.post('/run/collect', async (req, res) => {
  const { slot_id } = req.body;
  // Run asynchronously
  runCollect(slot_id).catch(console.error);
  res.json({ success: true, message: 'Started collect' });
});

router.post('/run/check', async (req, res) => {
  // Run asynchronously
  runCheck().catch(console.error);
  res.json({ success: true, message: 'Started check' });
});

router.post('/run/collect/stop', (req, res) => {
  const { slot_id } = req.body;
  stopCollect(slot_id ? Number(slot_id) : undefined);
  res.json({ success: true, message: 'Stopped collect' });
});

router.post('/run/check/stop', (req, res) => {
  stopCheck();
  res.json({ success: true, message: 'Stopped check' });
});

router.get('/run/status', (req, res) => {
  res.json({
    isChecking,
    isCollecting: activeProcesses.size > 0,
    activeCollects: Array.from(activeProcesses)
  });
});

// Logs
router.get('/logs', (req, res) => {
  const db = getDb();
  const logs = db.prepare('SELECT * FROM run_logs ORDER BY id DESC LIMIT 50').all();
  res.json(logs);
});

// Notifications
router.get('/notifications', (req, res) => {
  const db = getDb();
  const notifications = db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50').all();
  res.json(notifications);
});

router.post('/notifications/read', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run();
  res.json({ success: true });
});

router.delete('/notifications', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM notifications').run();
  res.json({ success: true });
});

router.delete('/logs', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM run_logs').run();
  res.json({ success: true });
});

router.get('/scheduler/status', (req, res) => {
  res.json({ nextRunTime: getNextRunTime() });
});

// Settings
router.get('/settings', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM settings').all() as any[];
  const settings: any = {};
  rows.forEach(r => {
    settings[r.key] = r.value;
  });
  res.json(settings);
});

router.patch('/settings', (req, res) => {
  const db = getDb();
  const updateStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const transaction = db.transaction((updates: any) => {
    Object.entries(updates).forEach(([key, value]) => {
      updateStmt.run(key, String(value));
    });
  });
  
  try {
    transaction(req.body);
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Export
router.get('/export/csv', async (req, res) => {
  const { slot_id, status } = req.query;
  const csv = await exportCsv(slot_id ? Number(slot_id) : undefined, status as string);
  res.header('Content-Type', 'text/csv');
  res.attachment('export.csv');
  res.send(csv);
});

router.get('/export/xlsx', async (req, res) => {
  const { slot_id, status } = req.query;
  const buffer = await exportXlsx(slot_id ? Number(slot_id) : undefined, status as string);
  res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.attachment('export.xlsx');
  res.send(buffer);
});

// Dashboard Stats
router.get('/stats', (req, res) => {
  const db = getDb();
  const activeOffers = (db.prepare("SELECT COUNT(*) as count FROM offers WHERE status = 'active'").get() as any).count;
  const archivedOffers = (db.prepare("SELECT COUNT(*) as count FROM offers WHERE status = 'sold_or_removed'").get() as any).count;
  const activeSlots = (db.prepare('SELECT COUNT(*) as count FROM slots WHERE active = 1').get() as any).count;
  
  // Count price drops
  const priceDrops = (db.prepare(`
    WITH InitialPrices AS (
      SELECT offer_id, price as initial_price
      FROM price_history ph1
      WHERE checked_at = (SELECT MIN(checked_at) FROM price_history ph2 WHERE ph2.offer_id = ph1.offer_id)
    )
    SELECT COUNT(DISTINCT o.offer_id) as count
    FROM offers o
    JOIN InitialPrices ip ON o.offer_id = ip.offer_id
    WHERE o.status = 'active' AND o.price < ip.initial_price
  `).get() as any).count;

  const errors = (db.prepare('SELECT SUM(errors) as count FROM run_logs').get() as any).count || 0;
  
  res.json({
    activeOffers,
    archivedOffers,
    activeSlots,
    priceDrops,
    errors
  });
});

export default router;
