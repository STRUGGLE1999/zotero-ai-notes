import Addon from './addon';

declare const Zotero: any;
declare const Components: any;
declare const Services: any;

let addon: Addon | null = null;
let chromeHandle: { destruct(): void } | null = null;

export async function startup({ id, version, rootURI }: { id: string; version: string; rootURI: string }, reason: number) {
  try {
    const addonManagerStartup = Components.classes[
      '@mozilla.org/addons/addon-manager-startup;1'
    ].getService(Components.interfaces.amIAddonManagerStartup);
    const manifestURI = Services.io.newURI(`${rootURI}manifest.json`);
    chromeHandle = addonManagerStartup.registerChrome(manifestURI, [
      ['content', 'zotero-ai-notes', rootURI]
    ]);

    addon = new Addon({ id, version, rootURI });
    await addon.startup(reason);
    Zotero.debug('Zotero AI Notes: startup completed', 5);
  } catch (error) {
    Zotero.debug(`Zotero AI Notes: startup failed: ${error}`, 2);
    throw error;
  }
}

export function shutdown(_data: { id: string; version: string; rootURI: string }, reason: number) {
  try {
    if (addon) {
      addon.shutdown(reason);
      addon = null;
    }
    if (chromeHandle) {
      chromeHandle.destruct();
      chromeHandle = null;
    }
    Zotero.debug('Zotero AI Notes: shutdown completed', 5);
  } catch (error) {
    Zotero.debug(`Zotero AI Notes: shutdown failed: ${error}`, 2);
  }
}

export function install(_data: { id: string; version: string; rootURI: string }, _reason: number) {
  Zotero.debug('Zotero AI Notes: install', 5);
}

export function uninstall(_data: { id: string; version: string; rootURI: string }, _reason: number) {
  Zotero.debug('Zotero AI Notes: uninstall', 5);
}
