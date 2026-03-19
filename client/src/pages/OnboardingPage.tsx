import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import * as authService from '../services/authService';
import StudyondLogo from '../components/ui/StudyondLogo';

interface University { id: string; name: string; country: string; }
interface StudyProgram { id: string; name: string; degree: string; }
interface Field { id: string; name: string; }

const DEGREE_OPTIONS = [
  { label: 'Bachelor', value: 'bsc' },
  { label: 'Master', value: 'msc' },
  { label: 'PhD', value: 'phd' },
];

const THESIS_STAGES = [
  { label: "I'm still looking for a topic",             getCompleted: (a: boolean) => a ? [2] : [] },
  { label: "I have a topic, no literature review yet",  getCompleted: (a: boolean) => a ? [1, 2] : [1] },
  { label: "I've done literature research, no proposal yet", getCompleted: (a: boolean) => a ? [1, 2, 3] : [1, 3] },
  { label: "I'm writing my research proposal",          getCompleted: () => [1, 2, 3] },
  { label: "I'm doing my actual research",              getCompleted: () => [1, 2, 3, 4] },
  { label: "I'm writing my thesis",                     getCompleted: () => [1, 2, 3, 4, 5] },
  { label: "I'm preparing for my defense",              getCompleted: () => [1, 2, 3, 4, 5, 6] },
];

