import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { AdminNav } from "../components/AdminNav";
import { SelectField } from "../../../components/SelectField";
import { useAuth } from "../../../providers/auth";
import { useToast } from "../../../providers/toast";
import { api } from "../../../services/api";
import { getErrorMessage } from "../../../services/errors";
import { formatDateTime, formatOrderStatus, formatPrice } from "../../../services/format";
import type { SellerClaim } from "../../../types/api";

const claimStatuses = [
  { value: "all", label: "Все статусы" },
  { value: "open", label: "Новые" },
  { value: "in_review", label: "В работе" },
  { value: "escalated", label: "Эскалация" },
  { value: "approved", label: "Одобрено" },
  { value: "rejected", label: "Отклонено" },
  { value: "resolved", label: "Закрыто" },
];

const claimTypes = [
  { value: "all", label: "Все типы" },
  { value: "return", label: "Возврат" },
  { value: "dispute", label: "Спор" },
];

const updateStatuses = [
  { value: "in_review", label: "Взять в работу" },
  { value: "escalated", label: "Эскалировать" },
  { value: "approved", label: "Одобрить" },
  { value: "rejected", label: "Отклонить" },
  { value: "resolved", label: "Закрыть" },
];

function claimTypeLabel(type?: string) {
  return String(type || "").toLowerCase() === "return" ? "Возврат" : "Спор";
}

function claimStatusLabel(status?: string) {
  switch (String(status || "").toLowerCase()) {
    case "open":
      return "Новое";
    case "in_review":
      return "В работе";
    case "approved":
      return "Одобрено";
    case "rejected":
      return "Отклонено";
    case "resolved":
      return "Закрыто";
    case "escalated":
      return "Эскалация";
    default:
      return status || "—";
  }
}

function claimTone(status?: string) {
  switch (String(status || "").toLowerCase()) {
    case "approved":
    case "resolved":
      return "is-active";
    case "rejected":
      return "is-danger";
    case "escalated":
      return "is-warning";
    default:
      return "";
  }
}

