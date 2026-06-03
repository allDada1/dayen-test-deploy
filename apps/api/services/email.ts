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
  reason: string;
};

const EMAIL_SEND_TIMEOUT_MS = 8000;

function buildEmailLayout({
  title,
  preheader,
  body,
  buttonLabel,
  url,
  reason,
}: EmailLayoutPayload) {
  const safeTitle = escapeHtml(title);
  const safeUrl = escapeHtml(url);

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5ede2;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;padding:0;background:#f5ede2;">
      <tr>
        <td align="center" style="padding:30px 14px;font-family:Arial,Helvetica,sans-serif;color:#2b241d;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#fffaf3;border:1px solid #eadccb;border-radius:22px;overflow:hidden;box-shadow:0 18px 46px rgba(43,36,29,0.10);">
            <tr>
              <td style="padding:28px 30px 22px;background:#2b241d;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <div style="display:inline-block;width:10px;height:10px;border-radius:999px;background:#ead8c7;vertical-align:middle;margin-right:10px;"></div>
                      <span style="font-size:14px;line-height:20px;letter-spacing:0.18em;text-transform:uppercase;color:#f8f0e6;font-weight:800;">DAYEN</span>
                    </td>
                  </tr>
                </table>
                <div style="margin-top:18px;font-size:12px;line-height:18px;letter-spacing:0.08em;text-transform:uppercase;color:#d7bfa8;font-weight:700;">Маркетплейс товаров и услуг</div>
                <h1 style="margin:8px 0 0;font-size:30px;line-height:1.18;color:#fffaf3;font-weight:800;letter-spacing:0;">${safeTitle}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 30px 8px;background:#fffaf3;">
                <p style="margin:0;font-size:16px;line-height:1.7;color:#3b3027;">${escapeHtml(body)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 30px 28px;background:#fffaf3;">
                <a href="${safeUrl}" style="display:inline-block;padding:15px 22px;border-radius:14px;background:#2b241d;color:#fffaf3;text-decoration:none;font-size:15px;line-height:20px;font-weight:800;">${escapeHtml(buttonLabel)}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px 28px;background:#fffaf3;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe8;border:1px solid #eadccb;border-radius:16px;">
                  <tr>
                    <td style="padding:16px 18px;">
                      <div style="font-size:12px;line-height:18px;letter-spacing:0.08em;text-transform:uppercase;color:#8b5a38;font-weight:800;">Запасная ссылка</div>
                      <p style="margin:8px 0 0;font-size:13px;line-height:1.55;color:#6e6257;">Если кнопка не открывается, скопируйте ссылку вручную.</p>
                      <p style="margin:10px 0 0;font-size:13px;line-height:1.6;color:#5a3e29;word-break:break-all;"><a href="${safeUrl}" style="color:#5a3e29;text-decoration:underline;">${safeUrl}</a></p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 30px;background:#f0e5d8;border-top:1px solid #eadccb;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#6e6257;">${escapeHtml(reason)}</p>
              </td>
            </tr>
          </table>
          <p style="max-width:580px;margin:16px 0 0;font-size:12px;line-height:1.6;color:#8b7b6a;">Dayen отправил это письмо автоматически. Отвечать на него не нужно.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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
    const body = `Здравствуйте, ${displayName}. Нажмите кнопку ниже, чтобы задать новый пароль для аккаунта Dayen. Ссылка действует ограниченное время.`;
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
      body,
      buttonLabel: "Сбросить пароль",
      url: resetUrl,
      reason: "Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.",
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
    const body = `Здравствуйте, ${displayName}. Подтвердите email, чтобы пользоваться аккаунтом Dayen: оформлять заказы, подавать заявку продавца и получать уведомления.`;
    const text = [
      `Здравствуйте, ${displayName}!`,
      "",
      "Подтвердите email для аккаунта Dayen.",
      `Откройте ссылку для подтверждения: ${verifyUrl}`,
      "",
      "После подтверждения вы сможете оформлять заказы, подавать заявку продавца и получать уведомления.",
      "Если вы не регистрировались, просто проигнорируйте это письмо.",
    ].join("\n");

    const html = buildEmailLayout({
      title: "Подтверждение почты",
      preheader: "Подтвердите email для аккаунта Dayen.",
      body,
      buttonLabel: "Подтвердить email",
      url: verifyUrl,
      reason: "Если вы не регистрировались в Dayen, просто проигнорируйте это письмо.",
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
