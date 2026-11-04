import { SpeechUnavailableError } from "./speech-errors.js";

export interface ChatterboxAuthOptions {
  baseURL: string;
  passcode?: string;
  sessionCookie?: string;
  timeoutMs: number;
}

export class ChatterboxAuth {
  private cookieValue: string | undefined;
  private loginPromise: Promise<string> | undefined;

  constructor(private readonly options: ChatterboxAuthOptions) {
    this.cookieValue = options.sessionCookie;
  }

  async cookie(forceRefresh = false): Promise<string> {
    if (forceRefresh) this.cookieValue = undefined;
    if (this.cookieValue) return this.cookieValue;
    if (!this.options.passcode) throw new SpeechUnavailableError();
    this.loginPromise ??= this.login().finally(() => {
      this.loginPromise = undefined;
    });
    return this.loginPromise;
  }

  private async login(): Promise<string> {
    const response = await fetch(
      `${this.options.baseURL.replace(/\/+$/, "")}/auth/login`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ passcode: this.options.passcode ?? "" }),
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (response.status < 300 || response.status >= 400) {
      throw new SpeechUnavailableError();
    }
    const cookies = response.headers.getSetCookie()
      .map((cookie) => cookie.split(";", 1)[0])
      .filter(Boolean)
      .join("; ");
    if (!cookies) throw new SpeechUnavailableError();
    this.cookieValue = cookies;
    return cookies;
  }
}
