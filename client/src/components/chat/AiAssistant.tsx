import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuthStore } from '../../store/authStore';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';


interface Message {
  role: 'user' | 'assistant';
  content: string;
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const checkinContext = (() => {
        try {
          const raw = localStorage.getItem('todayCheckin');
          if (!raw) return undefined;
          const c = JSON.parse(raw);
          const today = new Date().toDateString();
          if (new Date(c.date).toDateString() !== today) return undefined;
          const energyLabel = ['', 'exhausted', 'tired', 'okay', 'good', 'energized'][c.energy] ?? '';
          return [
            `Energy: ${c.energy}/5 (${energyLabel})`,
            c.lastProgress ? `Last worked on: ${c.lastProgress}` : null,
            `Today's focus: ${c.focus}`,
            c.timeAvailable ? `Time available: ${c.timeAvailable}` : null,
            c.blocker ? `Blocker: ${c.blocker}` : null,
          ].filter(Boolean).join('\n');
        } catch { return undefined; }
      })();

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: newMessages,
          conversationId,
          checkinContext,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.conversationId) setConversationId(data.conversationId);
      setMessages([...newMessages, data.message]);
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
                  : 'border border-neutral-200 bg-neutral-50 text-neutral-700'
              }`}
            >
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

