import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as authService from '@/services/authService';

type TopicDetail = Awaited<ReturnType<typeof authService.getTopicById>>;

const EMPLOYMENT_LABEL: Record<string, string> = {
  open: 'Open',
  no: 'No employment',
  fixed: 'Fixed',
};

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  working_student: 'Working Student',
  internship: 'Internship',
  full_time: 'Full-time',
  part_time: 'Part-time',
};

const WORKPLACE_LABEL: Record<string, string> = {
  hybrid: 'Hybrid',
  on_site: 'On-site',
  remote: 'Remote',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-400">{title}</h2>
      {children}
    </div>
  );
}

function Badge({ label, variant = 'gray' }: { label: string; variant?: 'gray' | 'blue' | 'green' }) {
  const styles = {
    gray: 'bg-neutral-100 text-neutral-700',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-700',
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${styles[variant]}`}>
      {label}
    </span>
  );
}

export default function TopicDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<TopicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    authService.getTopicById(id)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message ?? 'Failed to load topic');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 text-neutral-500">
        Loading topic…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 text-red-500">
        {error ?? 'Topic not found'}
      </div>
    );
  }

  const { topic, company, university, fields, supervisors, experts } = data;

  return (
    <div className="min-h-screen bg-neutral-100">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-neutral-200 bg-white px-6 py-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <span className="text-xs text-neutral-300">/</span>
        <span className="text-sm text-neutral-500">Topics</span>
        <span className="text-xs text-neutral-300">/</span>
        <span className="max-w-xs truncate text-sm font-medium text-neutral-900">{topic.title}</span>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Hero */}
        <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {topic.degrees.map((d) => (
              <Badge key={d} label={d.toUpperCase()} />
            ))}
            {topic.workplaceType && (
              <Badge label={WORKPLACE_LABEL[topic.workplaceType] ?? topic.workplaceType} variant="blue" />
            )}
            {topic.employment !== 'no' && topic.employmentType && (
              <Badge label={EMPLOYMENT_TYPE_LABEL[topic.employmentType] ?? topic.employmentType} variant="green" />
            )}
          </div>
          <h1 className="text-2xl font-bold leading-snug text-neutral-900">{topic.title}</h1>
          {company && (
            <p className="mt-1 text-sm font-medium text-neutral-500">{company.name}</p>
          )}
          <p className="mt-4 leading-7 text-neutral-700">{topic.description}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left column */}
          <div className="flex flex-col gap-4 lg:col-span-2">
            {/* Requirements */}
            <Section title="Requirements">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div>
                  <dt className="text-neutral-400">Degree</dt>
                  <dd className="mt-1 font-medium text-neutral-800 capitalize">{topic.degrees.join(', ')}</dd>
                </div>
                <div>
                  <dt className="text-neutral-400">Employment</dt>
                  <dd className="mt-1 font-medium text-neutral-800">
                    {EMPLOYMENT_LABEL[topic.employment] ?? topic.employment}
                    {topic.employmentType && ` — ${EMPLOYMENT_TYPE_LABEL[topic.employmentType] ?? topic.employmentType}`}
                  </dd>
                </div>
                {topic.workplaceType && (
                  <div>
                    <dt className="text-neutral-400">Workplace</dt>
                    <dd className="mt-1 font-medium text-neutral-800">{WORKPLACE_LABEL[topic.workplaceType] ?? topic.workplaceType}</dd>
                  </div>
                )}
              </dl>
            </Section>

            {/* Fields */}
            {fields.length > 0 && (
              <Section title="Research Fields">
                <div className="flex flex-wrap gap-2">
                  {fields.map((f) => (
                    <Badge key={f.id} label={f.name} />
                  ))}
                </div>
              </Section>
            )}

            {/* Supervisors */}
            {supervisors.length > 0 && (
              <Section title="Academic Supervisors">
                <div className="flex flex-col gap-5">
                  {supervisors.map((s) => (
                    <div key={s.id}>
                      <p className="font-semibold text-neutral-900">{s.title} {s.firstName} {s.lastName}</p>
                      <a href={`mailto:${s.email}`} className="text-sm text-blue-500 hover:underline">{s.email}</a>
                      {s.about && <p className="mt-2 text-sm leading-6 text-neutral-600">{s.about}</p>}
                      {s.researchInterests?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {s.researchInterests.map((r) => (
                            <Badge key={r} label={r} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Experts */}
            {experts.length > 0 && (
              <Section title="Industry Experts">
                <div className="flex flex-col gap-5">
                  {experts.map((e) => (
                    <div key={e.id}>
                      <p className="font-semibold text-neutral-900">{e.firstName} {e.lastName}</p>
                      <p className="text-sm text-neutral-500">{e.title}</p>
                      <a href={`mailto:${e.email}`} className="text-sm text-blue-500 hover:underline">{e.email}</a>
                      {e.about && <p className="mt-2 text-sm leading-6 text-neutral-600">{e.about}</p>}
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">
            {/* Company */}
            {company && (
              <Section title="Company">
                <p className="text-base font-semibold text-neutral-900">{company.name}</p>
                {company.domains?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {company.domains.map((d) => <Badge key={d} label={d} />)}
                  </div>
                )}
                {company.size && (
                  <p className="mt-3 text-sm text-neutral-500">
                    <span className="font-medium text-neutral-700">Size:</span> {company.size} employees
                  </p>
                )}
                {company.about && (
                  <p className="mt-3 text-sm leading-6 text-neutral-600">{company.about}</p>
                )}
              </Section>
            )}

            {/* University */}
            {university && (
              <Section title="University">
                <p className="text-base font-semibold text-neutral-900">{university.name}</p>
                <p className="text-sm text-neutral-500">{university.country}</p>
                {university.about && (
                  <p className="mt-3 text-sm leading-6 text-neutral-600">{university.about}</p>
                )}
              </Section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
