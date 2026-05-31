import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../../../providers/auth";
import { useToast } from "../../../providers/toast";
import { api } from "../../../services/api";
import { getErrorMessage } from "../../../services/errors";
import { formatOrderStatus, formatPrice } from "../../../services/format";
import type { Order } from "../../../types/api";

type PaymentMethod = "card" | "kaspi";

type PaymentOrderItem = {
  id?: number;
  title?: string;
  product_title?: string;
  price?: number | string;
  qty?: number | string;
  image_url?: string;
  seller_name?: string;
  seller_email?: string;
  line_total?: number | string;
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCardNumber(value: string) {
  return onlyDigits(value)
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function formatExpiry(value: string) {
  const digits = onlyDigits(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function validateCard(form: { number: string; name: string; expiry: string; cvv: string }) {
  const number = onlyDigits(form.number);
  const cvv = onlyDigits(form.cvv);
  const expiry = form.expiry.match(/^(\d{2})\/(\d{2})$/);

  if (number.length !== 16) return "Введите 16 цифр номера карты.";
  if (form.name.trim().length < 2) return "Введите имя держателя карты.";
  if (!expiry) return "Введите срок карты в формате MM/YY.";
  if (Number(expiry[1]) < 1 || Number(expiry[1]) > 12) return "Проверьте месяц срока карты.";
  if (cvv.length !== 3) return "Введите 3 цифры CVV.";

  const now = new Date();
  const currentYear = now.getFullYear() % 100;
  const currentMonth = now.getMonth() + 1;
  const year = Number(expiry[2]);
  const month = Number(expiry[1]);
  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return "Срок действия карты уже истек.";
  }

  return "";
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function itemQty(item: PaymentOrderItem) {
  return Math.max(1, Number(item.qty || 1) || 1);
}

function itemTitle(item: PaymentOrderItem) {
  return String(item.title || item.product_title || "Товар");
}

function itemTotal(item: PaymentOrderItem) {
  const qty = itemQty(item);
  return Number(item.line_total || 0) || Number(item.price || 0) * qty;
}

function isPayableOrderStatus(status: string) {
  return ["created", "pending"].includes(status);
}

function paymentLockedMessage(status: string) {
  if (status === "paid") return "Заказ уже оплачен. Дальше его можно отслеживать в разделе заказов.";
  if (status === "shipped") return "Заказ уже передан в доставку, повторная оплата недоступна.";
  if (status === "delayed") return "Заказ уже находится в работе, повторная оплата недоступна.";
  if (status === "delivered") return "Заказ уже доставлен, оплатить его повторно нельзя.";
  if (status === "cancelled") return "Заказ отменен, оплатить его нельзя.";
  return "Оплата для текущего статуса заказа недоступна.";
}

export function PaymentPage() {
  const navigate = useNavigate();
  const { loading, user } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<PaymentOrderItem[]>([]);
  const [form, setForm] = useState({
    number: "",
    name: "",
    expiry: "",
    cvv: "",
  });
  const orderId = useMemo(() => Number(searchParams.get("order") || 0), [searchParams]);

  useEffect(() => {
    if (!orderId) return;
    void api
      .getOrder(orderId)
      .then((response) => {
        setOrder(response.order);
        setItems((response.items || []) as PaymentOrderItem[]);
      })
      .catch(() => {
        setOrder(null);
        setItems([]);
      });
  }, [orderId]);

  if (!loading && !user) return <Navigate to="/auth" replace />;

  const subtotal = Number(order?.subtotal || 0) || items.reduce((sum, item) => sum + itemTotal(item), 0);
  const delivery = Number(order?.delivery_price || 0);
  const total = Number(order?.total || 0) || subtotal + delivery;
  const qtyTotal = items.reduce((sum, item) => sum + itemQty(item), 0);
  const rawStatus = String(order?.status || "").toLowerCase();
  const currentStatus = String(order?.display_status || order?.status || "").toLowerCase();
  const paymentLocked = !!order && (!isPayableOrderStatus(rawStatus) || !isPayableOrderStatus(currentStatus));
  const lockedStatus = !isPayableOrderStatus(currentStatus) ? currentStatus : rawStatus;
  const canPay = !!orderId && !!order && !busy && isPayableOrderStatus(rawStatus) && isPayableOrderStatus(currentStatus);

  async function pay() {
    if (!orderId || !order) return;
    if (!isPayableOrderStatus(rawStatus) || !isPayableOrderStatus(currentStatus)) {
      const message = paymentLockedMessage(lockedStatus);
      setStatus(message);
      toast.warning(message);
      return;
    }

    if (method === "card") {
      const error = validateCard(form);
      if (error) {
        setStatus(error);
        toast.warning(error);
        return;
      }
    }

    setBusy(true);
    setStatus("");

    try {
      await wait(1000);
      await api.payOrder(orderId, method);
      await wait(400);
      toast.order("Оплата прошла успешно. Заказ можно отслеживать в разделе заказов.", {
        title: "Заказ оплачен",
        action: { label: "Перейти к заказам", href: "/orders" },
      });
      navigate(`/order-success?id=${orderId}`);
    } catch (error) {
      const message = getErrorMessage(error, "Не удалось провести оплату.");
      setStatus(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="paymentPro">
      <div className="container paymentPro__inner">
        <nav className="paymentPro__breadcrumbs" aria-label="Путь оформления">
          <Link to="/">Главная</Link>
          <span>/</span>
          <Link to="/cart">Корзина</Link>
          <span>/</span>
          <Link to="/checkout">Оформление</Link>
          <span>/</span>
          <span>Оплата</span>
        </nav>

        <header className="paymentPro__header">
          <div>
            <h1>Оплата заказа</h1>
            <p>Выберите способ оплаты и подтвердите заказ. После оплаты продавец получит уведомление.</p>
          </div>
          {order ? <span className="paymentPro__status">{formatOrderStatus(order.status)}</span> : null}
        </header>

        <div className="paymentPro__grid">
          <section className="paymentPro__main">
            {paymentLocked ? (
              <div className="paymentPanel">
                <h2>Оплата недоступна</h2>
                <p className="paymentHint">{paymentLockedMessage(lockedStatus)}</p>
                <Link to={`/orders/${order.id}`} className="linkBtn">
                  Открыть заказ
                </Link>
              </div>
            ) : (
              <>
                <div className="paymentPanel">
                  <h2>Способ оплаты</h2>

                  <label className={`paymentMethodPro ${method === "card" ? "is-active" : ""}`}>
                    <input type="radio" name="payment-method" checked={method === "card"} onChange={() => setMethod("card")} />
                    <span className="paymentMethodPro__radio" aria-hidden="true" />
                    <span className="paymentMethodPro__icon" aria-hidden="true">CARD</span>
                    <span>
                      <strong>Банковская карта</strong>
                      <small>Visa, Mastercard, Мир</small>
                    </span>
                    <span className="paymentMethodPro__brands">VISA MC МИР</span>
                  </label>

                  {method === "card" ? (
                    <div className="paymentCardForm">
                      <label className="field field--full">
                        <span className="field-label">Номер карты</span>
                        <input
                          className="field-input"
                          value={form.number}
                          onChange={(event) => setForm((current) => ({ ...current, number: formatCardNumber(event.target.value) }))}
                          placeholder="0000 0000 0000 0000"
                          inputMode="numeric"
                          autoComplete="cc-number"
                        />
                      </label>
                      <label className="field field--full">
                        <span className="field-label">Имя держателя</span>
                        <input
                          className="field-input"
                          value={form.name}
                          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value.toUpperCase() }))}
                          placeholder="IVAN IVANOV"
                          autoComplete="cc-name"
                        />
                      </label>
                      <label className="field">
                        <span className="field-label">Срок действия</span>
                        <input
                          className="field-input"
                          value={form.expiry}
                          onChange={(event) => setForm((current) => ({ ...current, expiry: formatExpiry(event.target.value) }))}
                          placeholder="MM/YY"
                          inputMode="numeric"
                          autoComplete="cc-exp"
                        />
                      </label>
                      <label className="field">
                        <span className="field-label">CVV</span>
                        <input
                          className="field-input"
                          type="password"
                          value={form.cvv}
                          onChange={(event) => setForm((current) => ({ ...current, cvv: onlyDigits(event.target.value).slice(0, 3) }))}
                          placeholder="123"
                          inputMode="numeric"
                          autoComplete="cc-csc"
                        />
                      </label>
                    </div>
                  ) : null}

                  <label className={`paymentMethodPro ${method === "kaspi" ? "is-active" : ""}`}>
                    <input type="radio" name="payment-method" checked={method === "kaspi"} onChange={() => setMethod("kaspi")} />
                    <span className="paymentMethodPro__radio" aria-hidden="true" />
                    <span className="paymentMethodPro__icon paymentMethodPro__icon--kaspi" aria-hidden="true">K</span>
                    <span>
                      <strong>Kaspi QR / Kaspi Pay</strong>
                      <small>Быстрая оплата через Kaspi</small>
                    </span>
                    <span className="paymentMethodPro__arrow">›</span>
                  </label>

                  {method === "kaspi" ? (
                    <div className="paymentKaspiBox">
                      <div className="paymentKaspiBox__qr" aria-hidden="true" />
                      <p>После нажатия кнопки оплаты заказ будет отмечен как оплаченный. Позже сюда можно подключить настоящий QR.</p>
                    </div>
                  ) : null}
                </div>

                <div className="paymentPanel">
                  <h2>Контактные данные</h2>
                  <div className="paymentContacts">
                    <label className="field">
                      <span className="field-label">Имя</span>
                      <input className="field-input" value={user?.name || ""} readOnly />
                    </label>
                    <label className="field">
                      <span className="field-label">Телефон</span>
                      <input className="field-input" value={order?.phone || ""} readOnly />
                    </label>
                    <label className="field">
                      <span className="field-label">Email</span>
                      <input className="field-input" value={order?.contact_email || user?.email || ""} readOnly />
                    </label>
                  </div>
                  <p className="paymentHint">Уведомления по заказу будут приходить на email, указанный при оформлении.</p>
                </div>

                {status ? <div className="paymentError">{status}</div> : null}

                <button type="button" className="paymentPayButton" disabled={!canPay} onClick={() => void pay()}>
                  {busy ? "Обрабатываем оплату..." : currentStatus === "paid" ? "Заказ уже оплачен" : `Оплатить ${formatPrice(total)}`}
                </button>

                <p className="paymentSecurity">Данные защищены и не передаются третьим лицам.</p>
              </>
            )}
          </section>

          <aside className="paymentPro__aside">
            <section className="paymentPanel paymentSummaryPro">
              <h2>Ваш заказ</h2>

              <div className="paymentSummaryPro__items">
                {items.length ? (
                  items.map((item, index) => (
                    <article className="paymentOrderItem" key={`${item.id || item.title || "item"}-${index}`}>
                      <span className="paymentOrderItem__image">
                        {item.image_url ? <img src={item.image_url} alt={itemTitle(item)} /> : null}
                      </span>
                      <span className="paymentOrderItem__body">
                        <strong>{itemTitle(item)}</strong>
                        <small>{item.seller_name ? `Продавец: ${item.seller_name}` : "Продавец Dayen"}</small>
                      </span>
                      <span className="paymentOrderItem__qty">{itemQty(item)} шт.</span>
                      <strong className="paymentOrderItem__price">{formatPrice(itemTotal(item))}</strong>
                    </article>
                  ))
                ) : (
                  <div className="paymentSummaryPro__empty">Состав заказа загрузится после выбора заказа.</div>
                )}
              </div>

              <div className="paymentSummaryPro__totals">
                <div>
                  <span>Товары ({qtyTotal || 0})</span>
                  <strong>{formatPrice(subtotal)}</strong>
                </div>
                <div>
                  <span>Доставка</span>
                  <strong>{delivery ? formatPrice(delivery) : "Бесплатно"}</strong>
                </div>
                <div className="paymentSummaryPro__total">
                  <span>Итого</span>
                  <strong>{formatPrice(total)}</strong>
                </div>
              </div>
            </section>

            <section className="paymentBenefits">
              <article>
                <strong>Безопасная оплата</strong>
                <span>Платеж фиксируется в заказе</span>
              </article>
              <article>
                <strong>Уведомления</strong>
                <span>Покупатель и продавец видят изменения</span>
              </article>
              <article>
                <strong>Поддержка</strong>
                <span>Можно открыть обращение по заказу</span>
              </article>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
