import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import type { ChatMessage, FormGame, NewsItem, StandingRow } from '../types';

type ChatContext = {
  team: string;
  league: string;
  standingSummary?: string;
  form: FormGame[];
  standings: StandingRow[];
  news: NewsItem[];
};

const SUGGESTIONS = [
  'Recap our last 5 in one paragraph.',
  'Who looks like our biggest threat in the table?',
  'What\'s the headline I should care about today?',
  'Are we trending up or down right now?',
];

export function Chatbot({
  context,
  accent,
  primary,
}: {
  context: ChatContext;
  accent: string;
  primary: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, busy]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const headlines = (context.news || []).slice(0, 6).map((n) => n.headline);
      const { reply } = await api.chat(next, {
        team: context.team,
        league: context.league,
        standingSummary: context.standingSummary,
        form: context.form,
        standings: context.standings,
        headlines,
      });
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: `Couldn't reach the assistant: ${e.message}. Try again.`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden flex flex-col h-[640px] sticky top-6">
      <div
        className="px-4 py-3 border-b border-white/10 flex items-center gap-2"
        style={{
          background: `linear-gradient(90deg, ${primary}55, transparent)`,
        }}
      >
        <Sparkles className="w-4 h-4" style={{ color: accent }} />
        <div className="flex flex-col leading-tight">
          <span className="font-display text-sm tracking-widest uppercase text-white">
            Touchline AI
          </span>
          <span className="text-[10px] text-zinc-400">
            Grounded in your team's live data
          </span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="text-sm text-zinc-300 leading-relaxed">
              Ask me anything about <span className="text-white font-semibold">{context.team}</span>.
              I've got their last five, current league spot, and today's
              headlines loaded up.
            </div>
            <div className="flex flex-col gap-2 pt-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-xs px-3 py-2 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/30 transition-colors text-zinc-300"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={
                m.role === 'user'
                  ? 'ml-auto max-w-[85%] text-sm rounded-2xl rounded-br-sm px-3.5 py-2.5 leading-relaxed'
                  : 'mr-auto max-w-[90%] text-sm rounded-2xl rounded-bl-sm px-3.5 py-2.5 leading-relaxed bg-white/[0.04] border border-white/10 text-zinc-100'
              }
              style={
                m.role === 'user'
                  ? {
                      background: primary,
                      color: '#fff',
                    }
                  : undefined
              }
            >
              {m.content}
            </motion.div>
          ))}
        </AnimatePresence>

        {busy && (
          <div className="mr-auto max-w-[80%] text-xs text-zinc-400 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            thinking…
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="p-3 border-t border-white/10 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask about ${context.team}…`}
          className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-lg px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          style={{ background: accent, color: '#0a0a0a' }}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
