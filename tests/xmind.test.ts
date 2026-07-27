import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { parseXmindFile } from '../src/output/xmind';

async function xmindFile(content: unknown): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('content.json', JSON.stringify(content));
  return zip.generateAsync({ type: 'uint8array' });
}

describe('XMind import', () => {
  it('imports modern content.json with multiple sheets, topics and plain notes', async () => {
    const data = await xmindFile([
      {
        id: 'sheet-1',
        title: '研究框架',
        rootTopic: {
          id: 'root-1',
          title: '机器翻译',
          children: {
            attached: [{
              id: 'topic-1',
              title: '编码器—解码器',
              notes: { plain: { content: '核心方法' } },
              children: { attached: [{ id: 'topic-2', title: '注意力机制' }] }
            }]
          }
        }
      },
      { id: 'sheet-2', title: '实验', rootTopic: { id: 'root-2', title: '实验结果' } }
    ]);

    const result = await parseXmindFile(data);
    expect(result.document.source).toBe('xmind');
    expect(result.document.sheets).toHaveLength(2);
    expect(result.document.sheets[0].root.children[0].text).toBe('编码器—解码器');
    expect(result.document.sheets[0].root.children[0].note).toBe('核心方法');
    expect(result.nodeCount).toBe(4);
    expect(result.maxDepth).toBe(3);
    expect(result.warnings[0]).toContain('2 个画布');
  });

  it('rejects invalid and legacy containers with a clear error', async () => {
    await expect(parseXmindFile(new Uint8Array([1, 2, 3])))
      .rejects.toThrow('有效的 ZIP');
    const legacy = new JSZip();
    legacy.file('content.xml', '<xmap-content/>');
    await expect(parseXmindFile(await legacy.generateAsync({ type: 'uint8array' })))
      .rejects.toThrow('旧版 XMind');
  });

  it('imports when the Zotero runtime does not provide setImmediate', async () => {
    const data = await xmindFile([
      { id: 'sheet-1', title: '兼容性', rootTopic: { id: 'root-1', title: '根主题' } }
    ]);
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'setImmediate');
    Object.defineProperty(globalThis, 'setImmediate', {
      configurable: true,
      writable: true,
      value: undefined
    });
    try {
      const result = await parseXmindFile(data);
      expect(result.tree.text).toBe('根主题');
      expect(typeof globalThis.setImmediate).toBe('function');
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'setImmediate', descriptor);
      } else {
        Reflect.deleteProperty(globalThis, 'setImmediate');
      }
    }
  });
});
