const { pool } = require('../config/db');
const { success, created, error, notFound, serverError } = require('../utils/response');
const { toLetterGrade } = require('../utils/helpers');

// ── Helpers ───────────────────────────────────────────────
function calcFinal(scores, weights) {
  const components = [
    { score: scores.classwork, weight: parseFloat(weights.classwork_weight || 0) },
    { score: scores.homework,  weight: parseFloat(weights.homework_weight  || 0) },
    { score: scores.midterm,   weight: parseFloat(weights.midterm_weight   || 0) },
    { score: scores.project,   weight: parseFloat(weights.project_weight   || 0) },
    { score: scores.exam,      weight: parseFloat(weights.exam_weight      || 0) },
  ].filter(c => c.weight > 0);

  const allFilled = components.every(c => c.score !== null && c.score !== undefined && c.score !== '');
  if (!allFilled) return null;

  const final = components.reduce((sum, c) => sum + (parseFloat(c.score) * c.weight / 100), 0);
  return Math.round(final * 10) / 10;
}

const DEFAULT_WEIGHTS = {
  classwork_weight: 10, homework_weight: 10,
  midterm_weight: 20, project_weight: 0, exam_weight: 60,
};

// ── WEIGHTS ───────────────────────────────────────────────

// GET /api/grades/weights?subject_id=
async function getWeights(req, res) {
  const { subject_id } = req.query;
  if (!subject_id) return error(res, 'subject_id required');
  try {
    const { rows: [w] } = await pool.query(
      'SELECT * FROM subject_assessment_weights WHERE subject_id=$1', [subject_id]
    );
    return success(res, w || { ...DEFAULT_WEIGHTS, subject_id: parseInt(subject_id) });
  } catch (err) { return serverError(res, err); }
}

// POST /api/grades/weights
async function setWeights(req, res) {
  const { subject_id, classwork_weight, homework_weight,
          midterm_weight, project_weight, exam_weight } = req.body;
  if (!subject_id) return error(res, 'subject_id required');

  const total = [classwork_weight, homework_weight, midterm_weight, project_weight, exam_weight]
    .reduce((s, v) => s + parseFloat(v || 0), 0);
  if (Math.abs(total - 100) > 0.1)
    return error(res, `Weights must sum to 100 (currently ${total})`);

  try {
    await pool.query(
      `INSERT INTO subject_assessment_weights
        (subject_id, classwork_weight, homework_weight, midterm_weight, project_weight, exam_weight)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (subject_id) DO UPDATE SET
         classwork_weight=$2, homework_weight=$3, midterm_weight=$4,
         project_weight=$5,   exam_weight=$6`,
      [subject_id,
       classwork_weight || 0, homework_weight || 0, midterm_weight || 0,
       project_weight   || 0, exam_weight     || 0]
    );
    return success(res, {}, 'Weights saved');
  } catch (err) { return serverError(res, err); }
}

// ── GRADE SCORES ─────────────────────────────────────────

