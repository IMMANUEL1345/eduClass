const cron = require('node-cron');
const { pool } = require('./config/db');

function startJobs() {
  // Every day at 10:00 AM — remind teachers who haven't marked attendance
  cron.schedule('0 10 * * 1-5', async () => {
    console.log('[cron] Checking for unmarked attendance...');
    try {
      const today = new Date().toISOString().split('T')[0];

      // Find subjects that have no attendance record for today
      const [subjects] = await pool.query(
        `SELECT sub.id, sub.name, u.id AS teacher_id, u.name AS teacher_name, u.email
         FROM subjects sub
         JOIN users u ON u.id = sub.teacher_id
         WHERE sub.id NOT IN (
           SELECT DISTINCT subject_id FROM attendance WHERE date = ?
         ) AND u.is_active = TRUE`,
        [today]
      );

      for (const sub of subjects) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, body)
           VALUES (?, 'reminder', 'Attendance not marked', ?)`,
          [sub.teacher_id, `You have not marked attendance for ${sub.name} today (${today}).`]
        );
      }
      console.log(`[cron] Sent ${subjects.length} attendance reminders`);
    } catch (err) {
      console.error('[cron] Attendance reminder error:', err.message);
    }
  });

  // Every Sunday at 6:00 PM — weekly summary notification to admins
  cron.schedule('0 18 * * 0', async () => {
    console.log('[cron] Sending weekly summary to admins...');
    try {
      const [[att]] = await pool.query(
        `SELECT ROUND(SUM(status='present') / COUNT(*) * 100, 1) AS pct
         FROM attendance
         WHERE date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`
      );

      const [[msgs]] = await pool.query(
        `SELECT COUNT(*) AS total FROM messages
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
      );

      const [admins] = await pool.query(
        `SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE`
      );

      for (const admin of admins) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, body) VALUES (?, 'summary', ?, ?)`,
          [
            admin.id,
            'Weekly school summary',
            `This week: avg attendance ${att.pct || 0}%, ${msgs.total} messages sent.`,
          ]
        );
      }
    } catch (err) {
      console.error('[cron] Weekly summary error:', err.message);
    }
  });

  console.log('[cron] Scheduled jobs started');
}

module.exports = { startJobs };
