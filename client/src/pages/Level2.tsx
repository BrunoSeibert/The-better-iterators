import { useEffect, useState } from 'react';
import * as authService from '@/services/authService';

type Topic = {
  id: string;
  title: string;
  description: string;
  type: string;
  employment: string;
  employmentType: string | null;
  workplaceType: string | null;
  degrees: string[];
  companyId: string;
  universityId: string;
};

export default function Level2() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    authService
      .getTopicsByUniversity()
      .then(({ topics }) => {
        if (!cancelled) {
          setTopics(topics);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message ?? 'Failed to load topics');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-neutral-500">
        Loading topics…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-40 items-center justify-center text-red-500">
        {error}
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-neutral-500">
        No topics found for your university.
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {topics.map((topic) => (
        <div
          key={topic.id}
          className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
        >
          <h3 className="text-base font-semibold leading-snug text-neutral-900">
            {topic.title}
          </h3>
          <p className="line-clamp-3 text-sm text-neutral-500">
            {topic.description}
          </p>
          <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
            {Array.isArray(topic.degrees)
              ? topic.degrees.map((d) => (
                  <span
                    key={d}
                    className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium uppercase text-neutral-600"
                  >
                    {d}
                  </span>
                ))
              : null}
            {topic.workplaceType && (
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
                {topic.workplaceType}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
