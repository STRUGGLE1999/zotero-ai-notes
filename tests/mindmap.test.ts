import { describe, expect, it } from 'vitest';
import { buildMermaidMindmap } from '../src/output/mindmap';

describe('Mermaid mindmap output', () => {
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

    const result = buildMermaidMindmap('ImageNet classification', note);

    expect(result.source).toContain('mindmap');
    expect(result.source).toContain('root((ImageNet classification))');
    expect(result.source).toContain('    1. 网络架构设计');
    expect(result.source).toContain('      模型包含五层卷积层和三层全连接层');
    expect(result.source).toContain('      图像平移与翻转');
    expect(result.markdown).toBe(`\`\`\`mermaid\n${result.source}\n\`\`\``);
    expect(result.nodeCount).toBeGreaterThan(5);
    expect(result.maxDepth).toBeLessThanOrEqual(5);
    for (const node of result.source.split('\n').slice(2)) {
      expect(node.trim().length).toBeLessThanOrEqual(30);
    }
  });

  it('removes internal Evidence IDs and ignores fenced code', () => {
    const result = buildMermaidMindmap('论文', [
      '## 方法',
      '结论来自原文 [E-ABC-1-01]。',
      '```js',
      'invented()',
      '```'
    ].join('\n'));

    expect(result.source).not.toContain('E-ABC');
    expect(result.source).not.toContain('invented');
    expect(result.source).toContain('结论来自原文');
  });

  it('keeps the source order in the tree', () => {
    const result = buildMermaidMindmap('论文', '## 第一部分\n内容一。\n## 第二部分\n内容二。');
    expect(result.tree.children.map(node => node.text)).toEqual(['第一部分', '第二部分']);
    expect(result.tree.children[0].children[0].text).toBe('内容一。');
  });

  it('shortens long English labels at a word boundary', () => {
    const result = buildMermaidMindmap(
      'ImageNet classification with deep convolutional neural networks',
      '## 方法\n正文。'
    );
    expect(result.tree.text).toBe('ImageNet classification with');
  });
});
