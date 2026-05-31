import type { FormEvent } from "react";
import { useState } from "react";
import { Navigate } from "react-router-dom";

import { AdminNav } from "../components/AdminNav";
import { SelectField } from "../../../components/SelectField";
import { useAuth } from "../../../providers/auth";
import { api } from "../../../services/api";
import { formatDate, formatOrderStatus, formatPrice } from "../../../services/format";
import type { Order } from "../../../types/api";

type HistoryItem = { status: string; note?: string; created_at?: string };

export function AdminOrdersPage() {
  const { loading, user } = useAuth();
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [status, setStatus] = useState("");
  const [statusForm, setStatusForm] = useState({ status: "pending", note: "" });

  if (!loading && !user) return <Navigate to="/auth" replace />;
  if (!loading && !user?.is_admin && !user?.is_owner) return <Navigate to="/" replace />;

  async function loadOrder(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const id = Number(orderId);
    if (!id) return;

    try {
      const [orderResponse, historyResponse] = await Promise.all([api.getOrder(id), api.getOrderHistory(id)]);
      setOrder(orderResponse.order);
      setItems(orderResponse.items);
      setHistory(historyResponse.items);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось открыть заказ");
    }
  }

  async function submitStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order) return;

    try {
      await api.updateOrderStatus(order.id, statusForm);
      await loadOrder();
      setStatus("Статус заказа обновлён.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось обновить статус");
    }
  }

  return (
    <div className="container admWrap">
      <header className="admPanelHead">
        <div>
          <div className="admPanelHead__title">Админ панель</div>
          <div className="admPanelHead__subtitle">Управление заказами каталога</div>
        </div>
        <AdminNav />
      </header>

      <section className="contentCard">
        <div className="order-card__top">
          <div>
            <h1 className="sectionTitle">Заказы</h1>
            <div className="muted">Открывай заказ по ID, проверяй состав и меняй статус.</div>
          </div>
          <span className="tiny-chip is-active">Доступ: администратор</span>
        </div>

        <div className="form-grid">
          <form className="profile-form" onSubmit={loadOrder}>
            <label className="field">
              <span className="field-label">ID заказа</span>
              <input className="field-input" value={orderId} onChange={(event) => setOrderId(event.target.value)} />
            </label>
            <div className="button-row">
              <button type="submit" className="linkBtn">Открыть заказ</button>
            </div>
          </form>

          <form className="profile-form" onSubmit={submitStatus}>
            <label className="field">
              <span className="field-label">Новый статус</span>
                <SelectField className="field-input" value={statusForm.status} onChange={(event) => setStatusForm((current) => ({ ...current, status: event.target.value }))}>
                <option value="pending">pending</option>
                <option value="paid">paid</option>
                <option value="shipped">shipped</option>
                <option value="delivered">delivered</option>
                <option value="cancelled">cancelled</option>
                </SelectField>
            </label>
            <label className="field">
              <span className="field-label">Комментарий</span>
              <input className="field-input" value={statusForm.note} onChange={(event) => setStatusForm((current) => ({ ...current, note: event.target.value }))} />
            </label>
            <div className="button-row">
              <button type="submit" className="linkBtn" disabled={!order}>Применить статус</button>
            </div>
          </form>
        </div>

        {status ? <div className="field-hint">{status}</div> : null}

        {order ? (
          <div className="form-grid">
            <div className="contentCard">
              <div className="order-card__top">
                <strong>Заказ #{order.id}</strong>
                <span className="tiny-chip is-active">{formatOrderStatus(order.status)}</span>
              </div>
              <div className="order-card__meta">
                <span>Сумма: {formatPrice(Number(order.total || 0))}</span>
                <span>{formatDate(order.created_at)}</span>
              </div>
              <div className="stack-list">
                {items.map((item, index) => (
                  <div key={index} className="summary-row">
                    <span>{String(item.title || item.product_id || "Товар")}</span>
                    <strong>{formatPrice(Number(item.price || 0))}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="contentCard">
              <h2 className="sectionTitle">История статусов</h2>
              <div className="stack-list">
                {history.map((item, index) => (
                  <article key={index} className="order-card">
                    <div className="order-card__top">
                      <strong>{formatOrderStatus(item.status)}</strong>
                      <span className="order-card__eyebrow">{formatDate(item.created_at)}</span>
                    </div>
                    <p className="order-card__note">{item.note || "Без комментария."}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
