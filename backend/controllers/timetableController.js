const { pool } = require('../config/db');
const { success, created, error, notFound, serverError } = require('../utils/response');

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday'];

// ── Period structure: 55-min lessons + 5-min refresh ─────────────
// Short break: 09:00-09:30 (immediately after P1 ends + 5 min refresh)
// Lunch break: 12:15-13:00 (45 min)
// School ends: ~16:00 after P7
const PERIOD_TIMES = {
  1: { start: '08:00', end: '08:55', label: '08:00–08:55' },
  2: { start: '09:30', end: '10:25', label: '09:30–10:25' },
  3: { start: '10:30', end: '11:25', label: '10:30–11:25' },
  4: { start: '11:30', end: '12:15', label: '11:30–12:15' },
  5: { start: '13:00', end: '13:55', label: '13:00–13:55' },
  6: { start: '14:00', end: '14:55', label: '14:00–14:55' },
  7: { start: '15:00', end: '15:55', label: '15:00–15:55' },
};
const ALL_PERIODS = [1, 2, 3, 4, 5, 6, 7];

// Pairs of period numbers that are truly consecutive (only 5-min refresh between them)
// P1→P2 has 35-min break, NOT adjacent
// P4→P5 has 45-min lunch, NOT adjacent
const ADJACENT = new Set(['2-3', '3-4', '5-6', '6-7']);
function areAdjacent(p1, p2) {
  const lo = Math.min(p1, p2), hi = Math.max(p1, p2);
  return ADJACENT.has(`${lo}-${hi}`);
}

// Determine class academic level from name
function classLevel(className = '') {
  const n = className.toLowerCase();
  if (/jhs/.test(n))                            return 'jhs';
  if (/primary/.test(n))                        return 'primary';
  return 'basic'; // creche, nursery, kg
}

// Does Wednesday worship apply to this class given the school setting?
function worshipApplies(level, setting) {
  if (!setting || setting === 'none') return false;
  if (setting === 'all')             return true;
  if (setting === 'primary')         return level !== 'jhs';   // basic + primary
  if (setting === 'jhs')             return level === 'jhs';
  return false;
}

// Periods available for a given day (worship removes P1 on Wednesday for affected levels)
function availablePeriodsForDay(day, skipP1) {
  if (day === 'Wednesday' && skipP1) return [2, 3, 4, 5, 6, 7];
  return ALL_PERIODS;
}

// Check if placing subjectId at (day, period) would create 3+ consecutive periods
function wouldExceedConsecutive(day, period, subjectId, slots, max = 2) {
  // Find the run that would result from this placement
  let lo = period, hi = period;
  while (lo > 1 && slots[day][lo - 1] === subjectId && areAdjacent(lo - 1, lo)) lo--;
  while (hi < 7 && slots[day][hi + 1] === subjectId && areAdjacent(hi, hi + 1)) hi++;
  return (hi - lo + 1) > max;
}

