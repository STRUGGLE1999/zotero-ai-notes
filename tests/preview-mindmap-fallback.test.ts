import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('mindmap preview fallback', () => {
  it('keeps Mermaid source exportable when Zotero cannot render the SVG', () => {
    const script = readFileSync('addon/preview/preview.js', 'utf8');

    expect(script).toContain('catch (error)');
    expect(script).toContain('this.mindmap = mindmap;');
    expect(script).toContain('this.mindmapTree.hidden = false;');
    expect(script).toContain('Mermaid SVG 渲染失败，已显示结构预览');
  });

  it('loads Mermaid in a standard XHTML renderer frame', () => {
    const markup = readFileSync('addon/preview/preview.xhtml', 'utf8');
    const frameMarkup = readFileSync('addon/preview/render-frame.xhtml', 'utf8');
    const buildScript = readFileSync('scripts/build.js', 'utf8');

    expect(markup).toContain('id="mindmap-render-frame"');
    expect(markup).toContain('src="render-frame.xhtml"');
    expect(frameMarkup).toContain('<script src="mermaid.min.js"></script>');
    expect(frameMarkup).toContain('<script src="render-frame.js"></script>');
    expect(buildScript).toContain("'preview/render-frame.xhtml'");
    expect(buildScript).toContain("'preview/render-frame.js'");
  });

  it('keeps the Zotero XUL shell while isolating Mermaid from it', () => {
    const markup = readFileSync('addon/preview/preview.xhtml', 'utf8');

    expect(markup).toContain('there.is.only.xul');
    expect(markup).not.toContain('<script src="mermaid.min.js"/>');
  });

  it('renders into an explicit HTML container for Zotero XUL compatibility', () => {
    const script = readFileSync('addon/preview/preview.js', 'utf8');

    expect(script).toContain('this.renderMindmapInFrame(');
  });
});
