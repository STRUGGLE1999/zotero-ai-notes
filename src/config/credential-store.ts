declare const Services: any;
declare const Cc: any;
declare const Ci: any;

const LOGIN_ORIGIN = 'https://zotero-ai-notes.local';
const LOGIN_REALM = 'Zotero AI Notes Gemini API Key';
const LOGIN_USERNAME = 'gemini';

export class CredentialStore {
  private async findLogins(): Promise<any[]> {
    await Services.logins.initializationPromise;
    return Services.logins.findLogins(LOGIN_ORIGIN, null, LOGIN_REALM);
  }

  async getApiKey(): Promise<string | null> {
    const logins = await this.findLogins();
    const login = logins.find(item => item.username === LOGIN_USERNAME);
    return login?.password || null;
  }

  async setApiKey(apiKey: string): Promise<void> {
    const logins = await this.findLogins();
    const existing = logins.find(item => item.username === LOGIN_USERNAME);
    const replacement = this.createLogin(apiKey);

    if (existing) {
      await Services.logins.modifyLogin(existing, replacement);
    } else {
      await Services.logins.addLoginAsync(replacement);
    }

    for (const duplicate of logins) {
      if (duplicate !== existing) {
        await Services.logins.removeLogin(duplicate);
      }
    }
  }

  async clearApiKey(): Promise<void> {
    const logins = await this.findLogins();
    for (const login of logins) {
      await Services.logins.removeLogin(login);
    }
  }

  private createLogin(apiKey: string): any {
    const login = Cc['@mozilla.org/login-manager/loginInfo;1']
      .createInstance(Ci.nsILoginInfo);
    login.init(
      LOGIN_ORIGIN,
      null,
      LOGIN_REALM,
      LOGIN_USERNAME,
      apiKey,
      '',
      ''
    );
    return login;
  }
}
