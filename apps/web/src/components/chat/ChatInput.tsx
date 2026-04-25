import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Briefcase, Send } from 'lucide-react';
import clsx from 'clsx';

const MAX_TEXTAREA_HEIGHT = 160;

export function ChatInput({
  onSubmit,
  disabled,
  showGrantBadge,
  onGrantClick,
}: {
  onSubmit: (message: string) => void | Promise<void>;
  disabled?: boolean;
  showGrantBadge?: boolean;
  onGrantClick?: () => void;
}) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasText = value.trim().length > 0;

  // Auto-grow up to MAX_TEXTAREA_HEIGHT, then scroll inside the textarea.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [value]);

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
      className="border-t border-surface-2 bg-surface-1 py-3 sticky bottom-0 z-10"
    >
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          disabled={disabled}
          placeholder="Tanya apa-apa, contoh: macam mana business hari ni?"
          className="flex-1 resize-none rounded-xl border border-surface-2 px-3 py-2.5 text-[15px] font-body bg-surface-1 text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-4 focus:ring-tng-blue/15 focus:border-tng-blue disabled:bg-surface-2 disabled:cursor-not-allowed transition-colors duration-200 leading-relaxed overflow-y-auto"
        />
        {showGrantBadge && (
          <button
            type="button"
            onClick={onGrantClick}
            aria-label="Cari business grant"
            disabled={disabled}
            title="Cari business grant"
            className={clsx(
              'rounded-xl w-11 h-11 flex items-center justify-center bg-tng-yellow text-ink-900 transition-[background-color,transform] duration-200 focus:outline-none focus:ring-4 focus:ring-tng-yellow/40',
              disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-tng-yellow-deep cursor-pointer active:scale-[0.96] tng-grant-pulse',
            )}
          >
            <Briefcase className="w-4 h-4" />
          </button>
        )}
        <button
          type="submit"
          aria-label="Hantar mesej"
          disabled={disabled || !hasText}
          className={clsx(
            'rounded-xl w-11 h-11 flex items-center justify-center transition-[background-color,color,transform] duration-200 focus:outline-none focus:ring-4 focus:ring-tng-blue/25',
            hasText
              ? 'bg-tng-blue hover:bg-tng-blue-dark text-white cursor-pointer active:scale-[0.96]'
              : 'bg-surface-2 text-ink-300 cursor-not-allowed',
          )}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
