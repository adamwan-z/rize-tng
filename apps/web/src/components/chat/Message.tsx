import ReactMarkdown from 'react-markdown';
import clsx from 'clsx';

export function Message({
  role,
  text,
  streaming = false,
}: {
  role: 'user' | 'agent';
  text: string;
  streaming?: boolean;
}) {
  const isUser = role === 'user';
  return (
    <div className={clsx('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={clsx(
          'max-w-[80%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed',
          isUser
            ? 'bg-tng-blue text-white rounded-br-sm font-body'
            : 'bg-surface-1 border border-surface-2 text-ink-900 rounded-bl-sm font-body',
        )}
      >
        {text ? (
          <ReactMarkdown>{text}</ReactMarkdown>
        ) : streaming ? (
          <span className="text-ink-500 italic font-editorial">Sekejap ya</span>
        ) : null}
      </div>
    </div>
  );
}
