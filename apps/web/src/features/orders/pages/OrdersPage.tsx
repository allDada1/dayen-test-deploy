import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../../../providers/auth";
import { api } from "../../../services/api";
import { formatDateTime, formatOrderStatus, formatPrice } from "../../../services/format";
import type { Order } from "../../../types/api";

type OrderFilter = "all" | "processing" | "delivery" | "done" | "cancelled";
type OrderSort = "new_desc" | "old_desc" | "total_desc" | "total_asc";

const filters: Array<{ key: OrderFilter; label: string; icon: string }> = [
  { key: "all", label: "Все заказы", icon: "□" },
  { key: "processing", label: "В обработке", icon: "◷" },
  { key: "delivery", label: "Доставляются", icon: "↗" },
  { key: "done", label: "Выполнены", icon: "✓" },
  { key: "cancelled", label: "Отменены", icon: "×" },
];

function normalizedStatus(order: Order) {
  return String(order.display_status || order.status || "").toLowerCase();
}

function canPay(order: Order) {
  const status = String(order.status || "").toLowerCase();
  const displayStatus = normalizedStatus(order);
  return ["created", "pending"].includes(status) && ["created", "pending"].includes(displayStatus);
}

function filterForOrder(order: Order): OrderFilter {
  const status = normalizedStatus(order);
  if (status === "cancelled") return "cancelled";
  if (status === "delivered") return "done";
  if (status === "shipped" || status === "delayed") return "delivery";
  return "processing";
}

function statusTone(order: Order) {
  const group = filterForOrder(order);
  if (group === "done") return "success";
  if (group === "delivery") return "delivery";
  if (group === "cancelled") return "danger";
  return "warning";
}

function orderHint(order: Order) {
  const status = normalizedStatus(order);
  if (status === "created" || status === "pending") return "Заказ создан. После оплаты он перейдет в обработку.";
  if (status === "paid") return "Оплата получена. Продавец готовит заказ к передаче.";
  if (status === "shipped") return "Заказ передан в доставку. Ожидайте обновления статуса.";
  if (status === "delayed") return "По заказу есть задержка. Проверьте детали или обратитесь в поддержку.";
  if (status === "delivered") return "Заказ завершен. Спасибо за покупку.";
  if (status === "cancelled") return "Заказ отменен. Если это ошибка, обратитесь в поддержку.";
  if (status === "mixed") return "Позиции заказа находятся на разных этапах обработки.";
  return "Статус заказа обновлен. Подробности доступны на странице заказа.";
}

function dateValue(order: Order) {
  const value = order.created_at ? new Date(order.created_at).getTime() : 0;
  return Number.isFinite(value) ? value : 0;
}

function deliveryLabel(order: Order) {
  const method = String(order.delivery_method || "").trim();
  const city = String(order.delivery_city || "").trim();
  if (method && city) return `${method}, ${city}`;
  return method || city || "Не указана";
}

function paymentLabel(order: Order) {
  const status = String(order.status || "").toLowerCase();
  if (status === "paid" || status === "delivered") return "Оплачено";
  if (canPay(order)) return "Ожидает оплаты";
  return "По статусу заказа";
}

