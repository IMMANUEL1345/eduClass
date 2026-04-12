// Convert numeric score to letter grade (Ghana GES grading system)
function toLetterGrade(score) {
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 55) return 'C+';
  if (score >= 50) return 'C';
  if (score >= 45) return 'D+';
  if (score >= 40) return 'D';
  return 'F';
}

// Generate a unique ID prefix + timestamp token
function generateCode(prefix = '') {
  return `${prefix}${Date.now().toString(36).toUpperCase()}`;
}

// Paginate a SQL query — returns { limit, offset, page }
function paginate(query) {
  const page   = Math.max(1, parseInt(query.page) || 1);
  const limit  = Math.min(100, parseInt(query.limit) || 20);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

module.exports = { toLetterGrade, generateCode, paginate };
