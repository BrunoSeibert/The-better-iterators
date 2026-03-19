import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import * as authService from '../services/authService';
import StudyondLogo from '../components/ui/StudyondLogo';
import DatePicker from '../components/DatePicker';

const C = {
  darkBrown:  'rgba(38,38,38,1)',
  midBrown:   'rgba(82,82,91,1)',
  tan:        'rgba(161,161,170,1)',
  lightTan:   'rgba(228,228,231,1)',
  cream:      'rgba(250,250,250,1)',
  warmWhite:  'rgba(244,244,245,1)',
  border:     'rgba(212,212,216,1)',
  mutedText:  'rgba(113,113,122,1)',
};

interface University { id: string; name: string; country: string; }
interface StudyProgram { id: string; name: string; degree: string; }
interface Field { id: string; name: string; }

const DEGREE_OPTIONS = [
  { label: 'Bachelor', value: 'bsc' },
  { label: 'Master', value: 'msc' },
  { label: 'PhD', value: 'phd' },
];

const THESIS_STAGES: { label: string; currentLevel: number; getCompleted: (hasAdvisor: boolean) => number[] }[] = [
  { label: "I'm still looking for a topic",          currentLevel: 1, getCompleted: (a) => a ? [2] : [] },
  { label: "I have a topic, working on my proposal", currentLevel: 3, getCompleted: (a) => a ? [1, 2] : [1] },
  { label: "I'm doing my actual research",           currentLevel: 4, getCompleted: (a) => a ? [1, 2, 3] : [1, 3] },
  { label: "I'm writing my thesis",                  currentLevel: 5, getCompleted: () => [1, 2, 3, 4] },
  { label: "I'm preparing for my defense",           currentLevel: 6, getCompleted: () => [1, 2, 3, 4, 5] },
];

type Step = 'info' | 'interests' | 'advisor' | 'stage' | 'deadline';
const STEP_ORDER: Step[] = ['info', 'interests', 'advisor', 'stage', 'deadline'];

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: `2px solid ${C.border}`,
  borderRadius: 16,
  padding: '14px 20px',
  fontSize: 15,
  color: C.darkBrown,
  backgroundColor: C.cream,
  outline: 'none',
};

