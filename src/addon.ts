import ContextMenu from './zotero/context-menu';

declare const Zotero: any;
declare const Services: any;
declare const Ci: any;

export interface AddonConfig {
  id: string;
  version: string;
  rootURI: string;
}

export default class Addon {
  private config: AddonConfig;
  private contextMenu: ContextMenu | null = null;
  private windowListeners: any[] = [];

  constructor(config: AddonConfig) {
    this.config = config;
  }

  startup(reason: number) {
    Zotero.debug(`Zotero AI Notes: starting up (reason: ${reason})`, 5);

    this.contextMenu = new ContextMenu(this.config.rootURI);

    if (reason === Zotero.APP_STARTUP || reason === Zotero.ADDON_ENABLE) {
      const windows = Services.wm.getEnumerator('navigator:browser');
      while (windows.hasMoreElements()) {
        const win = windows.getNext();
        this.initializeWindow(win);
      }
    }

    this.registerWindowListener();
  }

  shutdown(reason: number) {
    Zotero.debug(`Zotero AI Notes: shutting down (reason: ${reason})`, 5);

    this.unregisterWindowListener();

    if (reason === Zotero.APP_SHUTDOWN) {
      return;
    }

    const windows = Services.wm.getEnumerator('navigator:browser');
    while (windows.hasMoreElements()) {
      const win = windows.getNext();
      this.cleanupWindow(win);
    }

    if (this.contextMenu) {
      this.contextMenu.destroy();
      this.contextMenu = null;
    }
  }

  private registerWindowListener() {
    const listener = {
      onOpenWindow: (xulWindow: any) => {
        const win = xulWindow.QueryInterface(Ci.nsIInterfaceRequestor)
          .getInterface(Ci.nsIDOMWindow);
        win.addEventListener('load', () => this.onWindowLoad(win), { once: true });
      },
      onCloseWindow: (xulWindow: any) => {
        const win = xulWindow.QueryInterface(Ci.nsIInterfaceRequestor)
          .getInterface(Ci.nsIDOMWindow);
        this.cleanupWindow(win);
      }
    };

    Services.wm.addListener(listener);
    this.windowListeners.push(listener);
  }

  private unregisterWindowListener() {
    for (const listener of this.windowListeners) {
      Services.wm.removeListener(listener);
    }
    this.windowListeners = [];
  }

  private onWindowLoad(win: any) {
    if (win.document.documentElement.getAttribute('windowtype') !== 'navigator:browser') {
      return;
    }
    this.initializeWindow(win);
  }

  private initializeWindow(win: any) {
    if (!this.contextMenu) {
      return;
    }
    this.contextMenu.register(win);
  }

  private cleanupWindow(win: any) {
    if (!this.contextMenu) {
      return;
    }
    this.contextMenu.unregister(win);
  }
}
