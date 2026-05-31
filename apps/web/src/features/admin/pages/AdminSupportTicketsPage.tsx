import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";

import { AdminNav } from "../components/AdminNav";
import { SelectField } from "../../../components/SelectField";
import { useAuth } from "../../../providers/auth";
import { useToast } from "../../../providers/toast";
import { api } from "../../../services/api";
import { getErrorMessage } from "../../../services/errors";
import { formatDateTime } from "../../../services/format";
import type { SupportTicket } from "../../../types/api";

const ticketStatuses = [
  { value: "all", label: "Все статусы" },
  { value: "new", label: "Новые" },
  { value: "in_review", label: "В работе" },
  { value: "resolved", label: "Решены" },
  { value: "closed", label: "Закрыты" },
];

const ticketCategories = [
  { value: "all", label: "Все типы" },
  { value: "site", label: "Ошибка сайта" },
  { value: "order", label: "Заказ" },
  { value: "payment", label: "Оплата" },
  { value: "seller", label: "Продавец" },
  { value: "account", label: "Аккаунт" },
  { value: "other", label: "Другое" },
];

const updateStatuses = [
  { value: "new", label: "Новое" },
  { value: "in_review", label: "В работу" },
  { value: "resolved", label: "Решено" },
  { value: "closed", label: "Закрыто" },
];

const SUPPORT_TICKETS_PER_PAGE = 20;

function categoryLabel(category?: string) {
  return ticketCategories.find((item) => item.value === category)?.label || category || "Другое";
}

function statusLabel(status?: string) {
  switch (status) {
    case "new":
      return "Новое";
    case "in_review":
      return "В работе";
    case "resolved":
      return "Решено";
    case "closed":
      return "Закрыто";
    default:
      return status || "Неизвестно";
  }
}

function ticketTone(ticket: SupportTicket) {
  if (ticket.priority === "high") return "is-danger";
  if (ticket.status === "resolved" || ticket.status === "closed") return "is-active";
  if (ticket.status === "in_review") return "is-warning";
  return "";
}

function getTicketImages(ticket: SupportTicket) {
  if (ticket.image_urls?.length) return ticket.image_urls;

  try {
    const parsed = JSON.parse(ticket.image_urls_json || "[]");
    if (Array.isArray(parsed)) return parsed.map((item) => String(item || "")).filter(Boolean);
  } catch {
    // Keep backward compatibility with older single-image tickets.
  }

  return ticket.image_url ? [ticket.image_url] : [];
}

