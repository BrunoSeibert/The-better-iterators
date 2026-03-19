import { useEffect, useState } from 'react';
import * as authService from '@/services/authService';

type Topic = {
  id: string;
  title: string;
  description: string;
  employment: string;
  employmentType: string | null;
  workplaceType: string | null;
  degrees: string[];
  companyId: string;
};

function TopicGrid({ topics }: { topics: Topic[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            {topic.degrees.map((d) => (
              <span
                key={d}
                className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium uppercase text-neutral-600"
              >
                {d}
              </span>
            ))}
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

export default function Level2() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [browsingAll, setBrowsingAll] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
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

  const browseAll = () => {
    setLoadingAll(true);
    authService
      .getTopicsByUniversity(true)
      .then(({ topics }) => {
        setTopics(topics);
        setBrowsingAll(true);
        setLoadingAll(false);
      })
      .catch(() => setLoadingAll(false));
  };

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

  if (topics.length === 0 && !browsingAll) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <p className="text-neutral-600">
          At your university there are no available topics matching your interests.
        </p>
        <button
          type="button"
          onClick={browseAll}
          disabled={loadingAll}
          className="rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60"
        >
          {loadingAll ? 'Loading…' : 'Browse all topics from your university'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {browsingAll && (
        <p className="text-sm text-neutral-400">
          Showing all topics from your university
        </p>
      )}
      <TopicGrid topics={topics} />
    </div>
  );
}
