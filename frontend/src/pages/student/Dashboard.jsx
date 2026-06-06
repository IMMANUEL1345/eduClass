import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';
import { gradeAPI, commsAPI, studentAPI, attendanceAPI } from '../../api';
import { StatCard, Card, Badge, PageHeader, Spinner } from '../../components/ui';
import { gradeColor } from '../../utils/grades';
import toast from 'react-hot-toast';

const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;

const TERMS = ['Term 1', 'Term 2', 'Term 3'];
function currentTerm() {
  const m = new Date().getMonth(); // 0-indexed
  if (m < 4)  return 'Term 2';    // Jan–Apr
  if (m < 8)  return 'Term 3';    // May–Aug
  return 'Term 1';                 // Sep–Dec
}

function gradeColorClass(g) {
  if (!g) return 'text-gray-400';
  if (g === 'A')          return 'text-green-600';
  if (g.startsWith('B')) return 'text-blue-600';
  if (g.startsWith('C')) return 'text-amber-600';
  return 'text-red-500';
}

export default function StudentDashboard() {
  const user  = useSelector(selectUser);
  const term  = currentTerm();

  const [grades,        setGrades]        = useState([]);
  const [attSummary,    setAttSummary]    = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [studentId,     setStudentId]     = useState(null);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Load all data in parallel
        const [annRes, gradesRes] = await Promise.all([
          commsAPI.announcements(),
          gradeAPI.myGrades({ term, academic_year: CURRENT_YEAR }),
        ]);

        setAnnouncements(annRes.data.data.slice(0, 4));
        setGrades(gradesRes.data.data || []);

      } catch {
        toast.error('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Compute average from grades
  const validFinals  = grades.map(g => parseFloat(g.final_score)).filter(n => !isNaN(n));
  const avgScore     = validFinals.length
    ? (validFinals.reduce((a, v) => a + v, 0) / validFinals.length).toFixed(1)
    : null;

  // Best and worst subject
  const sorted       = [...grades].filter(g => g.final_score != null)
                         .sort((a, b) => b.final_score - a.final_score);
  const best         = sorted[0]  || null;
  const worst        = sorted[sorted.length - 1] || null;

  // Recent 4 grades for the card
  const recentGrades = grades.slice(0, 4);

  const dayName = new Date().toLocaleDateString('en-GB', { weekday: 'long' });
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div>
      <PageHeader
        title={`Good morning, ${user?.name?.split(' ')[0]}`}
        subtitle={`${dayName}, ${dateStr} · ${term}`}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Average score"
          value={avgScore ? `${avgScore}%` : '—'}
          color="blue"
          sub={`${term} · ${grades.length} subject${grades.length !== 1 ? 's' : ''}`}
        />
        <StatCard
          label="Best subject"
          value={best ? `${parseFloat(best.final_score).toFixed(1)}%` : '—'}
          color="green"
          sub={best?.subject_name || 'No data yet'}
        />
        <StatCard
          label="Needs work"
          value={worst && worst !== best ? `${parseFloat(worst.final_score).toFixed(1)}%` : '—'}
          color="amber"
          sub={worst && worst !== best ? worst.subject_name : 'No data yet'}
        />
        <StatCard
          label="Subjects"
          value={grades.length || '—'}
          color="purple"
          sub={`Recorded this ${term}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* My recent grades */}
        <Card title={`My grades · ${term}`}>
          {recentGrades.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">
              No grades recorded for {term} yet
            </p>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentGrades.map(g => (
                <div key={g.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{g.subject_name}</p>
                    <div className="flex gap-3 mt-0.5">
                      {g.classwork_score != null && (
                        <span className="text-xs text-gray-400">CW: {g.classwork_score}</span>
                      )}
                      {g.exam_score != null && (
                        <span className="text-xs text-gray-400">Exam: {g.exam_score}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {g.final_score != null ? (
                      <>
                        <span className={`text-sm font-bold ${gradeColorClass(g.letter_grade)}`}>
                          {parseFloat(g.final_score).toFixed(1)}%
                        </span>
                        {g.letter_grade && (
                          <span className={`ml-2 text-xs font-semibold ${gradeColorClass(g.letter_grade)}`}>
                            {g.letter_grade}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-gray-300">Pending</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Announcements */}
        <Card title="Announcements">
          {announcements.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No announcements</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {announcements.map(a => (
                <div key={a.id} className="py-2.5 first:pt-0 last:pb-0">
                  <p className="text-sm font-semibold text-gray-700">{a.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{a.body}</p>
                  <p className="text-xs text-gray-300 mt-1">
                    {new Date(a.created_at).toLocaleDateString('en-GB')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}