// ── GET /api/timetable/class ──────────────────────────────────────
async function getClassTimetable(req, res) {
  const { class_id, term, academic_year } = req.query;
  if (!class_id) return error(res, 'class_id required');
  try {
    const { rows } = await pool.query(
      `SELECT t.id, t.day_of_week, t.period_number, t.start_time, t.end_time,
              t.is_approved, t.is_generated, t.is_free,
              s.name AS subject_name, s.id AS subject_id,
              u.name AS teacher_name, te.id AS teacher_id
       FROM timetable t
       LEFT JOIN subjects s  ON s.id  = t.subject_id
       LEFT JOIN teachers te ON te.id = t.teacher_id
       LEFT JOIN users    u  ON u.id  = te.user_id
       WHERE t.class_id = $1
         AND t.term          = COALESCE($2, t.term)
         AND t.academic_year = COALESCE($3, t.academic_year)
       ORDER BY
         ARRAY_POSITION(ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], t.day_of_week),
         t.period_number`,
      [class_id, term || null, academic_year || null]
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// ── GET /api/timetable/teacher ────────────────────────────────────
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
      [teacher_id, term || null, academic_year || null]
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// ── POST /api/timetable ───────────────────────────────────────────
async function addEntry(req, res) {
  const { class_id, subject_id, teacher_id, day_of_week,
          period_number, start_time, end_time, term, academic_year } = req.body;
  if (!class_id || !subject_id || !teacher_id || !day_of_week || !period_number)
    return error(res, 'class_id, subject_id, teacher_id, day_of_week and period_number required');
  try {
    const { rows: clash } = await pool.query(
      `SELECT id FROM timetable
       WHERE teacher_id = $1 AND day_of_week = $2 AND period_number = $3
         AND term = $4 AND academic_year = $5`,
      [teacher_id, day_of_week, period_number, term, academic_year]
    );
    if (clash[0]) return error(res, 'Teacher is already assigned elsewhere at this time', 409);

    const pt = PERIOD_TIMES[period_number] || PERIOD_TIMES[1];
    const { rows: [r] } = await pool.query(
      `INSERT INTO timetable
        (class_id,subject_id,teacher_id,day_of_week,period_number,
         start_time,end_time,term,academic_year,is_generated)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,FALSE) RETURNING id`,
      [class_id, subject_id, teacher_id, day_of_week, period_number,
       start_time || pt.start, end_time || pt.end, term, academic_year]
    );
    return created(res, { id: r.id }, 'Entry added');
  } catch (err) {
    if (err.code === '23505') return error(res, 'This slot is already taken for this class', 409);
    return serverError(res, err);
  }
}

// ── PUT /api/timetable/:id ────────────────────────────────────────
async function updateEntry(req, res) {
  const { teacher_id, start_time, end_time } = req.body;
  try {
    await pool.query(
      `UPDATE timetable SET
         teacher_id = COALESCE($1, teacher_id),
         start_time = COALESCE($2, start_time),
         end_time   = COALESCE($3, end_time)
       WHERE id = $4`,
      [teacher_id || null, start_time || null, end_time || null, req.params.id]
    );
    return success(res, {}, 'Entry updated');
  } catch (err) { return serverError(res, err); }
}

// ── DELETE /api/timetable/:id ─────────────────────────────────────
async function removeEntry(req, res) {
  try {
    await pool.query('DELETE FROM timetable WHERE id = $1', [req.params.id]);
    return success(res, {}, 'Entry removed');
  } catch (err) { return serverError(res, err); }
}

// ── POST /api/timetable/generate ─────────────────────────────────
async function generateTimetable(req, res) {
  const {
    class_id, term, academic_year,
    worship_wednesday = 'none',   // 'none' | 'all' | 'primary' | 'jhs'
    free_period       = true,     // reserve 1 empty non-P1 slot per class per week
    pinned            = [],       // [{subject_id, teacher_id, day, period}]
  } = req.body;

  if (!class_id || !term || !academic_year)
    return error(res, 'class_id, term and academic_year required');

  try {
    // 1. Get class details (name for level detection)
    const { rows: [cls] } = await pool.query(
      'SELECT id, name, section FROM classes WHERE id = $1', [class_id]
    );
    if (!cls) return notFound(res, 'Class not found');

    const level    = classLevel(cls.name);
    const skipP1   = worshipApplies(level, worship_wednesday);

    // 2. Get subjects with assigned teachers
    const { rows: subjects } = await pool.query(
      `SELECT s.id AS subject_id, s.name AS subject_name,
              s.periods_per_week, t.id AS teacher_id
       FROM subjects s
       JOIN teachers t ON t.user_id = s.teacher_id
       WHERE s.class_id = $1 AND s.teacher_id IS NOT NULL`,
      [class_id]
    );
    if (subjects.length === 0)
      return error(res, 'No subjects with assigned teachers found. Assign teachers to subjects first.');

    // 3. Cross-class teacher clash map
    const { rows: existing } = await pool.query(
      `SELECT teacher_id, day_of_week, period_number
       FROM timetable
       WHERE term = $1 AND academic_year = $2 AND class_id != $3`,
      [term, academic_year, class_id]
    );
    const blocked = new Set(existing.map(e => `${e.teacher_id}:${e.day_of_week}:${e.period_number}`));

    // 4. Delete previous generated entries for this class
    await pool.query(
      `DELETE FROM timetable
       WHERE class_id = $1 AND term = $2 AND academic_year = $3 AND is_generated = TRUE`,
      [class_id, term, academic_year]
    );

    // 5. Build slot grid
    const slots = {};
    DAYS.forEach(d => {
      slots[d] = {};
      availablePeriodsForDay(d, skipP1).forEach(p => { slots[d][p] = null; });
    });

    const daySubjectCount  = {};
    const weekSubjectCount = {};
    DAYS.forEach(d => { daySubjectCount[d] = {}; });

    const assigned   = [];
    const unassigned = [];

    // Helper: place one entry
    function placeEntry(day, period, subjectId, teacherId, isFree = false) {
      slots[day][period] = subjectId;
      if (!isFree) {
        daySubjectCount[day][subjectId]  = (daySubjectCount[day][subjectId]  || 0) + 1;
        weekSubjectCount[subjectId]       = (weekSubjectCount[subjectId]       || 0) + 1;
      }
      blocked.add(`${teacherId}:${day}:${period}`);
      const pt = PERIOD_TIMES[period] || PERIOD_TIMES[1];
      assigned.push({
        class_id, subject_id: isFree ? null : subjectId,
        teacher_id: isFree ? null : teacherId,
        day_of_week: day, period_number: period,
        start_time: pt.start, end_time: pt.end,
        term, academic_year,
        is_free: isFree,
      });
    }

    // 6. Handle pinned entries first (e.g. PE on Friday P6)
    for (const pin of pinned) {
      const { subject_id, day, period } = pin;
      // Find teacher for this subject
      const subj = subjects.find(s => s.subject_id === parseInt(subject_id));
      if (!subj) continue;
      const avail = availablePeriodsForDay(day, skipP1);
      if (!avail.includes(parseInt(period))) continue;
      if (slots[day][parseInt(period)] !== null) continue;
      if (blocked.has(`${subj.teacher_id}:${day}:${period}`)) continue;
      placeEntry(day, parseInt(period), subj.subject_id, subj.teacher_id);
    }

    // 7. Build allocation queue: MAX 2 periods per subject per week
    const MAX_PER_WEEK = 2;
    const queue = [];
    for (const subj of subjects) {
      // Check if already placed by pinning
      const alreadyPinned = weekSubjectCount[subj.subject_id] || 0;
      const toPlace = Math.min(MAX_PER_WEEK - alreadyPinned, MAX_PER_WEEK);
      for (let i = 0; i < toPlace; i++) {
        queue.push({ ...subj });
      }
    }

    // Shuffle for variety
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }

    // 8. Place each subject
    for (const item of queue) {
      // Already at max for the week?
      if ((weekSubjectCount[item.subject_id] || 0) >= MAX_PER_WEEK) continue;

      let placed = false;
      const dayOrder = [...DAYS].sort(() => Math.random() - 0.5);

      for (const day of dayOrder) {
        if (placed) break;
        const avail = availablePeriodsForDay(day, skipP1);
        const periodOrder = [...avail].sort(() => Math.random() - 0.5);

        for (const period of periodOrder) {
          if (placed) break;
          if (slots[day][period] !== null) continue;               // slot taken
          if (blocked.has(`${item.teacher_id}:${day}:${period}`)) continue; // teacher busy

          // Max 2 same subject per day
          if ((daySubjectCount[day][item.subject_id] || 0) >= MAX_PER_WEEK) continue;

          // No 3+ consecutive same subject
          if (wouldExceedConsecutive(day, period, item.subject_id, slots, 2)) continue;

          placeEntry(day, period, item.subject_id, item.teacher_id);
          placed = true;
        }
      }

      if (!placed) unassigned.push(item.subject_name);
    }

    // 9. Designate 1 free period per class (any non-P1 empty slot)
    if (free_period) {
      let freePlaced = false;
      const dayOrder = [...DAYS].sort(() => Math.random() - 0.5);
      for (const day of dayOrder) {
        if (freePlaced) break;
        const avail = availablePeriodsForDay(day, skipP1).filter(p => p !== 1);
        for (const period of avail) {
          if (slots[day][period] === null) {
            // Mark as free
            slots[day][period] = 'FREE';
            const pt = PERIOD_TIMES[period] || PERIOD_TIMES[1];
            assigned.push({
              class_id, subject_id: null, teacher_id: null,
              day_of_week: day, period_number: period,
              start_time: pt.start, end_time: pt.end,
              term, academic_year, is_free: true,
            });
            freePlaced = true;
            break;
          }
        }
      }
    }

    // 10. Insert all entries
    for (const entry of assigned) {
      if (entry.is_free) {
        // Check if is_free column exists — insert free period entry
        try {
          await pool.query(
            `INSERT INTO timetable
              (class_id, subject_id, teacher_id, day_of_week, period_number,
               start_time, end_time, term, academic_year, is_generated, is_approved, is_free)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,FALSE,TRUE)
             ON CONFLICT DO NOTHING`,
            [entry.class_id, null, null, entry.day_of_week, entry.period_number,
             entry.start_time, entry.end_time, entry.term, entry.academic_year]
          );
        } catch {
          // is_free column may not exist yet — insert without it
          await pool.query(
            `INSERT INTO timetable
              (class_id, subject_id, teacher_id, day_of_week, period_number,
               start_time, end_time, term, academic_year, is_generated, is_approved)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,FALSE)
             ON CONFLICT DO NOTHING`,
            [entry.class_id, null, null, entry.day_of_week, entry.period_number,
             entry.start_time, entry.end_time, entry.term, entry.academic_year]
          );
        }
      } else {
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
    }

    const placed = assigned.filter(a => !a.is_free).length;
    return success(res, {
      assigned:   placed,
      unassigned: unassigned.length,
      conflicts:  [...new Set(unassigned)],
      worship_applied: skipP1 ? `Wednesday P1 blocked (${worship_wednesday} worship)` : null,
      message: unassigned.length === 0
        ? `Timetable generated — ${placed} periods scheduled`
        : `Generated ${placed} periods. Could not place: ${[...new Set(unassigned)].join(', ')}`,
    });

  } catch (err) { return serverError(res, err); }
}

// ── POST /api/timetable/regenerate ────────────────────────────────
async function regenerateTimetable(req, res) {
  const { class_id, term, academic_year } = req.body;
  if (!class_id || !term || !academic_year)
    return error(res, 'class_id, term and academic_year required');
  try {
    await pool.query(
      `UPDATE timetable SET is_approved = FALSE
       WHERE class_id = $1 AND term = $2 AND academic_year = $3`,
      [class_id, term, academic_year]
    );
    return generateTimetable(req, res);
  } catch (err) { return serverError(res, err); }
}

// ── POST /api/timetable/approve ───────────────────────────────────
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

// ── Teacher assignments ───────────────────────────────────────────
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
       JOIN subjects s  ON s.id  = ta.subject_id
       JOIN classes  c  ON c.id  = ta.class_id
       JOIN teachers te ON te.id = ta.teacher_id
       JOIN users    u  ON u.id  = te.user_id
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