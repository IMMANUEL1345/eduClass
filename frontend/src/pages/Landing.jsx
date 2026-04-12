import React from 'react';
import { useNavigate } from 'react-router-dom';

function Feature({ icon, title, desc }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-sm transition-shadow">
      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
        <span style={{ fontSize: '16px' }}>{icon}</span>
      </div>
      <h3 className="text-sm font-medium text-gray-800 mb-1">{title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
    </div>
  );
}

function RoleCard({ role, desc, bg, text }) {
  return (
    <div className={`rounded-2xl p-4 border ${bg}`}>
      <p className={`text-sm font-medium mb-1 capitalize ${text}`}>{role}</p>
      <p className={`text-xs opacity-75 ${text}`}>{desc}</p>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-semibold text-gray-800">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="EduClass logo" className="w-8 h-8 object-contain" />
            <span className="text-sm font-semibold text-gray-800">EduClass</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/register')}
              className="text-sm text-gray-500 hover:text-gray-800 px-4 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
              Register
            </button>
            <button onClick={() => navigate('/login')}
              className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-medium">
              Sign in
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1.5 rounded-full mb-8 border border-blue-100">
          <span>BSc Information Technology</span>
          <span className="text-blue-300">·</span>
          <span>Faculty of Engineering</span>
        </div>

        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt="EduClass" className="w-24 h-24 object-contain" />
        </div>

        <h1 className="text-5xl font-semibold text-gray-900 mb-5 leading-tight tracking-tight">
          School management,<br />
          <span className="text-blue-600">simplified.</span>
        </h1>

        <p className="text-base text-gray-500 mb-10 max-w-lg mx-auto leading-relaxed">
          One platform for students, teachers, parents and administrators —
          attendance, grades, fees, communication and reports.
        </p>

        <div className="flex items-center justify-center gap-3 mb-16">
          <button onClick={() => navigate('/login')}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
            Sign in
          </button>
          <button onClick={() => navigate('/register')}
            className="px-6 py-2.5 border border-gray-200 bg-white text-gray-600 text-sm font-medium rounded-xl hover:border-gray-300 transition-colors">
            Create parent account
          </button>
        </div>

        {/* Stats bar */}
        <div className="inline-flex items-center gap-10 bg-white border border-gray-100 rounded-2xl px-10 py-5">
          <Stat value="5"     label="User roles"   />
          <div className="w-px h-8 bg-gray-100" />
          <Stat value="8"     label="Core modules" />
          <div className="w-px h-8 bg-gray-100" />
          <Stat value="100%"  label="Web-based"    />
          <div className="w-px h-8 bg-gray-100" />
          <Stat value="Free"  label="Open access"  />
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center mb-10">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">Everything your school needs</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Feature icon="📋" title="Attendance tracking"  desc="Mark daily attendance per subject. Parents get instant alerts when their child is absent." />
          <Feature icon="📊" title="Grade management"     desc="Enter scores, compute averages, generate ranked term reports automatically." />
          <Feature icon="💳" title="Fee collection"       desc="Record payments, track balances, identify defaulters and print collection summaries." />
          <Feature icon="👨‍👩‍👧" title="Parent portal"        desc="Parents view grades, attendance and reports anytime from any device." />
          <Feature icon="💬" title="Communication hub"    desc="Direct messages and announcements between teachers, parents and administrators." />
          <Feature icon="📈" title="Analytics dashboard"  desc="Charts for attendance trends, grade distributions and class performance." />
        </div>
      </section>

      {/* Roles */}
      <section className="bg-white border-y border-gray-100 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-8">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">Built for every role</p>
          </div>
          <div className="grid grid-cols-5 gap-3">
            <RoleCard role="Admin"      desc="Full oversight and configuration"  bg="bg-blue-50 border-blue-100"     text="text-blue-800"   />
            <RoleCard role="Teacher"    desc="Attendance, grades and classes"    bg="bg-teal-50 border-teal-100"     text="text-teal-800"   />
            <RoleCard role="Accountant" desc="Fee collection and tracking"       bg="bg-amber-50 border-amber-100"   text="text-amber-800"  />
            <RoleCard role="Parent"     desc="Monitor child's progress"          bg="bg-pink-50 border-pink-100"     text="text-pink-800"   />
            <RoleCard role="Student"    desc="Grades, reports and announcements" bg="bg-purple-50 border-purple-100" text="text-purple-800" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <div className="bg-blue-600 rounded-3xl px-10 py-14">
          <h2 className="text-2xl font-semibold text-white mb-3">Ready to get started?</h2>
          <p className="text-sm text-blue-200 mb-8">Sign in to your account or register as a parent today.</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => navigate('/login')}
              className="px-8 py-3 bg-white text-blue-600 text-sm font-medium rounded-xl hover:bg-blue-50 transition-colors">
              Sign in to EduClass
            </button>
            <button onClick={() => navigate('/register')}
              className="px-8 py-3 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-400 transition-colors border border-blue-400">
              Create parent account
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="EduClass" className="w-6 h-6 object-contain" />
            <span className="text-sm font-medium text-gray-600">EduClass</span>
          </div>
          <p className="text-xs text-gray-400">Faculty of Engineering · Department of ICT · BSc IT</p>
          <p className="text-xs text-gray-400">v1.0 · 2025</p>
        </div>
      </footer>

    </div>
  );
}