import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { classAPI } from '../../api';
import { PageHeader, Button } from '../../components/ui';
import toast from 'react-hot-toast';

const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;

const BLOOD_GROUPS  = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const PERF_LEVELS   = ['Excellent','Very Good','Good','Average','Below Average'];
const DOCUMENTS     = [
  'Birth Certificate',
  'Transfer Certificate (if applicable)',
  'Previous Academic Report Card',
  'Address Proof',
  'Passport Size Photos (3 copies)',
  'Identity Proof of Parent/Guardian',
];

// ── Reusable field components ─────────────────────────────
function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 mb-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, required, children, full }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white`;
const selectCls = `${inputCls} appearance-none`;

export default function NewAdmission() {
  const navigate = useNavigate();
  const [saving,   setSaving]   = useState(false);
  const [classes,  setClasses]  = useState([]);
  const [step,     setStep]     = useState(1);
  const TOTAL_STEPS = 6;

  useEffect(() => {
    classAPI.list({}).then(({ data }) => setClasses(data.data || [])).catch(() => {});
  }, []);

  const [form, setForm] = useState({
    // Student
    applicant_name:'', dob:'', gender:'', nationality:'', religion:'',
    address_city:'', address_region:'', address_postal:'',
    email:'', phone:'',
    // Father
    father_name:'', father_phone:'', father_email:'',
    father_occupation:'', father_office_addr:'',
    // Mother
    mother_name:'', mother_phone:'', mother_email:'',
    mother_occupation:'', mother_office_addr:'',
    // Previous academic
    previous_school:'', last_class_completed:'', academic_performance:'',
    // Admission
    class_applied:'', class_id:'', academic_year: CURRENT_YEAR,
    preferred_language:'', has_sibling: false, sibling_name_class:'',
    // Medical
    blood_group:'', allergies:'', emergency_contact:'',
    // Documents
    documents_submitted: [],
    // Declaration
    declaration_agreed: false,
    notes:'',
  });

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));
  const setCheck = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.checked }));

  function toggleDoc(doc) {
    setForm(p => ({
      ...p,
      documents_submitted: p.documents_submitted.includes(doc)
        ? p.documents_submitted.filter(d => d !== doc)
        : [...p.documents_submitted, doc],
    }));
  }

  // Step validation
  function canProceed() {
    if (step === 1) return form.applicant_name.trim() !== '';
    if (step === 4) return form.class_id !== '';
    if (step === 6) return form.declaration_agreed;
    return true;
  }

  async function handleSubmit() {
    if (!form.declaration_agreed) return toast.error('Please agree to the declaration');
    if (!form.applicant_name)     return toast.error('Applicant name is required');
    if (!form.class_id)           return toast.error('Please select a class');
    setSaving(true);
    try {
      const { data } = await api.post('/admissions', form);
      toast.success(`Application submitted — ${data.data.admission_number}`);
      navigate('/admissions/list');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit');
    } finally { setSaving(false); }
  }

  // ── Step labels ───────────────────────────────────────
  const STEPS = [
    'Student Info',
    'Father / Guardian',
    'Mother',
    'Admission',
    'Medical',
    'Documents & Declaration',
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title="New Admission Application"
        subtitle="Complete all sections before submitting"
        action={<Button onClick={() => navigate(-1)}>Back</Button>} />

      {/* Step progress */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <button key={i} onClick={() => setStep(i + 1)}
            className={`flex-1 min-w-[90px] py-2 px-2 rounded-lg text-xs font-medium
                        transition-colors whitespace-nowrap text-center
                        ${step === i + 1
                          ? 'bg-blue-600 text-white'
                          : step > i + 1
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-400'}`}>
            <span className="block text-[10px] opacity-70 mb-0.5">{i + 1}</span>
            {s}
          </button>
        ))}
      </div>

      {/* ── Step 1: Student Information ── */}
      {step === 1 && (
        <Section title="Student Information">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full name" required full>
              <input value={form.applicant_name} onChange={set('applicant_name')}
                placeholder="e.g. Ama Mensah" className={`${inputCls} col-span-2`} />
            </Field>
            <Field label="Date of birth (DD/MM/YYYY)">
              <input type="date" value={form.dob} onChange={set('dob')} className={inputCls} />
            </Field>
            <Field label="Gender">
              <select value={form.gender} onChange={set('gender')} className={selectCls}>
                <option value="">Select…</option>
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </Field>
            <Field label="Nationality">
              <input value={form.nationality} onChange={set('nationality')}
                placeholder="e.g. Ghanaian" className={inputCls} />
            </Field>
            <Field label="Religion (optional)">
              <input value={form.religion} onChange={set('religion')}
                placeholder="e.g. Christianity" className={inputCls} />
            </Field>
            <Field label="Email (optional)">
              <input type="email" value={form.email} onChange={set('email')}
                placeholder="student@email.com" className={inputCls} />
            </Field>
            <Field label="Phone (optional)">
              <input value={form.phone} onChange={set('phone')}
                placeholder="+233 24 000 0000" className={inputCls} />
            </Field>

            <div className="col-span-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 mt-2">
                Residential Address
              </p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="City">
                  <input value={form.address_city} onChange={set('address_city')}
                    placeholder="City" className={inputCls} />
                </Field>
                <Field label="Region / State">
                  <input value={form.address_region} onChange={set('address_region')}
                    placeholder="Region" className={inputCls} />
                </Field>
                <Field label="Postal code">
                  <input value={form.address_postal} onChange={set('address_postal')}
                    placeholder="Postal code" className={inputCls} />
                </Field>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* ── Step 2: Father / Guardian ── */}
      {step === 2 && (
        <Section title="Father / Guardian Information">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Father / Guardian name" full>
              <input value={form.father_name} onChange={set('father_name')}
                placeholder="Full name" className={inputCls} />
            </Field>
            <Field label="Contact number">
              <input value={form.father_phone} onChange={set('father_phone')}
                placeholder="+233 24 000 0000" className={inputCls} />
            </Field>
            <Field label="Email address">
              <input type="email" value={form.father_email} onChange={set('father_email')}
                placeholder="email@example.com" className={inputCls} />
            </Field>
            <Field label="Occupation">
              <input value={form.father_occupation} onChange={set('father_occupation')}
                placeholder="e.g. Engineer" className={inputCls} />
            </Field>
            <Field label="Office address (optional)" full>
              <input value={form.father_office_addr} onChange={set('father_office_addr')}
                placeholder="Office address" className={inputCls} />
            </Field>
          </div>
        </Section>
      )}

      {/* ── Step 3: Mother ── */}
      {step === 3 && (
        <Section title="Mother's Information">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Mother's name" full>
              <input value={form.mother_name} onChange={set('mother_name')}
                placeholder="Full name" className={inputCls} />
            </Field>
            <Field label="Contact number">
              <input value={form.mother_phone} onChange={set('mother_phone')}
                placeholder="+233 24 000 0000" className={inputCls} />
            </Field>
            <Field label="Email address">
              <input type="email" value={form.mother_email} onChange={set('mother_email')}
                placeholder="email@example.com" className={inputCls} />
            </Field>
            <Field label="Occupation">
              <input value={form.mother_occupation} onChange={set('mother_occupation')}
                placeholder="e.g. Teacher" className={inputCls} />
            </Field>
            <Field label="Office address (optional)" full>
              <input value={form.mother_office_addr} onChange={set('mother_office_addr')}
                placeholder="Office address" className={inputCls} />
            </Field>
          </div>
        </Section>
      )}

      {/* ── Step 4: Admission & Previous Academic ── */}
      {step === 4 && (
        <>
          <Section title="Previous Academic Details">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Last school attended" full>
                <input value={form.previous_school} onChange={set('previous_school')}
                  placeholder="School name" className={inputCls} />
              </Field>
              <Field label="Last class completed">
                <input value={form.last_class_completed} onChange={set('last_class_completed')}
                  placeholder="e.g. Primary 6" className={inputCls} />
              </Field>
              <Field label="Academic performance">
                <select value={form.academic_performance} onChange={set('academic_performance')}
                  className={selectCls}>
                  <option value="">Select…</option>
                  {PERF_LEVELS.map(p => <option key={p}>{p}</option>)}
                </select>
              </Field>
            </div>
          </Section>

          <Section title="Admission Details">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Class for admission" required>
                <select value={form.class_id}
                  onChange={e => {
                    const cls = classes.find(c => String(c.id) === e.target.value);
                    setForm(p => ({
                      ...p,
                      class_id:      e.target.value,
                      class_applied: cls ? `${cls.name}${cls.section ? ' '+cls.section : ''}` : '',
                    }));
                  }}
                  className={selectCls}>
                  <option value="">Select class…</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.section ? ' '+c.section : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Academic year">
                <input value={form.academic_year} onChange={set('academic_year')}
                  placeholder="2025/2026" className={inputCls} />
              </Field>
              <Field label="Preferred second language (if applicable)">
                <input value={form.preferred_language} onChange={set('preferred_language')}
                  placeholder="e.g. French" className={inputCls} />
              </Field>
              <Field label="Any sibling in this school?">
                <div className="flex items-center gap-4 mt-1">
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="radio" checked={form.has_sibling === true}
                      onChange={() => setForm(p => ({ ...p, has_sibling: true }))} />
                    Yes
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="radio" checked={form.has_sibling === false}
                      onChange={() => setForm(p => ({ ...p, has_sibling: false }))} />
                    No
                  </label>
                </div>
              </Field>
              {form.has_sibling && (
                <Field label="Sibling name and class" full>
                  <input value={form.sibling_name_class} onChange={set('sibling_name_class')}
                    placeholder="e.g. Kofi Mensah — JHS 2A" className={inputCls} />
                </Field>
              )}
            </div>
          </Section>
        </>
      )}

      {/* ── Step 5: Medical ── */}
      {step === 5 && (
        <Section title="Medical Information">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Blood group">
              <select value={form.blood_group} onChange={set('blood_group')} className={selectCls}>
                <option value="">Select…</option>
                {BLOOD_GROUPS.map(b => <option key={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="Emergency contact name and number">
              <input value={form.emergency_contact} onChange={set('emergency_contact')}
                placeholder="Name — +233 24 000 0000" className={inputCls} />
            </Field>
            <Field label="Any allergies or medical conditions" full>
              <textarea rows={3} value={form.allergies} onChange={set('allergies')}
                placeholder="Describe any known allergies, medical conditions or special needs…"
                className={`${inputCls} resize-none`} />
            </Field>
            <Field label="Additional notes" full>
              <textarea rows={3} value={form.notes} onChange={set('notes')}
                placeholder="Any other relevant information…"
                className={`${inputCls} resize-none`} />
            </Field>
          </div>
        </Section>
      )}

      {/* ── Step 6: Documents & Declaration ── */}
      {step === 6 && (
        <>
          <Section title="Documents Checklist (Attach Copies)">
            <p className="text-xs text-gray-400 mb-3">
              Check each document you are submitting with this application:
            </p>
            <div className="space-y-2.5">
              {DOCUMENTS.map(doc => (
                <label key={doc}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-100
                             hover:bg-gray-50 cursor-pointer transition-colors">
                  <input type="checkbox"
                    checked={form.documents_submitted.includes(doc)}
                    onChange={() => toggleDoc(doc)}
                    className="w-4 h-4 rounded accent-blue-600" />
                  <span className="text-sm text-gray-700">{doc}</span>
                </label>
              ))}
            </div>
            {form.documents_submitted.length > 0 && (
              <p className="text-xs text-green-600 mt-3 font-medium">
                ✅ {form.documents_submitted.length} document{form.documents_submitted.length > 1 ? 's' : ''} marked for submission
              </p>
            )}
          </Section>

          <Section title="Declaration">
            <div className="bg-gray-50 rounded-xl p-4 mb-4 text-sm text-gray-600 leading-relaxed">
              I, the undersigned, hereby declare that the information provided above is true and
              correct to the best of my knowledge. I understand that providing false information
              may result in the cancellation of admission.
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.declaration_agreed}
                onChange={setCheck('declaration_agreed')}
                className="w-4 h-4 mt-0.5 rounded accent-blue-600" />
              <span className="text-sm text-gray-700">
                I agree to the above declaration on behalf of the applicant.
                <span className="text-red-500 ml-1">*</span>
              </span>
            </label>
            {!form.declaration_agreed && (
              <p className="text-xs text-amber-600 mt-2">
                ⚠️ You must agree to the declaration before submitting.
              </p>
            )}
          </Section>
        </>
      )}

      {/* Navigation */}
      <div className="flex justify-between gap-3 mt-2 mb-8">
        <Button
          onClick={() => setStep(s => Math.max(1, s - 1))}
          disabled={step === 1}>
          ← Previous
        </Button>
        <div className="flex gap-2">
          {step < TOTAL_STEPS ? (
            <Button variant="primary"
              onClick={() => {
                if (!canProceed()) {
                  if (step === 1) toast.error('Applicant name is required');
                  if (step === 4) toast.error('Please select a class');
                  return;
                }
                setStep(s => s + 1);
              }}>
              Next →
            </Button>
          ) : (
            <Button variant="primary" loading={saving}
              disabled={!form.declaration_agreed || saving}
              onClick={handleSubmit}>
              ✅ Submit Application
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}