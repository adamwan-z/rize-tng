import { useMemo } from 'react';
import { ChatWindow } from './components/chat/ChatWindow.js';
import { TngBar } from './components/brand/TngBar.js';

export function App() {
  const sessionId = useMemo(() => crypto.randomUUID(), []);
  return (
    <div className="h-full flex flex-col bg-surface-0">
      <TngBar />
      <header className="border-b border-surface-2 bg-surface-1">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Header content lands in Task 3 */}
          <div className="font-display font-bold text-ink-900">TNG Rise</div>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <ChatWindow sessionId={sessionId} />
      </main>
      <TngBar thin />
    </div>
  );
}
