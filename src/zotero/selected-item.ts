declare const Zotero: any;

export interface SelectedItemResult {
  success: boolean;
  message?: string;
  title?: string;
  itemType?: string;
  isAttachment?: boolean;
}

export function getSelectedItem(): SelectedItemResult {
  const pane = Zotero.getActiveZoteroPane();
  if (!pane) {
    return { success: false, message: '无法获取当前 Zotero 窗口' };
  }

  const items = pane.getSelectedItems();

  if (items.length === 0) {
    return { success: false, message: '请先选择一篇文献。' };
  }

  if (items.length > 1) {
    return { success: false, message: '当前阶段只支持选择一篇文献。' };
  }

  const item = items[0];
  const itemType = item.itemType;

  if (itemType === 'attachment') {
    const parentItem = item.parentItem;
    if (parentItem) {
      const parentTitle = parentItem.getField('title');
      return {
        success: true,
        title: parentTitle,
        itemType: 'attachment',
        isAttachment: true
      };
    }
    return { success: false, message: '无法获取附件所属的文献。' };
  }

  const title = item.getField('title');
  return {
    success: true,
    title: title || '(无标题)',
    itemType: itemType,
    isAttachment: false
  };
}

export function getDisplayTitle(result: SelectedItemResult): string {
  if (!result.success || !result.title) {
    return '';
  }
  if (result.isAttachment) {
    return `（附件）${result.title}`;
  }
  return result.title;
}
