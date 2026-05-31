import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { AdminNav } from "../components/AdminNav";
import { SelectField } from "../../../components/SelectField";
import { useAuth } from "../../../providers/auth";
import { api } from "../../../services/api";
import { formatDate } from "../../../services/format";
import type { SellerRequest } from "../../../types/api";

const PAGE_SIZE = 8;

function requestStatusLabel(request: SellerRequest) {
  if (request.status === "approved" && request.seller_access === false) return "Доступ снят";
  if (request.status === "approved") return "Одобрено";
  if (request.status === "rejected") return "Отклонено";
  return "На рассмотрении";
}

function requestStatusTone(request: SellerRequest) {
  if (request.status === "approved" && request.seller_access === false) return "is-warning";
  if (request.status === "approved") return "is-active";
  if (request.status === "rejected") return "is-danger";
  return "";
}

export function AdminSellerRequestsPage() {
  const { loading, user } = useAuth();
  const [requests, setRequests] = useState<SellerRequest[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("new");
  const [page, setPage] = useState(1);

  async function reload() {
    const response = await api.getAdminSellerRequests();
    setRequests(response.items || response.requests || []);
  }

  useEffect(() => {
    if (!user?.is_admin && !user?.is_owner) return;
    void reload();
  }, [user]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sort]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    const next = requests.filter((request) => {
      const requestStatus =
        request.status === "approved" && request.seller_access === false ? "revoked" : request.status;

      if (statusFilter !== "all" && requestStatus !== statusFilter) return false;
      if (!query) return true;

      const haystack = [
        request.id,
        request.shop_name,
        request.shop_slug,
        request.user_name,
        request.email,
        request.contacts,
        request.about,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });

    next.sort((a, b) => {
      if (sort === "old") return a.id - b.id;
      if (sort === "shop") return (a.shop_name || "").localeCompare(b.shop_name || "", "ru");
      if (sort === "status") return requestStatusLabel(a).localeCompare(requestStatusLabel(b), "ru");
      return b.id - a.id;
    });

    return next;
  }, [requests, search, sort, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedRequests = filteredRequests.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (!loading && !user) return <Navigate to="/auth" replace />;
  if (!loading && !user?.is_admin && !user?.is_owner) return <Navigate to="/" replace />;

  async function approve(id: number) {
    setStatus("");
    try {
      await api.approveAdminSellerRequest(id);
      await reload();
      setStatus("Заявка одобрена, доступ продавца открыт.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось одобрить заявку");
    }
  }

  async function reject(id: number) {
    const comment = "Требуется доработать профиль магазина";
    setStatus("");
    try {
      await api.rejectAdminSellerRequest(id, comment);
      await reload();
      setStatus("Заявка отклонена.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось отклонить заявку");
    }
  }

  async function revoke(id: number) {
    const comment = "Доступ продавца снят администратором";
    setStatus("");
    try {
      await api.revokeAdminSellerRequest(id, comment);
      await reload();
      setStatus("Доступ продавца снят.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось снять доступ");
    }
  }

  async function restore(id: number) {
    const comment = "Доступ продавца восстановлен администратором";
    setStatus("");
    try {
      await api.restoreAdminSellerRequest(id, comment);
      await reload();
      setStatus("Доступ продавца восстановлен.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось вернуть доступ");
    }
  }

  async function copySlug(slug: string) {
    try {
      await navigator.clipboard.writeText(slug);
      setStatus(`Slug ${slug} скопирован.`);
    } catch {
      setStatus("Не удалось скопировать slug.");
    }
  }

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setSort("new");
    setPage(1);
  }

  return (
    <div className="container admWrap">
      <header className="admPanelHead">
        <div>
          <div className="admPanelHead__title">Запросы продавцов</div>
          <div className="admPanelHead__subtitle">Проверка заявок, статусов доступа и решений по магазинам.</div>
        </div>
        <AdminNav />
      </header>

      <section className="contentCard">
        <div className="order-card__top">
          <div>
            <h1 className="sectionTitle">Запросы продавцов</h1>
            <div className="muted">Поиск, фильтры, понятные статусы и действия по доступу продавцов.</div>
          </div>
          <span className="tiny-chip is-active">Найдено: {filteredRequests.length}</span>
        </div>

        {status ? <div className="field-hint">{status}</div> : null}

        <div className="admToolbar admToolbar--searchOnly">
          <label className="field admToolbar__wide">
            <span className="field-label">Поиск</span>
            <input
              className="field-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ID, магазин, slug, пользователь, email"
            />
          </label>
        </div>

        <div className="admToolbar admToolbar--filters">
          <label className="field">
            <span className="field-label">Статус</span>
            <SelectField className="field-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Все заявки</option>
              <option value="pending">На рассмотрении</option>
              <option value="approved">Одобрено</option>
              <option value="rejected">Отклонено</option>
              <option value="revoked">Доступ снят</option>
            </SelectField>
          </label>

          <label className="field">
            <span className="field-label">Сортировка</span>
            <SelectField className="field-input" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="new">Сначала новые</option>
              <option value="old">Сначала старые</option>
              <option value="shop">По магазину</option>
              <option value="status">По статусу</option>
            </SelectField>
          </label>

          <div className="field admToolbar__action">
            <button type="button" className="ghostBtn ghostBtn--wide" onClick={resetFilters}>
              Сбросить фильтры
            </button>
          </div>
        </div>

        <div className="stack-list">
          {paginatedRequests.map((request) => {
            const isApproved = request.status === "approved";
            const isRejected = request.status === "rejected";
            const accessRevoked = isApproved && request.seller_access === false;

            return (
              <article key={request.id} className="order-card sellerRequestCard">
                <div className="order-card__top">
                  <div>
                    <strong>
                      #{request.id} • {request.shop_name}
                    </strong>
                    <div className="order-card__eyebrow">
                      slug: {request.shop_slug} • пользователь: {request.user_name || "—"} • email: {request.email || "—"}
                    </div>
                  </div>
                  <div className="sellerRequestCard__badges">
                    <span className={`tiny-chip ${requestStatusTone(request)}`}>{requestStatusLabel(request)}</span>
                    {request.admin_comment ? <span className="tiny-chip">{request.admin_comment}</span> : null}
                  </div>
                </div>

                <div className="specGrid">
                  <div className="spec">
                    <div className="spec__k">Контакты</div>
                    <div className="spec__v">{request.contacts || "Не указаны"}</div>
                  </div>
                  <div className="spec">
                    <div className="spec__k">Создана</div>
                    <div className="spec__v">{request.created_at ? formatDate(request.created_at) : "—"}</div>
                  </div>
                  <div className="spec">
                    <div className="spec__k">Проверена</div>
                    <div className="spec__v">{request.reviewed_at ? formatDate(request.reviewed_at) : "Ещё нет"}</div>
                  </div>
                  <div className="spec">
                    <div className="spec__k">Состояние доступа</div>
                    <div className="spec__v">{accessRevoked ? "Снят" : isApproved ? "Активен" : "Не выдан"}</div>
                  </div>
                </div>

                <div className="contentCard sellerRequestCard__about">
                  <div className="spec__k">О магазине</div>
                  <div className="spec__v">{request.about || "Описание не добавлено."}</div>
                </div>

                <div className="button-row">
                  <Link to={`/seller/${request.user_id}`} className="ghostBtn">
                    Открыть магазин
                  </Link>
                  <button type="button" className="ghostBtn" onClick={() => void copySlug(request.shop_slug)}>
                    Копировать slug
                  </button>
                  {!isApproved ? (
                    <button type="button" className="linkBtn" onClick={() => void approve(request.id)}>
                      Одобрить
                    </button>
                  ) : null}
                  {!isRejected ? (
                    <button type="button" className="ghostBtn" onClick={() => void reject(request.id)}>
                      Отклонить
                    </button>
                  ) : null}
                  {isApproved && !accessRevoked ? (
                    <button type="button" className="ghostBtn" onClick={() => void revoke(request.id)}>
                      Снять доступ
                    </button>
                  ) : null}
                  {accessRevoked ? (
                    <button type="button" className="linkBtn" onClick={() => void restore(request.id)}>
                      Вернуть доступ
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}

          <div className="admPagination">
            <button
              type="button"
              className="admPageBtn"
              disabled={currentPage <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              ‹
            </button>
            <span className="admPageInfo">
              Страница {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              className="admPageBtn"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            >
              ›
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
