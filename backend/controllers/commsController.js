const { pool } = require('../config/db');
const { success, created, notFound, serverError, error } = require('../utils/response');
const { paginate } = require('../utils/helpers');

async function inbox(req, res) {
  const { limit, offset } = paginate(req.query);
  try {
    const { rows } = await pool.query(
      `SELECT m.id, m.subject, m.body, m.is_read, m.created_at,
              u.name AS sender_name, u.role AS sender_role
       FROM messages m JOIN users u ON u.id = m.sender_id
       WHERE m.receiver_id = $1 ORDER BY m.created_at DESC LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    const { rows: [{ total }] } = await pool.query('SELECT COUNT(*) AS total FROM messages WHERE receiver_id = $1', [req.user.id]);
    return success(res, { messages: rows, total: parseInt(total) });
  } catch (err) { return serverError(res, err); }
}

async function sent(req, res) {
  const { limit, offset } = paginate(req.query);
  try {
    const { rows } = await pool.query(
      `SELECT m.id, m.subject, m.body, m.is_read, m.created_at, u.name AS receiver_name
       FROM messages m JOIN users u ON u.id = m.receiver_id
       WHERE m.sender_id = $1 ORDER BY m.created_at DESC LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function send(req, res) {
  const { receiver_id, subject, body } = req.body;
  if (!receiver_id || !subject || !body) return error(res, 'receiver_id, subject and body required');
  try {
    const { rows: [r] } = await pool.query(
      'INSERT INTO messages (sender_id,receiver_id,subject,body) VALUES ($1,$2,$3,$4) RETURNING id',
      [req.user.id, receiver_id, subject, body]
    );
    await pool.query(
      'INSERT INTO notifications (user_id,type,title,body) VALUES ($1,$2,$3,$4)',
      [receiver_id, 'message', `New message from ${req.user.name}`, subject]
    );
    return created(res, { id: r.id }, 'Message sent');
  } catch (err) { return serverError(res, err); }
}

async function getOne(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT m.*, us.name AS sender_name, ur.name AS receiver_name
       FROM messages m JOIN users us ON us.id = m.sender_id JOIN users ur ON ur.id = m.receiver_id
       WHERE m.id = $1 AND (m.sender_id = $2 OR m.receiver_id = $2)`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return notFound(res, 'Message not found');
    if (rows[0].receiver_id === req.user.id && !rows[0].is_read) {
      await pool.query('UPDATE messages SET is_read = TRUE WHERE id = $1', [req.params.id]);
    }
    return success(res, rows[0]);
  } catch (err) { return serverError(res, err); }
}

async function markRead(req, res) {
  try {
    await pool.query('UPDATE messages SET is_read = TRUE WHERE id = $1 AND receiver_id = $2', [req.params.id, req.user.id]);
    return success(res, {}, 'Marked as read');
  } catch (err) { return serverError(res, err); }
}

async function remove(req, res) {
  try {
    await pool.query('DELETE FROM messages WHERE id = $1 AND (sender_id = $2 OR receiver_id = $2)', [req.params.id, req.user.id]);
    return success(res, {}, 'Message deleted');
  } catch (err) { return serverError(res, err); }
}

async function listAnnouncements(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.title, a.body, a.target_role, a.created_at, u.name AS author_name
       FROM announcements a JOIN users u ON u.id = a.author_id
       WHERE a.target_role = 'all' OR a.target_role = $1
       ORDER BY a.created_at DESC LIMIT 50`, [req.user.role]
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function createAnnouncement(req, res) {
  const { title, body, target_role } = req.body;
  try {
    const { rows: [r] } = await pool.query(
      'INSERT INTO announcements (author_id,title,body,target_role) VALUES ($1,$2,$3,$4) RETURNING id',
      [req.user.id, title, body, target_role||'all']
    );
    const roleWhere = (!target_role || target_role === 'all') ? '' : `AND role = '${target_role}'`;
    const { rows: users } = await pool.query(`SELECT id FROM users WHERE is_active = TRUE ${roleWhere}`);
    for (const u of users) {
      await pool.query('INSERT INTO notifications (user_id,type,title,body) VALUES ($1,$2,$3,$4)', [u.id,'announcement',title,body]);
    }
    return created(res, { id: r.id }, 'Announcement posted');
  } catch (err) { return serverError(res, err); }
}

async function listNotifications(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT id,type,title,body,is_read,created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    const unread = rows.filter(r => !r.is_read).length;
    return success(res, { notifications: rows, unread });
  } catch (err) { return serverError(res, err); }
}

async function markOneRead(req, res) {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    return success(res, {}, 'Marked as read');
  } catch (err) { return serverError(res, err); }
}

async function markAllRead(req, res) {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [req.user.id]);
    return success(res, {}, 'All notifications marked as read');
  } catch (err) { return serverError(res, err); }
}

async function deleteNotification(req, res) {
  try {
    await pool.query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    return success(res, {}, 'Notification dismissed');
  } catch (err) { return serverError(res, err); }
}

module.exports = { inbox, sent, send, getOne, markRead, remove, listAnnouncements, createAnnouncement, listNotifications, markOneRead, markAllRead, deleteNotification };
