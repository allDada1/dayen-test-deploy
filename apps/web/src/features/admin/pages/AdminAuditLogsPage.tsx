import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

import { AdminNav } from "../components/AdminNav";
import { SelectField } from "../../../components/SelectField";
import { useAuth } from "../../../providers/auth";
import { api } from "../../../services/api";
import { formatDate } from "../../../services/format";
import type { AdminAuditLog } from "../../../types/api";

function actorLabel(item: AdminAuditLog) {
  if (item.actor_name) return item.actor_name;
  if (item.actor_user_id) return `ID ${item.actor_user_id}`;
  return "system";
}

function targetLabel(item: AdminAuditLog) {
  if (item.target_name) return item.target_name;
  if (item.target_user_id) return `ID ${item.target_user_id}`;
  return item.entity_id || "без ID";
}

export function AdminAuditLogsPage() {
  const { loading, user } = useAuth();
  const [items, setItems] = useState<AdminAuditLog[]>([]);
  const [status, setStatus] = useState("");
  const [filters, setFilters] = useState({ q: "", entity: "all" });

  useEffect(() => {
    if (!user?.is_owner) return;
    api.getAdminActionLogs()
      .then((response) => setItems(response.items || []))
      .catch((error) => setStatus(error instanceof Error ? error.message : "Не удалось загрузить журнал"));
  }, [user]);

  const entities = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.entity_type).filter(Boolean))).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = filters.q.trim().toLowerCase();

    return items.filter((item) => {
      if (filters.entity !== "all" && item.entity_type !== filters.entity) return false;
      if (!query) return true;

      const haystack = [
        item.action,
        item.entity_type,
        item.entity_id,
        item.summary,
        item.actor_name,
        item.target_name,
        item.ip_address,
        JSON.stringify(item.metadata || {}),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [filters, items]);

  if (!loading && !user) return <Navigate to="/auth" replace />;
  if (!loading && !user?.is_owner) return <Navigate to="/admin" replace />;

  return (
    <div className="container admWrap">
      <header className="admPanelHead">
        <div>
          <div className="admPanelHead__title">Админ панель - Журнал действий</div>
          <div className="admPanelHead__subtitle">Кто, что и когда изменил в системе.</div>
        </div>
        <AdminNav />
      </header>

      <section className="contentCard">
        <div className="order-card__top">
          <div>
            <h1 className="sectionTitle">Журнал действий</h1>
            <div className="muted">Owner-only журнал: роли, модерация, товары, разделы, заявки, обращения и действия админов.</div>
          </div>
          <span className="tiny-chip is-active">Записей: {filteredItems.length} / {items.length}</span>
        </div>

        {status ? <div className="field-error">{status}</div> : null}

        <div className="admToolbar admToolbar--filters">
          <label className="field admToolbar__wide">
            <span className="field-label">Поиск</span>
            <input
              className="field-input"
              value={filters.q}
              onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
              placeholder="Действие, админ, объект, IP"
            />
          </label>
          <label className="field">
            <span className="field-label">Объект</span>
            <SelectField className="field-input" value={filters.entity} onChange={(event) => setFilters((current) => ({ ...current, entity: event.target.value }))}>
              <option value="all">Все объекты</option>
              {entities.map((entity) => (
                <option key={entity} value={entity}>{entity}</option>
              ))}
            </SelectField>
          </label>
          <div className="field admToolbar__action">
            <button type="button" className="ghostBtn ghostBtn--wide" onClick={() => setFilters({ q: "", entity: "all" })}>Сбросить</button>
          </div>
        </div>

        <div className="stack-list">
          {filteredItems.map((item) => (
            <article key={item.id} className="order-card">
              <div className="order-card__top">
                <div>
                  <strong>{item.summary || item.action}</strong>
                  <div className="muted">{item.action} - {item.entity_type}</div>
                </div>
                <span className="tiny-chip">{formatDate(item.created_at)}</span>
              </div>
              <div className="specGrid">
                <div className="spec">
                  <div className="spec__k">Админ</div>
                  <div className="spec__v">{actorLabel(item)}</div>
                </div>
                <div className="spec">
                  <div className="spec__k">Объект</div>
                  <div className="spec__v">{targetLabel(item)}</div>
                </div>
                <div className="spec">
                  <div className="spec__k">ID объекта</div>
                  <div className="spec__v">{item.entity_id || "нет"}</div>
                </div>
                <div className="spec">
                  <div className="spec__k">IP</div>
                  <div className="spec__v">{item.ip_address || "нет"}</div>
                </div>
                <div className="spec">
                  <div className="spec__k">Устройство</div>
                  <div className="spec__v">{item.user_agent || "нет"}</div>
                </div>
              </div>
              {item.metadata && Object.keys(item.metadata).length ? (
                <details className="admAuditMeta">
                  <summary>Технические данные действия</summary>
                  <pre>{JSON.stringify(item.metadata, null, 2)}</pre>
                </details>
              ) : null}
            </article>
          ))}
          {!filteredItems.length && !status ? (
            <div className="empty-panel">
              <h2>{items.length ? "По фильтрам ничего не найдено" : "Журнал пока пустой"}</h2>
              <p>{items.length ? "Измените поиск или сбросьте фильтры." : "Новые админские изменения появятся здесь автоматически."}</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