export function AdminClaimsPage() {
  const { loading, user } = useAuth();
  const toast = useToast();
  const [claims, setClaims] = useState<SellerClaim[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [openedId, setOpenedId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [resolutions, setResolutions] = useState<Record<number, string>>({});
  const deferredQuery = useDeferredValue(query);

  async function loadClaims() {
    try {
      const response = await api.getAdminClaims();
      setClaims(response.items);
      setResolutions((current) => {
        const next = { ...current };
        for (const claim of response.items) {
          if (next[claim.id] === undefined) next[claim.id] = claim.resolution || "";
        }
        return next;
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось загрузить обращения."));
    }
  }

  useEffect(() => {
    if (!user?.is_admin && !user?.is_owner) return;
    void loadClaims();
  }, [user]);

  const filteredClaims = useMemo(() => {
    const lowered = deferredQuery.trim().toLowerCase();
    return claims.filter((claim) => {
      const matchesStatus = statusFilter === "all" || claim.status === statusFilter;
      const matchesType = typeFilter === "all" || claim.type === typeFilter;
      const text = [
        claim.id,
        claim.order_id,
        claim.reason,
        claim.seller_reply,
        claim.resolution,
        claim.product_titles,
        claim.buyer_name,
        claim.buyer_email,
        claim.seller_name,
        claim.seller_email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && matchesType && (!lowered || text.includes(lowered));
    });
  }, [claims, deferredQuery, statusFilter, typeFilter]);

  async function updateClaim(claimId: number, status: string) {
    setBusyId(claimId);
    try {
      await api.updateAdminClaim(claimId, {
        status,
        resolution: resolutions[claimId] || "",
      });
      toast.success("Обращение обновлено.");
      await loadClaims();
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось обновить обращение."));
    } finally {
      setBusyId(null);
    }
  }

  if (!loading && !user) return <Navigate to="/auth" replace />;
  if (!loading && !user?.is_admin && !user?.is_owner) return <Navigate to="/" replace />;

  return (
    <div className="container admWrap">
      <header className="admPanelHead">
        <div>
          <div className="admPanelHead__title">Обращения</div>
          <div className="admPanelHead__subtitle">Возвраты и споры по заказам.</div>
        </div>
        <AdminNav />
      </header>

      <section className="contentCard">
        <div className="order-card__top">
          <div>
            <h1 className="sectionTitle">Обращения</h1>
            <div className="muted">Поиск, фильтры и решение спорных ситуаций.</div>
          </div>
          <span className="tiny-chip is-active">Найдено: {filteredClaims.length}</span>
        </div>

        <form className="admToolbar admToolbar--searchOnly" onSubmit={(event) => event.preventDefault()}>
          <label className="field admToolbar__wide">
            <span className="field-label">Поиск</span>
            <input
              className="field-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ID обращения, заказ, покупатель, продавец, причина"
            />
          </label>
        </form>

        <div className="admToolbar admToolbar--filters">
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
          <label className="field">
            <span className="field-label">Тип</span>
            <SelectField className="field-input" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              {claimTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </SelectField>
          </label>
          <div className="field admToolbar__action">
            <button
              type="button"
              className="ghostBtn ghostBtn--wide"
              onClick={() => {
                setQuery("");
                setStatusFilter("all");
                setTypeFilter("all");
              }}
            >
              Сбросить фильтры
            </button>
          </div>
        </div>

        <div className="admClaimsLayout">
          <div className="stack-list">
            {filteredClaims.map((claim) => {
              const isOpen = openedId === claim.id;
              return (
                <article key={claim.id} className={`order-card admClaimCard ${isOpen ? "is-active" : ""}`}>
                  <button
                    type="button"
                    className="admClaimCard__open"
                    onClick={() => setOpenedId((current) => (current === claim.id ? null : claim.id))}
                  >
                    <span className="admRow__thumb">
                      {claim.image_url ? <img src={claim.image_url} alt={claim.product_titles || `Обращение #${claim.id}`} /> : `#${claim.id}`}
                    </span>
                    <span className="admClaimCard__main">
                      <strong>Обращение #{claim.id}</strong>
                      <span className="muted">
                        Заказ #{claim.order_id} • {claimTypeLabel(claim.type)} • {claim.buyer_name || claim.buyer_email || "Покупатель не указан"}
                      </span>
                    </span>
                    <span className="tiny-chip">{claim.seller_name || claim.seller_email || "Продавец"}</span>
                    <span className={`tiny-chip ${claimTone(claim.status)}`}>{claimStatusLabel(claim.status)}</span>
                  </button>
                </article>
              );
            })}

            {!filteredClaims.length ? (
              <section className="empty-panel">
                <h2>Обращений пока нет</h2>
                <p>Когда покупатели откроют возврат или спор, они появятся здесь.</p>
              </section>
            ) : null}
          </div>

          <aside className="contentCard admClaimPanel">
            {openedId ? (
              (() => {
                const claim = filteredClaims.find((item) => item.id === openedId);
                if (!claim) {
                  return (
                    <div className="empty-panel">
                      <h2>Обращение не найдено</h2>
                      <p>Возможно, оно уже обновилось после фильтрации.</p>
                    </div>
                  );
                }

                const isBusy = busyId === claim.id;

                return (
                  <>
                    <div className="order-card__top">
                      <div>
                        <h2 className="sectionTitle">Обращение #{claim.id}</h2>
                        <div className="muted">{formatDateTime(claim.created_at)}</div>
                      </div>
                      <span className={`tiny-chip ${claimTone(claim.status)}`}>{claimStatusLabel(claim.status)}</span>
                    </div>

                    <div className="specGrid">
                      <div className="spec">
                        <div className="spec__k">Тип</div>
                        <div className="spec__v">{claimTypeLabel(claim.type)}</div>
                      </div>
                      <div className="spec">
                        <div className="spec__k">Статус заказа</div>
                        <div className="spec__v">{formatOrderStatus(claim.order_status || "pending")}</div>
                      </div>
                      <div className="spec">
                        <div className="spec__k">Сумма заказа</div>
                        <div className="spec__v">{formatPrice(Number(claim.order_total || 0))}</div>
                      </div>
                      <div className="spec">
                        <div className="spec__k">Позиции</div>
                        <div className="spec__v">{claim.items_count || 0}</div>
                      </div>
                    </div>

                    <div className="stack-list">
                      <div className="contentCard">
                        <div className="field-label">Покупатель</div>
                        <strong>{claim.buyer_name || "Не указан"}</strong>
                        <div className="muted">{claim.buyer_email || "Без email"}</div>
                      </div>

                      <div className="contentCard">
                        <div className="field-label">Продавец</div>
                        <strong>{claim.seller_name || "Не указан"}</strong>
                        <div className="muted">{claim.seller_email || "Без email"}</div>
                      </div>

                      <div className="contentCard">
                        <div className="field-label">Товары</div>
                        <strong>{claim.product_titles || "Без привязанных товаров"}</strong>
                      </div>

                      <div className="contentCard">
                        <div className="field-label">Причина</div>
                        <strong>{claim.reason}</strong>
                      </div>

                      <div className="contentCard">
                        <div className="field-label">Ответ продавца</div>
                        <strong>{claim.seller_reply || "Ответ пока не добавлен"}</strong>
                      </div>
                    </div>

                    <label className="field">
                      <span className="field-label">Решение администратора</span>
                      <textarea
                        className="field-input field-input--area"
                        value={resolutions[claim.id] || ""}
                        onChange={(event) => setResolutions((current) => ({ ...current, [claim.id]: event.target.value }))}
                        placeholder="Комментарий администратора, итог проверки, условия возврата..."
                      />
                    </label>

                    <div className="button-row">
                      {updateStatuses.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          className="ghostBtn"
                          disabled={isBusy}
                          onClick={() => void updateClaim(claim.id, item.value)}
                        >
                          {isBusy ? "Сохраняем..." : item.label}
                        </button>
                      ))}
                    </div>

                    <div className="button-row">
                      <Link to={`/orders/${claim.order_id}`} className="linkBtn">
                        Открыть заказ
                      </Link>
                    </div>
                  </>
                );
              })()
            ) : (
              <div className="empty-panel">
                <h2>Выбери обращение</h2>
                <p>Справа появятся детали, ответ продавца и действия администратора.</p>
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
