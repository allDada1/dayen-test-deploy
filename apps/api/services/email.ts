function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type SendEmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

type PasswordResetPayload = {
  to: string;
  name: string;
  resetUrl: string;
};

type EmailVerificationPayload = {
  to: string;
  name: string;
  verifyUrl: string;
};

type EmailLayoutPayload = {
  title: string;
  preheader: string;
  body: string;
  buttonLabel: string;
  url: string;
};

const EMAIL_SEND_TIMEOUT_MS = 8000;

function buildEmailLayout({ title, preheader, body, buttonLabel, url }: EmailLayoutPayload) {
  const safeUrl = escapeHtml(url);

  return `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e9f2;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="padding:26px 28px 12px;background:#101828;">
                <div style="font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#9ec5ff;font-weight:700;">DAYEN</div>
                <h1 style="margin:14px 0 0;font-size:26px;line-height:1.2;color:#ffffff;font-weight:800;">${escapeHtml(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px 10px;">
                <p style="margin:0;font-size:16px;line-height:1.65;color:#344054;">${escapeHtml(body)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 28px 24px;">
                <a href="${safeUrl}" style="display:inline-block;padding:14px 20px;border-radius:12px;background:#2563eb;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">${escapeHtml(buttonLabel)}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#667085;">Если кнопка не открывается, скопируйте ссылку вручную:</p>
                <p style="margin:8px 0 0;font-size:13px;line-height:1.6;color:#2563eb;word-break:break-all;">${safeUrl}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #eef2f7;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#667085;">Если вы не запрашивали это письмо, просто проигнорируйте его.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

export function createEmailService() {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.RESEND_FROM_EMAIL || "").trim();
  const appBaseUrl = String(process.env.APP_BASE_URL || "http://localhost:5173")
    .trim()
    .replace(/\/$/, "");

  async function sendViaResend({ to, subject, html, text }: SendEmailPayload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EMAIL_SEND_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html,
          text,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") {
        throw new Error("resend_timeout");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    const data = await res.json().catch(() => ({} as { message?: string; error?: string }));
    if (!res.ok) {
      const message = data?.message || data?.error || `resend_http_${res.status}`;
      throw new Error(message);
    }
    return data;
  }

  async function sendPasswordResetEmail({ to, name, resetUrl }: PasswordResetPayload) {
    const displayName = name || "пользователь";
    const subject = "Сброс пароля - Dayen";
    const text = [
      `Здравствуйте, ${displayName}!`,
      "",
      "Вы запросили сброс пароля для аккаунта Dayen.",
      `Откройте ссылку, чтобы задать новый пароль: ${resetUrl}`,
      "",
      "Ссылка действует ограниченное время.",
      "Если вы не запрашивали сброс, просто проигнорируйте это письмо.",
    ].join("\n");

    const html = buildEmailLayout({
      title: "Сброс пароля",
      preheader: "Ссылка для сброса пароля Dayen.",
      body: `Здравствуйте, ${displayName}. Нажмите кнопку ниже, чтобы задать новый пароль для аккаунта Dayen. Ссылка действует ограниченное время.`,
      buttonLabel: "Сбросить пароль",
      url: resetUrl,
    });

    if (!apiKey || !from) {
      console.log("[auth:reset-email:dev]", { to, resetUrl, mode: "console_fallback" });
      return { ok: true, mode: "console_fallback" as const };
    }

    const data = await sendViaResend({ to, subject, html, text });
    return { ok: true, mode: "resend" as const, data };
  }

  async function sendEmailVerificationEmail({
    to,
    name,
    verifyUrl,
  }: EmailVerificationPayload) {
    const displayName = name || "пользователь";
    const subject = "Подтверждение почты - Dayen";
    const text = [
      `Здравствуйте, ${displayName}!`,
      "",
      "Подтвердите email для аккаунта Dayen.",
      `Откройте ссылку для подтверждения: ${verifyUrl}`,
      "",
      "После подтверждения вы сможете оформлять заказы и подавать заявку продавца.",
      "Если вы не регистрировались, просто проигнорируйте это письмо.",
    ].join("\n");

    const html = buildEmailLayout({
      title: "Подтверждение почты",
      preheader: "Подтвердите email для аккаунта Dayen.",
      body: `Здравствуйте, ${displayName}. Нажмите кнопку ниже, чтобы подтвердить email для аккаунта Dayen. После подтверждения будут доступны заказы и заявка продавца.`,
      buttonLabel: "Подтвердить email",
      url: verifyUrl,
    });

    if (!apiKey || !from) {
      console.log("[auth:verify-email:dev]", { to, verifyUrl, mode: "console_fallback" });
      return { ok: true, mode: "console_fallback" as const };
    }

    const data = await sendViaResend({ to, subject, html, text });
    return { ok: true, mode: "resend" as const, data };
  }

  return {
    appBaseUrl,
    sendPasswordResetEmail,
    sendEmailVerificationEmail,
  };
}
