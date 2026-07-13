import { getSelectedItem } from './selected-item';
import { showTestDialog } from '../ui/test-dialog';

declare const Zotero: any;

export default class ContextMenu {
  private rootURI: string;
  private menuItems: Map<any, any> = new Map();

  constructor(rootURI: string) {
    this.rootURI = rootURI;
  }

  register(win: any) {
    const doc = win.document;
    if (this.menuItems.has(win)) {
      return;
    }

    const menupopup = doc.getElementById('zotero-item-pane-context-menu');
    if (!menupopup) {
      Zotero.debug('Zotero AI Notes: zotero-item-pane-context-menu not found', 2);
      return;
    }

    const menuItem = doc.createXULElement('menuitem');
    menuItem.setAttribute('id', 'zotero-ai-notes-context-menu');
    menuItem.setAttribute('label', 'AI 整理批注');
    menuItem.setAttribute('tooltiptext', '使用 AI 整理批注');

    menuItem.addEventListener('command', () => this.onMenuItemClick(win));

    const separator = doc.createXULElement('menuseparator');
    separator.setAttribute('id', 'zotero-ai-notes-context-menu-separator');

    const beforeItem = doc.getElementById('zotero-item-pane-context-menu-edit');
    if (beforeItem) {
      beforeItem.parentNode.insertBefore(separator, beforeItem);
      beforeItem.parentNode.insertBefore(menuItem, separator);
    } else {
      menupopup.appendChild(separator);
      menupopup.appendChild(menuItem);
    }

    this.menuItems.set(win, { menuItem, separator });
    Zotero.debug('Zotero AI Notes: context menu registered', 5);
  }

  unregister(win: any) {
    const items = this.menuItems.get(win);
    if (!items) {
      return;
    }

    try {
      if (items.menuItem && items.menuItem.parentNode) {
        items.menuItem.parentNode.removeChild(items.menuItem);
      }
      if (items.separator && items.separator.parentNode) {
        items.separator.parentNode.removeChild(items.separator);
      }
    } catch (error) {
      Zotero.debug(`Zotero AI Notes: error removing context menu: ${error}`, 2);
    }

    this.menuItems.delete(win);
    Zotero.debug('Zotero AI Notes: context menu unregistered', 5);
  }

  destroy() {
    const windows = [...this.menuItems.keys()];
    for (const win of windows) {
      this.unregister(win);
    }
    this.menuItems.clear();
  }

  private onMenuItemClick(win: any) {
    try {
      const result = getSelectedItem();
      showTestDialog(win, result);
    } catch (error) {
      Zotero.debug(`Zotero AI Notes: context menu click error: ${error}`, 2);
      Zotero.alert(win, 'Zotero AI Notes', `操作失败：${error}`);
    }
  }
}