// GET /api/grades/scores?subject_id=&class_id=&term=&academic_year=
async function getClassScores(req, res) {
  const { subject_id, class_id, term, academic_year } = req.query;
  if (!subject_id || !class_id) return error(res, 'subject_id and class_id required');

  try {
    // Left join so we get all students even if no grade yet
    const { rows } = await pool.query(
      `SELECT
         s.id           AS student_id,
         u.name         AS student_name,
         s.student_number,
         gs.id          AS grade_id,
         gs.classwork_score,
         gs.homework_score,
         gs.midterm_score,
         gs.project_score,
         gs.exam_score,
         gs.final_score,
         gs.letter_grade,
         gs.updated_at
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN grade_scores gs
         ON gs.student_id = s.id
         AND gs.subject_id = $1
         AND gs.term = $2
         AND gs.academic_year = $3
       WHERE s.class_id = $4
       ORDER BY u.name`,
      [subject_id, term || 'Term 1', academic_year, class_id]
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// POST /api/grades/scores — bulk upsert all components
async function bulkUpsert(req, res) {
  const { subject_id, term, academic_year, scores } = req.body;
  if (!subject_id || !term || !academic_year || !Array.isArray(scores) || !scores.length)
    return error(res, 'subject_id, term, academic_year and scores are required');

  // Get weights for this subject
  const { rows: [w] } = await pool.query(
    'SELECT * FROM subject_assessment_weights WHERE subject_id=$1', [subject_id]
  ).catch(() => ({ rows: [] }));
  const weights = w || DEFAULT_WEIGHTS;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let saved = 0;

    for (const s of scores) {
      const cw   = s.classwork  != null && s.classwork  !== '' ? parseFloat(s.classwork)  : null;
      const hw   = s.homework   != null && s.homework   !== '' ? parseFloat(s.homework)   : null;
      const mid  = s.midterm    != null && s.midterm    !== '' ? parseFloat(s.midterm)    : null;
      const proj = s.project    != null && s.project    !== '' ? parseFloat(s.project)    : null;
      const exam = s.exam       != null && s.exam       !== '' ? parseFloat(s.exam)       : null;

      // Skip row if nothing is filled
      if ([cw, hw, mid, proj, exam].every(v => v === null)) continue;

      const final  = calcFinal({ classwork: cw, homework: hw, midterm: mid, project: proj, exam }, weights);
      const letter = final != null ? toLetterGrade(final) : null;

      await client.query(
        `INSERT INTO grade_scores
          (student_id, subject_id, term, academic_year,
           classwork_score, homework_score, midterm_score, project_score, exam_score,
           final_score, letter_grade, entered_by, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
         ON CONFLICT (student_id, subject_id, term, academic_year) DO UPDATE SET
           classwork_score = COALESCE(EXCLUDED.classwork_score, grade_scores.classwork_score),
           homework_score  = COALESCE(EXCLUDED.homework_score,  grade_scores.homework_score),
           midterm_score   = COALESCE(EXCLUDED.midterm_score,   grade_scores.midterm_score),
           project_score   = COALESCE(EXCLUDED.project_score,   grade_scores.project_score),
           exam_score      = COALESCE(EXCLUDED.exam_score,      grade_scores.exam_score),
           final_score     = EXCLUDED.final_score,
           letter_grade    = EXCLUDED.letter_grade,
           entered_by      = EXCLUDED.entered_by,
           updated_at      = NOW()`,
        [s.student_id, subject_id, term, academic_year,
         cw, hw, mid, proj, exam, final, letter, req.user.id]
      );
      saved++;
    }

    await client.query('COMMIT');
    return success(res, { count: saved }, `${saved} grade records saved`);
  } catch (err) {
    await client.query('ROLLBACK');
    return serverError(res, err);
  } finally { client.release(); }
}

// ── LEGACY: keep old endpoints working ───────────────────

async function submit(req, res) {
  const { subject_id, assessment_type, term, academic_year, scores } = req.body;
  if (!Array.isArray(scores) || !scores.length) return error(res, 'scores array is required');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const s of scores) {
      const letter = toLetterGrade(s.score);
      await client.query(
        `INSERT INTO grades (student_id,subject_id,score,letter_grade,assessment_type,term,academic_year,entered_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT DO NOTHING`,
        [s.student_id, subject_id, s.score, letter, assessment_type, term, academic_year, req.user.id]
      );
    }
    await client.query('COMMIT');
    return created(res, { count: scores.length }, 'Grades submitted');
  } catch (err) { await client.query('ROLLBACK'); return serverError(res, err); }
  finally { client.release(); }
}

