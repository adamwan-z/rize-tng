import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

export function ChatInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (message: string) => void | Promise<void>;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    setValue('');
    void onSubmit(trimmed);
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-neutral-200 bg-white py-3">
      <div className="flex gap-2 items-end">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          disabled={disabled}
          placeholder="Tanya apa-apa, contoh: macam mana business hari ni?"
          className="flex-1 resize-none rounded-xl border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tng-500 disabled:bg-neutral-100"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="rounded-xl bg-tng-500 px-4 py-2 text-white hover:bg-tng-600 disabled:bg-neutral-300 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
