import { useNavigate, useLocation } from 'react-router-dom';
import type { Expert } from './Level2';

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
  fresh_insights: 'Fresh insights',
  education_collaboration: 'Education collaboration',
  research_collaboration: 'Research collaboration',
  recruiting: 'Recruiting',
  brand_visibility: 'Brand visibility',
  network_expansion: 'Network expansion',
};

export default function ExpertPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const expert = (location.state as { expert?: Expert } | null)?.expert ?? null;

  if (!expert) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4" style={{ backgroundColor: C.warmWhite }}>
        <p style={{ color: C.mutedText }}>Expert not found.</p>
        <button onClick={() => navigate('/app')} style={{ color: C.darkBrown, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
          Back to workspace
        </button>
      </div>
    );
  }

  const objectives = Array.isArray(expert.objectives)
    ? expert.objectives
    : typeof expert.objectives === 'string'
      ? (expert.objectives as string).replace(/[{}]/g, '').split(',').filter(Boolean)
      : [];

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
              {expert.firstName[0]}{expert.lastName[0]}
            </div>
            <div>
              <p className="text-xl font-bold" style={{ color: C.cream }}>{expert.firstName} {expert.lastName}</p>
              <p className="mt-0.5 text-sm" style={{ color: C.tan }}>{expert.title}</p>
              <p className="mt-0.5 text-sm" style={{ color: C.tan }}>{expert.companyName}</p>
              {expert.offerInterviews && (
                <span
                  className="mt-2 inline-block rounded-full px-3 py-0.5 text-xs font-semibold"
                  style={{ backgroundColor: C.midBrown, color: C.cream }}
                >
                  Offers interviews
                </span>
              )}
            </div>
          </div>

          {typeof expert.match === 'number' && (
            <div className="mt-6">
              <div className="mb-2 flex justify-between text-xs" style={{ color: C.tan }}>
                <span>Match with your profile</span>
                <span>{Math.round(expert.match * 100)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(70,70,78,1)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.round(expert.match * 100)}%`, backgroundColor: C.lightTan }}
                />
              </div>
            </div>
          )}
        </div>

        {/* About */}
        {expert.about && (
          <div className="rounded-xl px-8 py-7" style={{ backgroundColor: C.cream, border: `2px solid ${C.border}` }}>
            <h2 className="mb-3 text-base font-bold" style={{ color: C.darkBrown }}>About</h2>
            <p className="text-sm leading-relaxed" style={{ color: C.midBrown }}>{expert.about}</p>
          </div>
        )}

        {/* Company domains */}
        {expert.companyDomains.length > 0 && (
          <div className="rounded-xl px-8 py-7" style={{ backgroundColor: C.cream, border: `2px solid ${C.border}` }}>
            <h2 className="mb-4 text-base font-bold" style={{ color: C.darkBrown }}>Domains</h2>
            <div className="flex flex-wrap gap-2">
              {expert.companyDomains.map(domain => (
                <span
                  key={domain}
                  className="rounded-full px-3 py-1 text-sm"
                  style={{ backgroundColor: C.lightTan, color: C.midBrown, border: `1px solid ${C.border}` }}
                >
                  {domain}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Objectives */}
        {objectives.length > 0 && (
          <div className="rounded-xl px-8 py-7" style={{ backgroundColor: C.cream, border: `2px solid ${C.border}` }}>
            <h2 className="mb-4 text-base font-bold" style={{ color: C.darkBrown }}>Open to</h2>
            <div className="flex flex-wrap gap-2">
              {objectives.map(obj => (
                <span
                  key={obj}
                  className="rounded-full px-3 py-1 text-sm font-medium"
                  style={{ backgroundColor: C.warmWhite, color: C.darkBrown, border: `2px solid ${C.border}` }}
                >
                  {OBJECTIVE_LABELS[obj.trim()] ?? obj.trim()}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Contact */}
        <div className="rounded-xl px-8 py-7" style={{ backgroundColor: C.cream, border: `2px solid ${C.border}` }}>
          <h2 className="mb-4 text-base font-bold" style={{ color: C.darkBrown }}>Contact</h2>
          <a
            href={`mailto:${expert.email}`}
            className="text-sm font-medium hover:underline"
            style={{ color: C.darkBrown }}
          >
            {expert.email}
          </a>
        </div>

      </div>
    </div>
  );
}
