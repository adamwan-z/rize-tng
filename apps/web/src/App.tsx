import { useMemo } from 'react';
import { ChatWindow } from './components/chat/ChatWindow.js';
import { TngBar } from './components/brand/TngBar.js';
import { RiseMark } from './components/brand/RiseMark.js';

export function App() {
  const sessionId = useMemo(() => crypto.randomUUID(), []);
  return (
    <div className="h-full flex flex-col bg-surface-0">
      <TngBar />
      <header className="border-b border-surface-2 bg-surface-1">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <RiseMark />
          <span className="hidden sm:inline-flex items-center gap-2 px-2 py-1 rounded-full bg-tng-green/10 text-tng-green text-[10px] font-mono font-semibold uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-tng-green" />
            Online
          </span>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <ChatWindow sessionId={sessionId} />
      </main>
      <TngBar thin />
    </div>
  );
}
