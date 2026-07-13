import Addon from './addon';

declare const Zotero: any;

let addon: Addon | null = null;

export function startup({ id, version, rootURI }: { id: string; version: string; rootURI: string }, reason: number) {
  try {
    addon = new Addon({ id, version, rootURI });
    addon.startup(reason);
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
