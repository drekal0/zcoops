import { config } from "./config";

/**
 * Verify a Cloudflare Turnstile token server-side. If no secret is configured
 * (dev/mock), verification is a no-op that passes — so local dev needs no setup.
 * Enforced only for public pools (see enqueueClaim).
 */
export async function verifyCaptcha(token: string | undefined, ip?: string): Promise<boolean> {
  const secret = config.security.turnstileSecret;
  if (!secret) return true; // disabled → allow
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.append("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return !!data.success;
  } catch {
    return false;
  }
}

export const captchaEnabled = () => !!config.security.turnstileSecret;
