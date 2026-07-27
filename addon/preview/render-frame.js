var ZoteroAINotes_MindmapFrame = {
  escape(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  },

  textUnits(value) {
    return [...value].reduce((total, character) =>
      total + (/[^\u0000-\u00ff]/.test(character) ? 2 : 1), 0);
  },

  wrap(value, maxUnits, maxLines) {
    const source = String(value).replace(/\s+/g, ' ').trim() || '未命名主题';
    const lines = [];
    let line = '';
    let units = 0;
    for (const character of source) {
      const size = /[^\u0000-\u00ff]/.test(character) ? 2 : 1;
      if (line && units + size > maxUnits) {
        lines.push(line.trim());
        line = '';
        units = 0;
      }
      line += character;
      units += size;
    }
    if (line) lines.push(line.trim());
    if (lines.length > maxLines) {
      const clipped = lines.slice(0, maxLines);
      clipped[maxLines - 1] = `${clipped[maxLines - 1].replace(/[\s,.，。；;:：]+$/, '')}…`;
      return clipped;
    }
    return lines;
  },

  nodeBox(node, depth) {
    const root = depth === 0;
    const primary = depth === 1;
    const width = root ? 280 : primary ? 230 : 210;
    const lines = this.wrap(node.text, root ? 30 : primary ? 26 : 24, root ? 3 : 4);
    return {
      width,
      height: Math.max(root ? 68 : 48, lines.length * (root ? 21 : 18) + (root ? 28 : 22)),
      lines
    };
  },

  render(tree) {
    if (!tree || typeof tree.text !== 'string' || !Array.isArray(tree.children)) {
      throw new Error('思维导图结构无效。');
    }
    const horizontalGap = 92;
    const verticalGap = 20;
    const positions = [];
    const connections = [];
    const boxes = new WeakMap();
    const heights = new WeakMap();

    const box = (node, depth) => {
      if (!boxes.has(node)) boxes.set(node, this.nodeBox(node, depth));
      return boxes.get(node);
    };
    const subtreeHeight = (node, depth) => {
      if (heights.has(node)) return heights.get(node);
      const own = box(node, depth).height;
      if (!node.children.length) {
        heights.set(node, own);
        return own;
      }
      const children = node.children.map(child => subtreeHeight(child, depth + 1));
      const height = Math.max(own, children.reduce((sum, childHeight) => sum + childHeight, 0)
        + verticalGap * Math.max(0, children.length - 1));
      heights.set(node, height);
      return height;
    };

    const right = [];
    const left = [];
    let rightHeight = 0;
    let leftHeight = 0;
    for (const child of tree.children) {
      const height = subtreeHeight(child, 1);
      if (rightHeight <= leftHeight) {
        right.push(child);
        rightHeight += height + verticalGap;
      } else {
        left.push(child);
        leftHeight += height + verticalGap;
      }
    }
    const sideHeight = nodes => nodes.length
      ? nodes.reduce((sum, node) => sum + subtreeHeight(node, 1), 0)
        + verticalGap * (nodes.length - 1)
      : 0;
    const contentHeight = Math.max(240, sideHeight(right), sideHeight(left));
    const rootY = contentHeight / 2;
    const rootBox = box(tree, 0);
    positions.push({ node: tree, depth: 0, direction: 0, x: 0, y: rootY, box: rootBox });

    const place = (node, depth, direction, startY, parentPosition) => {
      const nodeBox = box(node, depth);
      const height = subtreeHeight(node, depth);
      const y = startY + height / 2;
      const x = direction * (rootBox.width / 2 + horizontalGap
        + nodeBox.width / 2 + (depth - 1) * (210 + horizontalGap));
      const position = { node, depth, direction, x, y, box: nodeBox };
      positions.push(position);
      connections.push({ from: parentPosition, to: position });
      if (node.children.length) {
        const childHeights = node.children.map(child => subtreeHeight(child, depth + 1));
        const total = childHeights.reduce((sum, value) => sum + value, 0)
          + verticalGap * Math.max(0, childHeights.length - 1);
        let childY = y - total / 2;
        for (let index = 0; index < node.children.length; index += 1) {
          place(node.children[index], depth + 1, direction, childY, position);
          childY += childHeights[index] + verticalGap;
        }
      }
    };
    const placeSide = (nodes, direction) => {
      let y = (contentHeight - sideHeight(nodes)) / 2;
      for (const node of nodes) {
        const height = subtreeHeight(node, 1);
        place(node, 1, direction, y, positions[0]);
        y += height + verticalGap;
      }
    };
    placeSide(right, 1);
    placeSide(left, -1);

    const padding = 54;
    const minX = Math.min(...positions.map(item => item.x - item.box.width / 2));
    const maxX = Math.max(...positions.map(item => item.x + item.box.width / 2));
    const minY = Math.min(...positions.map(item => item.y - item.box.height / 2));
    const maxY = Math.max(...positions.map(item => item.y + item.box.height / 2));
    const width = Math.ceil(maxX - minX + padding * 2);
    const height = Math.ceil(maxY - minY + padding * 2);
    const offsetX = padding - minX;
    const offsetY = padding - minY;

    const paths = connections.map(({ from, to }) => {
      const fromX = from.x + offsetX + to.direction * from.box.width / 2;
      const toX = to.x + offsetX - to.direction * to.box.width / 2;
      const fromY = from.y + offsetY;
      const toY = to.y + offsetY;
      const bend = fromX + (toX - fromX) * 0.52;
      return `<path class="mindmap-connection depth-${Math.min(to.depth, 3)}" `
        + `d="M ${fromX} ${fromY} C ${bend} ${fromY}, ${bend} ${toY}, ${toX} ${toY}"/>`;
    }).join('');

    const nodes = positions.map(position => {
      const x = position.x + offsetX - position.box.width / 2;
      const y = position.y + offsetY - position.box.height / 2;
      const className = position.depth === 0 ? 'root' : position.depth === 1 ? 'primary' : 'secondary';
      const lineHeight = position.depth === 0 ? 21 : 18;
      const firstY = position.y + offsetY
        - ((position.box.lines.length - 1) * lineHeight) / 2 + 1;
      const tspans = position.box.lines.map((line, index) =>
        `<tspan x="${position.x + offsetX}" y="${firstY + index * lineHeight}">${this.escape(line)}</tspan>`
      ).join('');
      return `<g class="mindmap-node ${className}">`
        + `<title>${this.escape(position.node.text)}</title>`
        + `<rect x="${x}" y="${y}" width="${position.box.width}" height="${position.box.height}" rx="${position.depth === 0 ? 14 : 9}"/>`
        + `<text text-anchor="middle" dominant-baseline="middle">${tspans}</text>`
        + '</g>';
    }).join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" class="academic-mindmap" `
      + `viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" `
      + `aria-label="${this.escape(tree.text)}">`
      + '<style>'
      + '.academic-mindmap{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans CJK SC","Microsoft YaHei",sans-serif;background:#f7f7f5}'
      + '.mindmap-connection{fill:none;stroke:#9aa7b2;stroke-width:2.2;stroke-linecap:round}'
      + '.mindmap-connection.depth-1{stroke:#a53a43;stroke-width:2.8}'
      + '.mindmap-node rect{fill:#fff;stroke:#d7dde2;stroke-width:1.4}'
      + '.mindmap-node text{fill:#263238;font-size:14px}'
      + '.mindmap-node.primary rect{fill:#eef2f5;stroke:#667889;stroke-width:1.6}'
      + '.mindmap-node.primary text{font-size:14.5px;font-weight:600}'
      + '.mindmap-node.root rect{fill:#a53a43;stroke:#8f3038;stroke-width:1.6}'
      + '.mindmap-node.root text{fill:#fff;font-size:16px;font-weight:650}'
      + '@media(prefers-color-scheme:dark){.academic-mindmap{background:#202124}.mindmap-node rect{fill:#292b2d;stroke:#50555a}.mindmap-node text{fill:#e7e9eb}.mindmap-node.primary rect{fill:#303941;stroke:#8293a2}.mindmap-node.root rect{fill:#9d4149;stroke:#bc666d}.mindmap-connection{stroke:#6f7b84}.mindmap-connection.depth-1{stroke:#bc666d}}'
      + '</style>' + paths + nodes + '</svg>';
    return { svg, width, height };
  }
};

window.renderAcademicMindmap = tree => ZoteroAINotes_MindmapFrame.render(tree);
