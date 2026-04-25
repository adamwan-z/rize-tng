import ReactMarkdown, { type Components } from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import clsx from 'clsx';

// Per-element styling for markdown rendered inside chat bubbles. Tailwind's
// preflight strips default list/heading styles, so each element needs explicit
// classes. Same components are used for both user and agent bubbles; the
// surrounding bubble drives color via inheritance.
const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="font-mono text-[13px] px-1.5 py-0.5 rounded bg-black/5">
      {children}
    </code>
  ),
  h1: ({ children }) => (
    <h1 className="font-display font-bold text-[18px] mt-3 mb-2 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-display font-semibold text-[16px] mt-3 mb-1 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-display font-semibold text-[15px] mt-2 mb-1 first:mt-0">{children}</h3>
  ),
};

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
          <ReactMarkdown
            remarkPlugins={[remarkBreaks]}
            components={markdownComponents}
          >
            {text}
          </ReactMarkdown>
        ) : streaming ? (
          <span className="text-ink-500 italic font-editorial">Sekejap ya</span>
        ) : null}
      </div>
    </div>
  );
}
