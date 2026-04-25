import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import clsx from 'clsx';

export function ChatInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (message: string) => void | Promise<void>;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');
  const hasText = value.trim().length > 0;

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
    <form
      onSubmit={handleSubmit}
      className="border-t border-surface-2 bg-surface-1 py-3 sticky bottom-0"
    >
      <div className="flex gap-2 items-end">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          disabled={disabled}
          placeholder="Tanya apa-apa, contoh: macam mana business hari ni?"
          className="flex-1 resize-none rounded-xl border border-surface-2 px-3 py-2.5 text-[15px] font-body bg-surface-1 text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-4 focus:ring-tng-blue/15 focus:border-tng-blue disabled:bg-surface-2"
        />
        <button
          type="submit"
          aria-label="Hantar mesej"
          disabled={disabled || !hasText}
          className={clsx(
            'rounded-xl w-11 h-11 flex items-center justify-center transition',
            hasText
              ? 'bg-tng-blue hover:bg-tng-blue-dark text-white'
              : 'bg-surface-2 text-ink-300 cursor-not-allowed',
          )}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
