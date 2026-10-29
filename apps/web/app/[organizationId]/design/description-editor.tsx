'use client';

import {
  Bold,
  ChevronDown,
  Code,
  Heading2,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Table,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import { CODE_LANGUAGES, GherkinPreview, Markdown } from './markdown';
import { Select } from '../select';

type SegType = 'text' | 'gherkin' | 'code';
interface Segment {
  id: string;
  type: SegType;
  content: string;
  lang?: string; // code blocks only
}

let seq = 0;
const mk = (type: SegType, content = '', lang?: string): Segment => ({
  id: `seg-${++seq}`,
  type,
  content,
  lang,
});

const TABLE_TEMPLATE = `| Field | Value |
| --- | --- |
| Example | Example |
`;

const GHERKIN_STRUCTURE: { label: string; snippet: string }[] = [
  { label: 'Feature', snippet: 'Feature: feature name' },
  { label: 'Background', snippet: 'Background:\n  Given a shared precondition' },
  {
    label: 'Scenario',
    snippet: 'Scenario: scenario name\n  Given a context\n  When an action occurs\n  Then an outcome',
  },
  {
    label: 'Scenario Outline',
    snippet:
      'Scenario Outline: scenario name\n  Given <input>\n  When an action occurs\n  Then <result>\n\n  Examples:\n    | input | result |\n    | a     | b      |',
  },
  { label: 'Examples', snippet: '  Examples:\n    | param |\n    | value |' },
];
const GHERKIN_STEPS = ['Given', 'When', 'Then', 'And', 'But'];

/** Markdown → ordered prose / gherkin / code segments. */
function parse(markdown: string): Segment[] {
  const text = markdown ?? '';
  if (!text.trim()) return [mk('text')];
  const segments: Segment[] = [];
  const fence = /```(\w*)\n([\s\S]*?)```/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(text))) {
    segments.push(mk('text', text.slice(last, match.index).trim()));
    const lang = match[1] ?? '';
    const body = (match[2] ?? '').trim();
    if (lang === 'gherkin') segments.push(mk('gherkin', body));
    else segments.push(mk('code', body, lang || undefined));
    last = fence.lastIndex;
  }
  segments.push(mk('text', text.slice(last).trim()));
  return segments.length ? segments : [mk('text')];
}

/** Segments → one Markdown string (prose + fenced ```gherkin / ```code). */
function serialize(segments: Segment[]): string {
  return segments
    .map((seg) => {
      const content = seg.content.trim();
      if (!content) return '';
      if (seg.type === 'gherkin') return `\`\`\`gherkin\n${content}\n\`\`\``;
      if (seg.type === 'code') return `\`\`\`${seg.lang ?? ''}\n${content}\n\`\`\``;
      return content;
    })
    .filter(Boolean)
    .join('\n\n');
}

/** Guarantees a trailing text segment so prose can always follow a Gherkin box. */
function withTail(segments: Segment[]): Segment[] {
  if (segments.length === 0) return [mk('text')];
  if (segments[segments.length - 1]!.type !== 'text') return [...segments, mk('text')];
  return segments;
}

/**
 * One Description surface with Gherkin embedded inline: prose flows as seamless
 * text, and `+ Gherkin` drops a styled Gherkin box at the caret (prose continues
 * below it). Serialises to a single Markdown string, so storage is unchanged.
 */
