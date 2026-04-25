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
          'max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed',
          isUser
            ? 'bg-neutral-200 text-neutral-900'
            : 'bg-white border border-neutral-200 text-neutral-900',
        )}
      >
        {text ? (
          <ReactMarkdown>{text}</ReactMarkdown>
        ) : (
          streaming && <span className="text-neutral-400 italic">Sekejap ya</span>
        )}
      </div>
    </div>
  );
}
