export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderInline(value: string): string {
  const code: string[] = [];
  let rendered = escapeHtml(value).replace(/`([^`]+)`/g, (_match, content: string) => {
    const index = code.push(`<code>${content}</code>`) - 1;
    return `%%ZAI_CODE_${index}%%`;
  });
  rendered = rendered.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label: string, url: string) => {
    if (!/^(?:https?:|zotero:)/i.test(url)) {
      return label;
    }
    return `<a href="${escapeAttribute(url)}">${label}</a>`;
  });
  rendered = rendered
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return rendered.replace(/%%ZAI_CODE_(\d+)%%/g, (_match, index: string) => code[Number(index)] || '');
}

export function markdownToSafeHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const output: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (listType) {
      output.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      closeList();
      if (inCode) {
        output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
      }
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }
    if (!line.trim()) {
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      output.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    if (unordered) {
      if (listType !== 'ul') {
        closeList();
        output.push('<ul>');
        listType = 'ul';
      }
      output.push(`<li>${renderInline(unordered[1])}</li>`);
      continue;
    }

    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ordered) {
      if (listType !== 'ol') {
        closeList();
        output.push('<ol>');
        listType = 'ol';
      }
      output.push(`<li>${renderInline(ordered[1])}</li>`);
      continue;
    }

    closeList();
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      output.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
    } else if (/^---+$/.test(line.trim())) {
      output.push('<hr>');
    } else {
      output.push(`<p>${renderInline(line.trim())}</p>`);
    }
  }

  closeList();
  if (inCode) {
    output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  }
  return output.join('\n');
}

export function safeFileBaseName(title: string): string {
  const withoutControlCharacters = [...title]
    .filter(character => character.charCodeAt(0) >= 32)
    .join('');
  const cleaned = withoutControlCharacters
    .normalize('NFC')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim();
  return (cleaned || '文献').slice(0, 120);
}