export function OrdersPage() {
  const { loading, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [sort, setSort] = useState<OrderSort>("new_desc");
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function reload() {
    setIsRefreshing(true);
    try {
      const response = await api.getMyOrders();
      setOrders(response);
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    void reload();
  }, [user]);

  const createdOrderId = searchParams.get("created");

  const counts = useMemo(() => {
    const next: Record<OrderFilter, number> = {
      all: orders.length,
      processing: 0,
      delivery: 0,
      done: 0,
      cancelled: 0,
    };

    orders.forEach((order) => {
      next[filterForOrder(order)] += 1;
    });

    return next;
  }, [orders]);

  const visibleOrders = useMemo(() => {
    const next = orders.filter((order) => (filter === "all" ? true : filterForOrder(order) === filter));

    return next.sort((a, b) => {
      if (sort === "old_desc") return dateValue(a) - dateValue(b);
      if (sort === "total_desc") return Number(b.total || 0) - Number(a.total || 0);
      if (sort === "total_asc") return Number(a.total || 0) - Number(b.total || 0);
      return dateValue(b) - dateValue(a);
    });
  }, [filter, orders, sort]);

  if (!loading && !user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="ordersPagePro">
      <div className="container ordersPagePro__inner">
        <nav className="ordersBreadcrumbs" aria-label="Навигация">
          <Link to="/">Главная</Link>
          <span>›</span>
          <span>Мои заказы</span>
        </nav>

        {createdOrderId ? (
          <section className="ordersCreatedNotice">
            <strong>Заказ #{createdOrderId} создан.</strong>
            <span>Он уже добавлен в историю. Здесь можно открыть детали, оплатить или отслеживать статус.</span>
          </section>
        ) : null}

        <section className="ordersHeroPro">
          <div>
            <h1>Мои заказы</h1>
            <p>Здесь можно посмотреть все свои заказы, их статус, сумму и детали доставки.</p>
          </div>

          <div className="ordersStatsPro" aria-label="Статистика заказов">
            <article>
              <span>Всего заказов</span>
              <strong>{orders.length}</strong>
            </article>
            <article>
              <span>Выполнено</span>
              <strong>{counts.done}</strong>
            </article>
            <article>
              <span>В обработке</span>
              <strong>{counts.processing}</strong>
            </article>
          </div>
        </section>

        <section className="ordersBoardPro">
          <div className="ordersToolbarPro">
            <div className="ordersFiltersPro" aria-label="Фильтр заказов">
              {filters.map((item) => (
                <button type="button" className={filter === item.key ? "is-active" : ""} key={item.key} onClick={() => setFilter(item.key)}>
                  <span>{item.icon}</span>
                  {item.label}
                  <b>{counts[item.key]}</b>
                </button>
              ))}
            </div>

            <div className="ordersToolbarActionsPro">
              <select value={sort} onChange={(event) => setSort(event.target.value as OrderSort)} aria-label="Сортировка заказов">
                <option value="new_desc">Сначала новые</option>
                <option value="old_desc">Сначала старые</option>
                <option value="total_desc">Сумма: по убыванию</option>
                <option value="total_asc">Сумма: по возрастанию</option>
              </select>
              <button type="button" onClick={() => void reload()}>
                {isRefreshing ? "Обновляем..." : "Обновить"}
              </button>
            </div>
          </div>

          {visibleOrders.length ? (
            <div className="ordersRowsPro">
              {visibleOrders.map((order) => (
                <article className="orderRowPro" key={order.id}>
                  <div className="orderRowPro__status">
                    <span className={`orderStatusDot orderStatusDot--${statusTone(order)}`} />
                    <div>
                      <small>Заказ #{order.id}</small>
                      <strong>{formatOrderStatus(order.display_status || order.status)}</strong>
                      <time>{formatDateTime(order.created_at)}</time>
                    </div>
                  </div>

                  <div className="orderRowPro__details">
                    <div className="orderMetric">
                      <span>□</span>
                      <div>
                        <small>Сумма заказа</small>
                        <strong>{formatPrice(Number(order.total || 0))}</strong>
                      </div>
                    </div>
                    <div className="orderMetric">
                      <span>↗</span>
                      <div>
                        <small>Доставка</small>
                        <strong>{deliveryLabel(order)}</strong>
                      </div>
                    </div>
                    <div className="orderMetric">
                      <span>▭</span>
                      <div>
                        <small>Оплата</small>
                        <strong>{paymentLabel(order)}</strong>
                      </div>
                    </div>
                    <p>{orderHint(order)}</p>
                  </div>

                  <div className="orderRowPro__actions">
                    <Link to={`/orders/${order.id}`}>
                      Подробнее
                      <span>›</span>
                    </Link>
                    {canPay(order) ? <Link to={`/payment?order=${order.id}`}>Оплатить</Link> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <section className="ordersEmptyPro">
              <strong>Заказов пока нет</strong>
              <p>После оформления заказа история появится здесь.</p>
              <Link to="/catalog">Перейти в каталог</Link>
            </section>
          )}
        </section>

        <section className="ordersHelpPro">
          <div>
            <span>?</span>
            <div>
              <h2>Нужна помощь с заказом?</h2>
              <p>Поддержка поможет с оплатой, доставкой, отменой или возвратом.</p>
              <Link to="/about/support">Связаться с поддержкой</Link>
            </div>
          </div>
          <div className="ordersFaqPro">
            <strong>Частые вопросы</strong>
            <Link to="/about/faq">Как отменить заказ?<span>›</span></Link>
            <Link to="/about/faq">Как отследить доставку?<span>›</span></Link>
            <Link to="/about/faq">Как оформить возврат?<span>›</span></Link>
          </div>
        </section>
      </div>
    </div>
  );
}
