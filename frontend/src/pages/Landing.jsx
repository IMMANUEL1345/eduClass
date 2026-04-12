import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const SLIDES = [
  {
    badge:   'School Management System',
    heading: ['Manage your school,', 'smarter & faster.'],
    sub:     'One platform for students, teachers, parents and administrators — attendance, grades, fees and reports all in one place.',
    bg:      'from-blue-50 to-white',
    shape1:  'bg-blue-500',
    shape2:  'bg-blue-200',
    icon:    '📋',
    iconBig: '🏫',
  },
  {
    badge:   'Grade & Attendance Tracking',
    heading: ['Track performance,', 'inspire excellence.'],
    sub:     'Teachers mark attendance and enter grades in seconds. Automated reports rank students and notify parents instantly.',
    bg:      'from-teal-50 to-white',
    shape1:  'bg-teal-500',
    shape2:  'bg-teal-200',
    icon:    '📊',
    iconBig: '🎓',
  },
  {
    badge:   'Fee Management',
    heading: ['Collect fees,', 'track every payment.'],
    sub:     'Record payments, identify defaulters, send parent notifications and generate collection summaries — all automated.',
    bg:      'from-amber-50 to-white',
    shape1:  'bg-amber-500',
    shape2:  'bg-amber-200',
    icon:    '💳',
    iconBig: '💰',
  },
];

