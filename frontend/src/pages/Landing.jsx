import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const SLIDES = [
  {
    badge:    'School Management System',
    heading:  ['Manage your school,', 'smarter & faster.'],
    sub:      'One platform for students, teachers, parents and administrators — attendance, grades, fees and reports all in one place.',
    accent:   'smarter & faster.',
    bg:       'from-blue-50 to-white',
    shape1:   'bg-blue-500',
    shape2:   'bg-blue-300',
    icon:     '📋',
    iconBig:  '🏫',
  },
  {
    badge:    'Grade & Attendance Tracking',
    heading:  ['Track performance,', 'inspire excellence.'],
    sub:      'Teachers mark attendance and enter grades in seconds. Automated reports rank students and notify parents instantly.',
    accent:   'inspire excellence.',
    bg:       'from-teal-50 to-white',
    shape1:   'bg-teal-500',
    shape2:   'bg-teal-300',
    icon:     '📊',
    iconBig:  '🎓',
  },
  {
    badge:    'Fee Management',
    heading:  ['Collect fees,', 'track every payment.'],
    sub:      'Record payments, identify defaulters, send parent notifications and generate collection summaries — all automated.',
    accent:   'track every payment.',
    bg:       'from-amber-50 to-white',
    shape1:   'bg-amber-500',
    shape2:   'bg-amber-300',
    icon:     '💳',
    iconBig:  '💰',
  },
];

function Feature({ icon, title, desc }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-sm transition-shadow">
      <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center mb-3 text-lg">{icon}</div>
      <h3 className="text-sm font-semibold text-gray-800 mb-1">{title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
    </div>
  );
}

function RoleCard({ role, desc, bg, text }) {
  return (
    <div className={`rounded-2xl p-4 border ${bg}`}>
      <p className={`text-sm font-semibold mb-1 capitalize ${text}`}>{role}</p>
      <p className={`text-xs opacity-75 ${text}`}>{desc}</p>
    </div>
  );
}

