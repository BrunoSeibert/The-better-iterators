import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useLocation, useNavigate } from 'react-router-dom';
import * as authService from '@/services/authService';
import { api } from '@/services/api';
import { BADGES } from '@/utils/badges';

interface University { id: string; name: string; country: string; }
interface StudyProgram { id: string; name: string; degree: string; }
interface Field { id: string; name: string; }

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

const DEGREE_OPTIONS = [
  { label: 'Bachelor', value: 'bsc' },
  { label: 'Master',   value: 'msc' },
  { label: 'PhD',      value: 'phd' },
];
const DEGREE_LABELS: Record<string, string> = { bsc: 'Bachelor', msc: 'Master', phd: 'PhD' };

export default function Profile() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? '/app';

  const level = user?.currentLevel ?? 0;
  const completedStages = user?.completedStages ?? [];

  const [streak, setStreak] = useState<number | null>(() => authService.peekStreakSummary()?.currentStreak ?? null);
  const [profileInfo, setProfileInfo] = useState<{
    universityName: string | null;
    studyProgramName: string | null;
    degreeType: string | null;
    interestNames: string[];
  } | null>(null);
  const [advisorName, setAdvisorName] = useState<string>('');

  // Edit state
  const [editing, setEditing] = useState(false);
  const [universities, setUniversities] = useState<University[]>([]);
  const [allFields, setAllFields] = useState<Field[]>([]);
  const [studyPrograms, setStudyPrograms] = useState<StudyProgram[]>([]);

  const [uniSearch, setUniSearch] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [degreeType, setDegreeType] = useState('');
  const [studyProgramId, setStudyProgramId] = useState('');
  const [fieldIds, setFieldIds] = useState<string[]>([]);
  const [editAdvisor, setEditAdvisor] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authService.me()
      .then(({ user: refreshedUser }) => { useAuthStore.getState().setUser(refreshedUser); })
      .catch(() => {});
    authService.getProfileInfo().then(setProfileInfo).catch(() => {});
    authService.getLevelMetadata().then((meta) => {
      setAdvisorName((meta as Record<string, string>)['2'] ?? '');
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let isMounted = true;
    authService.getStreakSummary({ force: true })
      .then((data) => { if (isMounted) setStreak(data.currentStreak); })
      .catch(() => { if (isMounted && authService.peekStreakSummary() === null) setStreak(0); });
    return () => { isMounted = false; };
  }, []);

  // Load reference data when edit mode opens
  useEffect(() => {
    if (!editing) return;
    api.get('/data/universities').then((r) => setUniversities(r.data)).catch(() => {});
    api.get('/data/fields').then((r) => setAllFields(r.data)).catch(() => {});
  }, [editing]);

  // Load study programs when university + degree change
  useEffect(() => {
    if (!editing || !universityId || !degreeType) { setStudyPrograms([]); return; }
    api.get(`/data/study-programs?universityId=${universityId}&degree=${degreeType}`)
      .then((r) => setStudyPrograms(r.data))
      .catch(() => {});
  }, [editing, universityId, degreeType]);

  function openEdit() {
    setUniSearch(profileInfo?.universityName ?? '');
    setUniversityId(''); // will be resolved via search
    setDegreeType(profileInfo?.degreeType ?? '');
    setStudyProgramId('');
    setFieldIds([]); // will reload once we have the raw IDs
    setEditAdvisor(advisorName);
    setEditing(true);
    // Load raw field IDs from the server
    api.get('/auth/me').then((r) => {
      const u = r.data.user;
      setFieldIds(u.interests ?? []);
      setUniversityId(u.university_id ?? '');
      setStudyProgramId(u.study_program_id ?? '');
    }).catch(() => {});
  }

  async function save() {
    setSaving(true);
    try {
      await authService.updateProfile({
        universityId,
        studyProgramId,
        degreeType,
        fieldIds,
        advisorName: editAdvisor.trim() || null,
      });
      const info = await authService.getProfileInfo();
      setProfileInfo(info);
      setAdvisorName(editAdvisor.trim());
      setEditing(false);
    } catch {
      // keep editing open
    } finally {
      setSaving(false);
    }
  }

  const filteredUniversities = universities.filter((u) =>
    u.name.toLowerCase().includes(uniSearch.toLowerCase())
  );

  const streakValue = streak ?? 0;
  const unlockedCount = BADGES.filter((b) => b.condition(streakValue, level)).length;

  const rowStyle: React.CSSProperties = {
    backgroundColor: 'rgba(255,255,255,1)',
    border: '2px solid rgba(224,224,228,1)',
  };

  return (
    <div className="min-h-screen px-4 py-12 sm:px-8" style={{ backgroundColor: C.warmWhite }}>
      <button
        type="button"
        onClick={() => navigate(returnTo)}
        className="mb-8 flex items-center gap-2 px-4 py-2 text-sm font-medium transition rounded-lg"
        style={{ color: C.darkBrown, backgroundColor: C.lightTan, border: '2px solid rgba(224,224,228,1)' }}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
          <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>
        Back
      </button>

      <div className="mx-auto max-w-2xl space-y-5">

        {/* Header card */}
        <div className="rounded-xl px-8 py-8" style={{ backgroundColor: C.darkBrown, border: `2px solid ${C.midBrown}` }}>
          <div className="flex items-center gap-5">
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl text-3xl font-bold"
              style={{ backgroundColor: C.midBrown, color: C.cream }}
            >
              {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <p className="text-lg font-bold" style={{ color: C.cream }}>{user?.name ?? user?.email ?? '—'}</p>
              <p className="mt-0.5 text-sm" style={{ color: C.tan }}>
                Level {level} · {completedStages.length} stages completed
              </p>
            </div>
          </div>

          <div className="mt-7">
            <div className="mb-2 flex justify-between text-xs" style={{ color: C.tan }}>
              <span>Progress</span>
              <span>{completedStages.length} / 6 stages</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(70,70,78,1)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(completedStages.length / 6) * 100}%`, backgroundColor: C.lightTan }}
              />
            </div>
          </div>
        </div>

        {/* Badges card */}
        <div className="rounded-xl px-8 py-7" style={{ backgroundColor: C.cream, border: '2px solid rgba(224,224,228,1)' }}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-bold" style={{ color: C.darkBrown }}>Badges</h2>
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{ backgroundColor: C.lightTan, color: C.darkBrown, border: '2px solid rgba(224,224,228,1)' }}
            >
              {unlockedCount} / {BADGES.length} unlocked
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
            {BADGES.map((badge) => {
              const unlocked = badge.condition(streakValue, level);
              return (
                <div key={badge.label} className="group relative flex flex-col items-center gap-2">
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-xl text-3xl transition"
                    style={unlocked
                      ? { backgroundColor: C.lightTan, border: '2px solid rgba(224,224,228,1)' }
                      : { backgroundColor: C.warmWhite, border: '2px solid rgba(224,224,228,1)', opacity: 0.4, filter: 'grayscale(1)' }
                    }
                  >
                    {badge.emoji}
                  </div>
                  <span className="text-center text-xs font-medium" style={{ color: C.mutedText }}>{badge.label}</span>
                  <div
                    className="pointer-events-none absolute -top-10 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs opacity-0 shadow-lg transition group-hover:opacity-100"
                    style={{ backgroundColor: C.darkBrown, color: C.cream }}
                  >
                    {badge.description}
                    <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent" style={{ borderTopColor: C.darkBrown }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Academic Profile card */}
        <div className="rounded-xl px-8 py-7" style={{ backgroundColor: C.cream, border: '2px solid rgba(224,224,228,1)' }}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-bold" style={{ color: C.darkBrown }}>Academic Profile</h2>
            {!editing && (
              <button
                type="button"
                onClick={openEdit}
                className="text-xs font-semibold rounded-lg px-3 py-1.5 transition"
                style={{ color: C.darkBrown, backgroundColor: C.lightTan, border: `2px solid ${C.border}` }}
              >
                Edit
              </button>
            )}
          </div>

          {!editing ? (
            <div className="space-y-2">
              {[
                { label: 'University',  value: profileInfo?.universityName },
                { label: 'Programme',   value: profileInfo?.studyProgramName },
                { label: 'Degree',      value: profileInfo?.degreeType ? DEGREE_LABELS[profileInfo.degreeType] ?? profileInfo.degreeType : null },
                { label: 'Advisor',     value: advisorName || null },
              ].filter(({ value }) => value).map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between rounded-lg px-5 py-3.5" style={rowStyle}>
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.mutedText }}>{label}</span>
                  <span className="text-sm font-semibold text-right max-w-[60%]" style={{ color: C.darkBrown }}>{value}</span>
                </div>
              ))}
              {(profileInfo?.interestNames.length ?? 0) > 0 && (
                <div className="rounded-lg px-5 py-3.5" style={rowStyle}>
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.mutedText }}>Research Interests</span>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {profileInfo!.interestNames.map((name) => (
                      <span key={name} className="rounded-full px-3 py-1 text-xs font-medium"
                        style={{ backgroundColor: C.lightTan, color: C.darkBrown, border: `2px solid ${C.border}` }}>
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {!profileInfo?.universityName && !profileInfo?.degreeType && !advisorName && (profileInfo?.interestNames.length ?? 0) === 0 && (
                <p className="text-sm" style={{ color: C.mutedText }}>No academic info set yet.</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* University search */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: C.mutedText }}>University</label>
                <div className="relative">
                  <input
                    value={uniSearch}
                    onChange={(e) => { setUniSearch(e.target.value); setUniversityId(''); }}
                    placeholder="Search university…"
                    className="w-full focus:outline-none"
                    style={{ backgroundColor: C.warmWhite, border: `2px solid ${universityId ? C.darkBrown : C.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: C.darkBrown }}
                  />
                  {uniSearch && !universityId && filteredUniversities.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 overflow-y-auto rounded-xl bg-white shadow-md" style={{ maxHeight: 180, border: `2px solid ${C.border}` }}>
                      {filteredUniversities.slice(0, 8).map((u) => (
                        <button key={u.id} type="button"
                          onClick={() => { setUniversityId(u.id); setUniSearch(u.name); setStudyProgramId(''); }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-neutral-50"
                          style={{ color: C.darkBrown }}
                        >
                          {u.name} <span style={{ color: C.mutedText }}>· {u.country}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Degree */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: C.mutedText }}>Degree</label>
                <div className="flex gap-2">
                  {DEGREE_OPTIONS.map((d) => (
                    <button key={d.value} type="button"
                      onClick={() => { setDegreeType(d.value); setStudyProgramId(''); }}
                      className="flex-1 rounded-xl py-2.5 text-sm font-medium transition"
                      style={{
                        border: `2px solid ${degreeType === d.value ? C.darkBrown : C.border}`,
                        backgroundColor: degreeType === d.value ? C.darkBrown : C.warmWhite,
                        color: degreeType === d.value ? C.cream : C.darkBrown,
                      }}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Study programme */}
              {studyPrograms.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: C.mutedText }}>Programme</label>
                  <div className="overflow-y-auto rounded-xl" style={{ maxHeight: 160, border: `2px solid ${C.border}` }}>
                    {studyPrograms.map((p) => (
                      <button key={p.id} type="button"
                        onClick={() => setStudyProgramId(p.id)}
                        className="w-full text-left px-4 py-2.5 text-sm transition hover:bg-neutral-50"
                        style={{
                          backgroundColor: studyProgramId === p.id ? C.darkBrown : 'transparent',
                          color: studyProgramId === p.id ? C.cream : C.darkBrown,
                        }}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Advisor */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: C.mutedText }}>Advisor / Supervisor</label>
                <input
                  value={editAdvisor}
                  onChange={(e) => setEditAdvisor(e.target.value)}
                  placeholder="e.g. Prof. Dr. Smith"
                  className="w-full focus:outline-none"
                  style={{ backgroundColor: C.warmWhite, border: `2px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: C.darkBrown }}
                />
              </div>

              {/* Research interests */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: C.mutedText }}>Research Interests</label>
                <div className="flex flex-wrap gap-2">
                  {allFields.map((f) => {
                    const on = fieldIds.includes(f.id);
                    return (
                      <button key={f.id} type="button"
                        onClick={() => setFieldIds((prev) => on ? prev.filter((id) => id !== f.id) : [...prev, f.id])}
                        className="rounded-full px-3 py-1.5 text-xs font-medium transition"
                        style={{
                          border: `2px solid ${on ? C.darkBrown : C.border}`,
                          backgroundColor: on ? C.darkBrown : C.warmWhite,
                          color: on ? C.cream : C.darkBrown,
                        }}
                      >
                        {f.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Save / Cancel */}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={save} disabled={saving}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 14, fontWeight: 700, backgroundColor: C.darkBrown, color: C.cream, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1 }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={() => setEditing(false)} disabled={saving}
                  style={{ padding: '10px 20px', borderRadius: 10, fontSize: 14, color: C.mutedText, backgroundColor: 'transparent', border: `2px solid ${C.border}`, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Account card */}
        <div className="rounded-xl px-8 py-7" style={{ backgroundColor: C.cream, border: '2px solid rgba(224,224,228,1)' }}>
          <h2 className="mb-5 text-base font-bold" style={{ color: C.darkBrown }}>Account</h2>
          <div className="space-y-2">
            {[
              { label: 'Email',            value: user?.email ?? '—' },
              { label: 'Current Level',    value: String(level) },
              { label: 'Daily Streak',     value: streak === null ? 'Loading…' : `🔥 ${streak} days` },
              { label: 'Completed Stages', value: completedStages.join(', ') || '—' },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-lg px-5 py-3.5"
                style={rowStyle}
              >
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.mutedText }}>{label}</span>
                <span className="text-sm font-semibold" style={{ color: C.darkBrown }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={() => { logout(); navigate('/login', { state: { returnTo } }); }}
          className="w-full rounded-lg py-3 text-sm font-bold transition"
          style={{ backgroundColor: 'rgba(220,38,38,0.5)', color: 'rgba(153,27,27,1)', border: '2px solid rgba(220,38,38,1)' }}
        >
          Log out
        </button>

      </div>
    </div>
  );
}
