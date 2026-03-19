import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getTopicsSimilarFromOthers } from '@/services/authService';

type Topic = {
  id: string;
  title: string;
  description: string;
  employment: string;
  employmentType: string | null;
  workplaceType: string | null;
  degrees: string[];
  companyId: string;
  universityName: string | null;
};

export default function ExploreOtherTopics() {
  const navigate = useNavigate();
  const location = useLocation();
  const topicIds: string[] = location.state?.topicIds ?? [];

  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTopicsSimilarFromOthers(topicIds)
      .then(({ topics }) => { setTopics(topics); setLoading(false); })
      .catch((err) => { setError(err.message ?? 'Failed to load topics'); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-neutral-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
          <span className="text-sm">Finding similar topics…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-red-500">{error}</div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-700 transition"
        >
          ← Back
        </button>
        <h2 className="text-xl font-semibold text-neutral-900">Topics from other universities</h2>
        <p className="mt-1 text-sm text-neutral-500">Similar topics to your suggestions, available at other universities.</p>
      </div>

      {topics.length === 0 ? (
        <p className="text-sm text-neutral-500">No matching topics found at other universities.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((topic) => (
            <div
              key={topic.id}
              onClick={() => navigate(`/topics/${topic.id}`)}
              className="flex cursor-pointer flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-300 hover:shadow-md"
            >
              <h3 className="text-base font-semibold leading-snug text-neutral-900">{topic.title}</h3>
              <p className="line-clamp-3 text-sm text-neutral-500">{topic.description}</p>
              <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                {topic.degrees.map((d) => (
                  <span key={d} className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium uppercase text-neutral-600">
                    {d}
                  </span>
                ))}
                {topic.workplaceType && (
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
                    {topic.workplaceType}
                  </span>
                )}
                {topic.universityName && (
                  <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-600">
                    {topic.universityName}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