const NAV_LINKS = ['Home', 'About', 'Features', 'Contact'];

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
  const navigate   = useNavigate();
  const [current,  setCurrent]  = useState(0);
  const [animating,setAnimating] = useState(false);
  const [form, setForm] = useState({ name:'', email:'', message:'' });
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setAnimating(true);
      setTimeout(() => { setCurrent(p => (p + 1) % SLIDES.length); setAnimating(false); }, 400);
    }, 5000);
    return () => clearInterval(t);
  }, []);

  function goTo(i) {
    if (i === current) return;
    setAnimating(true);
    setTimeout(() => { setCurrent(i); setAnimating(false); }, 400);
  }

  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  function handleContact(e) {
    e.preventDefault();
    setSent(true);
    setForm({ name:'', email:'', message:'' });
    setTimeout(() => setSent(false), 4000);
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
          <div className="hidden md:flex items-center gap-6">
            {[['Home','hero'],['About','about'],['Features','features'],['Contact','contact']].map(([label,id]) => (
              <button key={id} onClick={() => scrollTo(id)}
                className="text-sm text-gray-500 hover:text-blue-600 transition-colors font-medium">
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/register')}
              className="text-sm text-gray-500 hover:text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium transition-colors">
              Register
            </button>
            <button onClick={() => navigate('/login')}
              className="text-sm bg-blue-600 text-white px-5 py-2 rounded-xl hover:bg-blue-700 font-semibold transition-colors">
              Sign in
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Slider */}
      <section id="hero" className={`bg-gradient-to-br ${slide.bg} transition-all duration-500`}>
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="grid grid-cols-2 gap-12 items-center">
            {/* Left */}
            <div style={{ opacity: animating ? 0 : 1, transform: animating ? 'translateX(-20px)' : 'translateX(0)', transition: 'all 0.4s ease' }}>
              <div className="inline-flex items-center gap-2 bg-white text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border border-blue-100 shadow-sm">
                <span>{slide.icon}</span>{slide.badge}
              </div>
              <h1 className="text-5xl font-bold text-gray-900 mb-5 leading-tight">
                {slide.heading[0]}<br />
                <span className="text-blue-600">{slide.heading[1]}</span>
              </h1>
              <p className="text-base text-gray-500 mb-8 leading-relaxed max-w-md">{slide.sub}</p>
              <div className="flex items-center gap-3 mb-10">
                <button onClick={() => navigate('/login')}
                  className="px-7 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">
                  Get started
                </button>
                <button onClick={() => scrollTo('about')}
                  className="px-6 py-3 border border-gray-200 bg-white text-gray-600 text-sm font-medium rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors">
                  Learn more
                </button>
              </div>
              <div className="flex items-center gap-2">
                {SLIDES.map((_, i) => (
                  <button key={i} onClick={() => goTo(i)}
                    className={`rounded-full transition-all duration-300 ${i === current ? 'w-6 h-2 bg-blue-600' : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'}`} />
                ))}
              </div>
            </div>

            {/* Right visual */}
            <div style={{ opacity: animating ? 0 : 1, transform: animating ? 'translateX(20px)' : 'translateX(0)', transition: 'all 0.4s ease' }}
              className="relative flex items-center justify-center">
              <div className={`absolute w-72 h-72 ${slide.shape2} rounded-full opacity-30`} style={{ top:'-20px', right:'-20px' }} />
              <div className={`absolute w-48 h-48 ${slide.shape1} rounded-full opacity-10`} style={{ bottom:'10px', left:'10px' }} />
              <div className="relative z-10 bg-white rounded-3xl shadow-xl p-6 w-80">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-xs text-gray-400">EduClass</p>
                    <p className="text-sm font-semibold text-gray-800">School Dashboard</p>
                  </div>
                  <div className="text-3xl">{slide.iconBig}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[['Students','342','bg-blue-50 text-blue-700'],['Teachers','18','bg-teal-50 text-teal-700'],['Attendance','87%','bg-green-50 text-green-700'],['Reports','120','bg-purple-50 text-purple-700']].map(([l,v,c]) => (
                    <div key={l} className={`${c} rounded-xl p-3`}>
                      <p className="text-lg font-bold">{v}</p>
                      <p className="text-xs opacity-70">{l}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-2">Weekly attendance</p>
                  <div className="flex items-end gap-1.5 h-10">
                    {[70,85,78,92,88,95,82].map((h,i) => (
                      <div key={i} className={`flex-1 rounded-sm ${slide.shape1} opacity-70`} style={{ height:`${h}%` }} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="absolute top-4 left-0 bg-white rounded-xl shadow-lg px-3 py-2 flex items-center gap-2 z-20">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-xs">✓</div>
                <div><p className="text-xs font-semibold text-gray-700">Fee cleared</p><p className="text-xs text-gray-400">Ama Asante</p></div>
              </div>
              <div className="absolute bottom-4 right-0 bg-white rounded-xl shadow-lg px-3 py-2 z-20">
                <p className="text-xs font-semibold text-gray-700">Report generated</p>
                <p className="text-xs text-gray-400">Term 1 · JHS 2A</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-3">About EduClass</p>
            <h2 className="text-3xl font-bold text-gray-900 mb-5 leading-tight">
              Designed for junior high schools in Ghana.
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-5">
              EduClass is a final year project developed by a student of the Faculty of Engineering,
              Department of Information Communication Technology at BSc Information Technology level.
              The system was built to address the real administrative challenges faced by junior high
              schools — disconnected tools, manual record keeping and poor parent communication.
            </p>
            <p className="text-sm text-gray-500 leading-relaxed mb-8">
              The platform centralises student data, automates reporting and creates a transparent
              communication channel between schools and families — all accessible from any browser,
              on any device.
            </p>
            <div className="grid grid-cols-3 gap-4">
              {[['5+','User roles'],['8+','Core modules'],['100%','Web-based']].map(([v,l]) => (
                <div key={l} className="bg-blue-50 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">{v}</p>
                  <p className="text-xs text-blue-500 mt-1">{l}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon:'🎓', title:'Student-centred',   desc:'Every feature is designed around improving the student experience and academic outcomes.' },
              { icon:'🔒', title:'Secure by design',   desc:'Role-based access ensures every user only sees what they are authorised to view.' },
              { icon:'📱', title:'Works everywhere',   desc:'Fully web-based — no installation required. Works on any laptop, tablet or phone.' },
              { icon:'⚡', title:'Real-time updates',  desc:'Attendance alerts, grade notifications and announcements are delivered instantly.' },
            ].map(c => (
              <div key={c.title} className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <div className="text-2xl mb-3">{c.icon}</div>
                <p className="text-sm font-semibold text-gray-800 mb-1">{c.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-gray-50 border-y border-gray-100 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-2">Features</p>
            <h2 className="text-2xl font-bold text-gray-900">Everything your school needs</h2>
          </div>
          <div className="grid grid-cols-3 gap-5 mb-14">
            <Feature icon="📋" title="Attendance tracking"  desc="Mark daily attendance per subject. Parents get instant alerts when their child is absent." />
            <Feature icon="📊" title="Grade management"     desc="Enter scores, compute averages and generate ranked term reports automatically." />
            <Feature icon="💳" title="Fee collection"       desc="Record payments, track balances, identify defaulters and print collection summaries." />
            <Feature icon="👨‍👩‍👧" title="Parent portal"        desc="Parents view their child's grades, attendance and reports from any device." />
            <Feature icon="💬" title="Communication hub"    desc="Direct messages and announcements between teachers, parents and administrators." />
            <Feature icon="📈" title="Analytics dashboard"  desc="Charts for attendance trends, grade distributions and class performance." />
          </div>
          <div className="text-center mb-8">
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

      {/* Contact */}
      <section id="contact" className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid grid-cols-2 gap-16 items-start">
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-3">Contact</p>
            <h2 className="text-3xl font-bold text-gray-900 mb-5">Get in touch</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-8">
              Have questions about EduClass or want to request access for your school?
              Send us a message and we will get back to you.
            </p>
            <div className="space-y-5">
              {[
                { icon:'📧', label:'Email',    value:'admin@educlass.school'        },
                { icon:'🏫', label:'Faculty',  value:'Faculty of Engineering, ICT Dept.' },
                { icon:'📍', label:'Location', value:'Ghana'                        },
              ].map(c => (
                <div key={c.label} className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-lg flex-shrink-0">{c.icon}</div>
                  <div>
                    <p className="text-xs text-gray-400">{c.label}</p>
                    <p className="text-sm font-medium text-gray-700">{c.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100">
            {sent ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center text-2xl mb-4">✓</div>
                <p className="text-base font-semibold text-gray-800 mb-1">Message sent!</p>
                <p className="text-sm text-gray-500">We will get back to you shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleContact} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Full name</label>
                  <input required value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))}
                    placeholder="Your name"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Email address</label>
                  <input required type="email" value={form.email} onChange={e => setForm(p=>({...p,email:e.target.value}))}
                    placeholder="you@example.com"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Message</label>
                  <textarea required rows={4} value={form.message} onChange={e => setForm(p=>({...p,message:e.target.value}))}
                    placeholder="How can we help?"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
                <button type="submit"
                  className="w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">
                  Send message
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="EduClass" className="w-8 h-8 object-contain" />
              <span className="text-base font-bold text-white">EduClass</span>
            </div>
            <div className="flex items-center gap-6">
              {[['Home','hero'],['About','about'],['Features','features'],['Contact','contact']].map(([label,id]) => (
                <button key={id} onClick={() => scrollTo(id)} className="text-sm text-gray-400 hover:text-white transition-colors">{label}</button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => navigate('/login')}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
                Sign in
              </button>
              <button onClick={() => navigate('/register')}
                className="px-5 py-2 border border-gray-600 text-gray-300 text-sm font-medium rounded-xl hover:border-gray-400 transition-colors">
                Register
              </button>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 flex items-center justify-between">
            <p className="text-xs text-gray-500">Faculty of Engineering · Dept. of ICT · BSc Information Technology</p>
            <p className="text-xs text-gray-500">EduClass v1.0 · 2025</p>
          </div>
        </div>
      </footer>

    </div>
  );
}