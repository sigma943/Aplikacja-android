import ExcelJS from 'exceljs';
import { getDb } from './db';

export async function exportCsv(slotId?: number, status?: string) {
  const db = getDb();
  let query = `
    SELECT o.*, s.name as slot_name, 
           (SELECT price FROM price_history ph WHERE ph.offer_id = o.offer_id ORDER BY checked_at ASC LIMIT 1) as price_initial,
           (SELECT price FROM price_history ph WHERE ph.offer_id = o.offer_id ORDER BY checked_at DESC LIMIT 1) as price_latest
    FROM offers o
    LEFT JOIN slots s ON o.slot_id = s.id
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (slotId) {
    query += ' AND o.slot_id = ?';
    params.push(slotId);
  }
  if (status) {
    query += ' AND o.status = ?';
    params.push(status);
  }

  const offers = db.prepare(query).all(...params) as any[];

  const header = ['offer_id', 'title', 'price_initial', 'price_latest', 'price_drop_pct', 'city', 'posted_at', 'added_at', 'sold_detected_at', 'lifetime_days', 'status', 'slot_name', 'url'];
  
  const rows = offers.map(o => {
    const dropPct = (o.price_initial && o.price_latest && o.price_initial > o.price_latest) 
      ? ((o.price_initial - o.price_latest) / o.price_initial * 100).toFixed(2) 
      : '';
      
    return [
      o.offer_id,
      `"${o.title.replace(/"/g, '""')}"`,
      o.price_initial || '',
      o.price_latest || '',
      dropPct,
      `"${o.city}"`,
      o.posted_at,
      o.added_at,
      o.sold_detected_at || '',
      o.lifetime_days ? o.lifetime_days.toFixed(2) : '',
      o.status,
      `"${o.slot_name}"`,
      o.url
    ].join(',');
  });

  return [header.join(','), ...rows].join('\n');
}

export async function exportXlsx(slotId?: number, status?: string) {
  const db = getDb();
  let query = `
    SELECT o.*, s.name as slot_name, 
           (SELECT price FROM price_history ph WHERE ph.offer_id = o.offer_id ORDER BY checked_at ASC LIMIT 1) as price_initial,
           (SELECT price FROM price_history ph WHERE ph.offer_id = o.offer_id ORDER BY checked_at DESC LIMIT 1) as price_latest
    FROM offers o
    LEFT JOIN slots s ON o.slot_id = s.id
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (slotId) {
    query += ' AND o.slot_id = ?';
    params.push(slotId);
  }
  if (status) {
    query += ' AND o.status = ?';
    params.push(status);
  }

  const offers = db.prepare(query).all(...params) as any[];

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Offers');

  sheet.columns = [
    { header: 'Offer ID', key: 'offer_id', width: 15 },
    { header: 'Title', key: 'title', width: 40 },
    { header: 'Initial Price', key: 'price_initial', width: 15 },
    { header: 'Latest Price', key: 'price_latest', width: 15 },
    { header: 'Drop %', key: 'price_drop_pct', width: 10 },
    { header: 'City', key: 'city', width: 20 },
    { header: 'Posted At', key: 'posted_at', width: 20 },
    { header: 'Added At', key: 'added_at', width: 20 },
    { header: 'Sold Detected At', key: 'sold_detected_at', width: 20 },
    { header: 'Lifetime Days', key: 'lifetime_days', width: 15 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Slot Name', key: 'slot_name', width: 20 },
    { header: 'URL', key: 'url', width: 50 },
  ];

  offers.forEach(o => {
    const dropPct = (o.price_initial && o.price_latest && o.price_initial > o.price_latest) 
      ? ((o.price_initial - o.price_latest) / o.price_initial * 100).toFixed(2) 
      : '';

    sheet.addRow({
      offer_id: o.offer_id,
      title: o.title,
      price_initial: o.price_initial,
      price_latest: o.price_latest,
      price_drop_pct: dropPct,
      city: o.city,
      posted_at: o.posted_at,
      added_at: o.added_at,
      sold_detected_at: o.sold_detected_at,
      lifetime_days: o.lifetime_days,
      status: o.status,
      slot_name: o.slot_name,
      url: o.url
    });
  });

  return workbook.xlsx.writeBuffer();
}
