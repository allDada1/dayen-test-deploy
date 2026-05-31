import { useEffect, useMemo, useState } from "react";
import { BellRing, CreditCard, Info, MessageCircleReply, PackageCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, Navigate } from "react-router-dom";

import { useAuth } from "../../../providers/auth";
import { api } from "../../../services/api";
import { formatOrderStatus } from "../../../services/format";
import type { NotificationItem } from "../../../types/api";

type NotificationFilter = "all" | "orders" | "payment" | "seller" | "system";
type SortMode = "new_desc" | "old_desc";

type NormalizedNotification = NotificationItem & {
  displayTitle: string;
  displayBody: string;
  href: string;
  category: NotificationFilter;
  icon: LucideIcon;
  actionLabel: string;
};

type NotificationGroup = {
  title: string;
  items: NormalizedNotification[];
};

const filterLabels: Record<NotificationFilter, string> = {
  all: "Все",
  orders: "Заказы",
  payment: "Оплата",
  seller: "Ответы",
  system: "Система",
};

function hasMojibake(value?: string | null) {
  const text = String(value || "");
  return ["Рџ", "Рђ", "Р”", "Рљ", "Рў", "Р’", "РЈ", "Р ", "Рњ", "Р", "СЃ", "С‚", "СЊ", "С‹", "СЏ", "вЂ", "в„"].some(
    (marker) => text.includes(marker),
  );
}

function normalizeLink(link?: string | null) {
  const clean = String(link || "").trim();
  if (!clean) return "";
  if (clean === "profile.html") return "/profile";
  if (clean === "orders.html") return "/orders";
  return `/${clean.replace(/^\//, "").replace(/\.html$/, "")}`;
}

function classifyNotification(title: string, body: string, link?: string | null): NotificationFilter {
  const text = `${title} ${body} ${link || ""}`.toLowerCase();
  if (text.includes("оплат") || text.includes("payment") || text.includes("pay")) return "payment";
  if (text.includes("заказ") || text.includes("order") || text.includes("/orders")) return "orders";
  if (text.includes("продав") || text.includes("seller") || text.includes("обращ") || text.includes("support")) return "seller";
  return "system";
}

function notificationIcon(category: NotificationFilter): LucideIcon {
  if (category === "payment") return CreditCard;
  if (category === "orders") return PackageCheck;
  if (category === "seller") return MessageCircleReply;
  return Info;
}

function actionLabel(category: NotificationFilter) {
  if (category === "payment" || category === "orders") return "Открыть заказ";
  if (category === "seller") return "Посмотреть ответ";
  return "Открыть";
}

