import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuthStore } from '../../store/authStore';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { getLevelMetadata } from '@/services/authService';

const IDLE_MS = 5 * 60 * 1000;
const AFFIRMATION_CHECK_MS = 1000;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isAffirmation?: boolean;
}

export default function AiAssistant() {
  const token = useAuthStore((s) => s.token);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'How can I help you with your journey?' },
  ]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastUserMessageAt = useRef<number>(Date.now());
  const loadingRef = useRef(false);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const getCheckinContext = () => {
    try {
      const raw = localStorage.getItem('todayCheckin');
      if (!raw) return undefined;
      const c = JSON.parse(raw);
      if (new Date(c.date).toDateString() !== new Date().toDateString()) return undefined;
      const energyLabel = ['', 'exhausted', 'tired', 'okay', 'good', 'energized'][c.energy] ?? '';
      return [
        `Energy: ${c.energy}/5 (${energyLabel})`,
        c.lastProgress ? `Last worked on: ${c.lastProgress}` : null,
        `Today's focus: ${c.focus}`,
        c.timeAvailable ? `Time available: ${c.timeAvailable}` : null,
        c.blocker ? `Blocker: ${c.blocker}` : null,
      ].filter(Boolean).join('\n');
    } catch { return undefined; }
  };

  const playAffirmation = useCallback((content: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.rate = 1;
    utterance.pitch = 1.02;
    window.speechSynthesis.speak(utterance);
  }, []);

  const fetchAffirmation = useCallback(async () => {
    if (loadingRef.current || !token) return;

    try {
      const checkinContext = getCheckinContext();
      const res = await fetch('/api/affirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ checkinContext }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.content) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.content, isAffirmation: true }]);
        playAffirmation(data.content);
      }
    } catch { /* silently skip */ }
  }, [playAffirmation, token]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const idleMs = Date.now() - lastUserMessageAt.current;
      if (idleMs >= IDLE_MS) {
        void fetchAffirmation();
        lastUserMessageAt.current = Date.now();
      }
    }, AFFIRMATION_CHECK_MS);
    return () => window.clearInterval(interval);
  }, [fetchAffirmation]);

  useEffect(() => () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    lastUserMessageAt.current = Date.now();

    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const checkinContext = getCheckinContext();

      const thesisMeta: Record<string, string> = await getLevelMetadata().catch(() => ({}));
      const thesisContext = [
        thesisMeta['1'] ? `Thesis topic: ${thesisMeta['1']}` : null,
        thesisMeta['2'] ? `Advisor: ${thesisMeta['2']}` : null,
        thesisMeta['3'] ? `Research question: ${thesisMeta['3']}` : null,
      ].filter(Boolean).join('\n') || undefined;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: newMessages.map(({ role, content }) => ({ role, content })),
          conversationId,
          checkinContext,
          thesisContext,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.conversationId) setConversationId(data.conversationId);
      setMessages([...newMessages, { ...data.message, isAffirmation: false }]);
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex-1 overflow-y-auto rounded-[0.5rem] border border-neutral-200 bg-white p-4 text-sm">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-3 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-[0.42rem] px-3 py-2 ${
                msg.role === 'user'
                  ? 'bg-[rgba(114,96,84,1)] text-[rgba(245,239,231,1)]'
                  : msg.isAffirmation
                    ? 'border border-amber-200 bg-amber-50 text-neutral-700'
                    : 'border border-neutral-200 bg-neutral-50 text-neutral-700'
              }`}
            >
              {msg.isAffirmation && (
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-500">✦ Noodle</p>
              )}
              {msg.role === 'user' ? (
                msg.content
              ) : (
                <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="mb-3 flex justify-start">
            <div className="rounded-[0.42rem] border border-neutral-200 bg-neutral-50 px-3 py-2 text-neutral-400">...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
          }}
          placeholder="Type a message..."
          className="flex-1 rounded-[0.42rem] border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-neutral-400"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="rounded-[0.32rem] border-2 border-[rgba(214,146,52,1)] bg-[rgba(247,187,96,1)] px-4 py-2 text-sm font-medium text-[rgba(102,60,8,1)] transition hover:bg-[rgba(240,176,80,1)] hover:text-[rgba(84,47,4,1)] disabled:opacity-30"
        >
          Send
        </button>
      </div>
    </div>
  );
}
