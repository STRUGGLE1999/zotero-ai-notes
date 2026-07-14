import ContextMenu from './zotero/context-menu';
import { SettingsService } from './config/settings';
import { GeminiClient } from './llm/gemini-client';

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
  private preferencePaneID: string | null = null;
  private settings = new SettingsService();

  constructor(config: AddonConfig) {
    this.config = config;
  }

  async startup(reason: number) {
    Zotero.debug(`Zotero AI Notes: starting up (reason: ${reason})`, 5);

    this.contextMenu = new ContextMenu(this.config.rootURI, this.settings, this.config.version);
    Zotero.ZoteroAINotes = {
      settings: {
        getPublicSettings: () => this.settings.getPublicSettings(),
        save: (update: { baseURL: string; model: string; apiKey?: string }) =>
          this.settings.save(update),
        clearApiKey: () => this.settings.clearApiKey(),
        testConnection: async () => {
          const config = await this.settings.getProviderConfig();
          await new GeminiClient().testConnection(config);
        }
      }
    };

    this.preferencePaneID = await Zotero.PreferencePanes.register({
      pluginID: this.config.id,
      id: 'zotero-ai-notes-preferences',
      label: 'Zotero AI Notes',
      src: 'preferences/preferences.xhtml',
      scripts: ['preferences/preferences.js'],
      stylesheets: ['preferences/preferences.css']
    });

    const windows = Services.wm.getEnumerator('navigator:browser');
    while (windows.hasMoreElements()) {
      const win = windows.getNext();
      this.initializeWindow(win);
    }

    this.registerWindowListener();
  }

  shutdown(reason: number) {
    Zotero.debug(`Zotero AI Notes: shutting down (reason: ${reason})`, 5);

    this.unregisterWindowListener();

    if (reason === Zotero.APP_SHUTDOWN) {
      return;
    }

    if (this.preferencePaneID) {
      Zotero.PreferencePanes.unregister(this.preferencePaneID);
      this.preferencePaneID = null;
    }
    delete Zotero.ZoteroAINotes;

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
