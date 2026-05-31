import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { SectionHeading } from "../../../components/SectionHeading";
import { SelectField } from "../../../components/SelectField";
import { useAuth } from "../../../providers/auth";
import { useCart } from "../../../providers/cart";
import { useToast } from "../../../providers/toast";
import { api } from "../../../services/api";
import { getErrorMessage } from "../../../services/errors";
import { formatDateTime, formatOrderStatus, formatPrice } from "../../../services/format";
import type { Order, SellerClaim } from "../../../types/api";

type OrderItem = {
  id?: number;
  product_id?: number;
  title?: string;
  price?: number;
  qty?: number;
  seller_status?: string;
  seller_note?: string;
  seller_name?: string;
  image_url?: string;
};

type OrderHistoryItem = {
  status: string;
  note?: string;
  created_at?: string;
};

function canPay(order?: Order | null) {
  const status = String(order?.status || "").toLowerCase();
  const displayStatus = String(order?.display_status || order?.status || "").toLowerCase();
  return ["created", "pending"].includes(status) && ["created", "pending"].includes(displayStatus);
}

function canClaim(order?: Order | null) {
  const status = String(order?.status || "").toLowerCase();
  return ["paid", "shipped", "delayed", "delivered"].includes(status);
}

function statusStep(status?: string) {
  const value = String(status || "").toLowerCase();
  if (value === "cancelled") return 0;
  if (value === "created") return 1;
  if (value === "pending") return 2;
  if (value === "paid") return 3;
  if (value === "shipped" || value === "delayed" || value === "mixed") return 4;
  if (value === "delivered") return 5;
  return 1;
}

function claimStatusLabel(status?: string) {
  switch (String(status || "").toLowerCase()) {
    case "open":
      return "Открыто";
    case "in_review":
      return "На рассмотрении";
    case "approved":
      return "Одобрено";
    case "rejected":
      return "Отклонено";
    case "resolved":
      return "Закрыто";
    default:
      return status || "Открыто";
  }
}

function claimStatusTone(status?: string) {
  switch (String(status || "").toLowerCase()) {
    case "approved":
    case "resolved":
      return "is-success";
    case "rejected":
      return "is-danger";
    case "in_review":
      return "is-info";
    default:
      return "is-warning";
  }
}

function claimTypeLabel(type?: string) {
  return String(type || "").toLowerCase() === "return" ? "Возврат" : "Спор";
}