export default function Landing() {
  const navigate  = useNavigate();
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setCurrent(p => (p + 1) % SLIDES.length);
        setAnimating(false);
      }, 400);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  function goTo(i) {
    if (i === current) return;
    setAnimating(true);
    setTimeout(() => { setCurrent(i); setAnimating(false); }, 400);
  }

  const slide = SLIDES[current];

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'system-ui,-apple-system,sans-serif' }}>

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="EduClass" className="w-9 h-9 object-contain" />
            <span className="text-base font-bold text-gray-800">EduClass</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/register')}
              className="text-sm text-gray-500 hover:text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium">
              Register
            </button>
            <button onClick={() => navigate('/login')}
              className="text-sm bg-blue-600 text-white px-5 py-2 rounded-xl hover:bg-blue-700 transition-colors font-semibold">
              Sign in
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Slider */}
      <section className={`bg-gradient-to-br ${slide.bg} transition-all duration-500`}>
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="grid grid-cols-2 gap-12 items-center">

            {/* Left */}
            <div style={{ opacity: animating ? 0 : 1, transform: animating ? 'translateX(-20px)' : 'translateX(0)', transition: 'all 0.4s ease' }}>
              <div className="inline-flex items-center gap-2 bg-white text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border border-blue-100 shadow-sm">
                <span style={{ fontSize: '12px' }}>{slide.icon}</span>
                {slide.badge}
              </div>

              <h1 className="text-5xl font-bold text-gray-900 mb-5 leading-tight">
                {slide.heading[0]}<br />
                <span className="text-blue-600">{slide.heading[1]}</span>
              </h1>

              <p className="text-base text-gray-500 mb-8 leading-relaxed max-w-md">
                {slide.sub}
              </p>

              <div className="flex items-center gap-3 mb-10">
                <button onClick={() => navigate('/login')}
                  className="px-7 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">
                  Get started
                </button>
                <button onClick={() => navigate('/register')}
                  className="flex items-center gap-2 px-6 py-3 border border-gray-200 bg-white text-gray-600 text-sm font-medium rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors">
                  <span className="w-6 h-6 rounded-full border-2 border-gray-300 flex items-center justify-center">
                    <span className="w-0 h-0" style={{ borderLeft: '6px solid #6b7280', borderTop: '4px solid transparent', borderBottom: '4px solid transparent' }} />
                  </span>
                  How it works
                </button>
              </div>

              {/* Slide dots */}
              <div className="flex items-center gap-2">
                {SLIDES.map((_, i) => (
                  <button key={i} onClick={() => goTo(i)}
                    className={`rounded-full transition-all duration-300 ${i === current ? 'w-6 h-2 bg-blue-600' : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'}`} />
                ))}
              </div>
            </div>

            {/* Right — visual */}
            <div style={{ opacity: animating ? 0 : 1, transform: animating ? 'translateX(20px)' : 'translateX(0)', transition: 'all 0.4s ease' }}
              className="relative flex items-center justify-center">

              {/* Background circles */}
              <div className={`absolute w-72 h-72 ${slide.shape2} rounded-full opacity-20`} style={{ top: '-20px', right: '-20px' }} />
              <div className={`absolute w-48 h-48 ${slide.shape1} rounded-full opacity-15`} style={{ bottom: '10px', left: '10px' }} />

              {/* Main card */}
              <div className="relative z-10 bg-white rounded-3xl shadow-xl p-6 w-80">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-xs text-gray-400">EduClass</p>
                    <p className="text-sm font-semibold text-gray-800">School Dashboard</p>
                  </div>
                  <div className="text-3xl">{slide.iconBig}</div>
                </div>

                {/* Mini stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: 'Students',   value: '342', color: 'bg-blue-50 text-blue-700'   },
                    { label: 'Teachers',   value: '18',  color: 'bg-teal-50 text-teal-700'   },
                    { label: 'Attendance', value: '87%', color: 'bg-green-50 text-green-700' },
                    { label: 'Reports',    value: '120', color: 'bg-purple-50 text-purple-700'},
                  ].map(s => (
                    <div key={s.label} className={`${s.color} rounded-xl p-3`}>
                      <p className="text-lg font-bold">{s.value}</p>
                      <p className="text-xs opacity-70">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Mini bar chart */}
                <div>
                  <p className="text-xs text-gray-400 mb-2">Weekly attendance</p>
                  <div className="flex items-end gap-1.5 h-10">
                    {[70,85,78,92,88,95,82].map((h,i) => (
                      <div key={i} className={`flex-1 rounded-sm ${slide.shape1} opacity-70`}
                        style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating badges */}
              <div className="absolute top-4 left-0 bg-white rounded-xl shadow-lg px-3 py-2 flex items-center gap-2 z-20">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-xs">✓</div>
                <div>
                  <p className="text-xs font-semibold text-gray-700">Fee cleared</p>
                  <p className="text-xs text-gray-400">Ama Asante</p>
                </div>
              </div>
              <div className="absolute bottom-4 right-0 bg-white rounded-xl shadow-lg px-3 py-2 z-20">
                <p className="text-xs font-semibold text-gray-700">Report generated</p>
                <p className="text-xs text-gray-400">Term 1 · JHS 2A</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-2">Features</p>
          <h2 className="text-2xl font-bold text-gray-900">Everything your school needs</h2>
        </div>
        <div className="grid grid-cols-3 gap-5">
          <Feature icon="📋" title="Attendance tracking"  desc="Mark daily attendance per subject. Parents get instant alerts when their child is absent." />
          <Feature icon="📊" title="Grade management"     desc="Enter scores, compute averages and generate ranked term reports automatically." />
          <Feature icon="💳" title="Fee collection"       desc="Record payments, track balances, identify defaulters and print collection summaries." />
          <Feature icon="👨‍👩‍👧" title="Parent portal"        desc="Parents view their child's grades, attendance and reports from any device." />
          <Feature icon="💬" title="Communication hub"    desc="Direct messages and announcements between teachers, parents and administrators." />
          <Feature icon="📈" title="Analytics dashboard"  desc="Charts for attendance trends, grade distributions and class performance." />
        </div>
      </section>

      {/* Roles */}
      <section className="bg-gray-50 border-y border-gray-100 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-2">Roles</p>
            <h2 className="text-2xl font-bold text-gray-900">Built for every role</h2>
          </div>
          <div className="grid grid-cols-5 gap-4">
            <RoleCard role="Admin"      desc="Full oversight and configuration"  bg="bg-blue-50 border-blue-100"     text="text-blue-800"   />
            <RoleCard role="Teacher"    desc="Attendance, grades and classes"    bg="bg-teal-50 border-teal-100"     text="text-teal-800"   />
            <RoleCard role="Accountant" desc="Fee collection and tracking"       bg="bg-amber-50 border-amber-100"   text="text-amber-800"  />
            <RoleCard role="Parent"     desc="Monitor child's progress"          bg="bg-pink-50 border-pink-100"     text="text-pink-800"   />
            <RoleCard role="Student"    desc="Grades, reports, announcements"    bg="bg-purple-50 border-purple-100" text="text-purple-800" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="bg-blue-600 rounded-3xl px-12 py-16 grid grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-2xl font-bold text-white mb-3">Ready to get started?</h2>
            <p className="text-blue-200 text-sm leading-relaxed">
              Sign in to your account or register as a parent. All school data is managed securely on the cloud.
            </p>
          </div>
          <div className="flex items-center justify-end gap-3">
            <button onClick={() => navigate('/login')}
              className="px-7 py-3 bg-white text-blue-600 text-sm font-bold rounded-xl hover:bg-blue-50 transition-colors">
              Sign in
            </button>
            <button onClick={() => navigate('/register')}
              className="px-7 py-3 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-400 transition-colors border border-blue-400">
              Create account
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="EduClass" className="w-7 h-7 object-contain" />
            <span className="text-sm font-bold text-gray-700">EduClass</span>
          </div>
          <p className="text-xs text-gray-400">Faculty of Engineering · Dept. of ICT · BSc Information Technology</p>
          <p className="text-xs text-gray-400">v1.0 · 2025</p>
        </div>
      </footer>

    </div>
  );
}