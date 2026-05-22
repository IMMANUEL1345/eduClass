const cron = require('node-cron');
const { pool } = require('./config/db');
const { runDailyDeductions } = require('./controllers/dailyFeesController');

function startJobs() {

  // ── Weekdays 10:00 AM — remind teachers who haven't marked attendance
  cron.schedule('0 10 * * 1-5', async () => {
    console.log('[cron] Checking for unmarked attendance...');
    try {
      const today = new Date().toISOString().split('T')[0];
      const { rows: subjects } = await pool.query(
        `SELECT sub.id, sub.name, u.id AS teacher_id
         FROM subjects sub
         JOIN users u ON u.id = sub.teacher_id
         WHERE sub.id NOT IN (
           SELECT DISTINCT subject_id FROM attendance WHERE date = $1
         ) AND u.is_active = TRUE`,
        [today]
      );
      for (const sub of subjects) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, body)
           VALUES ($1,'reminder','Attendance not marked',$2)`,
          [sub.teacher_id,
           `You have not marked attendance for ${sub.name} today (${today}).`]
        ).catch(() => {});
      }
      console.log(`[cron] Sent ${subjects.length} attendance reminders`);
    } catch (err) {
      console.error('[cron] Attendance reminder error:', err.message);
    }
  });

  // ── Sundays 6:00 PM — weekly summary to admins
  cron.schedule('0 18 * * 0', async () => {
    console.log('[cron] Sending weekly summary to admins...');
    try {
      const { rows: [att] } = await pool.query(
        `SELECT ROUND(
           SUM(CASE WHEN status='present' THEN 1 ELSE 0 END)::numeric
           / NULLIF(COUNT(*), 0) * 100
         , 1) AS pct
         FROM attendance
         WHERE date >= CURRENT_DATE - INTERVAL '7 days'`
      );
      const { rows: [msgs] } = await pool.query(
        `SELECT COUNT(*) AS total FROM messages
         WHERE created_at >= NOW() - INTERVAL '7 days'`
      );
      const { rows: admins } = await pool.query(
        `SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE`
      );
      for (const admin of admins) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, body)
           VALUES ($1,'summary',$2,$3)`,
          [admin.id,
           'Weekly school summary',
           `This week: avg attendance ${att?.pct || 0}%, ${msgs?.total || 0} messages sent.`]
        ).catch(() => {});
      }
    } catch (err) {
      console.error('[cron] Weekly summary error:', err.message);
    }
  });

  // ── Weekdays 6:00 AM — daily feeding & transport fee deductions
  cron.schedule('0 6 * * 1-5', async () => {
    console.log('[cron] Running daily fee deductions...');
    await runDailyDeductions();
  }, { timezone: 'Africa/Accra' });

  console.log('[cron] Scheduled jobs started');
}

module.exports = { startJobs };