export function OrderDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { loading, user } = useAuth();
  const { addMany } = useCart();
  const toast = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [history, setHistory] = useState<OrderHistoryItem[]>([]);
  const [claims, setClaims] = useState<SellerClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimType, setClaimType] = useState<"return" | "dispute">("return");
  const [claimReason, setClaimReason] = useState("");
  const [claimBusy, setClaimBusy] = useState(false);

  const orderId = Number(id);

  async function reload() {
    if (!Number.isFinite(orderId) || orderId <= 0) return;
    setIsLoading(true);
    try {
      const [orderResponse, historyResponse, claimsResponse] = await Promise.all([
        api.getOrder(orderId),
        api.getOrderHistory(orderId),
        api.getOrderClaims(orderId),
      ]);
      setOrder(orderResponse.order);
      setItems(orderResponse.items as OrderItem[]);
      setHistory(historyResponse.items);
      setClaims(claimsResponse.items);
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось открыть заказ."));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    void reload();
  }, [user, orderId]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 1), 0);
    return {
      subtotal,
      delivery: Number(order?.delivery_price || 0),
      total: Number(order?.total || subtotal),
    };
  }, [items, order]);

  if (!loading && !user) return <Navigate to="/auth" replace />;

  async function repeatOrder() {
    if (!order) return;

    try {
      const response = await api.repeatOrder(order.id);
      const productIds = response.items
        .map((item) => Number(item.product_id))
        .filter((productId) => Number.isFinite(productId) && productId > 0);

      if (!productIds.length) {
        toast.warning("В этом заказе нет товаров для повтора.");
        return;
      }

      addMany(productIds);
      navigate("/cart");
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось повторить заказ."));
    }
  }

  async function submitClaim() {
    if (!order) return;
    if (!claimReason.trim()) {
      toast.warning("Опишите причину обращения.");
      return;
    }

    setClaimBusy(true);
    try {
      await api.createOrderClaim(order.id, {
        type: claimType,
        reason: claimReason.trim(),
      });
      toast.success(claimType === "return" ? "Запрос на возврат отправлен." : "Спор по заказу открыт.");
      setClaimOpen(false);
      setClaimReason("");
      await reload();
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось отправить обращение."));
    } finally {
      setClaimBusy(false);
    }
  }

  return (
    <div className="page-shell shell-container section-stack ordersPage orderDetailsPage">
      <section className="page-hero page-hero--compact">
        <div className="split-panel">
          <SectionHeading
            eyebrow="Детали заказа"
            title={order ? `Заказ #${order.id}` : "Заказ"}
            description={order ? `Создан: ${formatDateTime(order.created_at)}` : "Загружаем данные заказа"}
          />
          <div className="button-row">
            <Link to="/orders" className="shell-button shell-button--ghost">
              Все заказы
            </Link>
            <button type="button" className="shell-button shell-button--ghost" onClick={() => void reload()}>
              Обновить
            </button>
          </div>
        </div>
      </section>

      {isLoading ? (
        <section className="empty-panel">Загружаем заказ...</section>
      ) : order ? (
        <>
          <section className="orderDetailsGrid">
            <article className="orderDetailsCard orderDetailsCard--wide">
              <div className="orderDetailsCard__top">
                <div>
                  <span className="order-card__eyebrow">Текущий статус</span>
                  <h2>{formatOrderStatus(order.display_status || order.status)}</h2>
                </div>
                <span className="tiny-chip is-active">{formatPrice(totals.total)}</span>
              </div>

              <div className="orderSteps" style={{ "--step": statusStep(order.display_status || order.status) } as CSSProperties}>
                {["Создан", "В обработке", "Оплачен", "В пути", "Готово"].map((label, index) => (
                  <span key={label} className={index + 1 <= statusStep(order.display_status || order.status) ? "is-active" : ""}>
                    {label}
                  </span>
                ))}
              </div>

              <p className="orderDetailsCard__note">{order.comment || "Комментарий к заказу не добавлен."}</p>

              <div className="button-row">
                {canPay(order) ? (
                  <Link to={`/payment?order=${order.id}`} className="shell-button">
                    Перейти к оплате
                  </Link>
                ) : null}
                <button type="button" className="shell-button shell-button--ghost" onClick={() => void repeatOrder()}>
                  Повторить заказ
                </button>
                {canClaim(order) ? (
                  <button type="button" className="shell-button shell-button--ghost" onClick={() => setClaimOpen((current) => !current)}>
                    Возврат или спор
                  </button>
                ) : null}
              </div>

              {claimOpen ? (
                <div className="orderClaimBox">
                  <div className="orderClaimBox__row">
                    <label className="field">
                      <span className="field-label">Тип обращения</span>
                      <SelectField className="field-input" value={claimType} onChange={(event) => setClaimType(event.target.value as "return" | "dispute")}>
                        <option value="return">Возврат</option>
                        <option value="dispute">Спор</option>
                      </SelectField>
                    </label>
                  </div>

                  <label className="field field--full">
                    <span className="field-label">Причина</span>
                    <textarea
                      className="field-input orderClaimBox__textarea"
                      value={claimReason}
                      onChange={(event) => setClaimReason(event.target.value)}
                      placeholder="Опишите проблему или причину возврата..."
                    />
                  </label>

                  <div className="button-row">
                    <button type="button" className="shell-button" disabled={claimBusy} onClick={() => void submitClaim()}>
                      {claimBusy ? "Отправляем..." : "Отправить обращение"}
                    </button>
                    <button type="button" className="shell-button shell-button--ghost" disabled={claimBusy} onClick={() => setClaimOpen(false)}>
                      Отмена
                    </button>
                  </div>
                </div>
              ) : null}
            </article>

            <aside className="orderDetailsCard">
              <h3>Оплата и доставка</h3>
              <div className="orderDetailsRows">
                <div>
                  <span>Товары</span>
                  <strong>{formatPrice(totals.subtotal)}</strong>
                </div>
                <div>
                  <span>Доставка</span>
                  <strong>{formatPrice(totals.delivery)}</strong>
                </div>
                <div>
                  <span>Итого</span>
                  <strong>{formatPrice(totals.total)}</strong>
                </div>
                <div>
                  <span>Город</span>
                  <strong>{order.delivery_city || "Не указан"}</strong>
                </div>
                <div>
                  <span>Адрес</span>
                  <strong>{order.delivery_address || "Не указан"}</strong>
                </div>
                <div>
                  <span>Телефон</span>
                  <strong>{order.phone || "Не указан"}</strong>
                </div>
              </div>
            </aside>
          </section>

          {claims.length ? (
            <section className="orderDetailsCard">
              <div className="orderDetailsCard__top">
                <h3>Обращения по заказу</h3>
                <span className="tiny-chip">{claims.length}</span>
              </div>
              <div className="orderClaimsList">
                {claims.map((claim) => (
                  <article key={claim.id} className="orderClaimCard">
                    <div className="orderClaimCard__top">
                      <div>
                        <span className="order-card__eyebrow">
                          {claimTypeLabel(claim.type)} • обращение #{claim.id}
                        </span>
                        <strong>{claim.product_titles || "По заказу"}</strong>
                      </div>
                      <span className={`sellerSaleStatus ${claimStatusTone(claim.status)}`}>{claimStatusLabel(claim.status)}</span>
                    </div>

                    <div className="orderClaimCard__grid">
                      <div>
                        <span>Создано</span>
                        <strong>{formatDateTime(claim.created_at)}</strong>
                      </div>
                      <div>
                        <span>Продавец</span>
                        <strong>{claim.seller_name || claim.seller_email || "Не указан"}</strong>
                      </div>
                    </div>

                    <div className="orderClaimCard__block">
                      <span>Причина</span>
                      <strong>{claim.reason}</strong>
                    </div>

                    <div className="orderClaimCard__block">
                      <span>Ответ продавца</span>
                      <strong>{claim.seller_reply || "Продавец ещё не ответил."}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="orderDetailsCard">
            <div className="orderDetailsCard__top">
              <h3>Товары в заказе</h3>
              <span className="tiny-chip">{items.length}</span>
            </div>
            <div className="orderItemsList">
              {items.map((item) => (
                <Link key={item.id || item.product_id} to={`/product/${item.product_id}`} className="orderItemRow">
                  <span className="ordersPage__thumb">{item.image_url ? <img src={item.image_url} alt={item.title || ""} /> : null}</span>
                  <span className="orderItemRow__body">
                    <strong>{item.title || `Товар #${item.product_id}`}</strong>
                    <small>
                      {formatPrice(Number(item.price || 0))} × {item.qty || 1}
                      {item.seller_name ? ` • продавец: ${item.seller_name}` : ""}
                    </small>
                    <small>Статус позиции: {formatOrderStatus(item.seller_status)}</small>
                    {item.seller_note ? <small>{item.seller_note}</small> : null}
                  </span>
                  <strong>{formatPrice(Number(item.price || 0) * Number(item.qty || 1))}</strong>
                </Link>
              ))}
            </div>
          </section>

          <section className="orderDetailsCard">
            <div className="orderDetailsCard__top">
              <h3>История статусов</h3>
              <span className="tiny-chip">{history.length}</span>
            </div>
            {history.length ? (
              <div className="orderTimeline">
                {history.map((item, index) => (
                  <article key={`${item.status}-${index}`} className="orderTimeline__item">
                    <span />
                    <div>
                      <strong>{formatOrderStatus(item.status)}</strong>
                      <small>{formatDateTime(item.created_at)}</small>
                      {item.note ? <p>{item.note}</p> : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="muted">История пока пустая.</div>
            )}
          </section>
        </>
      ) : (
        <section className="empty-panel">
          <strong>Заказ не найден</strong>
          <p>Возможно, он был удалён или у вас нет доступа.</p>
          <Link to="/orders" className="shell-button">
            Вернуться к заказам
          </Link>
        </section>
      )}
    </div>
  );
}