export default function OnboardingPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const user = useAuthStore((s) => s.user);

  const [step, setStep] = useState<Step>('info');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [universities, setUniversities] = useState<University[]>([]);
  const [studyPrograms, setStudyPrograms] = useState<StudyProgram[]>([]);
  const [fields, setFields] = useState<Field[]>([]);

  const [universityId, setUniversityId] = useState('');
  const [degreeType, setDegreeType] = useState('');
  const [studyProgramId, setStudyProgramId] = useState('');
  const [uniSearch, setUniSearch] = useState('');
  const [fieldIds, setFieldIds] = useState<string[]>([]);
  const [hasAdvisor, setHasAdvisor] = useState<boolean | null>(null);
  const [pendingStages, setPendingStages] = useState<{ currentLevel: number; completedStages: number[] } | null>(null);
  const [mainDeadline, setMainDeadline] = useState('');

  const stepIndex = STEP_ORDER.indexOf(step);
  const progress = ((stepIndex + 1) / STEP_ORDER.length) * 100;

  useEffect(() => {
    api.get('/data/universities').then((r) => setUniversities(r.data));
    api.get('/data/fields').then((r) => setFields(r.data));
  }, []);

  useEffect(() => {
    if (!universityId || !degreeType) { setStudyPrograms([]); setStudyProgramId(''); return; }
    api.get(`/data/study-programs?universityId=${universityId}&degree=${degreeType}`)
      .then((r) => { setStudyPrograms(r.data); setStudyProgramId(''); });
  }, [universityId, degreeType]);

  function toggleField(id: string) {
    setFieldIds((prev) => prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]);
  }

  function goBack() {
    const prev = STEP_ORDER[stepIndex - 1];
    if (prev) setStep(prev);
  }

  function handleStageSelect(stage: typeof THESIS_STAGES[number]) {
    const completedStages = stage.getCompleted(hasAdvisor ?? false);
    const currentLevel = stage.currentLevel;
    setPendingStages({ currentLevel, completedStages });
    setStep('deadline');
  }

  async function handleDeadlineSubmit() {
    if (!pendingStages) return;
    setLoading(true);
    try {
      const { currentLevel, completedStages } = pendingStages;
      const result = await authService.completeOnboarding({
        currentLevel, completedStages, universityId, studyProgramId, degreeType, fieldIds,
        mainDeadline: mainDeadline || undefined,
      });
      setAuth({ ...user!, isOnboarded: true, currentLevel, completedStages }, result.token);
      navigate('/dashboard');
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  const filteredUniversities = universities.filter((u) =>
    u.name.toLowerCase().includes(uniSearch.toLowerCase())
  );

  const primaryBtn: React.CSSProperties = {
    width: '100%', padding: '14px 0', borderRadius: 16, fontSize: 15, fontWeight: 700,
    backgroundColor: C.darkBrown, color: C.cream, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.5 : 1,
  };

  const optionBtn = (selected: boolean): React.CSSProperties => ({
    width: '100%', padding: '14px 20px', borderRadius: 16, fontSize: 15, textAlign: 'left',
    border: `2px solid ${selected ? C.darkBrown : C.border}`,
    backgroundColor: selected ? C.darkBrown : C.cream,
    color: selected ? C.cream : C.darkBrown,
    cursor: 'pointer',
  });

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.warmWhite }}>
      <div className="w-full max-w-lg px-10 py-16 flex flex-col items-center">
        <StudyondLogo className="h-10 w-auto mb-12" />

        {/* Progress bar */}
        <div className="w-full h-1 rounded-full mb-10" style={{ backgroundColor: C.border }}>
          <div
            className="h-1 rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, backgroundColor: C.darkBrown }}
          />
        </div>

        <p className="text-xs mb-3" style={{ color: C.mutedText }}>
          {stepIndex + 1} / {STEP_ORDER.length}
        </p>

        {error && <p className="text-sm text-red-500 mb-4 text-center">{error}</p>}

        {/* Step 1: Info */}
        {step === 'info' && (
          <>
            <h1 className="text-3xl font-bold mb-10 text-center" style={{ color: C.darkBrown }}>
              Tell us about yourself
            </h1>
            <div className="w-full space-y-4">
              <div className="relative">
                <input
                  value={uniSearch}
                  onChange={(e) => { setUniSearch(e.target.value); setUniversityId(''); }}
                  placeholder="Search your university*"
                  style={{ ...inputStyle, borderColor: universityId ? C.darkBrown : C.border }}
                />
                {uniSearch && !universityId && filteredUniversities.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 rounded-2xl bg-white shadow-md max-h-48 overflow-y-auto" style={{ border: `2px solid ${C.border}` }}>
                    {filteredUniversities.slice(0, 8).map((u) => (
                      <button
                        key={u.id}
                        onClick={() => { setUniversityId(u.id); setUniSearch(u.name); }}
                        className="w-full text-left px-5 py-3 text-sm hover:bg-neutral-50 first:rounded-t-2xl last:rounded-b-2xl"
                        style={{ color: C.darkBrown }}
                      >
                        {u.name} <span style={{ color: C.mutedText }}>· {u.country}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                {DEGREE_OPTIONS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDegreeType(d.value)}
                    className="flex-1 rounded-2xl px-4 py-4 text-sm transition hover:opacity-80"
                    style={optionBtn(degreeType === d.value)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              {studyPrograms.length > 0 && (
                <div className="w-full rounded-2xl overflow-hidden max-h-48 overflow-y-auto" style={{ border: `2px solid ${C.border}` }}>
                  {studyPrograms.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setStudyProgramId(p.id)}
                      className="w-full text-left px-5 py-3 text-sm transition hover:bg-neutral-50 first:rounded-t-2xl last:rounded-b-2xl"
                      style={{
                        backgroundColor: studyProgramId === p.id ? C.darkBrown : 'transparent',
                        color: studyProgramId === p.id ? C.cream : C.darkBrown,
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
              {universityId && degreeType && studyPrograms.length === 0 && (
                <p className="text-sm text-center" style={{ color: C.mutedText }}>No programs found for this combination.</p>
              )}

              <button
                onClick={() => {
                  if (!universityId || !degreeType || !studyProgramId) {
                    setError('Please fill in all fields.');
                    return;
                  }
                  setError('');
                  setStep('interests');
                }}
                style={primaryBtn}
              >
                Continue
              </button>
            </div>
          </>
        )}

        {/* Step 2: Interests */}
        {step === 'interests' && (
          <>
            <h1 className="text-3xl font-bold mb-3 text-center" style={{ color: C.darkBrown }}>
              What are your research interests?
            </h1>
            <p className="text-sm text-center mb-8" style={{ color: C.mutedText }}>Select all that apply.</p>
            <div className="w-full flex flex-wrap gap-2 mb-8">
              {fields.map((f) => (
                <button
                  key={f.id}
                  onClick={() => toggleField(f.id)}
                  className="rounded-2xl px-4 py-2 text-sm transition hover:opacity-80"
                  style={{ ...optionBtn(fieldIds.includes(f.id)), width: 'auto', padding: '9px 18px', fontSize: 14 }}
                >
                  {f.name}
                </button>
              ))}
            </div>
            <button onClick={() => { setError(''); setStep('advisor'); }} style={primaryBtn}>Continue</button>
            <button onClick={goBack} className="mt-4 text-sm hover:underline" style={{ color: C.mutedText, background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
          </>
        )}

        {/* Step 3: Advisor */}
        {step === 'advisor' && (
          <>
            <h1 className="text-3xl font-bold mb-10 text-center" style={{ color: C.darkBrown }}>
              Do you already have a supervisor?
            </h1>
            <div className="w-full space-y-3">
              {[
                { label: 'Yes, I have a supervisor', value: true },
                { label: "No, I'm still looking", value: false },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  onClick={() => { setHasAdvisor(opt.value); setStep('stage'); }}
                  className="w-full rounded-2xl px-5 py-4 text-left text-sm transition hover:opacity-80"
                  style={{ border: `2px solid ${C.border}`, color: C.darkBrown, backgroundColor: C.cream, cursor: 'pointer' }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button onClick={goBack} className="mt-6 text-sm hover:underline" style={{ color: C.mutedText, background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
          </>
        )}

        {/* Step 4: Thesis Stage */}
        {step === 'stage' && (
          <>
            <h1 className="text-3xl font-bold mb-10 text-center" style={{ color: C.darkBrown }}>
              {hasAdvisor ? 'Great! Where are you in your thesis journey?' : 'Where are you in your thesis journey?'}
            </h1>
            <div className="w-full space-y-3">
              {THESIS_STAGES.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleStageSelect(s)}
                  disabled={loading}
                  className="w-full rounded-2xl px-5 py-4 text-left text-sm transition hover:opacity-80 disabled:opacity-40"
                  style={{ border: `2px solid ${C.border}`, color: C.darkBrown, backgroundColor: C.cream, cursor: 'pointer' }}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <button onClick={goBack} className="mt-6 text-sm hover:underline" style={{ color: C.mutedText, background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
          </>
        )}

        {/* Step 5: Deadline */}
        {step === 'deadline' && (
          <>
            <h1 className="text-3xl font-bold mb-3 text-center" style={{ color: C.darkBrown }}>
              When is your thesis due?
            </h1>
            <p className="text-sm text-center mb-8" style={{ color: C.mutedText }}>
              We'll suggest deadlines for each level to keep you on track.
            </p>
            <div className="w-full space-y-4">
              <DatePicker
                value={mainDeadline}
                onChange={setMainDeadline}
                min={new Date().toISOString().slice(0, 10)}
                placeholder="Pick your thesis deadline"
              />
              <button onClick={handleDeadlineSubmit} disabled={loading} style={primaryBtn}>
                {loading ? 'Setting up…' : mainDeadline ? "Let's go →" : 'Skip for now →'}
              </button>
            </div>
            <button onClick={goBack} className="mt-6 text-sm hover:underline" style={{ color: C.mutedText, background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
          </>
        )}
      </div>
    </div>
  );
}
