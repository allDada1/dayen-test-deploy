import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { SectionHeading } from "../../../components/SectionHeading";
import { SelectField } from "../../../components/SelectField";
import { useAuth } from "../../../providers/auth";
import { useToast } from "../../../providers/toast";
import { api } from "../../../services/api";
import { getErrorMessage } from "../../../services/errors";
import { formatDateTime } from "../../../services/format";
import type { SellerClaim } from "../../../types/api";

const claimStatuses = [
  { value: "all", label: "Все" },
  { value: "open", label: "Новые" },
  { value: "in_review", label: "На рассмотрении" },
  { value: "approved", label: "Одобрены" },
  { value: "rejected", label: "Отклонены" },
  { value: "resolved", label: "Закрыты" },
];

const updateStatuses = [
  { value: "in_review", label: "Взять в работу" },
  { value: "approved", label: "Одобрить" },
  { value: "rejected", label: "Отклонить" },
  { value: "resolved", label: "Закрыть" },
];

function claimTone(status?: string) {
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

function claimLabel(type?: string) {
  return String(type || "").toLowerCase() === "return" ? "Возврат" : "Спор";
}

export function SellerClaimsPage() {
  const { loading, user } = useAuth();
  const toast = useToast();
  const [claims, setClaims] = useState<SellerClaim[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openedId, setOpenedId] = useState<number | null>(null);
  const [replies, setReplies] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const deferredQuery = useDeferredValue(query);

  async function reload() {
    try {
      const response = await api.getSellerClaims();
      setClaims(response.items);
      setReplies((current) => {
        const next = { ...current };
        for (const claim of response.items) {
          if (next[claim.id] === undefined) next[claim.id] = claim.seller_reply || "";
        }
        return next;
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось загрузить обращения."));
    }
  }

  useEffect(() => {
    if (!user?.is_seller) return;
    void reload();
  }, [user]);

  if (!loading && !user) return <Navigate to="/auth" replace />;
  if (!loading && !user?.is_seller) return <Navigate to="/seller" replace />;

  const filteredClaims = useMemo(() => {
    const lowered = deferredQuery.trim().toLowerCase();
    return claims.filter((claim) => {
      const matchesStatus = statusFilter === "all" || claim.status === statusFilter;
      const text = [
        claim.id,
        claim.order_id,
        claim.type,
        claim.reason,
        claim.seller_reply,
        claim.product_titles,
        claim.buyer_name,
        claim.buyer_email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesStatus && (!lowered || text.includes(lowered));
    });
  }, [claims, deferredQuery, statusFilter]);

  async function updateClaim(claimId: number, status: string) {
    setBusyId(claimId);
    try {
      await api.updateSellerClaim(claimId, {
        status,
        seller_reply: replies[claimId] || "",
      });
      toast.success("Обращение обновлено.");
      await reload();
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось обновить обращение."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page-shell shell-container section-stack sellerSalesPage sellerClaimsPage">
      <section className="page-hero page-hero--compact">
        <div className="split-panel">
          <SectionHeading
            eyebrow="Панель продавца"
            title="Обращения покупателей"
            description="Здесь собираются возвраты и споры по вашим заказам. Можно быстро ответить, принять решение и держать всё под контролем."
          />
          <div className="button-row">
            <Link to="/seller" className="shell-button shell-button--ghost">
              Кабинет продавца
            </Link>
            <Link to="/seller/sales" className="shell-button shell-button--ghost">
              Продажи
            </Link>
          </div>
        </div>
      </section>

      <section className="sellerSalesFilters contentCard">
        <label className="field field--full">
          <span className="field-label">Поиск</span>
          <input
            className="field-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Заказ, покупатель, причина, товар"
          />
        </label>

        <div className="sellerSalesFilters__row sellerClaimsFilters__row">
          <label className="field">
            <span className="field-label">Статус</span>
            <SelectField className="field-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {claimStatuses.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </SelectField>
          </label>

          <button
            type="button"
            className="shell-button shell-button--ghost"
            onClick={() => {
              setQuery("");
              setStatusFilter("all");
            }}
          >
            Сбросить фильтры
          </button>
        </div>
      </section>

      <section className="sellerSalesList">
        <div className="sellerSalesList__head">
          <strong>Найдено обращений: {filteredClaims.length}</strong>
        </div>

        {filteredClaims.length ? (
          filteredClaims.map((claim) => {
            const isOpen = openedId === claim.id;
            const isBusy = busyId === claim.id;

            return (
              <article key={claim.id} className={`sellerSaleCard ${isOpen ? "is-open" : ""}`}>
                <button
                  type="button"
                  className="sellerSaleCard__summary"
                  onClick={() => setOpenedId((current) => (current === claim.id ? null : claim.id))}
                >
                  <span className="sellerSaleCard__thumb">
                    {claim.image_url ? <img src={claim.image_url} alt={claim.product_titles || `Обращение #${claim.id}`} /> : null}
                  </span>

                  <span className="sellerSaleCard__main">
                    <span className="order-card__eyebrow">
                      Заказ #{claim.order_id} • обращение #{claim.id}
                    </span>
                    <strong>{claim.product_titles || "Обращение по заказу"}</strong>
                    <small>{claimLabel(claim.type)} • {formatDateTime(claim.created_at)}</small>
                  </span>

                  <span className="sellerSaleCard__buyer">
                    <small>Покупатель</small>
                    <strong>{claim.buyer_name || claim.buyer_email || "Не указан"}</strong>
                  </span>

                  <span className={`sellerSaleStatus ${claimTone(claim.status)}`}>{claim.status}</span>
                </button>

                {isOpen ? (
                  <div className="sellerSaleCard__details">
                    <div className="sellerSaleCard__infoGrid">
                      <div>
                        <span>Тип</span>
                        <strong>{claimLabel(claim.type)}</strong>
                      </div>
                      <div>
                        <span>Позиции</span>
                        <strong>{claim.items_count || 0}</strong>
                      </div>
                      <div>
                        <span>Email покупателя</span>
                        <strong>{claim.buyer_email || "Не указан"}</strong>
                      </div>
                      <div>
                        <span>Заказ</span>
                        <Link to={`/orders/${claim.order_id}`}>Открыть заказ #{claim.order_id}</Link>
                      </div>
                    </div>

                    <div className="sellerClaimCard__reason">
                      <span>Причина обращения</span>
                      <strong>{claim.reason}</strong>
                    </div>

                    <label className="field field--full">
                      <span className="field-label">Ответ продавца</span>
                      <textarea
                        className="field-input sellerSaleCard__note"
                        value={replies[claim.id] || ""}
                        onChange={(event) => setReplies((current) => ({ ...current, [claim.id]: event.target.value }))}
                        placeholder="Напишите решение, условия возврата или комментарий по спору..."
                      />
                    </label>

                    <div className="sellerSaleCard__actions">
                      {updateStatuses.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          className="shell-button shell-button--ghost shell-button--compact"
                          disabled={isBusy}
                          onClick={() => void updateClaim(claim.id, item.value)}
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
            <strong>Обращений пока нет</strong>
            <p>Когда покупатели откроют возврат или спор, они появятся здесь.</p>
          </section>
        )}
      </section>
    </div>
  );
}
