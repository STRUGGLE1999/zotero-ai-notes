import { beforeEach, describe, expect, it, vi } from 'vitest';

const addonMocks = vi.hoisted(() => ({
  startup: vi.fn(),
  shutdown: vi.fn()
}));

vi.mock('../src/addon', () => ({
  default: class MockAddon {
    startup = addonMocks.startup;
    shutdown = addonMocks.shutdown;
  }
}));

describe('bootstrap chrome resources', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('registers the preview content package on startup and releases it on shutdown', async () => {
    const destruct = vi.fn();
    const registerChrome = vi.fn(() => ({ destruct }));
    const getService = vi.fn(() => ({ registerChrome }));
    const newURI = vi.fn((value: string) => `uri:${value}`);

    vi.stubGlobal('Components', {
      classes: {
        '@mozilla.org/addons/addon-manager-startup;1': { getService }
      },
      interfaces: { amIAddonManagerStartup: 'amIAddonManagerStartup' }
    });
    vi.stubGlobal('Services', { io: { newURI } });
    vi.stubGlobal('Zotero', { debug: vi.fn() });

    const bootstrap = await import('../src/bootstrap');
    const data = {
      id: 'zotero-ai-notes@example.com',
      version: '0.2.2',
      rootURI: 'jar:file:///plugin.xpi!/'
    };

    await bootstrap.startup(data, 1);

    expect(newURI).toHaveBeenCalledWith('jar:file:///plugin.xpi!/manifest.json');
    expect(registerChrome).toHaveBeenCalledWith(
      'uri:jar:file:///plugin.xpi!/manifest.json',
      [['content', 'zotero-ai-notes', 'jar:file:///plugin.xpi!/']]
    );
    expect(addonMocks.startup).toHaveBeenCalledWith(1);

    bootstrap.shutdown(data, 2);

    expect(addonMocks.shutdown).toHaveBeenCalledWith(2);
    expect(destruct).toHaveBeenCalledOnce();
  });
});
