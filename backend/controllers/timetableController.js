const { pool } = require('../config/db');
const { success, created, error, notFound, serverError } = require('../utils/response');

const DAYS    = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
const PERIODS = [1,2,3,4,5,6,7,8];

// ── GET /api/timetable/class ──────────────────────────────
async function getClassTimetable(req, res) {
  const { class_id, term, academic_year } = req.query;
  if (!class_id) return error(res, 'class_id required');
  try {
    const { rows } = await pool.query(
      `SELECT t.id, t.day_of_week, t.period_number, t.start_time, t.end_time,
              t.is_approved, t.is_generated,
              s.name AS subject_name, s.id AS subject_id,
              u.name AS teacher_name, te.id AS teacher_id
       FROM timetable t
       JOIN subjects  s  ON s.id  = t.subject_id
       JOIN teachers  te ON te.id = t.teacher_id
       JOIN users     u  ON u.id  = te.user_id
       WHERE t.class_id = $1
         AND t.term          = COALESCE($2, t.term)
         AND t.academic_year = COALESCE($3, t.academic_year)
       ORDER BY
         ARRAY_POSITION(ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], t.day_of_week),
         t.period_number`,
      [class_id, term||null, academic_year||null]
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// ── GET /api/timetable/teacher ────────────────────────────
async function getTeacherTimetable(req, res) {
  const { teacher_id, term, academic_year } = req.query;
  if (!teacher_id) return error(res, 'teacher_id required');
  try {
    const { rows } = await pool.query(
      `SELECT t.id, t.day_of_week, t.period_number, t.start_time, t.end_time,
              s.name AS subject_name, c.name AS class_name, c.section
       FROM timetable t
       JOIN subjects s ON s.id = t.subject_id
       JOIN classes  c ON c.id = t.class_id
       WHERE t.teacher_id = $1
         AND t.term          = COALESCE($2, t.term)
         AND t.academic_year = COALESCE($3, t.academic_year)
       ORDER BY
         ARRAY_POSITION(ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], t.day_of_week),
         t.period_number`,
      [teacher_id, term||null, academic_year||null]
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// ── POST /api/timetable ───────────────────────────────────
async function addEntry(req, res) {
  const { class_id, subject_id, teacher_id, day_of_week,
          period_number, start_time, end_time, term, academic_year } = req.body;
  if (!class_id || !subject_id || !teacher_id || !day_of_week || !period_number)
    return error(res, 'class_id, subject_id, teacher_id, day_of_week and period_number required');
  try {
    // Check teacher clash
    const { rows: clash } = await pool.query(
      `SELECT id FROM timetable
       WHERE teacher_id = $1 AND day_of_week = $2 AND period_number = $3
         AND term = $4 AND academic_year = $5`,
      [teacher_id, day_of_week, period_number, term, academic_year]
    );
    if (clash[0]) return error(res, 'Teacher is already assigned elsewhere at this time', 409);

    const { rows: [r] } = await pool.query(
      `INSERT INTO timetable
        (class_id,subject_id,teacher_id,day_of_week,period_number,
         start_time,end_time,term,academic_year,is_generated)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,FALSE) RETURNING id`,
      [class_id, subject_id, teacher_id, day_of_week, period_number,
       start_time||null, end_time||null, term, academic_year]
    );
    return created(res, { id: r.id }, 'Entry added');
  } catch (err) {
    if (err.code === '23505') return error(res, 'This slot is already taken for this class', 409);
    return serverError(res, err);
  }
}

// ── PUT /api/timetable/:id ────────────────────────────────
async function updateEntry(req, res) {
  const { teacher_id, start_time, end_time } = req.body;
  try {
    await pool.query(
      `UPDATE timetable SET
         teacher_id = COALESCE($1, teacher_id),
         start_time = COALESCE($2, start_time),
         end_time   = COALESCE($3, end_time)
       WHERE id = $4`,
      [teacher_id||null, start_time||null, end_time||null, req.params.id]
    );
    return success(res, {}, 'Entry updated');
  } catch (err) { return serverError(res, err); }
}

// ── DELETE /api/timetable/:id ─────────────────────────────
async function removeEntry(req, res) {
  try {
    await pool.query('DELETE FROM timetable WHERE id = $1', [req.params.id]);
    return success(res, {}, 'Entry removed');
  } catch (err) { return serverError(res, err); }
}

// ── POST /api/timetable/generate ─────────────────────────
// Auto-generates conflict-free timetable for a class
async function generateTimetable(req, res) {
  const { class_id, term, academic_year } = req.body;
  if (!class_id || !term || !academic_year)
    return error(res, 'class_id, term and academic_year required');

  try {
    // 1. Get all subjects for this class WITH their assigned teachers
    const { rows: subjects } = await pool.query(
      `SELECT s.id AS subject_id, s.name AS subject_name,
              s.periods_per_week, s.teacher_id AS teacher_id
       FROM subjects s
       WHERE s.class_id = $1 AND s.teacher_id IS NOT NULL`,
      [class_id]
    );

    if (subjects.length === 0)
      return error(res, 'No subjects with assigned teachers found for this class. Assign teachers to subjects first.');

    // 2. Get ALL timetable entries for the same term/year (to detect cross-class teacher clashes)
    const { rows: existing } = await pool.query(
      `SELECT teacher_id, day_of_week, period_number
       FROM timetable
       WHERE term = $1 AND academic_year = $2 AND class_id != $3`,
      [term, academic_year, class_id]
    );

    // Build a set of blocked slots per teacher: "teacher_id:day:period"
    const blocked = new Set(existing.map(e => `${e.teacher_id}:${e.day_of_week}:${e.period_number}`));

    // 3. Delete old generated entries for this class
    await pool.query(
      `DELETE FROM timetable
       WHERE class_id = $1 AND term = $2 AND academic_year = $3 AND is_generated = TRUE`,
      [class_id, term, academic_year]
    );

    // 4. Generate period times (standard Ghana school timetable)
    const periodTimes = [
      { start: '07:30', end: '08:15' },
      { start: '08:15', end: '09:00' },
      { start: '09:00', end: '09:45' },
      // Period 4 = break (skip)
      { start: '10:15', end: '11:00' },
      { start: '11:00', end: '11:45' },
      { start: '11:45', end: '12:30' },
      // Period 7 = lunch (skip)
      { start: '13:30', end: '14:15' },
      { start: '14:15', end: '15:00' },
    ];

    const AVAILABLE_PERIODS = [1, 2, 3, 5, 6, 7]; // skip break (4) and lunch (8)

    // 5. Build allocation queue: expand each subject by periods_per_week
    const queue = [];
    for (const subj of subjects) {
      for (let i = 0; i < (subj.periods_per_week || 4); i++) {
        queue.push({ ...subj });
      }
    }

    // Shuffle queue for variety
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }

    // 6. Track usage per day per subject (max 2 same subject per day)
    // Slots: day → period → filled?
    const slots = {};
    DAYS.forEach(d => {
      slots[d] = {};
      AVAILABLE_PERIODS.forEach(p => { slots[d][p] = null; });
    });

    const daySubjectCount = {};
    DAYS.forEach(d => { daySubjectCount[d] = {}; });

    const assigned = [];
    const unassigned = [];

    for (const item of queue) {
      let placed = false;

      // Try each day/period combo in random order
      const dayOrder = [...DAYS].sort(() => Math.random() - 0.5);

      for (const day of dayOrder) {
        if (placed) break;
        const periodOrder = [...AVAILABLE_PERIODS].sort(() => Math.random() - 0.5);

        for (const period of periodOrder) {
          if (placed) break;
          if (slots[day][period] !== null) continue; // slot taken
          if (blocked.has(`${item.teacher_id}:${day}:${period}`)) continue; // teacher busy
          const dayCount = daySubjectCount[day][item.subject_id] || 0;
          if (dayCount >= 2) continue; // max 2 same subject per day

          // Place it
          slots[day][period] = item.subject_id;
          daySubjectCount[day][item.subject_id] = dayCount + 1;
          blocked.add(`${item.teacher_id}:${day}:${period}`);
          const pt = periodTimes[period - 1] || { start: '07:30', end: '08:15' };
          assigned.push({
            class_id, subject_id: item.subject_id, teacher_id: item.teacher_id,
            day_of_week: day, period_number: period,
            start_time: pt.start, end_time: pt.end,
            term, academic_year,
          });
          placed = true;
        }
      }

      if (!placed) unassigned.push(item.subject_name);
    }

    // 7. Insert all assigned entries
    for (const entry of assigned) {
      await pool.query(
        `INSERT INTO timetable
          (class_id,subject_id,teacher_id,day_of_week,period_number,
           start_time,end_time,term,academic_year,is_generated,is_approved)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,FALSE)
         ON CONFLICT DO NOTHING`,
        [entry.class_id, entry.subject_id, entry.teacher_id,
         entry.day_of_week, entry.period_number, entry.start_time,
         entry.end_time, entry.term, entry.academic_year]
      );
    }

    return success(res, {
      assigned:   assigned.length,
      unassigned: unassigned.length,
      conflicts:  unassigned,
      message: unassigned.length === 0
        ? `Timetable generated successfully — ${assigned.length} periods scheduled`
        : `Generated ${assigned.length} periods. ${unassigned.length} could not be placed due to teacher conflicts: ${[...new Set(unassigned)].join(', ')}`,
    });

  } catch (err) { return serverError(res, err); }
}

// ── POST /api/timetable/approve ───────────────────────────
async function approveTimetable(req, res) {
  const { class_id, term, academic_year } = req.body;
  if (!class_id || !term || !academic_year)
    return error(res, 'class_id, term and academic_year required');
  try {
    const { rowCount } = await pool.query(
      `UPDATE timetable SET is_approved = TRUE
       WHERE class_id = $1 AND term = $2 AND academic_year = $3`,
      [class_id, term, academic_year]
    );
    return success(res, { updated: rowCount }, `Timetable approved — ${rowCount} entries locked`);
  } catch (err) { return serverError(res, err); }
}

// ── POST /api/timetable/regenerate ────────────────────────
async function regenerateTimetable(req, res) {
  const { class_id, term, academic_year } = req.body;
  if (!class_id || !term || !academic_year)
    return error(res, 'class_id, term and academic_year required');
  try {
    // Unapprove first, then regenerate
    await pool.query(
      `UPDATE timetable SET is_approved = FALSE
       WHERE class_id = $1 AND term = $2 AND academic_year = $3`,
      [class_id, term, academic_year]
    );
    req.body = { class_id, term, academic_year };
    return generateTimetable(req, res);
  } catch (err) { return serverError(res, err); }
}

// ── Teacher assignments (unchanged) ──────────────────────
async function listAssignments(req, res) {
  const { class_id, term, academic_year } = req.query;
  const conditions = ['TRUE']; const params = [];
  if (class_id)      conditions.push(`ta.class_id = $${params.push(class_id)}`);
  if (term)          conditions.push(`ta.term = $${params.push(term)}`);
  if (academic_year) conditions.push(`ta.academic_year = $${params.push(academic_year)}`);
  try {
    const { rows } = await pool.query(
      `SELECT ta.id, ta.term, ta.academic_year,
              s.name AS subject_name, s.id AS subject_id,
              c.name AS class_name, c.section, c.id AS class_id,
              u.name AS teacher_name, te.id AS teacher_id
       FROM teacher_assignments ta
       JOIN subjects s ON s.id = ta.subject_id
       JOIN classes  c ON c.id = ta.class_id
       JOIN teachers te ON te.id = ta.teacher_id
       JOIN users    u  ON u.id = te.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.name, s.name`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function assign(req, res) {
  const { teacher_id, subject_id, class_id, term, academic_year } = req.body;
  if (!teacher_id || !subject_id || !class_id || !term || !academic_year)
    return error(res, 'teacher_id, subject_id, class_id, term and academic_year required');
  try {
    const { rows: [r] } = await pool.query(
      `INSERT INTO teacher_assignments (teacher_id,subject_id,class_id,term,academic_year)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (subject_id,class_id,term,academic_year)
       DO UPDATE SET teacher_id = $1 RETURNING id`,
      [teacher_id, subject_id, class_id, term, academic_year]
    );
    return created(res, { id: r.id }, 'Teacher assigned');
  } catch (err) { return serverError(res, err); }
}

async function removeAssignment(req, res) {
  try {
    await pool.query('DELETE FROM teacher_assignments WHERE id = $1', [req.params.id]);
    return success(res, {}, 'Assignment removed');
  } catch (err) { return serverError(res, err); }
}

module.exports = {
  getClassTimetable, getTeacherTimetable,
  addEntry, updateEntry, removeEntry,
  generateTimetable, regenerateTimetable, approveTimetable,
  listAssignments, assign, removeAssignment,
};