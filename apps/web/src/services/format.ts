export function formatPrice(price: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(price || 0);
}

export function formatDate(value?: string) {
  if (!value) return "Недавно";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Недавно";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value?: string) {
  if (!value) return "Недавно";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Недавно";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatOrderStatus(status?: string) {
  switch (String(status || "").toLowerCase()) {
    case "created":
      return "Создан";
    case "pending":
      return "В обработке";
    case "paid":
      return "Оплачен";
    case "shipped":
      return "Отправлен";
    case "delayed":
      return "Задерживается";
    case "delivered":
      return "Доставлен";
    case "cancelled":
      return "Отменен";
    case "mixed":
      return "Частично обработан";
    default:
      return status || "Новый";
  }
}
