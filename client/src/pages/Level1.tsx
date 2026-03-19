import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {topics.map((topic) => (
        <div
          key={topic.id}
          onClick={() => navigate(`/topics/${topic.id}`)}
          className="flex cursor-pointer flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-300 hover:shadow-md"
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

export default function Level1() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [browsingOther, setBrowsingOther] = useState(false);
  const [loadingOther, setLoadingOther] = useState(false);
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

  const browseOtherUniversities = () => {
    setLoadingOther(true);
    authService
      .getTopicsFromOtherUniversities()
      .then(({ topics }) => {
        setTopics(topics);
        setBrowsingOther(true);
        setLoadingOther(false);
      })
      .catch(() => setLoadingOther(false));
  };

  const browseAllUniversities = () => {
    setLoadingAll(true);
    authService
      .getTopicsAllUniversities()
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

  if (topics.length === 0 && browsingOther) {
    return (
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-neutral-600">
          No topics matching your interests were found at other universities either.
        </p>
      </div>
    );
  }

  if (topics.length === 0 && !browsingOther) {
    return (
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-neutral-600">
          At your university there are no available topics matching your interests.
        </p>
        <button
          type="button"
          onClick={browseOtherUniversities}
          disabled={loadingOther}
          className="rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60"
        >
          {loadingOther ? 'Loading…' : 'Browse same interests in other universities'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {browsingAll ? (
        <p className="text-sm text-neutral-400">Showing topics matching your interests from all universities</p>
      ) : browsingOther ? (
        <p className="text-sm text-neutral-400">Showing topics matching your interests from other universities</p>
      ) : null}
      <TopicGrid topics={topics} />
      {!browsingAll && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={browseAllUniversities}
            disabled={loadingAll}
            className="rounded-full border border-neutral-300 px-6 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-60"
          >
            {loadingAll ? 'Loading…' : 'Browse other universities'}
          </button>
        </div>
      )}
    </div>
  );
}
