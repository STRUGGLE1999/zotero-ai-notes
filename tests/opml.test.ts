import { describe, expect, it } from 'vitest';
import { mindmapDocumentToOpml } from '../src/output/opml';

describe('OPML output', () => {
  it('exports hierarchy, notes and escaped Unicode text as OPML 2.0', () => {
    const opml = mindmapDocumentToOpml({
      title: '论文 & 方法',
      source: 'generated',
      sheets: [{
        id: 'sheet-1',
        title: '论文 & 方法',
        root: {
          id: 'root',
          text: '论文 & 方法',
          children: [{
            id: 'child',
            text: '实验 <结果>',
            note: '准确率 "更高"',
            children: []
          }]
        }
      }]
    });

    expect(opml).toContain('<opml version="2.0">');
    expect(opml).toContain('<title>论文 &amp; 方法</title>');
    expect(opml).toContain('text="实验 &lt;结果&gt;"');
    expect(opml).toContain('_note="准确率 &quot;更高&quot;"');
  });

  it('exports the selected sheet', () => {
    const makeRoot = (id: string) => ({ id, text: id, children: [] });
    const opml = mindmapDocumentToOpml({
      title: '多画布',
      source: 'xmind',
      sheets: [
        { id: 'one', title: '第一张', root: makeRoot('root-one') },
        { id: 'two', title: '第二张', root: makeRoot('root-two') }
      ]
    }, 1);
    expect(opml).toContain('<title>第二张</title>');
    expect(opml).toContain('text="root-two"');
    expect(opml).not.toContain('root-one');
  });
});