async function query(req, res) {
  const { subject_id, term, academic_year, assessment_type } = req.query;
  const conditions = ['TRUE']; const params = [];
  if (subject_id)      conditions.push(`g.subject_id = $${params.push(subject_id)}`);
  if (term)            conditions.push(`g.term = $${params.push(term)}`);
  if (academic_year)   conditions.push(`g.academic_year = $${params.push(academic_year)}`);
  if (assessment_type) conditions.push(`g.assessment_type = $${params.push(assessment_type)}`);
  try {
    const { rows } = await pool.query(
      `SELECT g.id, g.score, g.letter_grade, g.assessment_type, g.term, g.academic_year, g.created_at,
              u.name AS student_name, s.student_number, sub.name AS subject_name
       FROM grades g
       JOIN students s   ON s.id = g.student_id
       JOIN users u      ON u.id = s.user_id
       JOIN subjects sub ON sub.id = g.subject_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY u.name, g.created_at DESC`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function update(req, res) {
  const { score } = req.body;
  if (score === undefined) return error(res, 'score is required');
  const letter = toLetterGrade(score);
  try {
    const { rowCount } = await pool.query(
      'UPDATE grades SET score=$1, letter_grade=$2 WHERE id=$3', [score, letter, req.params.id]
    );
    if (rowCount === 0) return notFound(res, 'Grade not found');
    return success(res, {}, 'Grade updated');
  } catch (err) { return serverError(res, err); }
}

async function remove(req, res) {
  try {
    const { rowCount } = await pool.query('DELETE FROM grades WHERE id=$1', [req.params.id]);
    if (rowCount === 0) return notFound(res, 'Grade not found');
    return success(res, {}, 'Grade removed');
  } catch (err) { return serverError(res, err); }
}

async function leaderboard(req, res) {
  const { term, academic_year } = req.query;
  const conditions = [`s.class_id = $1`]; const params = [req.params.classId];
  if (term)          conditions.push(`g.term = $${params.push(term)}`);
  if (academic_year) conditions.push(`g.academic_year = $${params.push(academic_year)}`);
  try {
    // Try new grade_scores first, fall back to old grades
    const { rows } = await pool.query(
      `SELECT u.name AS student_name, s.student_number,
              ROUND(AVG(gs.final_score)::numeric, 1) AS average,
              RANK() OVER (ORDER BY AVG(gs.final_score) DESC) AS position
       FROM grade_scores gs
       JOIN students s ON s.id = gs.student_id
       JOIN users u    ON u.id = s.user_id
       WHERE s.class_id = $1
         ${term          ? `AND gs.term = $${params.indexOf(term) + 1}` : ''}
         ${academic_year ? `AND gs.academic_year = $${params.indexOf(academic_year) + 1}` : ''}
       GROUP BY s.id, u.name, s.student_number
       ORDER BY average DESC`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}



// ── CLASSWORK / HOMEWORK ENTRIES ─────────────────────────

// GET /api/grades/entries?student_id=&subject_id=&type=&term=&academic_year=
async function getEntries(req, res) {
  const { student_id, subject_id, type, term, academic_year } = req.query;
  if (!subject_id) return error(res, 'subject_id required');
  const conds = ['ce.subject_id=$1']; const params = [subject_id];
  if (student_id)    conds.push(`ce.student_id=$${params.push(student_id)}`);
  if (type)          conds.push(`ce.type=$${params.push(type)}`);
  if (term)          conds.push(`ce.term=$${params.push(term)}`);
  if (academic_year) conds.push(`ce.academic_year=$${params.push(academic_year)}`);
  try {
    const { rows } = await pool.query(
      `SELECT ce.*, u.name AS student_name, s.student_number
       FROM classwork_entries ce
       JOIN students s ON s.id = ce.student_id
       JOIN users u    ON u.id = s.user_id
       WHERE ${conds.join(' AND ')}
       ORDER BY ce.entry_date DESC, u.name`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// POST /api/grades/entries — add one or bulk entries for a date
// Body: { subject_id, type, entry_date, title, max_score, term, academic_year, scores:[{student_id, score}] }
async function addEntries(req, res) {
  const { subject_id, type, entry_date, title, max_score, term, academic_year, scores } = req.body;
  if (!subject_id || !type || !Array.isArray(scores) || !scores.length)
    return error(res, 'subject_id, type and scores required');
  if (!['classwork','homework'].includes(type))
    return error(res, 'type must be classwork or homework');

  const maxSc   = parseFloat(max_score) || 10;
  const entDate = entry_date || new Date().toISOString().split('T')[0];
  const entTitle = title || `${type === 'classwork' ? 'Classwork' : 'Homework'} — ${new Date(entDate).toLocaleDateString('en-GB')}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let saved = 0;
    for (const s of scores) {
      if (s.score === null || s.score === undefined || s.score === '') continue;
      await client.query(
        `INSERT INTO classwork_entries
          (student_id, subject_id, type, entry_date, title, score, max_score, term, academic_year, entered_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (student_id, subject_id, type, entry_date, term, academic_year, title)
         DO UPDATE SET score=$6, max_score=$7, entered_by=$10`,
        [s.student_id, subject_id, type, entDate, entTitle,
         parseFloat(s.score), maxSc, term, academic_year, req.user.id]
      );
      saved++;
    }

    // After saving entries, recompute avg for affected students → update grade_scores
    const { rows: weights } = await client.query(
      'SELECT * FROM subject_assessment_weights WHERE subject_id=$1', [subject_id]
    );
    const w = weights[0] || DEFAULT_WEIGHTS;

    const studentIds = [...new Set(scores.map(s => s.student_id))];
    for (const sid of studentIds) {
      // Compute avg for this type
      const { rows: [avg] } = await client.query(
        `SELECT ROUND(AVG(score / max_score * 100)::numeric, 2) AS avg_pct
         FROM classwork_entries
         WHERE student_id=$1 AND subject_id=$2 AND type=$3 AND term=$4 AND academic_year=$5`,
        [sid, subject_id, type, term, academic_year]
      );
      const avgScore = avg?.avg_pct ?? null;
      if (avgScore === null) continue;

      const colName = type === 'classwork' ? 'classwork_score' : 'homework_score';

      // Upsert into grade_scores
      await client.query(
        `INSERT INTO grade_scores
          (student_id, subject_id, term, academic_year, ${colName}, entered_by, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,NOW())
         ON CONFLICT (student_id, subject_id, term, academic_year) DO UPDATE
           SET ${colName}=EXCLUDED.${colName}, entered_by=EXCLUDED.entered_by, updated_at=NOW()`,
        [sid, subject_id, term, academic_year, avgScore, req.user.id]
      );

      // Recalculate final if all components present
      const { rows: [gs] } = await client.query(
        `SELECT classwork_score, homework_score, midterm_score, project_score, exam_score
         FROM grade_scores WHERE student_id=$1 AND subject_id=$2 AND term=$3 AND academic_year=$4`,
        [sid, subject_id, term, academic_year]
      );
      if (gs) {
        const fin = calcFinal({
          classwork: gs.classwork_score, homework: gs.homework_score,
          midterm: gs.midterm_score,     project:  gs.project_score,
          exam:    gs.exam_score,
        }, w);
        if (fin !== null) {
          const letter = toLetterGrade(fin);
          await client.query(
            `UPDATE grade_scores SET final_score=$1, letter_grade=$2
             WHERE student_id=$3 AND subject_id=$4 AND term=$5 AND academic_year=$6`,
            [fin, letter, sid, subject_id, term, academic_year]
          );
        }
      }
    }

    await client.query('COMMIT');
    return success(res, { count: saved }, `${saved} entries saved`);
  } catch (err) {
    await client.query('ROLLBACK');
    return serverError(res, err);
  } finally { client.release(); }
}

// DELETE /api/grades/entries/:id
async function deleteEntry(req, res) {
  try {
    await pool.query('DELETE FROM classwork_entries WHERE id=$1', [req.params.id]);
    return success(res, {}, 'Entry deleted');
  } catch (err) { return serverError(res, err); }
}

// GET /api/grades/student-record?student_id=&subject_id=&term=&academic_year=
async function studentRecord(req, res) {
  const { student_id, subject_id, term, academic_year } = req.query;
  if (!student_id || !subject_id) return error(res, 'student_id and subject_id required');
  try {
    const [entRows, gsRows, wRows] = await Promise.all([
      pool.query(
        `SELECT * FROM classwork_entries
         WHERE student_id=$1 AND subject_id=$2 AND term=$3 AND academic_year=$4
         ORDER BY type, entry_date DESC`,
        [student_id, subject_id, term, academic_year]
      ),
      pool.query(
        `SELECT gs.*, u.name AS student_name, s.student_number
         FROM grade_scores gs
         JOIN students s ON s.id = gs.student_id
         JOIN users u    ON u.id = s.user_id
         WHERE gs.student_id=$1 AND gs.subject_id=$2 AND gs.term=$3 AND gs.academic_year=$4`,
        [student_id, subject_id, term, academic_year]
      ),
      pool.query(
        'SELECT * FROM subject_assessment_weights WHERE subject_id=$1', [subject_id]
      ),
    ]);
    return success(res, {
      entries:  entRows.rows,
      scores:   gsRows.rows[0] || null,
      weights:  wRows.rows[0] || DEFAULT_WEIGHTS,
    });
  } catch (err) { return serverError(res, err); }
}

module.exports = {
  submit, query, update, remove, leaderboard,
  getWeights, setWeights,
  getClassScores, bulkUpsert,
  getEntries, addEntries, deleteEntry, studentRecord,
};