function normalizeNotification(item: NotificationItem): NormalizedNotification {
  let title = item.title || "Уведомление";
  let body = item.body || "";

  const method = body.match(/\((card|kaspi)\)/i)?.[1];
  const orderId = body.match(/#(\d+)/)?.[1];
  if ((hasMojibake(title) || hasMojibake(body)) && method) {
    title = "Оплата принята";
    body = `Заказ #${orderId || ""} оплачен (${method}).`.replace("# ", "#");
  }

  const statusMatch = body.match(/#(\d+).*:\s*([a-z_]+)/i);
  if ((hasMojibake(title) || hasMojibake(body)) && statusMatch) {
    title = "Статус товара в заказе обновлен";
    body = `Продавец обновил статус товара в заказе #${statusMatch[1]}: ${formatOrderStatus(statusMatch[2])}.`;
  }

  if (title === "Статус товара в заказе обновлен" && /:\s*[a-z_]+\./i.test(body)) {
    body = body.replace(/:\s*([a-z_]+)\./i, (_, status: string) => `: ${formatOrderStatus(status)}.`);
  }

  if (hasMojibake(title)) title = "Уведомление";
  if (hasMojibake(body)) body = "Событие аккаунта обновлено. Откройте связанный раздел, чтобы посмотреть детали.";

  const href = normalizeLink(item.link);
  const category = classifyNotification(title, body, href);

  return {
    ...item,
    displayTitle: title,
    displayBody: body,
    href,
    category,
    icon: notificationIcon(category),
    actionLabel: actionLabel(category),
  };
}

function timeValue(item: NotificationItem) {
  const value = item.created_at ? new Date(item.created_at).getTime() : 0;
  return Number.isFinite(value) ? value : 0;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function groupTitle(createdAt?: string) {
  if (!createdAt) return "Ранее";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "Ранее";

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (sameDay(date, now)) return "Сегодня";
  if (sameDay(date, yesterday)) return "Вчера";
  return "Ранее";
}

function formatNotificationTime(createdAt?: string) {
  if (!createdAt) return "";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";

  if (groupTitle(createdAt) === "Сегодня") {
    return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(date);
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function makeGroups(items: NormalizedNotification[]): NotificationGroup[] {
  const groups: NotificationGroup[] = [];

  items.forEach((item) => {
    const title = groupTitle(item.created_at);
    let group = groups.find((current) => current.title === title);
    if (!group) {
      group = { title, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  });

  const order = ["Сегодня", "Вчера", "Ранее"];
  return groups.sort((a, b) => order.indexOf(a.title) - order.indexOf(b.title));
}

export function NotificationsPage() {
  const { loading, user } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [sort, setSort] = useState<SortMode>("new_desc");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const normalizedItems = useMemo(() => items.map(normalizeNotification), [items]);
  const unreadCount = useMemo(() => normalizedItems.filter((item) => !item.is_read).length, [normalizedItems]);
  const actionCount = useMemo(() => normalizedItems.filter((item) => !item.is_read && item.href).length, [normalizedItems]);
  const systemCount = useMemo(() => normalizedItems.filter((item) => item.category === "system").length, [normalizedItems]);

  const filterCounts = useMemo(() => {
    const counts: Record<NotificationFilter, number> = {
      all: normalizedItems.length,
      orders: 0,
      payment: 0,
      seller: 0,
      system: 0,
    };

    normalizedItems.forEach((item) => {
      counts[item.category] += 1;
    });

    return counts;
  }, [normalizedItems]);

  const visibleItems = useMemo(() => {
    const filtered = normalizedItems
      .filter((item) => (filter === "all" ? true : item.category === filter))
      .filter((item) => (onlyUnread ? !item.is_read : true));

    return filtered.sort((a, b) => {
      const left = timeValue(a);
      const right = timeValue(b);
      return sort === "old_desc" ? left - right : right - left;
    });
  }, [filter, normalizedItems, onlyUnread, sort]);

  const groups = useMemo(() => makeGroups(visibleItems), [visibleItems]);

  async function reload() {
    setIsLoading(true);
    const response = await api.getNotifications();
    setItems(response.items);
    setIsLoading(false);
  }

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    void reload();
  }, [user]);

  async function markAllRead() {
    const unreadIds = items.filter((item) => !item.is_read).map((item) => item.id);
    if (!unreadIds.length) return;
    await api.markNotificationsRead(unreadIds);
    await reload();
  }

  async function markOneRead(item: NotificationItem) {
    if (item.is_read) return;
    if (item.id < 0) return;
    await api.markNotificationsRead([item.id]);
    await reload();
  }

  if (!loading && !user) return <Navigate to="/auth" replace />;

  return (
    <div className="notificationsPagePro">
      <div className="container notificationsPagePro__inner">
        <section className="notificationsHeroPro">
          <div className="notificationsHeroPro__icon" aria-hidden="true">
            <BellRing size={38} strokeWidth={2.1} />
          </div>
          <div className="notificationsHeroPro__copy">
            <h1>Уведомления</h1>
            <p>Здесь собраны заказы, платежи, ответы продавцов и важные обновления аккаунта.</p>
          </div>

          <div className="notificationsStatsPro" aria-label="Статистика уведомлений">
            <article>
              <span>Всего</span>
              <strong>{items.length}</strong>
              <small>за все время</small>
            </article>
            <article>
              <span>Новые</span>
              <strong>{unreadCount}</strong>
              <small>непрочитанные</small>
            </article>
            <article>
              <span>С действиями</span>
              <strong>{actionCount}</strong>
              <small>требуют внимания</small>
            </article>
            <article>
              <span>Система</span>
              <strong>{systemCount}</strong>
              <small>обновления аккаунта</small>
            </article>
          </div>
        </section>

        <section className="notificationsBoardPro">
          <div className="notificationsToolbarPro">
            <div className="notificationsFiltersPro" aria-label="Фильтр уведомлений">
              {(Object.keys(filterLabels) as NotificationFilter[]).map((key) => (
                <button type="button" className={filter === key ? "is-active" : ""} key={key} onClick={() => setFilter(key)}>
                  {filterLabels[key]} <span>{filterCounts[key]}</span>
                </button>
              ))}
            </div>

            <div className="notificationsControlsPro">
              <label className="notificationsTogglePro">
                <input type="checkbox" checked={onlyUnread} onChange={(event) => setOnlyUnread(event.target.checked)} />
                <span />
                Только непрочитанные
              </label>

              <label className="notificationsSortPro">
                <span>Сортировка</span>
                <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
                  <option value="new_desc">Сначала новые</option>
                  <option value="old_desc">Сначала старые</option>
                </select>
              </label>

              <button type="button" className="notificationsMarkReadPro" disabled={!unreadCount} onClick={() => void markAllRead()}>
                Отметить все прочитанным
              </button>
            </div>
          </div>

          <div className="notificationsListPro">
            {isLoading ? (
              <div className="notificationsLoadingPro">Загружаем уведомления...</div>
            ) : groups.length ? (
              groups.map((group) => (
                <section className="notificationGroupPro" key={group.title}>
                  <h2>{group.title}</h2>
                  <div>
                    {group.items.map((item) => {
                      const Icon = item.icon;

                      return (
                        <article className={`notificationRowPro ${item.is_read ? "" : "is-unread"}`} key={item.id}>
                          {!item.is_read ? <span className="notificationRowPro__dot" aria-hidden="true" /> : null}
                          <div className={`notificationRowPro__icon notificationRowPro__icon--${item.category}`} aria-hidden="true">
                            <Icon size={24} strokeWidth={2.15} />
                          </div>

                          <div className="notificationRowPro__body">
                            <strong>{item.displayTitle}</strong>
                            <p>{item.displayBody}</p>
                            <div>
                              <span>{filterLabels[item.category]}</span>
                              {item.href ? <span>есть переход</span> : null}
                            </div>
                          </div>

                          <div className="notificationRowPro__side">
                            <time>{formatNotificationTime(item.created_at)}</time>
                            {item.href ? (
                              <Link to={item.href} onClick={() => void markOneRead(item)}>
                                {item.actionLabel}
                                <span>›</span>
                              </Link>
                            ) : (
                              <span className="notificationReadPill">{item.is_read ? "Прочитано" : "Новое"}</span>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))
            ) : (
              <section className="notificationsEmptyPro">
                <strong>Уведомлений нет</strong>
                <p>Когда появятся события по заказам, оплате или аккаунту, они будут показаны здесь.</p>
              </section>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
