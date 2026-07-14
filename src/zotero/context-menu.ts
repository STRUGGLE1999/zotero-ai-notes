import { collectSelectedDocumentData } from './annotation-reader';
import { buildEvidenceData } from '../evidence/evidence-builder';
import { writeEvidenceDebugJson } from '../utils/debug-json';
import type { SettingsService } from '../config/settings';
import { openPreviewWindow, PreviewController } from '../ui/preview-controller';

declare const Zotero: any;

export default class ContextMenu {
  private rootURI: string;
  private menuItems: Map<any, any> = new Map();
  private settings: SettingsService;
  private pluginVersion: string;
  private previewWindows = new Set<any>();

  constructor(rootURI: string, settings: SettingsService, pluginVersion: string) {
    this.rootURI = rootURI;
    this.settings = settings;
    this.pluginVersion = pluginVersion;
  }

  register(win: any) {
    const doc = win.document;
    if (this.menuItems.has(win)) {
      return;
    }

    const menupopup = doc.getElementById('zotero-itemmenu');
    if (!menupopup) {
      Zotero.debug('Zotero AI Notes: zotero-itemmenu not found', 2);
      return;
    }

    const menuItem = doc.createXULElement('menuitem');
    menuItem.setAttribute('id', 'zotero-ai-notes-context-menu');
    menuItem.setAttribute('label', 'AI 整理批注');
    menuItem.setAttribute('title', '使用 AI 整理批注');

    menuItem.addEventListener('command', () => {
      void this.onMenuItemClick(win);
    });

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
    for (const previewWindow of this.previewWindows) {
      try {
        previewWindow.close();
      } catch {
        // The user may already have closed the window.
      }
    }
    this.previewWindows.clear();
    const windows = [...this.menuItems.keys()];
    for (const win of windows) {
      this.unregister(win);
    }
    this.menuItems.clear();
  }

  private async onMenuItemClick(win: any) {
    try {
      const data = await collectSelectedDocumentData();
      const evidenceData = await buildEvidenceData(data);
      await writeEvidenceDebugJson(evidenceData);
      const config = await this.settings.getProviderConfig();
      const controller = new PreviewController(
        win,
        config,
        evidenceData,
        this.pluginVersion
      );
      const previewWindow = openPreviewWindow(win, this.rootURI, controller);
      this.previewWindows.add(previewWindow);
      previewWindow.addEventListener('unload', () => {
        this.previewWindows.delete(previewWindow);
      }, { once: true });
    } catch (error) {
      Zotero.debug(`Zotero AI Notes: context menu click error: ${error}`, 2);
      const message = error instanceof Error ? error.message : String(error);
      Zotero.alert(win, 'Zotero AI Notes', `操作失败：${message}`);
    }
  }
}
