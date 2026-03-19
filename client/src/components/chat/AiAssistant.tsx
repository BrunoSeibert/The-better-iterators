import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuthStore } from '../../store/authStore';

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
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: newMessages,
          conversationId,
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
      <div className="flex-1 overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4 text-sm">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-3 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 ${
                msg.role === 'user'
                  ? 'bg-neutral-900 text-white'
                  : 'border border-neutral-200 bg-neutral-50 text-neutral-700'
              }`}
            >
              {msg.role === 'user' ? (
                msg.content
              ) : (
              <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="mb-3 flex justify-start">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-neutral-400">...</div>
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
          className="flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-neutral-400"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-30"
        >
          Send
        </button>
      </div>
    </div>
  );
}

