import { describe, expect, it } from 'vitest';
import { buildMindmapDocument } from '../src/output/mindmap';

describe('mindmap document output', () => {
  it('converts a validated note into a bounded hierarchy without adding facts', () => {
    const note = [
      '### 1. 网络架构设计',
      '模型包含五层卷积层和三层全连接层。',
      '',
      '### 2. 训练策略',
      '为缓解过拟合，研究使用两种策略：',
      '- **图像平移与翻转**：扩大训练集',
      '- **Dropout**：随机失活隐藏层神经元'
    ].join('\n');

    const result = buildMindmapDocument('ImageNet classification', note);

    expect(result.document.source).toBe('generated');
    expect(result.document.sheets).toHaveLength(1);
    expect(result.tree.text).toBe('ImageNet classification');
    expect(result.tree.children[0].text).toBe('1. 网络架构设计');
    expect(result.tree.children[0].children[0].text).toContain('模型包含五层卷积层');
    expect(result.nodeCount).toBeGreaterThan(5);
    expect(result.maxDepth).toBeLessThanOrEqual(5);
  });

  it('removes internal Evidence IDs and ignores fenced code', () => {
    const result = buildMindmapDocument('论文', [
      '## 方法',
      '结论来自原文 [E-ABC-1-01]。',
      '```js',
      'invented()',
      '```'
    ].join('\n'));

    expect(JSON.stringify(result.tree)).not.toContain('E-ABC');
    expect(JSON.stringify(result.tree)).not.toContain('invented');
    expect(result.tree.children[0].children[0].text).toContain('结论来自原文');
  });

  it('keeps the source order in the tree', () => {
    const result = buildMindmapDocument('论文', '## 第一部分\n内容一。\n## 第二部分\n内容二。');
    expect(result.tree.children.map(node => node.text)).toEqual(['第一部分', '第二部分']);
    expect(result.tree.children[0].children[0].text).toBe('内容一。');
  });

  it('shortens very long labels at a word boundary while allowing academic titles', () => {
    const result = buildMindmapDocument(
      'ImageNet classification with deep convolutional neural networks and large scale training experiments',
      '## 方法\n正文。'
    );
    expect(result.tree.text.length).toBeLessThanOrEqual(72);
    expect(result.tree.text.endsWith(' ')).toBe(false);
  });
});
