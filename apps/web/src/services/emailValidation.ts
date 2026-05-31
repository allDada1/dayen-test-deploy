const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DOMAIN_SUGGESTIONS: Record<string, string> = {
  "gmai.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmail.ru": "gmail.com",
  "mail.con": "mail.com",
  "mai.com": "mail.com",
  "yadnex.ru": "yandex.ru",
  "yanedx.ru": "yandex.ru",
  "hotnail.com": "hotmail.com",
};

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function getEmailValidationMessage(value: string) {
  const normalized = normalizeEmail(value);
  if (!EMAIL_REGEX.test(normalized)) return "Введите корректный email.";

  const domain = normalized.split("@")[1] || "";
  const suggestion = DOMAIN_SUGGESTIONS[domain];
  if (suggestion) {
    return `Проверьте email: возможно, вы имели в виду ${suggestion}.`;
  }

  return null;
}
