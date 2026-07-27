import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('mindmap preview and fallback', () => {
  const script = readFileSync('addon/preview/preview.js', 'utf8');
  const markup = readFileSync('addon/preview/preview.xhtml', 'utf8');
  const frameMarkup = readFileSync('addon/preview/render-frame.xhtml', 'utf8');
  const renderer = readFileSync('addon/preview/render-frame.js', 'utf8');
  const buildScript = readFileSync('scripts/build.js', 'utf8');

  it('shows a tree fallback without exposing source code when SVG rendering fails', () => {
    expect(script).toContain('思维导图渲染失败，已显示结构预览');
    expect(script).toContain('this.mindmapTree.hidden = false;');
    expect(markup).not.toContain('mindmap-source');
    expect(markup).not.toContain('Mermaid 源码');
    expect(script).not.toContain('copyMindmap');
  });

  it('loads a local SVG renderer in the standard XHTML frame', () => {
    expect(markup).toContain('id="mindmap-render-frame"');
    expect(markup).toContain('src="render-frame.xhtml"');
    expect(frameMarkup).toContain('<script src="render-frame.js"></script>');
    expect(frameMarkup).not.toContain('mermaid.min.js');
    expect(renderer).toContain('window.renderAcademicMindmap');
    expect(renderer).toContain('class="academic-mindmap"');
    expect(buildScript).toContain("'preview/render-frame.xhtml'");
    expect(buildScript).not.toContain('mermaid.min.js');
  });

  it('renders an escaped, bounded SVG from the shared topic tree', () => {
    const execute = new Function(
      'window',
      'tree',
      `${renderer}\nreturn window.renderAcademicMindmap(tree);`
    ) as (window: Record<string, unknown>, tree: unknown) => { svg: string; width: number; height: number };
    const rendered = execute({}, {
      id: 'root',
      text: '论文 <主题>',
      children: [
        { id: 'method', text: '研究方法 & 数据', children: [] },
        { id: 'result', text: '实验结果', children: [] }
      ]
    });

    expect(rendered.svg).toContain('<svg');
    expect(rendered.svg).toContain('论文 &lt;主题&gt;');
    expect(rendered.svg).toContain('研究方法 &amp; 数据');
    expect(rendered.width).toBeGreaterThan(600);
    expect(rendered.height).toBeGreaterThan(100);
  });

  it('provides XMind import, OPML export, zoom and fit controls', () => {
    expect(markup).toContain('id="import-xmind-button"');
    expect(markup).toContain('id="import-xmind-start-button"');
    expect(markup).toContain('id="mindmap-sheet-select"');
    expect(markup).toContain('id="mindmap-zoom-in"');
    expect(markup).toContain('id="mindmap-fit-button"');
    expect(markup).toContain('导出 OPML');
    expect(script).toContain('async importXmind()');
    expect(script).toContain("this.resultTitle.textContent = 'XMind 导入完成'");
    expect(script).toContain("this.switchStage('result')");
    expect(script).toContain('fitMindmap()');
  });

  it('keeps the Zotero XUL shell and an academic restrained palette', () => {
    expect(markup).toContain('there.is.only.xul');
    expect(renderer).toContain('#a53a43');
    expect(renderer).toContain('#eef2f5');
    expect(renderer).toContain('#f7f7f5');
  });
});
