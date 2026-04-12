import React from 'react';
import { useNavigate } from 'react-router-dom';

function Feature({ title, desc }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <h3 className="text-sm font-medium text-gray-800 mb-1">{title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
    </div>
  );
}

function RoleCard({ role, desc, color }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-700 border-blue-100',
    teal:   'bg-teal-50 text-teal-700 border-teal-100',
    pink:   'bg-pink-50 text-pink-700 border-pink-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    amber:  'bg-amber-50 text-amber-700 border-amber-100',
  };
  return (
    <div className={`border rounded-xl p-4 ${colors[color]}`}>
      <p className="text-sm font-medium mb-1 capitalize">{role}</p>
      <p className="text-xs opacity-80">{desc}</p>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-base font-semibold text-gray-800">EduClass</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/register')}
              className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5"
            >
              Register
            </button>
            <button
              onClick={() => navigate('/login')}
              className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Sign in
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <div className="inline-block bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1 rounded-full mb-6 border border-blue-100">
          BSc Information Technology · Faculty of Engineering
        </div>
        <h1 className="text-4xl font-semibold text-gray-900 mb-4 leading-tight">
          School management,<br />simplified.
        </h1>
        <p className="text-base text-gray-500 mb-8 max-w-xl mx-auto leading-relaxed">
          EduClass brings together students, teachers, parents and administrators
          on one platform — attendance, grades, fees, communication and reports.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign in to your account
          </button>
          <button
            onClick={() => navigate('/register')}
            className="px-6 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-white transition-colors"
          >
            Create parent account
          </button>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider text-center mb-6">
          Everything your school needs
        </p>
        <div className="grid grid-cols-3 gap-4">
          <Feature title="Attendance tracking"   desc="Mark and monitor daily attendance per subject. Parents receive instant alerts when their child is absent." />
          <Feature title="Grade management"      desc="Enter and manage assessment scores, generate term reports with class rankings automatically." />
          <Feature title="Fee collection"        desc="Record payments, track balances, identify defaulters and generate fee collection summaries." />
          <Feature title="Parent portal"         desc="Parents can view their child's grades, attendance and reports anytime from any device." />
          <Feature title="Communication hub"     desc="Send announcements and direct messages between teachers, parents and administrators." />
          <Feature title="Analytics dashboard"   desc="Visual insights into attendance trends, grade distributions and class performance." />
        </div>
      </section>

      {/* Roles */}
      <section className="bg-white border-t border-gray-100 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider text-center mb-6">
            Built for every role
          </p>
          <div className="grid grid-cols-5 gap-3">
            <RoleCard role="Admin"       desc="Full school oversight and configuration"    color="blue"   />
            <RoleCard role="Teacher"     desc="Attendance, grades and class management"    color="teal"   />
            <RoleCard role="Accountant"  desc="Fee collection and financial tracking"      color="amber"  />
            <RoleCard role="Parent"      desc="Monitor child's progress and communicate"   color="pink"   />
            <RoleCard role="Student"     desc="View timetable, grades and announcements"   color="purple" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 py-16 text-center">
        <h2 className="text-xl font-medium text-gray-800 mb-3">Ready to get started?</h2>
        <p className="text-sm text-gray-500 mb-6">
          Sign in with your account or register as a parent to get started.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="px-8 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Sign in to EduClass
        </button>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 text-center">
        <p className="text-xs text-gray-400">
          EduClass v1.0 · Faculty of Engineering, Department of ICT · BSc Information Technology
        </p>
      </footer>
    </div>
  );
}