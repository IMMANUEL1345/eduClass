const { pool } = require('../config/db');
const { success, created, error, notFound, serverError } = require('../utils/response');
const crypto = require('crypto');

function genRoomCode() {
  return 'educlass-' + crypto.randomBytes(6).toString('hex');
}

// GET /api/virtual-classroom
async function list(req, res) {
  const { class_id, status } = req.query;
  const conditions = ['TRUE']; const params = [];
  if (class_id) conditions.push(`vs.class_id = $${params.push(class_id)}`);
  if (status)   conditions.push(`vs.status = $${params.push(status)}`);

  // Students only see sessions for their own class
  if (req.user.role === 'student') {
    const { rows: [s] } = await pool.query(
      'SELECT class_id FROM students WHERE user_id=$1', [req.user.id]
    );
    if (s) conditions.push(`vs.class_id = $${params.push(s.class_id)}`);
  }

  // Parents only see sessions for their children's classes
  if (req.user.role === 'parent') {
    const { rows: children } = await pool.query(
      'SELECT class_id FROM students WHERE parent_id=$1 OR user_id IN (SELECT child_id FROM parent_links WHERE parent_id=$1)',
      [req.user.id]
    );
    const classIds = children.map(c => c.class_id).filter(Boolean);
    if (classIds.length > 0) {
      conditions.push(`vs.class_id = ANY($${params.push(classIds)})`);
    }
  }

  try {
    const { rows } = await pool.query(
      `SELECT vs.id, vs.title, vs.description, vs.room_code, vs.status,
              vs.scheduled_at, vs.started_at, vs.ended_at, vs.subject,
              vs.created_at,
              u.name AS host_name, u.role AS host_role,
              c.name AS class_name, c.section,
              (SELECT COUNT(*) FROM session_messages sm WHERE sm.session_id=vs.id) AS message_count,
              (SELECT COUNT(*) FROM session_materials smat WHERE smat.session_id=vs.id) AS material_count,
              (SELECT COUNT(*) FROM session_qa sq WHERE sq.session_id=vs.id) AS question_count
       FROM virtual_sessions vs
       JOIN users u ON u.id = vs.host_id
       LEFT JOIN classes c ON c.id = vs.class_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY vs.created_at DESC`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// POST /api/virtual-classroom
async function create(req, res) {
  let { title, description, class_id, subject, scheduled_at } = req.body;
  if (!title) return error(res, 'Title is required');

  try {
    // STUDENTS: force class_id to their own class — cannot schedule for other classes
    if (req.user.role === 'student') {
      const { rows: [s] } = await pool.query(
        'SELECT class_id FROM students WHERE user_id=$1', [req.user.id]
      );
      if (!s) return error(res, 'Student record not found');
      class_id = s.class_id; // Override whatever was sent — always their own class
    }

    const roomCode = genRoomCode();
    const { rows: [r] } = await pool.query(
      `INSERT INTO virtual_sessions
        (title, description, class_id, host_id, room_code, subject, scheduled_at, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'scheduled') RETURNING id, room_code`,
      [title, description || null, class_id || null, req.user.id,
       roomCode, subject || null, scheduled_at || null]
    );

    // Notify everyone in the target class (students + parents) if class_id given
    if (class_id) {
      // Get all students in the class
      const { rows: students } = await pool.query(
        'SELECT user_id FROM students WHERE class_id=$1', [class_id]
      );

      // Get class name for the notification message
      const { rows: [cls] } = await pool.query(
        'SELECT name, section FROM classes WHERE id=$1', [class_id]
      );
      const className = cls ? `${cls.name}${cls.section ? ' ' + cls.section : ''}` : 'your class';

      const notifBody = `${req.user.name} has scheduled a virtual class "${title}" for ${className}. Room code: ${roomCode}`;

      // Notify each student
      for (const s of students) {
        // Don't notify the student who created it
        if (s.user_id === req.user.id) continue;
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, body)
           VALUES ($1,'virtual_class',$2,$3)`,
          [s.user_id, `🎓 Virtual class scheduled: ${title}`, notifBody]
        ).catch(() => {});
      }

      // Also notify parents linked to students in this class
      const { rows: parents } = await pool.query(
        `SELECT DISTINCT p.user_id
         FROM students s
         JOIN students p_link ON p_link.class_id = s.class_id
         WHERE s.class_id = $1
           AND EXISTS (
             SELECT 1 FROM users pu WHERE pu.id = s.user_id
           )`, [class_id]
      );

      // Simpler parent query — get parents via parent_links table if it exists
      const { rows: parentUsers } = await pool.query(
        `SELECT DISTINCT pl.parent_id AS user_id
         FROM parent_links pl
         JOIN students st ON st.user_id = pl.child_id
         WHERE st.class_id = $1`, [class_id]
      ).catch(() => ({ rows: [] }));

      for (const p of parentUsers) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, body)
           VALUES ($1,'virtual_class',$2,$3)`,
          [p.user_id, `🎓 Virtual class scheduled: ${title}`, notifBody]
        ).catch(() => {});
      }
    }

    return created(res, { id: r.id, room_code: r.room_code }, 'Session created');
  } catch (err) { return serverError(res, err); }
}

// GET /api/virtual-classroom/:id
async function getOne(req, res) {
  try {
    const { rows: [session] } = await pool.query(
      `SELECT vs.*, u.name AS host_name, u.role AS host_role,
              c.name AS class_name, c.section
       FROM virtual_sessions vs
       JOIN users u ON u.id = vs.host_id
       LEFT JOIN classes c ON c.id = vs.class_id
       WHERE vs.id=$1`, [req.params.id]
    );
    if (!session) return notFound(res, 'Session not found');

    const [materials, messages, qa] = await Promise.all([
      pool.query(
        `SELECT sm.*, u.name AS added_by_name
         FROM session_materials sm JOIN users u ON u.id=sm.added_by
         WHERE sm.session_id=$1 ORDER BY sm.created_at ASC`, [req.params.id]
      ),
      pool.query(
        `SELECT msg.*, u.name AS user_name, u.role AS user_role
         FROM session_messages msg JOIN users u ON u.id=msg.user_id
         WHERE msg.session_id=$1 ORDER BY msg.created_at ASC`, [req.params.id]
      ),
      pool.query(
        `SELECT q.*, u.name AS asked_by_name, a.name AS answered_by_name
         FROM session_qa q
         JOIN users u ON u.id=q.asked_by
         LEFT JOIN users a ON a.id=q.answered_by
         WHERE q.session_id=$1 ORDER BY q.upvotes DESC, q.created_at ASC`, [req.params.id]
      ),
    ]);

    return success(res, {
      ...session,
      materials: materials.rows,
      messages:  messages.rows,
      qa:        qa.rows,
    });
  } catch (err) { return serverError(res, err); }
}

// POST /api/virtual-classroom/:id/start
async function startSession(req, res) {
  try {
    const { rows: [session] } = await pool.query(
      'SELECT host_id FROM virtual_sessions WHERE id=$1', [req.params.id]
    );
    if (!session) return notFound(res, 'Session not found');
    // Only the host can start
    if (session.host_id !== req.user.id) return error(res, 'Only the host can start this session', 403);

    await pool.query(
      `UPDATE virtual_sessions SET status='live', started_at=NOW() WHERE id=$1`,
      [req.params.id]
    );
    return success(res, {}, 'Session started');
  } catch (err) { return serverError(res, err); }
}

// POST /api/virtual-classroom/:id/end
async function endSession(req, res) {
  try {
    const { rows: [session] } = await pool.query(
      'SELECT host_id FROM virtual_sessions WHERE id=$1', [req.params.id]
    );
    if (!session) return notFound(res, 'Session not found');
    if (session.host_id !== req.user.id) return error(res, 'Only the host can end this session', 403);

    await pool.query(
      `UPDATE virtual_sessions SET status='ended', ended_at=NOW() WHERE id=$1`,
      [req.params.id]
    );
    return success(res, {}, 'Session ended');
  } catch (err) { return serverError(res, err); }
}

// DELETE /api/virtual-classroom/:id
async function remove(req, res) {
  try {
    await pool.query('DELETE FROM virtual_sessions WHERE id=$1 AND host_id=$2',
      [req.params.id, req.user.id]);
    return success(res, {}, 'Session deleted');
  } catch (err) { return serverError(res, err); }
}

// POST /api/virtual-classroom/:id/materials
async function addMaterial(req, res) {
  const { title, type, content } = req.body;
  if (!title || !content) return error(res, 'Title and content required');
  try {
    const { rows: [r] } = await pool.query(
      `INSERT INTO session_materials (session_id,title,type,content,added_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [req.params.id, title, type || 'link', content, req.user.id]
    );
    return created(res, { id: r.id }, 'Material added');
  } catch (err) { return serverError(res, err); }
}

// DELETE /api/virtual-classroom/:id/materials/:matId
async function removeMaterial(req, res) {
  try {
    await pool.query('DELETE FROM session_materials WHERE id=$1 AND session_id=$2',
      [req.params.matId, req.params.id]);
    return success(res, {}, 'Material removed');
  } catch (err) { return serverError(res, err); }
}

// POST /api/virtual-classroom/:id/messages
async function sendMessage(req, res) {
  const { message } = req.body;
  if (!message?.trim()) return error(res, 'Message required');
  try {
    const { rows: [r] } = await pool.query(
      `INSERT INTO session_messages (session_id,user_id,message)
       VALUES ($1,$2,$3) RETURNING id, created_at`,
      [req.params.id, req.user.id, message.trim()]
    );
    return created(res, {
      id: r.id, message: message.trim(),
      user_name: req.user.name, user_role: req.user.role,
      created_at: r.created_at,
    }, 'Message sent');
  } catch (err) { return serverError(res, err); }
}

// GET /api/virtual-classroom/:id/messages?since=
async function getMessages(req, res) {
  const { since } = req.query;
  try {
    const { rows } = await pool.query(
      `SELECT msg.id, msg.message, msg.created_at,
              u.name AS user_name, u.role AS user_role
       FROM session_messages msg JOIN users u ON u.id=msg.user_id
       WHERE msg.session_id=$1
         ${since ? `AND msg.created_at > $2` : ''}
       ORDER BY msg.created_at ASC`,
      since ? [req.params.id, since] : [req.params.id]
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// POST /api/virtual-classroom/:id/qa
async function askQuestion(req, res) {
  const { question } = req.body;
  if (!question?.trim()) return error(res, 'Question required');
  try {
    const { rows: [r] } = await pool.query(
      `INSERT INTO session_qa (session_id,asked_by,question)
       VALUES ($1,$2,$3) RETURNING id`,
      [req.params.id, req.user.id, question.trim()]
    );
    return created(res, { id: r.id }, 'Question submitted');
  } catch (err) { return serverError(res, err); }
}

// PUT /api/virtual-classroom/:id/qa/:qaId/answer
async function answerQuestion(req, res) {
  const { answer } = req.body;
  if (!answer?.trim()) return error(res, 'Answer required');
  try {
    await pool.query(
      `UPDATE session_qa SET answer=$1, answered_by=$2, answered_at=NOW()
       WHERE id=$3 AND session_id=$4`,
      [answer.trim(), req.user.id, req.params.qaId, req.params.id]
    );
    return success(res, {}, 'Question answered');
  } catch (err) { return serverError(res, err); }
}

// PUT /api/virtual-classroom/:id/qa/:qaId/upvote
async function upvoteQuestion(req, res) {
  try {
    await pool.query(
      'UPDATE session_qa SET upvotes=upvotes+1 WHERE id=$1 AND session_id=$2',
      [req.params.qaId, req.params.id]
    );
    return success(res, {}, 'Upvoted');
  } catch (err) { return serverError(res, err); }
}

// POST /api/virtual-classroom/join/:roomCode
async function joinByCode(req, res) {
  try {
    const { rows: [session] } = await pool.query(
      `SELECT vs.id, vs.title, vs.room_code, vs.status,
              vs.host_id, u.name AS host_name,
              c.name AS class_name, c.section
       FROM virtual_sessions vs
       JOIN users u ON u.id=vs.host_id
       LEFT JOIN classes c ON c.id=vs.class_id
       WHERE vs.room_code=$1`, [req.params.roomCode]
    );
    if (!session) return notFound(res, 'Session not found. Check the room code.');
    return success(res, session);
  } catch (err) { return serverError(res, err); }
}

module.exports = {
  list, create, getOne, remove,
  startSession, endSession,
  addMaterial, removeMaterial,
  sendMessage, getMessages,
  askQuestion, answerQuestion, upvoteQuestion,
  joinByCode,
};