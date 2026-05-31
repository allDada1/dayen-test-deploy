import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { SectionHeading } from "../../../components/SectionHeading";
import { SelectField } from "../../../components/SelectField";
import { useAuth } from "../../../providers/auth";
import { useToast } from "../../../providers/toast";
import { api } from "../../../services/api";
import { getErrorMessage } from "../../../services/errors";
import { formatDateTime, formatOrderStatus, formatPrice } from "../../../services/format";
import type { SellerSale } from "../../../types/api";

const statusOptions = [
  { value: "all", label: "Все" },
  { value: "pending", label: "Ожидают обработки" },
  { value: "paid", label: "Оплачены" },
  { value: "shipped", label: "Отправлены" },
  { value: "delayed", label: "С задержкой" },
  { value: "delivered", label: "Доставлены" },
  { value: "cancelled", label: "Отменены" },
];

const quickStatuses = [
  { value: "shipped", label: "Отметить как отправленный" },
  { value: "delayed", label: "Поставить задержку" },
  { value: "delivered", label: "Отметить как доставленный" },
  { value: "cancelled", label: "Отменить продажу" },
];

const pageSize = 8;

function saleSearchText(sale: SellerSale) {
  return [
    sale.order_id,
    sale.sale_id,
    sale.product_title,
    sale.buyer_name,
    sale.buyer_email,
    sale.seller_note,
    sale.order_comment,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function statusTone(status?: string) {
  const value = String(status || "").toLowerCase();
  if (value === "delivered") return "is-success";
  if (value === "cancelled") return "is-danger";
  if (value === "delayed") return "is-warning";
  if (value === "shipped") return "is-info";
  if (value === "paid") return "is-active";
  return "";
}

export function SellerSalesPage() {
  const { loading, user } = useAuth();
  const toast = useToast();
  const [sales, setSales] = useState<SellerSale[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("new");
  const [page, setPage] = useState(1);
  const [openedId, setOpenedId] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [busySaleId, setBusySaleId] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const deferredQuery = useDeferredValue(query);

  async function reload() {
    setIsRefreshing(true);
    try {
      const response = await api.getSellerSales();
      setSales(response.items);
      setNotes((current) => {
        const next = { ...current };
        for (const sale of response.items) {
          if (next[sale.sale_id] === undefined) next[sale.sale_id] = sale.seller_note || "";
        }
        return next;
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось загрузить продажи."));
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    if (!user?.is_seller) return;
    void reload();
  }, [user]);

  useEffect(() => {
    setPage(1);
  }, [deferredQuery, statusFilter, sort]);

  if (!loading && !user) {
    return <Navigate to="/auth" replace />;
  }

  if (!loading && !user?.is_seller) {
    return <Navigate to="/seller" replace />;
  }

  const summary = useMemo(() => {
    const total = sales.length;
    const waiting = sales.filter((sale) =>
      ["pending", "paid"].includes(String(sale.status || "").toLowerCase()),
    ).length;
    const shipped = sales.filter((sale) => String(sale.status || "").toLowerCase() === "shipped").length;
    const delivered = sales.filter((sale) => String(sale.status || "").toLowerCase() === "delivered").length;
    const revenue = sales
      .filter((sale) => String(sale.status || "").toLowerCase() !== "cancelled")
      .reduce((sum, sale) => sum + Number(sale.line_total || 0), 0);

    return { total, waiting, shipped, delivered, revenue };
  }, [sales]);

  const filteredSales = useMemo(() => {
    const lowered = deferredQuery.trim().toLowerCase();
    const filtered = sales.filter((sale) => {
      const matchesStatus =
        statusFilter === "all" || String(sale.status || "").toLowerCase() === statusFilter;
      const matchesQuery = !lowered || saleSearchText(sale).includes(lowered);
      return matchesStatus && matchesQuery;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "old") return Number(a.sale_id) - Number(b.sale_id);
      if (sort === "expensive") return Number(b.line_total || 0) - Number(a.line_total || 0);
      if (sort === "cheap") return Number(a.line_total || 0) - Number(b.line_total || 0);
      return Number(b.sale_id) - Number(a.sale_id);
    });
  }, [deferredQuery, sales, sort, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / pageSize));
  const visibleSales = filteredSales.slice((page - 1) * pageSize, page * pageSize);

  async function updateStatus(saleId: number, nextStatus: string) {
    setBusySaleId(saleId);
    try {
      await api.updateSellerSaleStatus(saleId, {
        status: nextStatus,
        note: notes[saleId] || "",
      });
      toast.success("Статус продажи обновлен.");
      await reload();
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось обновить статус продажи."));
    } finally {
      setBusySaleId(null);
    }
  }

  return (
    <div className="page-shell shell-container section-stack sellerSalesPage">
      <section className="page-hero page-hero--compact">
        <div className="split-panel">
          <SectionHeading
            eyebrow="Панель продавца"
            title="Продажи"
            description="Контролируйте все свои продажи в одном месте: отслеживайте заказы, меняйте статусы и оставляйте внутренние заметки по обработке."
          />
          <div className="button-row">
            <Link to="/seller" className="shell-button shell-button--ghost">
              Кабинет продавца
            </Link>
            <button type="button" className="shell-button shell-button--ghost" onClick={() => void reload()}>
              {isRefreshing ? "Обновляем..." : "Обновить"}
            </button>
          </div>
        </div>
      </section>

      <section className="sellerSalesStats">
        <article>
          <span>Всего продаж</span>
          <strong>{summary.total}</strong>
        </article>
        <article>
          <span>Ждут обработки</span>
          <strong>{summary.waiting}</strong>
        </article>
        <article>
          <span>В пути</span>
          <strong>{summary.shipped}</strong>
        </article>
        <article>
          <span>Доставлены</span>
          <strong>{summary.delivered}</strong>
        </article>
        <article>
          <span>Оборот</span>
          <strong>{formatPrice(summary.revenue)}</strong>
        </article>
      </section>

      <section className="sellerSalesFilters contentCard">
        <label className="field field--full">
          <span className="field-label">Поиск</span>
          <input
            className="field-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Заказ, товар, покупатель, email или заметка"
          />
        </label>

        <div className="sellerSalesFilters__row">
          <label className="field">
            <span className="field-label">Статус</span>
            <SelectField
              className="field-input"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {statusOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </SelectField>
          </label>

          <label className="field">
            <span className="field-label">Сортировка</span>
            <SelectField className="field-input" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="new">Сначала новые</option>
              <option value="old">Сначала старые</option>
              <option value="expensive">Сначала дорогие</option>
              <option value="cheap">Сначала дешевые</option>
            </SelectField>
          </label>

          <button
            type="button"
            className="shell-button shell-button--ghost"
            onClick={() => {
              setQuery("");
              setStatusFilter("all");
              setSort("new");
            }}
          >
            Сбросить фильтры
          </button>
        </div>
      </section>

      <section className="sellerSalesList">
        <div className="sellerSalesList__head">
          <strong>Найдено продаж: {filteredSales.length}</strong>
          <span>
            Страница {page} из {totalPages}
          </span>
        </div>

        {visibleSales.length ? (
          visibleSales.map((sale) => {
            const isOpen = openedId === sale.sale_id;
            const isBusy = busySaleId === sale.sale_id;

            return (
              <article key={sale.sale_id} className={`sellerSaleCard ${isOpen ? "is-open" : ""}`}>
                <button
                  type="button"
                  className="sellerSaleCard__summary"
                  onClick={() => setOpenedId((current) => (current === sale.sale_id ? null : sale.sale_id))}
                >
                  <span className="sellerSaleCard__thumb">
                    {sale.image_url ? <img src={sale.image_url} alt={sale.product_title} /> : null}
                  </span>

                  <span className="sellerSaleCard__main">
                    <span className="order-card__eyebrow">
                      Заказ #{sale.order_id} • продажа #{sale.sale_id}
                    </span>
                    <strong>{sale.product_title}</strong>
                    <small>
                      {sale.qty} шт. × {formatPrice(Number(sale.price || 0))} •{" "}
                      {formatDateTime(sale.created_at)}
                    </small>
                  </span>

                  <span className="sellerSaleCard__buyer">
                    <small>Покупатель</small>
                    <strong>{sale.buyer_name || sale.buyer_email || "Не указан"}</strong>
                  </span>

                  <span className={`sellerSaleStatus ${statusTone(sale.status)}`}>
                    {formatOrderStatus(sale.status)}
                  </span>

                  <strong className="sellerSaleCard__total">
                    {formatPrice(Number(sale.line_total || 0))}
                  </strong>
                </button>

                {isOpen ? (
                  <div className="sellerSaleCard__details">
                    <div className="sellerSaleCard__infoGrid">
                      <div>
                        <span>Заказ</span>
                        <Link to={`/orders/${sale.order_id}`}>Открыть заказ #{sale.order_id}</Link>
                      </div>
                      <div>
                        <span>Email покупателя</span>
                        <strong>{sale.buyer_email || "Не указан"}</strong>
                      </div>
                      <div>
                        <span>Комментарий к заказу</span>
                        <strong>{sale.order_comment || "Комментария нет"}</strong>
                      </div>
                      <div>
                        <span>Текущий статус</span>
                        <strong>{formatOrderStatus(sale.status)}</strong>
                      </div>
                    </div>

                    <label className="field field--full">
                      <span className="field-label">Заметка продавца</span>
                      <textarea
                        className="field-input sellerSaleCard__note"
                        value={notes[sale.sale_id] || ""}
                        onChange={(event) =>
                          setNotes((current) => ({ ...current, [sale.sale_id]: event.target.value }))
                        }
                        placeholder="Например: ключ отправлен, ожидаю ответ покупателя, будет задержка до вечера..."
                      />
                    </label>

                    <div className="sellerSaleCard__actions">
                      {quickStatuses.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          className="shell-button shell-button--ghost shell-button--compact"
                          disabled={isBusy}
                          onClick={() => void updateStatus(sale.sale_id, item.value)}
                        >
                          {isBusy ? "Сохраняем..." : item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <section className="empty-panel">
            <strong>Продажи не найдены</strong>
            <p>Попробуйте изменить поиск или сбросить фильтры.</p>
          </section>
        )}
      </section>

      {totalPages > 1 ? (
        <nav className="pager" aria-label="Страницы продаж">
          <button
            type="button"
            className="shell-button shell-button--ghost"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            ← Назад
          </button>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((item) => (
            <button
              key={item}
              type="button"
              className={page === item ? "shell-button" : "shell-button shell-button--ghost"}
              onClick={() => setPage(item)}
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            className="shell-button shell-button--ghost"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          >
            Вперед →
          </button>
        </nav>
      ) : null}
    </div>
  );
}
