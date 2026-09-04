'use client';

import { useEffect, useMemo, useState } from 'react';
import hljs from 'highlight.js/lib/common';
import { Check, Copy } from 'lucide-react';

/**
 * Highlights with the "common" language bundle (~35 languages) to keep the
 * client bundle reasonable; unknown languages fall back to auto-detection.
 */
export function CodeBlock({ code, language }: { code: string; language?: string | null }) {
  const [copied, setCopied] = useState(false);

  const { html, detected } = useMemo(() => {
    try {
      if (language && hljs.getLanguage(language)) {
        const result = hljs.highlight(code, { language, ignoreIllegals: true });
        return { html: result.value, detected: language };
      }
      const auto = hljs.highlightAuto(code);
      return { html: auto.value, detected: auto.language ?? 'text' };
    } catch {
      return { html: null, detected: language ?? 'text' };
    }
  }, [code, language]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <div className="group/code relative my-1 overflow-hidden rounded-2xl border border-hairline bg-canvas-2/70">
      <div className="flex items-center justify-between border-b border-hairline px-3 py-1.5">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{detected}</span>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
          }}
          className="press flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft hover:bg-glass/70"
          aria-label="Копировать код"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-500" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>
      <pre className="scrollbar-none max-h-96 overflow-auto px-3 py-2.5 text-xs leading-relaxed">
        {html ? (
          // Highlight.js escapes the source before adding spans, so this is safe.
          <code className="hljs font-mono" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <code className="hljs font-mono">{code}</code>
        )}
      </pre>
    </div>
  );
}
