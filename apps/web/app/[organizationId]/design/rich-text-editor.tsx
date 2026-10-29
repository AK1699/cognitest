'use client';

import { Bold, Code, Heading2, Italic, List, ListOrdered, Quote, Table } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Markdown } from './markdown';

const TABLE_TEMPLATE = `| Field | Value |
| --- | --- |
| Example | Example |
`;

/**
 * A pure Markdown editor (prose block): formatting toolbar over a textarea with
 * a Write/Preview toggle. Gherkin lives in its own block — see DescriptionEditor.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Describe the requirement… **bold**, lists, tables and `code` are supported.',
  minRows = 5,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const pending = useRef<[number, number] | null>(null);
  const [tab, setTab] = useState<'write' | 'preview'>('write');

  useEffect(() => {
    if (pending.current && ref.current) {
      const [start, end] = pending.current;
      ref.current.focus();
      ref.current.setSelectionRange(start, end);
      pending.current = null;
    }
  }, [value]);

  function apply(next: string, selection: [number, number]) {
    pending.current = selection;
    onChange(next);
  }

  function wrap(marker: string, sample: string) {
    const ta = ref.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const selected = value.slice(s, e) || sample;
    const next = `${value.slice(0, s)}${marker}${selected}${marker}${value.slice(e)}`;
    apply(next, [s + marker.length, s + marker.length + selected.length]);
  }

  function prefixLines(prefix: string | ((index: number) => string)) {
    const ta = ref.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    const block = value.slice(lineStart, e);
    const prefixed = block
      .split('\n')
      .map((line, index) => `${typeof prefix === 'function' ? prefix(index) : prefix}${line}`)
      .join('\n');
    const next = `${value.slice(0, lineStart)}${prefixed}${value.slice(e)}`;
    apply(next, [lineStart, lineStart + prefixed.length]);
  }

  function insertBlock(block: string) {
    const ta = ref.current;
    if (!ta) return;
    const { selectionStart: s } = ta;
    const before = value.slice(0, s);
    const needsLead = before.length > 0 && !before.endsWith('\n\n');
    const lead = needsLead ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
    const insertion = `${lead}${block}`;
    const next = `${before}${insertion}${value.slice(s)}`;
    const caret = s + insertion.length;
    apply(next, [caret, caret]);
  }

  const toolButton =
    'flex h-8 w-8 items-center justify-center rounded-[8px] text-muted transition-colors hover:bg-primary-tint hover:text-primary-deep';

  return (
    <div className="rounded-[10px] border border-line bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-line px-2 py-1.5">
        <button type="button" title="Bold" className={toolButton} onClick={() => wrap('**', 'bold')}>
          <Bold aria-hidden className="h-4 w-4" />
        </button>
        <button type="button" title="Italic" className={toolButton} onClick={() => wrap('_', 'italic')}>
          <Italic aria-hidden className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Inline code"
          className={toolButton}
          onClick={() => wrap('`', 'code')}
        >
          <Code aria-hidden className="h-4 w-4" />
        </button>
        <span className="mx-1 h-5 w-px bg-line" />
        <button type="button" title="Heading" className={toolButton} onClick={() => prefixLines('## ')}>
          <Heading2 aria-hidden className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Bulleted list"
          className={toolButton}
          onClick={() => prefixLines('- ')}
        >
          <List aria-hidden className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Numbered list"
          className={toolButton}
          onClick={() => prefixLines((index) => `${index + 1}. `)}
        >
          <ListOrdered aria-hidden className="h-4 w-4" />
        </button>
        <button type="button" title="Quote" className={toolButton} onClick={() => prefixLines('> ')}>
          <Quote aria-hidden className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Insert table"
          className={toolButton}
          onClick={() => insertBlock(TABLE_TEMPLATE)}
        >
          <Table aria-hidden className="h-4 w-4" />
        </button>

        <div className="ml-auto flex rounded-[8px] bg-cream p-0.5 text-xs font-semibold">
          {(['write', 'preview'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTab(mode)}
              className={`rounded-[6px] px-2.5 py-1 capitalize transition-colors ${
                tab === mode ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {tab === 'write' ? (
        <textarea
          ref={ref}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={minRows}
          className="block w-full resize-y rounded-b-[10px] bg-white px-3.5 py-2.5 font-mono text-[13px] leading-relaxed text-ink placeholder:text-muted/70 focus:outline-none"
        />
      ) : (
        <div className="min-h-[6rem] px-3.5 py-2.5">
          <Markdown source={value} />
        </div>
      )}
    </div>
  );
}
