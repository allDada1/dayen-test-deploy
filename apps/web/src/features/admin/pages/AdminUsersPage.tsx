import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

import { AdminNav } from "../components/AdminNav";
import { SelectField } from "../../../components/SelectField";
import { useAuth } from "../../../providers/auth";
import { api } from "../../../services/api";
import { formatDate } from "../../../services/format";
import type { AdminModerationAction, AdminModerationUser } from "../../../types/api";

function statusLabel(user: AdminModerationUser) {
  if (user.status === "banned") return "Бан";
  if (user.status === "temporarily_banned") return "Временный бан";
  return "Активен";
}

function roleLabel(user: AdminModerationUser) {
  if (user.is_owner) return "Владелец";
  if (user.is_admin) return "Админ";
  if (user.is_seller) return "Seller";
  return "Покупатель";
}

export function AdminUsersPage() {
  const { loading, user } = useAuth();
  const [users, setUsers] = useState<AdminModerationUser[]>([]);
  const [selected, setSelected] = useState<AdminModerationUser | null>(null);
  const [audit, setAudit] = useState<AdminModerationAction[]>([]);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ q: "", status: "all", role: "all" });
  const [reason, setReason] = useState("");
  const [banUntil, setBanUntil] = useState("");
  const [profileForm, setProfileForm] = useState({ name: "", nickname: "", avatar_url: "" });

  async function loadUsers(nextPage = page) {
    const response = await api.getAdminUsers({
      page: nextPage,
      limit: 12,
      q: filters.q,
      status: filters.status,
      role: filters.role,
    });
    setUsers(response.users);
    setPage(response.page);
    setTotalPages(response.total_pages);
    setTotal(response.total);

    if (selected && !response.users.some((item) => item.id === selected.id)) {
      setSelected(null);
      setAudit([]);
    }
  }

  async function openUser(nextUser: AdminModerationUser) {
    const response = await api.getAdminUser(nextUser.id);
    setSelected(response.user);
    setAudit(response.audit);
    setProfileForm({
      name: response.user.name || "",
      nickname: response.user.nickname || "",
      avatar_url: response.user.avatar_url || "",
    });
  }

  useEffect(() => {
    if (!user?.is_admin && !user?.is_owner) return;
    void loadUsers(1);
  }, [user, filters.status, filters.role]);

  const canModerateSelected = useMemo(() => {
    if (!selected || !user) return false;
    if (selected.id === user.id || selected.is_owner) return false;
    return !selected.is_admin || !!user.is_owner;
  }, [selected, user]);

  const canManageAdminRole = useMemo(() => {
    if (!selected || !user?.is_owner) return false;
    return selected.id !== user.id && !selected.is_owner;
  }, [selected, user]);

  if (!loading && !user) return <Navigate to="/auth" replace />;
  if (!loading && !user?.is_admin && !user?.is_owner) return <Navigate to="/" replace />;

  async function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    await loadUsers(1);
  }

  function resetFilters() {
    setFilters({ q: "", status: "all", role: "all" });
    setPage(1);
  }

  async function runAction(action: "warn" | "tempBan" | "ban" | "unban") {
    if (!selected) return;
    if (!reason.trim()) {
      setStatus("Укажи причину действия.");
      return;
    }

    setStatus("");
    try {
      if (action === "warn") {
        await api.warnAdminUser(selected.id, reason);
      } else if (action === "tempBan") {
        await api.banAdminUser(selected.id, { reason, banned_until: banUntil });
      } else if (action === "ban") {
        await api.banAdminUser(selected.id, { reason });
      } else {
        await api.unbanAdminUser(selected.id, reason);
      }

      const updated = await api.getAdminUser(selected.id);
      setSelected(updated.user);
      setAudit(updated.audit);
      setReason("");
      setBanUntil("");
      await loadUsers(page);
      setStatus("Действие сохранено и записано в журнал.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось выполнить действие");
    }
  }

  async function runRoleAction(nextAdminValue: boolean) {
    if (!selected) return;
    if (!reason.trim()) {
      setStatus("Укажи причину изменения роли.");
      return;
    }

    setStatus("");
    try {
      if (nextAdminValue) {
        await api.grantAdminUser(selected.id, reason);
      } else {
        await api.revokeAdminUser(selected.id, reason);
      }
      const updated = await api.getAdminUser(selected.id);
      setSelected(updated.user);
      setAudit(updated.audit);
      setReason("");
      await loadUsers(page);
      setStatus(nextAdminValue ? "Роль администратора выдана." : "Роль администратора снята.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось изменить роль");
    }
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    if (!reason.trim()) {
      setStatus("Укажи причину изменения профиля.");
      return;
    }

    try {
      await api.updateAdminUserProfile(selected.id, {
        name: profileForm.name,
        nickname: profileForm.nickname,
        avatar_url: profileForm.avatar_url,
        reason,
      });
      const updated = await api.getAdminUser(selected.id);
      setSelected(updated.user);
      setAudit(updated.audit);
      setReason("");
      await loadUsers(page);
      setStatus("Профиль пользователя обновлён.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось обновить профиль");
    }
  }

  return (
    <div className="container admWrap">
      <header className="admPanelHead">
        <div>
          <div className="admPanelHead__title">Админ панель — Пользователи</div>
          <div className="admPanelHead__subtitle">Контроль аккаунтов, банов, предупреждений и журнала действий.</div>
        </div>
        <AdminNav />
      </header>

      <section className="contentCard">
        <div className="order-card__top">
          <div>
            <h1 className="sectionTitle">Пользователи</h1>
            <div className="muted">Поиск, фильтры, модерация и прозрачный audit log.</div>
          </div>
          <span className="tiny-chip is-active">Найдено: {total}</span>
        </div>

        {status ? <div className="field-hint">{status}</div> : null}

        <form className="admToolbar admToolbar--searchOnly" onSubmit={submitFilters}>
          <label className="field admToolbar__wide">
            <span className="field-label">Поиск</span>
            <input
              className="field-input"
              value={filters.q}
              onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
              placeholder="ID, email, имя, ник"
            />
          </label>
        </form>

        <div className="admToolbar admToolbar--filters">
          <label className="field">
            <span className="field-label">Статус</span>
            <SelectField className="field-input" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="all">Все статусы</option>
              <option value="active">Активные</option>
              <option value="temporarily_banned">Временный бан</option>
              <option value="banned">Бан</option>
            </SelectField>
          </label>
          <label className="field">
            <span className="field-label">Роль</span>
            <SelectField className="field-input" value={filters.role} onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value }))}>
              <option value="all">Все роли</option>
              <option value="buyer">Покупатели</option>
              <option value="seller">Seller</option>
              <option value="admin">Админы</option>
              <option value="owner">Владельцы</option>
            </SelectField>
          </label>
          <div className="field admToolbar__action">
            <button type="button" className="ghostBtn ghostBtn--wide" onClick={() => void loadUsers(1)}>Найти</button>
          </div>
          <div className="field admToolbar__action">
            <button type="button" className="ghostBtn ghostBtn--wide" onClick={resetFilters}>Сбросить</button>
          </div>
        </div>

        <div className="admUsersLayout">
          <div className="stack-list">
            {users.map((item) => (
              <article key={item.id} className={`order-card admUserCard ${selected?.id === item.id ? "is-active" : ""}`}>
                <button type="button" className="admUserCard__open" onClick={() => void openUser(item)}>
                  <span className="admRow__thumb">
                    {item.avatar_url ? <img src={item.avatar_url} alt={item.name} /> : item.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="admUserCard__main">
                    <strong>#{item.id} {item.name}</strong>
                    <span className="muted">{item.email} · @{item.nickname || "без ника"}</span>
                  </span>
                  <span className="tiny-chip">{roleLabel(item)}</span>
                  <span className={`tiny-chip ${item.status === "active" ? "is-active" : ""}`}>{statusLabel(item)}</span>
                  <span className="tiny-chip">⚠ {item.warning_count}</span>
                </button>
              </article>
            ))}

            <div className="admPagination">
              <button type="button" className="admPageBtn" disabled={page <= 1} onClick={() => void loadUsers(page - 1)}>‹</button>
              <span className="admPageInfo">Страница {page} / {totalPages}</span>
              <button type="button" className="admPageBtn" disabled={page >= totalPages} onClick={() => void loadUsers(page + 1)}>›</button>
            </div>
          </div>

          <aside className="contentCard admUserPanel">
            {selected ? (
              <>
                <div>
                  <h2 className="sectionTitle">{selected.name}</h2>
                  <div className="muted">{selected.email}</div>
                </div>

                <div className="specGrid">
                  <div className="spec">
                    <div className="spec__k">Роль</div>
                    <div className="spec__v">{roleLabel(selected)}</div>
                  </div>
                  <div className="spec">
                    <div className="spec__k">Статус</div>
                    <div className="spec__v">{statusLabel(selected)}</div>
                  </div>
                  <div className="spec">
                    <div className="spec__k">Товаров</div>
                    <div className="spec__v">{selected.products_count || 0}</div>
                  </div>
                  <div className="spec">
                    <div className="spec__k">Заказов</div>
                    <div className="spec__v">{selected.orders_count || 0}</div>
                  </div>
                </div>

                {selected.banned_until ? <div className="field-hint">Бан до: {formatDate(selected.banned_until)}</div> : null}
                {user?.is_owner ? (
                  <div className="field-hint">
                    Owner-доступ: выдача и снятие роли администратора требуют включенный 2FA и записываются в журнал действий.
                  </div>
                ) : null}
                {!canModerateSelected ? <div className="field-error">Владельца, самого себя или чужого админа без роли владельца модерировать нельзя.</div> : null}

                <label className="field">
                  <span className="field-label">Причина действия</span>
                  <textarea className="field-input field-input--area" value={reason} onChange={(event) => setReason(event.target.value)} />
                </label>

                <label className="field">
                  <span className="field-label">Временный бан до</span>
                  <input className="field-input" type="datetime-local" value={banUntil} onChange={(event) => setBanUntil(event.target.value)} />
                </label>

                <div className="button-row">
                  <button type="button" className="ghostBtn" disabled={!canModerateSelected} onClick={() => void runAction("warn")}>Предупредить</button>
                  <button type="button" className="ghostBtn" disabled={!canModerateSelected || !banUntil} onClick={() => void runAction("tempBan")}>Временный бан</button>
                  <button type="button" className="ghostBtn" disabled={!canModerateSelected} onClick={() => void runAction("ban")}>Бан</button>
                  <button type="button" className="linkBtn" disabled={!canModerateSelected} onClick={() => void runAction("unban")}>Разбан</button>
                </div>

                {user?.is_owner ? (
                  <div className="button-row">
                    <button type="button" className="ghostBtn" disabled={!canManageAdminRole || selected.is_admin} onClick={() => void runRoleAction(true)}>Выдать админа</button>
                    <button type="button" className="linkBtn" disabled={!canManageAdminRole || !selected.is_admin} onClick={() => void runRoleAction(false)}>Снять админа</button>
                  </div>
                ) : null}

                <form className="profile-form" onSubmit={submitProfile}>
                  <label className="field">
                    <span className="field-label">Имя</span>
                    <input className="field-input" value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span className="field-label">Ник</span>
                    <input className="field-input" value={profileForm.nickname} onChange={(event) => setProfileForm((current) => ({ ...current, nickname: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span className="field-label">Аватар URL</span>
                    <input className="field-input" value={profileForm.avatar_url} onChange={(event) => setProfileForm((current) => ({ ...current, avatar_url: event.target.value }))} />
                  </label>
                  <button type="submit" className="linkBtn" disabled={!canModerateSelected}>Сохранить профиль</button>
                </form>

                <div className="stack-list">
                  <h3 className="sectionTitle">Журнал пользователя</h3>
                  {audit.map((item) => (
                    <article key={item.id} className="order-card">
                      <div className="order-card__top">
                        <strong>{item.action}</strong>
                        <span className="tiny-chip">{formatDate(item.created_at)}</span>
                      </div>
                      <div className="muted">Админ: {item.actor_name || item.actor_user_id || "system"}</div>
                      <div>{item.reason}</div>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-panel">
                <h2>Выбери пользователя</h2>
                <p>Справа появятся действия модерации и журнал.</p>
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
