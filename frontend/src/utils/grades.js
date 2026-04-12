export function toLetterGrade(score) {
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 55) return 'C+';
  if (score >= 50) return 'C';
  if (score >= 45) return 'D+';
  if (score >= 40) return 'D';
  return 'F';
}

export function gradeColor(g) {
  if (!g) return 'gray';
  if (g === 'A')              return 'green';
  if (g === 'B+' || g === 'B') return 'blue';
  if (g === 'C+' || g === 'C') return 'amber';
  return 'red';
}