export function DescriptionEditor({
  value,
  onChange,
  placeholder = 'Describe the requirement — bold, lists, tables…',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [segments, setSegments] = useState<Segment[]>(() => withTail(parse(value)));
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [activeId, setActiveId] = useState<string | null>(null);
  const textRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const pendingSel = useRef<Map<string, [number, number]>>(new Map());

  function push(next: Segment[]) {
    setSegments(next);
    onChange(serialize(next));
  }
  function pushStructural(next: Segment[]) {
    push(withTail(next));
  }

  const content = (id: string) => segments.find((s) => s.id === id)?.content ?? '';
  const setContent = (id: string, text: string) =>
    push(segments.map((s) => (s.id === id ? { ...s, content: text } : s)));
  const updateSeg = (id: string, partial: Partial<Segment>) =>
    push(segments.map((s) => (s.id === id ? { ...s, ...partial } : s)));

  /** The focused text segment, or the first text segment as a fallback. */
  function activeTextId(): string | null {
    if (activeId && segments.some((s) => s.id === activeId && s.type === 'text')) return activeId;
    return segments.find((s) => s.type === 'text')?.id ?? null;
  }

  function editActive(transform: (text: string, start: number, end: number) => {
    text: string;
    sel: [number, number];
  }) {
    const id = activeTextId();
    if (!id) return;
    const ta = textRefs.current.get(id);
    const start = ta?.selectionStart ?? content(id).length;
    const end = ta?.selectionEnd ?? start;
    const result = transform(content(id), start, end);
    pendingSel.current.set(id, result.sel);
    setContent(id, result.text);
  }

  const wrap = (marker: string, sample: string) =>
    editActive((text, s, e) => {
      const selected = text.slice(s, e) || sample;
      return {
        text: `${text.slice(0, s)}${marker}${selected}${marker}${text.slice(e)}`,
        sel: [s + marker.length, s + marker.length + selected.length],
      };
    });

  const prefixLines = (prefix: string | ((index: number) => string)) =>
    editActive((text, s, e) => {
      const lineStart = text.lastIndexOf('\n', s - 1) + 1;
      const block = text.slice(lineStart, e);
      const out = block
        .split('\n')
        .map((line, i) => `${typeof prefix === 'function' ? prefix(i) : prefix}${line}`)
        .join('\n');
      return { text: `${text.slice(0, lineStart)}${out}${text.slice(e)}`, sel: [lineStart, lineStart + out.length] };
    });

  const insertTable = () =>
    editActive((text, s) => {
      const before = text.slice(0, s);
      const lead = before.length === 0 || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
      const insertion = `${lead}${TABLE_TEMPLATE}`;
      const caret = s + insertion.length;
      return { text: `${before}${insertion}${text.slice(s)}`, sel: [caret, caret] };
    });

  /** Splits the active text at the caret and embeds a fresh Gherkin/code box. */
  function insertEmbedded(type: 'gherkin' | 'code') {
    const id = activeTextId();
    if (!id) {
      pushStructural([...segments, mk(type), mk('text')]);
      return;
    }
    const ta = textRefs.current.get(id);
    const pos = ta?.selectionStart ?? content(id).length;
    const text = content(id);
    const left = text.slice(0, pos);
    const right = text.slice(pos);
    const next: Segment[] = [];
    for (const seg of segments) {
      if (seg.id === id) next.push({ ...seg, content: left }, mk(type), mk('text', right));
      else next.push(seg);
    }
    pushStructural(next);
  }

  const removeSegment = (id: string) =>
    pushStructural(segments.filter((s) => s.id !== id));

  const toolButton =
    'flex h-8 w-8 items-center justify-center rounded-[8px] text-muted transition-colors hover:bg-primary-tint hover:text-primary-deep';

  const firstTextId = segments.find((s) => s.type === 'text')?.id;

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
          title="Code block"
          className={toolButton}
          onClick={() => insertEmbedded('code')}
        >
          <Code aria-hidden className="h-4 w-4" />
        </button>
        <span className="mx-1 h-5 w-px bg-line" />
        <button type="button" title="Heading" className={toolButton} onClick={() => prefixLines('## ')}>
          <Heading2 aria-hidden className="h-4 w-4" />
        </button>
        <button type="button" title="Bulleted list" className={toolButton} onClick={() => prefixLines('- ')}>
          <List aria-hidden className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Numbered list"
          className={toolButton}
          onClick={() => prefixLines((i) => `${i + 1}. `)}
        >
          <ListOrdered aria-hidden className="h-4 w-4" />
        </button>
        <button type="button" title="Quote" className={toolButton} onClick={() => prefixLines('> ')}>
          <Quote aria-hidden className="h-4 w-4" />
        </button>
        <button type="button" title="Insert table" className={toolButton} onClick={insertTable}>
          <Table aria-hidden className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Insert Gherkin block"
          onClick={() => insertEmbedded('gherkin')}
          className="ml-0.5 flex items-center gap-1.5 rounded-[8px] px-2 py-1 text-xs font-bold text-accent-deep transition-colors hover:bg-accent-tint"
        >
          <ListChecks aria-hidden className="h-4 w-4" />
          Gherkin
        </button>

        <div className="ml-auto flex rounded-[8px] bg-cream p-0.5 text-xs font-semibold">
          {(['write', 'preview'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-[6px] px-2.5 py-1 capitalize transition-colors ${
                mode === m ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {mode === 'preview' ? (
        <div className="min-h-[6rem] px-3.5 py-3">
          <Markdown source={serialize(segments)} />
        </div>
      ) : (
        <div className="space-y-1 px-2 py-2">
          {segments.map((seg) => {
            if (seg.type === 'text') {
              return (
                <TextSegment
                  key={seg.id}
                  id={seg.id}
                  value={seg.content}
                  placeholder={seg.id === firstTextId ? placeholder : ''}
                  onChange={(text) => setContent(seg.id, text)}
                  onFocus={() => setActiveId(seg.id)}
                  registerRef={(el) => {
                    if (el) textRefs.current.set(seg.id, el);
                    else textRefs.current.delete(seg.id);
                  }}
                  pendingSel={pendingSel}
                />
              );
            }
            if (seg.type === 'gherkin') {
              return (
                <GherkinSegment
                  key={seg.id}
                  value={seg.content}
                  onChange={(text) => setContent(seg.id, text)}
                  onRemove={() => removeSegment(seg.id)}
                />
              );
            }
            return (
              <CodeSegment
                key={seg.id}
                value={seg.content}
                lang={seg.lang ?? ''}
                onChange={(text) => setContent(seg.id, text)}
                onLang={(lang) => updateSeg(seg.id, { lang: lang || undefined })}
                onRemove={() => removeSegment(seg.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- text segment */

function TextSegment({
  id,
  value,
  placeholder,
  onChange,
  onFocus,
  registerRef,
  pendingSel,
}: {
  id: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  registerRef: (el: HTMLTextAreaElement | null) => void;
  pendingSel: RefObject<Map<string, [number, number]>>;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // auto-grow to content, and apply any pending toolbar selection
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
    const sel = pendingSel.current?.get(id);
    if (sel) {
      ta.focus();
      ta.setSelectionRange(sel[0], sel[1]);
      pendingSel.current?.delete(id);
    }
  }, [value, id, pendingSel]);

  return (
    <textarea
      ref={(el) => {
        ref.current = el;
        registerRef(el);
      }}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onFocus={onFocus}
      placeholder={placeholder}
      rows={2}
      className="block w-full resize-none overflow-hidden rounded-[8px] bg-transparent px-2 py-1.5 font-mono text-[13px] leading-relaxed text-ink placeholder:text-muted/70 focus:bg-cream/40 focus:outline-none"
    />
  );
}

/* ------------------------------------------------------------ gherkin segment */

function GherkinSegment({
  value,
  onChange,
  onRemove,
}: {
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const pending = useRef<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
    if (pending.current != null) {
      ta.focus();
      ta.setSelectionRange(pending.current, pending.current);
      pending.current = null;
    }
  }, [value]);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [menuOpen]);

  function insert(snippet: string) {
    setMenuOpen(false);
    const ta = ref.current;
    const at = ta ? ta.selectionStart : value.length;
    const before = value.slice(0, at);
    const lead = before.length === 0 || before.endsWith('\n') ? '' : '\n';
    const insertion = `${lead}${snippet}`;
    pending.current = before.length + insertion.length;
    onChange(`${before}${insertion}${value.slice(at)}`);
  }

  const stepChip =
    'rounded-[7px] bg-white px-2 py-1 text-xs font-bold text-accent-deep transition-colors hover:bg-accent/15';

  return (
    <div className="my-1 rounded-[10px] border border-accent/40 bg-accent-tint/30">
      <div className="flex flex-wrap items-center gap-1 border-b border-accent/20 px-2 py-1.5">
        <span className="mr-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-accent-deep">
          <ListChecks aria-hidden className="h-3.5 w-3.5" />
          Gherkin
        </span>
        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-1 rounded-[7px] bg-white px-2 py-1 text-xs font-bold text-accent-deep transition-colors hover:bg-accent/15"
          >
            Structure
            <ChevronDown aria-hidden className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute left-0 top-full z-30 mt-1 w-48 rounded-card border border-line bg-white p-1.5 shadow-lg"
            >
              {GHERKIN_STRUCTURE.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  onClick={() => insert(item.snippet)}
                  className="block w-full rounded-[8px] px-2 py-1.5 text-left text-sm font-semibold text-ink transition-colors hover:bg-primary-tint/60"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {GHERKIN_STEPS.map((keyword) => (
          <button key={keyword} type="button" className={stepChip} onClick={() => insert(`  ${keyword} `)}>
            {keyword}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowPreview((p) => !p)}
            className="rounded-[7px] px-2 py-1 text-xs font-semibold text-muted transition-colors hover:bg-white hover:text-ink"
          >
            {showPreview ? 'Edit' : 'Preview'}
          </button>
          <button
            type="button"
            title="Remove Gherkin block"
            onClick={onRemove}
            className="flex h-7 w-7 items-center justify-center rounded-[7px] text-muted transition-colors hover:bg-white hover:text-fail"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showPreview ? (
        <div className="px-3 py-2.5">
          <GherkinPreview source={value} />
        </div>
      ) : (
        <textarea
          ref={ref}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          className="block w-full resize-none overflow-hidden rounded-b-[10px] bg-white/70 px-3.5 py-2.5 font-mono text-[13px] leading-relaxed text-ink placeholder:text-muted/70 focus:bg-white focus:outline-none"
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- code segment */

function CodeSegment({
  value,
  lang,
  onChange,
  onLang,
  onRemove,
}: {
  value: string;
  lang: string;
  onChange: (value: string) => void;
  onLang: (lang: string) => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, [value]);

  return (
    <div className="my-1 rounded-[10px] border border-line bg-cream/50">
      <div className="flex flex-wrap items-center gap-1 border-b border-line px-2 py-1.5">
        <span className="mr-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted">
          <Code aria-hidden className="h-3.5 w-3.5" />
          Code
        </span>
        <div className="w-40">
          <Select options={CODE_LANGUAGES} value={lang} onChange={onLang} placeholder="Language" />
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowPreview((p) => !p)}
            className="rounded-[7px] px-2 py-1 text-xs font-semibold text-muted transition-colors hover:bg-white hover:text-ink"
          >
            {showPreview ? 'Edit' : 'Preview'}
          </button>
          <button
            type="button"
            title="Remove code block"
            onClick={onRemove}
            className="flex h-7 w-7 items-center justify-center rounded-[7px] text-muted transition-colors hover:bg-white hover:text-fail"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showPreview ? (
        <div className="px-3 py-2.5">
          <Markdown source={`\`\`\`${lang}\n${value}\n\`\`\``} />
        </div>
      ) : (
        <textarea
          ref={ref}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          spellCheck={false}
          className="block w-full resize-none overflow-hidden rounded-b-[10px] bg-white/70 px-3.5 py-2.5 font-mono text-[13px] leading-relaxed text-ink placeholder:text-muted/70 focus:bg-white focus:outline-none"
        />
      )}
    </div>
  );
}
