type Env = { bridgeSecret: string; resendKey?: string; brevoKey?: string; from: string; replyDomain: string };
type SendInput = { action: "send"; id: string; to: string; subject: string; text: string; replyToken: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const mailbox = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const answer = (status: number, message: string) => Response.json({ message }, { status });

async function sameSecret(actual: string, expected: string) {
  const encode = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encode.encode(actual)),
    crypto.subtle.digest("SHA-256", encode.encode(expected)),
  ]);
  const aa = new Uint8Array(a);
  const bb = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

async function limitedJson(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw Error("empty");
  let size = 0;
  const parts: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1048576) throw Error("too_large");
      parts.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function parseSender(from: string): { name?: string; email: string } | null {
  const trimmed = from.trim();
  const angle = trimmed.match(/^(.*)<([^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)>$/);
  if (angle) {
    const name = angle[1].trim().replace(/^["']|["']$/g, "");
    const email = angle[2].trim();
    return name ? { name, email } : { email };
  }
  if (mailbox.test(trimmed)) return { email: trimmed };
  return null;
}

async function messageUuid(rawId: string): Promise<string> {
  if (uuid.test(rawId)) return rawId;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("brevo:" + rawId)));
  digest[6] = (digest[6] & 0x0f) | 0x40;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = Array.from(digest.slice(0, 16), b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// Plain-text fallback only. HTML is never sent to the browser for execution/rendering.
export function plainText(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|tr)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .slice(0, 70000);
}

export async function handle(request: Request, env: Env, fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method !== "POST") return answer(405, "Method not allowed");
  const hasSendProvider = Boolean(env.brevoKey || env.resendKey);
  if (env.bridgeSecret.length < 32 || !hasSendProvider || !env.from || !env.replyDomain) {
    return answer(503, "Email is not configured");
  }
  const key = request.headers.get("X-PhysLive-Mail-Secret") || "";
  if (key.length > 256 || !(await sameSecret(key, env.bridgeSecret))) return answer(401, "Unauthorized");

  try {
    const raw = await request.text();
    if (raw.length > 50000) return answer(413, "Request too large");
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      return answer(400, "Invalid JSON");
    }
    if (!input || typeof input !== "object") return answer(400, "Invalid request");

    if (input.action === "send") {
      const value = input as SendInput;
      if (
        !uuid.test(value.id) ||
        !uuid.test(value.replyToken) ||
        typeof value.to !== "string" ||
        value.to.length > 255 ||
        !mailbox.test(value.to) ||
        /[\r\n]/.test(value.to) ||
        value.to.endsWith(".invalid") ||
        typeof value.subject !== "string" ||
        !value.subject.trim() ||
        value.subject.length > 180 ||
        /[\r\n]/.test(value.subject) ||
        typeof value.text !== "string" ||
        !value.text.trim() ||
        value.text.length > 20000
      ) {
        return answer(400, "Invalid email");
      }
      if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])$/i.test(env.replyDomain)) {
        return answer(503, "Invalid receiving domain");
      }
      const replyAddress = "reply+" + value.replyToken + "@" + env.replyDomain;

      if (env.brevoKey) {
        const sender = parseSender(env.from);
        if (!sender) return answer(503, "Invalid sender address");
        const response = await fetcher("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          signal: AbortSignal.timeout(15000),
          headers: {
            "api-key": env.brevoKey,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            sender,
            to: [{ email: value.to }],
            replyTo: { email: replyAddress },
            subject: value.subject,
            textContent: value.text,
          }),
        });
        if (!response.ok) {
          return answer(response.status >= 500 || response.status === 429 ? 503 : 400, "Email provider rejected the request");
        }
        const result = await limitedJson(response);
        if (typeof result.messageId !== "string" || !result.messageId.trim()) {
          return answer(503, "Unconfirmed email result");
        }
        return Response.json({ id: await messageUuid(result.messageId.trim()) });
      }

      const response = await fetcher("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: "Bearer " + env.resendKey,
          "Content-Type": "application/json",
          "Idempotency-Key": "physlive-customer/" + value.id,
        },
        body: JSON.stringify({
          from: env.from,
          to: [value.to],
          subject: value.subject,
          text: value.text,
          reply_to: replyAddress,
        }),
      });
      if (!response.ok) {
        return answer(response.status >= 500 || response.status === 429 ? 503 : 400, "Email provider rejected the request");
      }
      const result = await limitedJson(response);
      if (!uuid.test(result.id)) return answer(503, "Unconfirmed email result");
      return Response.json({ id: result.id });
    }

    if (input.action === "receive" && uuid.test(input.id)) {
      if (!env.resendKey) return answer(503, "Receiving email is not configured");
      const response = await fetcher("https://api.resend.com/emails/receiving/" + input.id, {
        headers: { Authorization: "Bearer " + env.resendKey },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) return answer(503, "Received email is temporarily unavailable");
      const value = await limitedJson(response);
      if (value.id !== input.id) return answer(503, "Unexpected received email");
      return Response.json({
        id: value.id,
        from: String(value.from || "").slice(0, 1000),
        to: Array.isArray(value.to) ? value.to.slice(0, 50) : [],
        subject: String(value.subject || "").slice(0, 998),
        text: typeof value.text === "string" ? value.text.slice(0, 70000) : plainText(String(value.html || "")),
        authentication: { dmarc: value.authentication?.dmarc || "unknown" },
        attachments: (Array.isArray(value.attachments) ? value.attachments : []).slice(0, 20).map((a: { filename?: string; content_type?: string; size?: number }) => ({
          filename: String(a.filename || "Tệp đính kèm").slice(0, 200),
          contentType: String(a.content_type || "").slice(0, 100),
          size: Number(a.size) || 0,
        })),
      });
    }

    return answer(400, "Unsupported action");
  } catch {
    return answer(503, "Email operation could not be confirmed");
  }
}
