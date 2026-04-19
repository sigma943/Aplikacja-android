import cron from 'node-cron';
import { runCollect } from './scraper';
import { runCheck } from './checker';
import { getDb } from './db';

let nextRunTime: Date | null = null;
let isFirstRunCheckDone = false;

export async function initScheduler() {
  // Check if we missed a run while being offline
  if (!isFirstRunCheckDone) {
    isFirstRunCheckDone = true;
    checkMissedRun();
  }

  // Run every 12 hours
  cron.schedule('0 */12 * * *', async () => {
    const db = getDb();
    const autoCheck = db.prepare('SELECT value FROM settings WHERE key = ?').get('auto_check_enabled') as any;
    
    if (autoCheck?.value === 'false') {
      console.log('Automatyczna weryfikacja jest wyłączona w ustawieniach. Pomijanie.');
      updateNextRunTime();
      return;
    }

    console.log('Running scheduled tasks...');
    await runCheck();
    await runCollect();
    updateNextRunTime();
  });
  
  updateNextRunTime();
}

async function checkMissedRun() {
  try {
    const db = getDb();
    const autoCheck = db.prepare('SELECT value FROM settings WHERE key = ?').get('auto_check_enabled') as any;
    
    if (autoCheck?.value === 'false') {
      console.log('Automatyczna weryfikacja jest wyłączona. Pominięto sprawdzenie zaległych zadań.');
      return;
    }

    const lastRun = db.prepare("SELECT started_at FROM run_logs WHERE run_type = 'check' AND finished_at IS NOT NULL ORDER BY id DESC LIMIT 1").get() as any;
    
    const now = new Date();
    let shouldRunNow = false;

    if (!lastRun) {
      console.log('No previous runs found. Triggering initial verification.');
      shouldRunNow = true;
    } else {
      const lastRunDate = new Date(lastRun.started_at + 'Z'); // Assume UTC
      const diffMs = now.getTime() - lastRunDate.getTime();
      const twelveHoursMs = 12 * 60 * 60 * 1000;

      if (diffMs > twelveHoursMs) {
        console.log(`Last run was ${Math.round(diffMs / 3600000)}h ago. Triggering catch-up run.`);
        shouldRunNow = true;
      }
    }

    if (shouldRunNow) {
      // Run with a small delay to not overload startup
      setTimeout(async () => {
        console.log('Starting catch-up verification and collect...');
        await runCheck();
        await runCollect();
      }, 5000);
    }
  } catch (err) {
    console.error('Error checking missed run:', err);
  }
}

function updateNextRunTime() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(now.getHours() + 12 - (now.getHours() % 12), 0, 0, 0);
  nextRunTime = next;
}

export function getNextRunTime() {
  return nextRunTime;
}
