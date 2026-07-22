import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('preview flow UI', () => {
  const script = readFileSync('addon/preview/preview.js', 'utf8');
  const markup = readFileSync('addon/preview/preview.xhtml', 'utf8');
  const styles = readFileSync('addon/preview/preview.css', 'utf8');

  it('uses selected topics and at most two explicit key topics', () => {
    const pipeline = readFileSync('src/llm/note-pipeline.ts', 'utf8');

    expect(script).not.toContain("select.className = 'topic-priority'");
    expect(script).toContain("emphasisButton.className = 'topic-emphasis'");
    expect(script).toContain('最多选择 2 个重点主题');
    expect(script).toContain("priority: card.classList.contains('emphasized') ? 1 : 2");
    expect(pipeline).toContain('用户标记的重点主题：优先呈现');
  });

  it('shows one workflow stage at a time', () => {
    expect(markup).toContain('id="focus-stage"');
    expect(markup).toContain('id="generation-stage"');
    expect(markup).toContain('id="result-stage"');
    expect(script).toContain("switchStage(stage)");
  });

  it('styles generated XHTML Markdown elements as block content in the XUL window', () => {
    expect(script).toContain("new DOMParser().parseFromString(rendered, 'text/html')");
    expect(script).toContain('document.importNode(node, true)');
    expect(script).not.toContain('this.preview.innerHTML =');
    expect(styles).toContain('@namespace html url("http://www.w3.org/1999/xhtml")');
    expect(styles).toContain('.markdown-body html|h2');
    expect(styles).toContain('.markdown-body html|p');
  });

  it('finishes write-back with a stable success state and blocks duplicate writes', () => {
    expect(script).toContain("this.setGlobalStatus('已写回 Zotero', 'success')");
    expect(script).toContain('this.savedMarkdown = this.editor.value;');
    expect(script).toContain("this.saveButton.textContent = alreadySaved ? '已写回 Zotero' : '写回 Zotero'");
  });
});