type Step = 'info' | 'interests' | 'advisor' | 'stage';
const STEP_ORDER: Step[] = ['info', 'interests', 'advisor', 'stage'];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const user = useAuthStore((s) => s.user);


  const [step, setStep] = useState<Step>('info');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reference data
  const [universities, setUniversities] = useState<University[]>([]);
  const [studyPrograms, setStudyPrograms] = useState<StudyProgram[]>([]);
  const [fields, setFields] = useState<Field[]>([]);

  // Step 1
  const [universityId, setUniversityId] = useState('');
  const [degreeType, setDegreeType] = useState('');
  const [studyProgramId, setStudyProgramId] = useState('');
  const [uniSearch, setUniSearch] = useState('');

  // Step 2
  const [fieldIds, setFieldIds] = useState<string[]>([]);

  // Step 3
  const [hasAdvisor, setHasAdvisor] = useState<boolean | null>(null);

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

  async function handleStageSelect(completedStages: number[]) {
    const currentLevel = completedStages.length > 0 ? Math.max(...completedStages) : 0;
    setLoading(true);
    try {
      const result = await authService.completeOnboarding({ currentLevel, completedStages, universityId, studyProgramId, degreeType, fieldIds });
      setAuth({ ...user!, isOnboarded: true, currentLevel, completedStages }, result.token);
      navigate('/app');
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  const filteredUniversities = universities.filter((u) =>
    u.name.toLowerCase().includes(uniSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-full max-w-lg px-10 py-16 flex flex-col items-center">
        <StudyondLogo className="h-10 w-auto mb-12" />

        {/* Progress bar */}
        <div className="w-full h-1 rounded-full mb-10" style={{ backgroundColor: 'var(--border)' }}>
          <div
            className="h-1 rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, backgroundColor: 'var(--primary)' }}
          />
        </div>

        <p className="ds-caption mb-3" style={{ color: 'var(--muted-foreground)' }}>
          {stepIndex + 1} / {STEP_ORDER.length}
        </p>

        {error && <p className="ds-small text-red-500 mb-4 text-center">{error}</p>}

        {/* Step 1: Info */}
        {step === 'info' && (
          <>
            <h1 className="ds-title-xl font-light text-[--foreground] mb-10 text-center">
              Tell us about yourself
            </h1>
            <div className="w-full space-y-4">
              {/* University search */}
              <div className="relative">
                <input
                  value={uniSearch}
                  onChange={(e) => { setUniSearch(e.target.value); setUniversityId(''); }}
                  placeholder="Search your university*"
                  className="w-full border rounded-2xl px-5 py-4 ds-body placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  style={{ borderColor: universityId ? 'var(--primary)' : 'var(--border)' }}
                />
                {uniSearch && !universityId && filteredUniversities.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 border rounded-2xl bg-white shadow-md max-h-48 overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
                    {filteredUniversities.slice(0, 8).map((u) => (
                      <button
                        key={u.id}
                        onClick={() => { setUniversityId(u.id); setUniSearch(u.name); }}
                        className="w-full text-left px-5 py-3 ds-small hover:bg-neutral-50 first:rounded-t-2xl last:rounded-b-2xl"
                        style={{ color: 'var(--foreground)' }}
                      >
                        {u.name} <span style={{ color: 'var(--muted-foreground)' }}>· {u.country}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Degree */}
              <div className="flex gap-3">
                {DEGREE_OPTIONS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDegreeType(d.value)}
                    className="flex-1 border rounded-2xl px-4 py-4 ds-body transition hover:opacity-80"
                    style={{
                      borderColor: degreeType === d.value ? 'var(--primary)' : 'var(--border)',
                      backgroundColor: degreeType === d.value ? 'var(--primary)' : 'transparent',
                      color: degreeType === d.value ? 'var(--primary-foreground)' : 'var(--foreground)',
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              {/* Study program */}
              {studyPrograms.length > 0 && (
                <div className="w-full border rounded-2xl overflow-hidden max-h-48 overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
                  {studyPrograms.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setStudyProgramId(p.id)}
                      className="w-full text-left px-5 py-3 ds-small transition hover:bg-neutral-50 first:rounded-t-2xl last:rounded-b-2xl"
                      style={{
                        backgroundColor: studyProgramId === p.id ? 'var(--primary)' : 'transparent',
                        color: studyProgramId === p.id ? 'var(--primary-foreground)' : 'var(--foreground)',
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
              {universityId && degreeType && studyPrograms.length === 0 && (
                <p className="ds-small text-center" style={{ color: 'var(--muted-foreground)' }}>
                  No programs found for this combination.
                </p>
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
                className="w-full py-4 rounded-2xl ds-label text-base transition hover:opacity-90"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                Continue
              </button>
            </div>
          </>
        )}

        {/* Step 2: Fields / Interests */}
        {step === 'interests' && (
          <>
            <h1 className="ds-title-xl font-light text-[--foreground] mb-3 text-center">
              What are your research interests?
            </h1>
            <p className="ds-body text-center mb-8" style={{ color: 'var(--muted-foreground)' }}>
              Select all that apply.
            </p>
            <div className="w-full flex flex-wrap gap-2 mb-8">
              {fields.map((f) => (
                <button
                  key={f.id}
                  onClick={() => toggleField(f.id)}
                  className="border rounded-2xl px-4 py-2 ds-small transition hover:opacity-80"
                  style={{
                    borderColor: fieldIds.includes(f.id) ? 'var(--primary)' : 'var(--border)',
                    backgroundColor: fieldIds.includes(f.id) ? 'var(--primary)' : 'transparent',
                    color: fieldIds.includes(f.id) ? 'var(--primary-foreground)' : 'var(--foreground)',
                  }}
                >
                  {f.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setError(''); setStep('advisor'); }}
              className="w-full py-4 rounded-2xl ds-label text-base transition hover:opacity-90"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              Continue
            </button>
            <button onClick={goBack} className="mt-4 ds-small hover:underline" style={{ color: 'var(--muted-foreground)' }}>
              ← Back
            </button>
          </>
        )}

        {/* Step 3: Advisor */}
        {step === 'advisor' && (
          <>
            <h1 className="ds-title-xl font-light text-[--foreground] mb-10 text-center">
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
                  className="w-full border rounded-2xl px-5 py-4 ds-body text-left transition hover:opacity-80"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button onClick={goBack} className="mt-6 ds-small hover:underline" style={{ color: 'var(--muted-foreground)' }}>
              ← Back
            </button>
          </>
        )}

        {/* Step 4: Thesis Stage */}
        {step === 'stage' && (
          <>
            <h1 className="ds-title-xl font-light text-[--foreground] mb-10 text-center">
              {hasAdvisor ? 'Great! Where are you in your thesis journey?' : 'Where are you in your thesis journey?'}
            </h1>
            <div className="w-full space-y-3">
              {THESIS_STAGES.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleStageSelect(s.getCompleted(hasAdvisor ?? false))}
                  disabled={loading}
                  className="w-full border rounded-2xl px-5 py-4 ds-body text-left transition hover:opacity-80 disabled:opacity-40"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <button onClick={goBack} className="mt-6 ds-small hover:underline" style={{ color: 'var(--muted-foreground)' }}>
              ← Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