export function AdminSupportTicketsPage() {
  const { loading, user } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") || "all");
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get("category") || "all");
  const [priorityFilter, setPriorityFilter] = useState(() => searchParams.get("priority") || "all");
  const [ticketsPage, setTicketsPage] = useState(() => {
    const page = Number(searchParams.get("page"));
    return Number.isInteger(page) && page > 0 ? page : 1;
  });
  const [ticketsMeta, setTicketsMeta] = useState({
    total: 0,
    page: 1,
    limit: SUPPORT_TICKETS_PER_PAGE,
    total_pages: 1,
  });
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [openedId, setOpenedId] = useState<number | null>(() => {
    const id = Number(searchParams.get("ticket"));
    return Number.isInteger(id) && id > 0 ? id : null;
  });
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [priorities, setPriorities] = useState<Record<number, string>>({});
  const [attachmentIndex, setAttachmentIndex] = useState(0);
  const [attachmentFullscreen, setAttachmentFullscreen] = useState(false);
  const [attachmentZoom, setAttachmentZoom] = useState(1);
  const deferredQuery = useDeferredValue(query);

  async function loadTickets(pageToLoad = ticketsPage) {
    setTicketsLoading(true);
    try {
      const response = await api.getAdminSupportTickets({
        page: pageToLoad,
        limit: SUPPORT_TICKETS_PER_PAGE,
        status: statusFilter,
        category: categoryFilter,
        priority: priorityFilter,
        q: deferredQuery.trim(),
      });
      setTickets(response.items);
      setTicketsMeta({
        total: response.total,
        page: response.page,
        limit: response.limit,
        total_pages: response.total_pages,
      });
      if (response.page > response.total_pages) {
        setTicketsPage(response.total_pages);
      }
      setNotes((current) => {
        const next = { ...current };
        for (const ticket of response.items) {
          if (next[ticket.id] === undefined) next[ticket.id] = ticket.admin_note || "";
        }
        return next;
      });
      setPriorities((current) => {
        const next = { ...current };
        for (const ticket of response.items) {
          if (next[ticket.id] === undefined) next[ticket.id] = ticket.priority || "normal";
        }
        return next;
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось загрузить обращения поддержки."));
    } finally {
      setTicketsLoading(false);
    }
  }

  useEffect(() => {
    if (!user?.is_admin && !user?.is_owner) return;
    void loadTickets();
  }, [user, ticketsPage, statusFilter, categoryFilter, priorityFilter, deferredQuery]);

  useEffect(() => {
    setStatusFilter(searchParams.get("status") || "all");
    setCategoryFilter(searchParams.get("category") || "all");
    setPriorityFilter(searchParams.get("priority") || "all");
    const page = Number(searchParams.get("page"));
    setTicketsPage(Number.isInteger(page) && page > 0 ? page : 1);
    const id = Number(searchParams.get("ticket"));
    setOpenedId(Number.isInteger(id) && id > 0 ? id : null);
  }, [searchParams]);

  const ticketStats = useMemo(
    () => ({
      new: tickets.filter((ticket) => ticket.status === "new").length,
      inReview: tickets.filter((ticket) => ticket.status === "in_review").length,
      high: tickets.filter((ticket) => ticket.priority === "high").length,
      closed: tickets.filter((ticket) => ticket.status === "closed").length,
    }),
    [tickets],
  );

  const filteredTickets = useMemo(() => {
    const lowered = deferredQuery.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (statusFilter !== "all" && ticket.status !== statusFilter) return false;
      if (categoryFilter !== "all" && ticket.category !== categoryFilter) return false;
      if (priorityFilter !== "all" && ticket.priority !== priorityFilter) return false;
      if (!lowered) return true;

      const text = [
        ticket.id,
        ticket.email,
        ticket.user_name,
        ticket.category,
        ticket.page_url,
        ticket.message,
        ticket.admin_note,
        ticket.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(lowered);
    });
  }, [categoryFilter, deferredQuery, priorityFilter, statusFilter, tickets]);

  async function updateTicket(ticketId: number, status: string) {
    setBusyId(ticketId);
    try {
      await api.updateAdminSupportTicket(ticketId, {
        status,
        priority: priorities[ticketId] || "normal",
        admin_note: notes[ticketId] || "",
      });
      toast.success("Обращение поддержки обновлено.");
      await loadTickets();
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось обновить обращение поддержки."));
    } finally {
      setBusyId(null);
    }
  }

  const selectedTicket = openedId ? filteredTickets.find((ticket) => ticket.id === openedId) || null : null;
  const selectedTicketImages = selectedTicket ? getTicketImages(selectedTicket) : [];
  const activeAttachmentIndex = selectedTicketImages.length ? Math.min(attachmentIndex, selectedTicketImages.length - 1) : 0;
  const activeAttachment = selectedTicketImages[activeAttachmentIndex] || "";

  useEffect(() => {
    setAttachmentIndex(0);
    setAttachmentFullscreen(false);
    setAttachmentZoom(1);
  }, [openedId]);

  useEffect(() => {
    if (!attachmentFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleAttachmentKeys(event: KeyboardEvent) {
      const maxIndex = selectedTicketImages.length - 1;
      const handledKeys = ["Escape", "ArrowLeft", "ArrowRight", "+", "=", "-", "_", "0"];
      if (!handledKeys.includes(event.key)) return;

      event.preventDefault();

      if (event.key === "Escape") {
        setAttachmentFullscreen(false);
        return;
      }

      if (event.key === "ArrowLeft") {
        setAttachmentIndex((current) => Math.max(0, current - 1));
        setAttachmentZoom(1);
        return;
      }

      if (event.key === "ArrowRight") {
        setAttachmentIndex((current) => Math.min(maxIndex, current + 1));
        setAttachmentZoom(1);
        return;
      }

      if (event.key === "+" || event.key === "=") {
        zoomAttachment(0.25);
        return;
      }

      if (event.key === "-" || event.key === "_") {
        zoomAttachment(-0.25);
        return;
      }

      if (event.key === "0") {
        setAttachmentZoom(1);
      }
    }

    window.addEventListener("keydown", handleAttachmentKeys);

    return () => {
      window.removeEventListener("keydown", handleAttachmentKeys);
      document.body.style.overflow = previousOverflow;
    };
  }, [attachmentFullscreen, selectedTicketImages.length]);

  function showPreviousAttachment() {
    setAttachmentIndex((current) => Math.max(0, current - 1));
    setAttachmentZoom(1);
  }

  function showNextAttachment() {
    setAttachmentIndex((current) => Math.min(selectedTicketImages.length - 1, current + 1));
    setAttachmentZoom(1);
  }

  function zoomAttachment(delta: number) {
    setAttachmentZoom((current) => Math.min(3, Math.max(0.75, Number((current + delta).toFixed(2)))));
  }

  if (!loading && !user) return <Navigate to="/auth" replace />;
  if (!loading && !user?.is_admin && !user?.is_owner) return <Navigate to="/" replace />;

  return (
    <div className="container admWrap">
      <header className="admPanelHead">
        <div>
          <div className="admPanelHead__title">Поддержка</div>
          <div className="admPanelHead__subtitle">Тикеты из формы “Сообщить о проблеме”.</div>
        </div>
        <AdminNav />
      </header>

      <section className="contentCard">
        <div className="order-card__top">
          <div>
            <h1 className="sectionTitle">Support tickets</h1>
            <div className="muted">Общие проблемы сайта отдельно от споров и возвратов по заказам.</div>
          </div>
          <span className="tiny-chip is-active">Найдено: {ticketsMeta.total}</span>
        </div>

        <div className="admSupportStats">
          <button
            type="button"
            className={`admSupportStat ${statusFilter === "new" ? "is-selected" : ""}`}
            onClick={() => {
              setTicketsPage(1);
              setStatusFilter((current) => (current === "new" ? "all" : "new"));
            }}
          >
            <span>Новые</span>
            <strong>{ticketStats.new}</strong>
          </button>
          <button
            type="button"
            className={`admSupportStat ${statusFilter === "in_review" ? "is-selected" : ""}`}
            onClick={() => {
              setTicketsPage(1);
              setStatusFilter((current) => (current === "in_review" ? "all" : "in_review"));
            }}
          >
            <span>В работе</span>
            <strong>{ticketStats.inReview}</strong>
          </button>
          <button
            type="button"
            className={`admSupportStat is-danger ${priorityFilter === "high" ? "is-selected" : ""}`}
            onClick={() => {
              setTicketsPage(1);
              setPriorityFilter((current) => (current === "high" ? "all" : "high"));
            }}
          >
            <span>Высокий приоритет</span>
            <strong>{ticketStats.high}</strong>
          </button>
          <button
            type="button"
            className={`admSupportStat ${statusFilter === "closed" || statusFilter === "resolved" ? "is-selected" : ""}`}
            onClick={() => {
              setTicketsPage(1);
              setStatusFilter((current) => (current === "closed" ? "all" : "closed"));
            }}
          >
            <span>Закрытые</span>
            <strong>{ticketStats.closed}</strong>
          </button>
        </div>

        <form className="admToolbar admToolbar--searchOnly" onSubmit={(event) => event.preventDefault()}>
          <label className="field admToolbar__wide">
            <span className="field-label">Поиск</span>
            <input
              className="field-input"
              value={query}
              onChange={(event) => {
                setTicketsPage(1);
                setQuery(event.target.value);
              }}
              placeholder="ID, email, страница, сообщение или заметка"
            />
          </label>
        </form>

        <div className="admToolbar admToolbar--filters">
          <label className="field">
            <span className="field-label">Статус</span>
            <SelectField
              className="field-input"
              value={statusFilter}
              onChange={(event) => {
                setTicketsPage(1);
                setStatusFilter(event.target.value);
              }}
            >
              {ticketStatuses.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </SelectField>
          </label>
          <label className="field">
            <span className="field-label">Тип</span>
            <SelectField
              className="field-input"
              value={categoryFilter}
              onChange={(event) => {
                setTicketsPage(1);
                setCategoryFilter(event.target.value);
              }}
            >
              {ticketCategories.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
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
                setCategoryFilter("all");
                setPriorityFilter("all");
                setTicketsPage(1);
              }}
            >
              Сбросить фильтры
            </button>
          </div>
        </div>

        <div className="admClaimsLayout">
          <div className="stack-list">
            {filteredTickets.map((ticket) => {
              const isOpen = openedId === ticket.id;
              return (
                <article key={ticket.id} className={`order-card admClaimCard ${isOpen ? "is-active" : ""}`}>
                  <button
                    type="button"
                    className="admClaimCard__open"
                    onClick={() => setOpenedId((current) => (current === ticket.id ? null : ticket.id))}
                  >
                    <span className="admRow__thumb">#{ticket.id}</span>
                    <span className="admClaimCard__main">
                      <strong>{categoryLabel(ticket.category)}</strong>
                      <span className="muted">{ticket.email} • {ticket.page_url || "страница не указана"}</span>
                    </span>
                    <span className={`tiny-chip ${ticket.priority === "high" ? "is-danger" : ""}`}>
                      {ticket.priority === "high" ? "Высокий" : "Обычный"}
                    </span>
                    <span className={`tiny-chip ${ticketTone(ticket)}`}>{statusLabel(ticket.status)}</span>
                  </button>
                </article>
              );
            })}

            {!filteredTickets.length ? (
              <section className="empty-panel">
                <h2>Тикетов пока нет</h2>
                <p>Когда пользователь отправит форму “Сообщить о проблеме”, обращение появится здесь.</p>
              </section>
            ) : null}

            {ticketsMeta.total_pages > 1 ? (
              <div className="admPagination">
                <button
                  type="button"
                  className="admPageBtn"
                  onClick={() => setTicketsPage((current) => Math.max(1, current - 1))}
                  disabled={ticketsLoading || ticketsPage <= 1}
                  aria-label="Предыдущая страница обращений"
                >
                  ‹
                </button>
                <span className="admPageInfo">
                  Страница {ticketsPage} из {ticketsMeta.total_pages}
                </span>
                <button
                  type="button"
                  className="admPageBtn"
                  onClick={() => setTicketsPage((current) => Math.min(ticketsMeta.total_pages, current + 1))}
                  disabled={ticketsLoading || ticketsPage >= ticketsMeta.total_pages}
                  aria-label="Следующая страница обращений"
                >
                  ›
                </button>
              </div>
            ) : null}
          </div>

          <aside className="contentCard admClaimPanel">
            {selectedTicket ? (
              <>
                <div className="order-card__top">
                  <div>
                    <h2 className="sectionTitle">Тикет #{selectedTicket.id}</h2>
                    <div className="muted">{formatDateTime(selectedTicket.created_at)}</div>
                  </div>
                  <span className={`tiny-chip ${ticketTone(selectedTicket)}`}>{statusLabel(selectedTicket.status)}</span>
                </div>

                <div className="specGrid">
                  <div className="spec">
                    <div className="spec__k">Тип</div>
                    <div className="spec__v">{categoryLabel(selectedTicket.category)}</div>
                  </div>
                  <div className="spec">
                    <div className="spec__k">Приоритет</div>
                    <div className="spec__v">{selectedTicket.priority === "high" ? "Высокий" : "Обычный"}</div>
                  </div>
                  <div className="spec">
                    <div className="spec__k">Пользователь</div>
                    <div className="spec__v">{selectedTicket.user_name || "Без аккаунта"}</div>
                  </div>
                  <div className="spec">
                    <div className="spec__k">Email</div>
                    <div className="spec__v">{selectedTicket.email}</div>
                  </div>
                </div>

                <div className="stack-list">
                  <div className="contentCard">
                    <div className="field-label">Страница или раздел</div>
                    <strong>{selectedTicket.page_url || "Не указано"}</strong>
                  </div>

                  <div className="contentCard admSupportMessage">
                    <div className="field-label">Сообщение пользователя</div>
                    <strong>{selectedTicket.message}</strong>
                  </div>

                  {selectedTicketImages.length ? (
                    <div className="contentCard admSupportAttachment">
                      <div className="field-label">Вложения</div>
                      <div className="admAttachmentBook">
                        <div className="admAttachmentBook__stage">
                          <img src={activeAttachment} alt={`Вложение ${activeAttachmentIndex + 1} тикета #${selectedTicket.id}`} />
                        </div>
                        <div className="admAttachmentBook__controls">
                          <button type="button" className="ghostBtn" onClick={showPreviousAttachment} disabled={activeAttachmentIndex === 0}>
                            Назад
                          </button>
                          <span>
                            {activeAttachmentIndex + 1} / {selectedTicketImages.length}
                          </span>
                          <button type="button" className="ghostBtn" onClick={showNextAttachment} disabled={activeAttachmentIndex >= selectedTicketImages.length - 1}>
                            Вперёд
                          </button>
                          <button
                            type="button"
                            className="linkBtn"
                            onClick={() => {
                              setAttachmentZoom(1);
                              setAttachmentFullscreen(true);
                            }}
                          >
                            На весь экран
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <label className="field">
                  <span className="field-label">Приоритет</span>
                  <SelectField
                    className="field-input"
                    value={priorities[selectedTicket.id] || selectedTicket.priority || "normal"}
                    onChange={(event) => setPriorities((current) => ({ ...current, [selectedTicket.id]: event.target.value }))}
                  >
                    <option value="normal">Обычный</option>
                    <option value="high">Высокий</option>
                  </SelectField>
                </label>

                <label className="field">
                  <span className="field-label">Заметка админа</span>
                  <textarea
                    className="field-input field-input--area"
                    value={notes[selectedTicket.id] || ""}
                    onChange={(event) => setNotes((current) => ({ ...current, [selectedTicket.id]: event.target.value }))}
                    placeholder="Что проверили, что нужно сделать, итог решения..."
                  />
                </label>

                <div className="button-row">
                  {updateStatuses.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className="ghostBtn"
                      disabled={busyId === selectedTicket.id}
                      onClick={() => void updateTicket(selectedTicket.id, item.value)}
                    >
                      {busyId === selectedTicket.id ? "Сохраняем..." : item.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-panel">
                <h2>Выбери тикет</h2>
                <p>Справа появятся детали обращения, приоритет, заметка администратора и кнопки статуса.</p>
              </div>
            )}
          </aside>
        </div>
      </section>

      {attachmentFullscreen && activeAttachment ? (
        <div className="admAttachmentOverlay" role="dialog" aria-modal="true">
          <div className="admAttachmentOverlay__top">
            <strong>
              Вложение {activeAttachmentIndex + 1} / {selectedTicketImages.length}
            </strong>
            <div className="admAttachmentOverlay__actions">
              <button type="button" className="ghostBtn" onClick={() => zoomAttachment(-0.25)} disabled={attachmentZoom <= 0.75}>
                -
              </button>
              <span>{Math.round(attachmentZoom * 100)}%</span>
              <button type="button" className="ghostBtn" onClick={() => zoomAttachment(0.25)} disabled={attachmentZoom >= 3}>
                +
              </button>
              <button type="button" className="ghostBtn" onClick={() => setAttachmentZoom(1)}>
                100%
              </button>
              <button type="button" className="linkBtn" onClick={() => setAttachmentFullscreen(false)}>
                Закрыть
              </button>
            </div>
          </div>
          <button
            type="button"
            className="admAttachmentOverlay__nav admAttachmentOverlay__nav--prev"
            onClick={showPreviousAttachment}
            disabled={activeAttachmentIndex === 0}
            aria-label="Предыдущее вложение"
          >
            ‹
          </button>
          <div className="admAttachmentOverlay__stage">
            <img
              src={activeAttachment}
              alt={`Вложение ${activeAttachmentIndex + 1}`}
              style={{ transform: `scale(${attachmentZoom})` }}
            />
          </div>
          <button
            type="button"
            className="admAttachmentOverlay__nav admAttachmentOverlay__nav--next"
            onClick={showNextAttachment}
            disabled={activeAttachmentIndex >= selectedTicketImages.length - 1}
            aria-label="Следующее вложение"
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  );
}
