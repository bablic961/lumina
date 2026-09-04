'use client';

import Link from 'next/link';
import { Fragment, useMemo } from 'react';
import { cn } from '@/lib/utils';

const PATTERN =
  /(https?:\/\/[^\s<]+|@[a-zA-Z0-9_]{2,32}|`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~)/g;

/**
 * Lightweight inline formatter: links, @mentions, `code`, **bold**, __italic__,
 * ~~strike~~. Deliberately not a full markdown parse — chat text should stay
 * predictable, and anything longer belongs in a code block.
 */
export function RichText({ text, outgoing }: { text: string; outgoing: boolean }) {
  const parts = useMemo(() => text.split(PATTERN).filter((p) => p !== ''), [text]);

  // A message that is nothing but emoji renders large, with no bubble chrome.
  const emojiOnly = useMemo(
    () => /^[\p{Extended_Pictographic}\p{Emoji_Component}\s]+$/u.test(text) && [...text.trim()].length <= 8,
    [text],
  );

  if (emojiOnly) {
    return <span className="block text-4xl leading-tight">{text.trim()}</span>;
  }

  return (
    <span className="wrap-anywhere whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (/^https?:\/\//.test(part)) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className={cn('underline decoration-dotted underline-offset-2', outgoing ? 'text-white' : 'text-accent')}
            >
              {part.length > 48 ? `${part.slice(0, 45)}…` : part}
            </a>
          );
        }
        if (/^@[a-zA-Z0-9_]{2,32}$/.test(part)) {
          return (
            <Link
              key={i}
              href={`/app/u/${part.slice(1)}`}
              className={cn(
                'rounded px-0.5 font-semibold',
                outgoing ? 'bg-white/20 text-white' : 'bg-accent/15 text-accent',
              )}
            >
              {part}
            </Link>
          );
        }
        if (/^`[^`]+`$/.test(part)) {
          return (
            <code
              key={i}
              className={cn('rounded-md px-1 py-0.5 font-mono text-[0.85em]', outgoing ? 'bg-white/20' : 'bg-glass/80')}
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (/^__[^_]+__$/.test(part)) return <em key={i}>{part.slice(2, -2)}</em>;
        if (/^~~[^~]+~~$/.test(part)) return <s key={i}>{part.slice(2, -2)}</s>;
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </span>
  );
}
