import { useMemo } from 'react';
import { ChatWindow } from './components/chat/ChatWindow.js';

export function App() {
  // One screen, one session per page load. Hackathon scope.
  const sessionId = useMemo(() => crypto.randomUUID(), []);

  return (
    <div className="h-full flex flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-tng-500 flex items-center justify-center text-white font-bold">
            R
          </div>
          <div>
            <div className="font-semibold text-neutral-900">TNG Rise</div>
            <div className="text-xs text-neutral-500">CFO untuk usahawan kecil</div>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <ChatWindow sessionId={sessionId} />
      </main>
    </div>
  );
}
