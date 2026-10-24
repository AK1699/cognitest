/*
 * A small, dependency-free Markdown renderer for requirement descriptions.
 *
 * XSS-safe by construction: user text is HTML-escaped and the renderer only
 * emits its own whitelisted tags; link hrefs are restricted to http(s)/relative.
 * Supports the subset that matters for requirements — headings, bold/italic,
 * lists, tables, blockquotes, inline/fenced code — plus Gherkin keyword
 * highlighting and lightweight per-language syntax highlighting for code blocks.
 */

const GHERKIN_KEYWORDS =
  /^(\s*)(Feature|Background|Scenario Outline|Scenario|Examples|Given|When|Then|And|But):?\b/;

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* --------------------------------------------------------- syntax highlighting */

interface LangDef {
  keywords: readonly string[];
  line?: string;
  block?: [string, string];
  strings: readonly string[];
  caseInsensitive?: boolean;
}

const JS_KW = [
  'const','let','var','function','return','if','else','for','while','do','switch','case','break',
  'continue','new','class','extends','super','this','import','export','from','default','try','catch',
  'finally','throw','typeof','instanceof','in','of','await','async','yield','delete','void','static',
  'get','set','interface','type','enum','implements','namespace','as','is','keyof','infer','abstract',
  'public','private','protected','readonly','declare','satisfies',
] as const;

const LANGS: Record<string, LangDef> = {
  js: { keywords: JS_KW, line: '//', block: ['/*', '*/'], strings: ['"', "'", '`'] },
  ts: { keywords: JS_KW, line: '//', block: ['/*', '*/'], strings: ['"', "'", '`'] },
  jsx: { keywords: JS_KW, line: '//', block: ['/*', '*/'], strings: ['"', "'", '`'] },
  tsx: { keywords: JS_KW, line: '//', block: ['/*', '*/'], strings: ['"', "'", '`'] },
  java: {
    keywords: [
      'public','private','protected','class','interface','enum','extends','implements','import',
      'package','static','final','void','new','return','if','else','for','while','do','switch','case',
      'break','continue','try','catch','finally','throw','throws','this','super','abstract','synchronized',
      'volatile','transient','native','int','long','short','byte','char','boolean','float','double','var',
      'instanceof','record','sealed',
    ],
    line: '//',
    block: ['/*', '*/'],
    strings: ['"', "'"],
  },
  json: { keywords: [], strings: ['"'] },
  sql: {
    keywords: [
      'select','from','where','insert','into','values','update','set','delete','create','table','alter',
      'drop','join','inner','left','right','outer','full','on','group','by','order','having','limit',
      'offset','distinct','as','and','or','not','null','is','in','between','like','exists','union','all',
      'primary','key','foreign','references','default','index','view','with','case','when','then','else',
      'end','count','sum','avg','min','max','cast','coalesce','asc','desc','add','column','constraint',
    ],
    line: '--',
    block: ['/*', '*/'],
    strings: ["'"],
    caseInsensitive: true,
  },
  py: {
    keywords: [
      'def','return','if','elif','else','for','while','break','continue','class','import','from','as',
      'try','except','finally','raise','with','lambda','yield','global','nonlocal','pass','assert','del',
      'in','is','not','and','or','async','await','match','case',
    ],
    line: '#',
    strings: ['"', "'"],
  },
  go: {
    keywords: [
      'func','return','if','else','for','range','switch','case','default','break','continue','package',
      'import','var','const','type','struct','interface','map','chan','go','defer','select','fallthrough',
      'goto',
    ],
    line: '//',
    block: ['/*', '*/'],
    strings: ['"', '`'],
  },
  bash: {
    keywords: [
      'if','then','else','elif','fi','for','in','do','done','while','until','case','esac','function',
      'return','local','export','echo','read','exit','source','alias',
    ],
    line: '#',
    strings: ['"', "'"],
  },
  yaml: { keywords: ['true', 'false', 'null'], line: '#', strings: ['"', "'"] },
};

const LITERALS = new Set(['true', 'false', 'null', 'nil', 'none', 'undefined', 'True', 'False', 'None']);

function tokenSpan(cls: string, text: string): string {
  return `<span class="tok-${cls}">${escapeHtml(text)}</span>`;
}

/** Tokenises code into keyword/string/comment/number spans. Escapes everything. */
function highlightCode(code: string, lang: string): string {
  const def = LANGS[lang];
  if (!def) return escapeHtml(code);
  const keywords = new Set(def.keywords);
  let out = '';
  let i = 0;
  const n = code.length;
  while (i < n) {
    const ch = code[i]!;
    if (def.line && code.startsWith(def.line, i)) {
      let j = code.indexOf('\n', i);
      if (j < 0) j = n;
      out += tokenSpan('com', code.slice(i, j));
      i = j;
      continue;
    }
    if (def.block && code.startsWith(def.block[0], i)) {
      let j = code.indexOf(def.block[1], i + def.block[0].length);
      j = j < 0 ? n : j + def.block[1].length;
      out += tokenSpan('com', code.slice(i, j));
      i = j;
      continue;
    }
    if (def.strings.includes(ch)) {
      let j = i + 1;
      while (j < n) {
        if (code[j] === '\\') {
          j += 2;
          continue;
        }
        if (code[j] === ch) {
          j += 1;
          break;
        }
        j += 1;
      }
      out += tokenSpan('str', code.slice(i, j));
      i = j;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(code[i + 1] ?? ''))) {
      let j = i + 1;
      while (j < n && /[0-9a-fA-FxXbBoO_.]/.test(code[j]!)) j += 1;
      out += tokenSpan('num', code.slice(i, j));
      i = j;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_$]/.test(code[j]!)) j += 1;
      const word = code.slice(i, j);
      const lookup = def.caseInsensitive ? word.toLowerCase() : word;
      if (keywords.has(lookup)) out += tokenSpan('kw', word);
      else if (LITERALS.has(word)) out += tokenSpan('lit', word);
      else out += escapeHtml(word);
      i = j;
      continue;
    }
    out += escapeHtml(ch);
    i += 1;
  }
  return out;
}

