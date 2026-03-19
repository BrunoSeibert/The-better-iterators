import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import type { Professor } from './Level2';

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

const OBJECTIVE_LABELS: Record<string, string> = {
  student_matching: 'Open to student matching',
  research_collaboration: 'Research collaboration',
  funding_access: 'Funding access',
  network_expansion: 'Network expansion',
  education_collaboration: 'Education collaboration',
};

export default function ProfessorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAuthStore((s) => s.token);

  const stateProf = (location.state as { professor?: Professor } | null)?.professor ?? null;
  const [professor, setProfessor] = useState<Professor | null>(stateProf);
  const [loading, setLoading] = useState(!stateProf);

  useEffect(() => {
    if (stateProf || !id) return;
    fetch(`/api/map/professors/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => { setProfessor(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id, stateProf, token]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: C.warmWhite }}>
        <div className="h-6 w-6 animate-spin rounded-full border-2" style={{ borderColor: C.lightTan, borderTopColor: C.darkBrown }} />
      </div>
    );
  }

  if (!professor) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4" style={{ backgroundColor: C.warmWhite }}>
        <p style={{ color: C.mutedText }}>Professor not found.</p>
        <button onClick={() => navigate('/app')} style={{ color: C.darkBrown, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
          Back to workspace
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-12 sm:px-8" style={{ backgroundColor: C.warmWhite }}>
      <button
        onClick={() => navigate(-1)}
        className="mb-8 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition"
        style={{ color: C.darkBrown, backgroundColor: C.lightTan, border: `2px solid ${C.border}` }}
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
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl text-2xl font-bold"
              style={{ backgroundColor: C.midBrown, color: C.cream }}
            >
              {professor.firstName[0]}{professor.lastName[0]}
            </div>
            <div>
              <p className="text-xl font-bold" style={{ color: C.cream }}>{professor.firstName} {professor.lastName}</p>
              <p className="mt-0.5 text-sm" style={{ color: C.tan }}>{professor.title}</p>
              <p className="mt-0.5 text-sm" style={{ color: C.tan }}>{professor.universityName}</p>
            </div>
          </div>

          {typeof professor.match === 'number' && (
            <div className="mt-6">
              <div className="mb-2 flex justify-between text-xs" style={{ color: C.tan }}>
                <span>Match with your profile</span>
                <span>{Math.round(professor.match * 100)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(70,70,78,1)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.round(professor.match * 100)}%`, backgroundColor: C.lightTan }}
                />
              </div>
            </div>
          )}
        </div>

        {/* About */}
        {professor.about && (
          <div className="rounded-xl px-8 py-7" style={{ backgroundColor: C.cream, border: `2px solid ${C.border}` }}>
            <h2 className="mb-3 text-base font-bold" style={{ color: C.darkBrown }}>About</h2>
            <p className="text-sm leading-relaxed" style={{ color: C.midBrown }}>{professor.about}</p>
          </div>
        )}

        {/* Research interests */}
        {professor.researchInterests.length > 0 && (
          <div className="rounded-xl px-8 py-7" style={{ backgroundColor: C.cream, border: `2px solid ${C.border}` }}>
            <h2 className="mb-4 text-base font-bold" style={{ color: C.darkBrown }}>Research Interests</h2>
            <div className="flex flex-wrap gap-2">
              {professor.researchInterests.map(interest => (
                <span
                  key={interest}
                  className="rounded-full px-3 py-1 text-sm"
                  style={{ backgroundColor: C.lightTan, color: C.midBrown, border: `1px solid ${C.border}` }}
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Objectives */}
        {professor.objectives.length > 0 && (
          <div className="rounded-xl px-8 py-7" style={{ backgroundColor: C.cream, border: `2px solid ${C.border}` }}>
            <h2 className="mb-4 text-base font-bold" style={{ color: C.darkBrown }}>Open to</h2>
            <div className="flex flex-wrap gap-2">
              {professor.objectives.map(obj => (
                <span
                  key={obj}
                  className="rounded-full px-3 py-1 text-sm font-medium"
                  style={{ backgroundColor: C.warmWhite, color: C.darkBrown, border: `2px solid ${C.border}` }}
                >
                  {OBJECTIVE_LABELS[obj] ?? obj}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Contact */}
        <div className="rounded-xl px-8 py-7" style={{ backgroundColor: C.cream, border: `2px solid ${C.border}` }}>
          <h2 className="mb-4 text-base font-bold" style={{ color: C.darkBrown }}>Contact</h2>
          <a
            href={`mailto:${professor.email}`}
            className="text-sm font-medium hover:underline"
            style={{ color: C.darkBrown }}
          >
            {professor.email}
          </a>
        </div>

      </div>
    </div>
  );
}