export const CODE_LANGUAGES: { value: string; label: string }[] = [
  { value: '', label: 'Plain text' },
  { value: 'js', label: 'JavaScript' },
  { value: 'ts', label: 'TypeScript' },
  { value: 'tsx', label: 'TSX' },
  { value: 'java', label: 'Java' },
  { value: 'json', label: 'JSON' },
  { value: 'sql', label: 'SQL' },
  { value: 'py', label: 'Python' },
  { value: 'go', label: 'Go' },
  { value: 'bash', label: 'Bash' },
  { value: 'yaml', label: 'YAML' },
];

/* ------------------------------------------------------------------- Gherkin */

function highlightGherkin(line: string): string {
  const match = GHERKIN_KEYWORDS.exec(line);
  if (!match) return escapeHtml(line);
  const indent = match[1] ?? '';
  const keyword = match[2] ?? '';
  const colon = match[0].includes(':') ? ':' : '';
  const rest = line.slice(match[0].length);
  return `${escapeHtml(indent)}<span class="gk-kw">${keyword}${colon}</span>${escapeHtml(rest)}`;
}

export function renderGherkin(source: string): string {
  return (source ?? '').split('\n').map(highlightGherkin).join('\n');
}

export function GherkinPreview({ source }: { source: string }) {
  if (!source?.trim()) {
    return <p className="text-xs italic text-muted/70">Empty scenario — use the buttons above.</p>;
  }
  return (
    <pre className="md-code lang-gherkin md-body">
      <code dangerouslySetInnerHTML={{ __html: renderGherkin(source) }} />
    </pre>
  );
}

/* -------------------------------------------------------------------- inline */

function inline(raw: string): string {
  const text = escapeHtml(raw);
  const codes: string[] = [];
  let out = text.replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(code);
    return ` ${codes.length - 1} `;
  });

  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/(^|[^_\w])_([^_\n]+)_/g, '$1<em>$2</em>');

  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label: string, href: string) => {
    const safe = /^(https?:\/\/|\/)/i.test(href);
    return safe
      ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`
      : match;
  });

  return out.replace(/ (\d+) /g, (_, index: string) => `<code>${codes[Number(index)]}</code>`);
}

function isTableSeparator(line: string): boolean {
  return /-/.test(line) && /^\s*\|?[\s:|-]+\|?\s*$/.test(line);
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());
}

export function renderMarkdown(source: string): string {
  const lines = (source ?? '').split('\n');
  const html: string[] = [];
  let i = 0;

  const paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${inline(paragraph.join('<br>'))}</p>`);
    paragraph.length = 0;
  };

  while (i < lines.length) {
    const line = lines[i] ?? '';

    const fence = /^```(\w*)\s*$/.exec(line);
    if (fence) {
      flushParagraph();
      const lang = fence[1] ?? '';
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i] ?? '')) {
        body.push(lines[i] ?? '');
        i += 1;
      }
      i += 1; // consume closing fence
      const raw = body.join('\n');
      const rendered =
        lang === 'gherkin'
          ? body.map(highlightGherkin).join('\n')
          : highlightCode(raw, lang);
      html.push(
        `<pre class="md-code${lang ? ` lang-${lang}` : ''}"><code>${rendered}</code></pre>`,
      );
      continue;
    }

    if (line.includes('|') && isTableSeparator(lines[i + 1] ?? '')) {
      flushParagraph();
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && (lines[i] ?? '').includes('|')) {
        rows.push(splitRow(lines[i] ?? ''));
        i += 1;
      }
      const head = header.map((cell) => `<th>${inline(cell)}</th>`).join('');
      const bodyRows = rows
        .map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`)
        .join('');
      html.push(
        `<div class="md-table-wrap"><table class="md-table"><thead><tr>${head}</tr></thead><tbody>${bodyRows}</tbody></table></div>`,
      );
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      const level = Math.min(4, Math.max(2, (heading[1]?.length ?? 1) + 1));
      html.push(`<h${level}>${inline(heading[2] ?? '')}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushParagraph();
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i] ?? '')) {
        quote.push((lines[i] ?? '').replace(/^>\s?/, ''));
        i += 1;
      }
      html.push(`<blockquote>${inline(quote.join('<br>'))}</blockquote>`);
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      flushParagraph();
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i] ?? '')) {
        items.push(`<li>${inline((lines[i] ?? '').replace(/^\s*[-*+]\s+/, ''))}</li>`);
        i += 1;
      }
      html.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      flushParagraph();
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i] ?? '')) {
        items.push(`<li>${inline((lines[i] ?? '').replace(/^\s*\d+\.\s+/, ''))}</li>`);
        i += 1;
      }
      html.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      flushParagraph();
      html.push('<hr>');
      i += 1;
      continue;
    }

    if (line.trim() === '') {
      flushParagraph();
      i += 1;
      continue;
    }

    paragraph.push(line);
    i += 1;
  }

  flushParagraph();
  return html.join('\n');
}

/** Renders Markdown into the shared `.md-body` typography scope. */
export function Markdown({ source, className = '' }: { source: string; className?: string }) {
  if (!source?.trim()) {
    return <p className={`text-sm italic text-muted/70 ${className}`}>No description.</p>;
  }
  return (
    <div
      className={`md-body ${className}`}
      // Safe: renderMarkdown escapes all input and emits only whitelisted tags.
      dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }}
    />
  );
}
