import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

import { AdminNav } from "../components/AdminNav";
import { SelectField } from "../../../components/SelectField";
import { useAuth } from "../../../providers/auth";
import { api } from "../../../services/api";
import type { MarketplaceSection } from "../../../types/api";

const initialForm = {
  title: "",
  slug: "",
  emoji: "",
  icon_url: "",
  sort_order: "10",
  is_active: "1",
};

function isFurnitureSectionName(value?: string | null) {
  return /furniture|мебел/i.test(String(value || ""));
}

export function AdminSectionsPage() {
  const { loading, user } = useAuth();
  const [sections, setSections] = useState<MarketplaceSection[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);

  async function reload() {
    const response = await api.getAdminSections();
    setSections(response.items);
  }

  useEffect(() => {
    if (!user?.is_admin && !user?.is_owner) return;
    void reload();
  }, [user]);

  const filteredSections = useMemo(() => {
    const query = search.trim().toLowerCase();
    const next = sections.filter((section) => {
      if (!query) return true;
      return [section.id, section.title, section.slug, section.emoji].join(" ").toLowerCase().includes(query);
    });

    next.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || a.title.localeCompare(b.title, "ru"));
    return next;
  }, [search, sections]);

  if (!loading && !user) return <Navigate to="/auth" replace />;
  if (!loading && !user?.is_admin && !user?.is_owner) return <Navigate to="/" replace />;

  const furnitureDraft = isFurnitureSectionName(form.title) || isFurnitureSectionName(form.slug);

  function updateTitle(title: string) {
    setForm((current) => ({
      ...current,
      title,
      slug: isFurnitureSectionName(title) && (!current.slug || isFurnitureSectionName(current.slug)) ? "furniture" : current.slug,
    }));
  }

  function makeFurnitureSection() {
    setForm((current) => ({
      ...current,
      title: "Мебель",
      slug: "furniture",
      emoji: current.emoji || "🛋",
      sort_order: current.sort_order || "10",
      is_active: "1",
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");

    const payload = {
      ...form,
      sort_order: Number(form.sort_order || 0),
      is_active: form.is_active === "1",
    };

    try {
      if (editingId) {
        await api.updateAdminSection(editingId, payload);
        setStatus("Раздел обновлён.");
      } else {
        await api.createAdminSection(payload);
        setStatus("Раздел добавлен.");
      }

      setEditingId(null);
      setForm(initialForm);
      await reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось сохранить раздел");
    }
  }

  function startEdit(section: MarketplaceSection) {
    setEditingId(section.id);
    setForm({
      title: section.title || "",
      slug: section.slug || "",
      emoji: section.emoji || "",
      icon_url: section.icon_url || "",
      sort_order: String(section.sort_order || 0),
      is_active: String(Number(Boolean(section.is_active))),
    });
  }

  async function removeSection(id: number) {
    try {
      await api.deleteAdminSection(id);
      await reload();
      setStatus("Раздел удалён.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось удалить раздел");
    }
  }

  async function toggleSection(section: MarketplaceSection) {
    try {
      await api.updateAdminSection(section.id, { is_active: !section.is_active });
      await reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось изменить статус раздела");
    }
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setStatus("");

    try {
      const uploaded = await api.uploadImage(file, "tiles");
      setForm((current) => ({ ...current, icon_url: uploaded.url }));
      setStatus("Иконка раздела загружена.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось загрузить иконку");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  return (
    <div className="container admWrap">
      <header className="admPanelHead">
        <div>
          <div className="admPanelHead__title">Разделы</div>
          <div className="admPanelHead__subtitle">Верхний уровень витрины: разделы ведут к плиткам, а плитки к товарам.</div>
        </div>
        <AdminNav />
      </header>

      <section className="contentCard">
        <div className="order-card__top">
          <div>
            <h1 className="sectionTitle">Разделы маркетплейса</h1>
            <div className="muted">Игры, приложения, будущие категории и другие крупные направления.</div>
          </div>
          <span className="tiny-chip is-active">Найдено: {filteredSections.length}</span>
        </div>

        <form className="profile-form" onSubmit={submit}>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">Название</span>
              <input className="field-input" value={form.title} onChange={(event) => updateTitle(event.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">Slug</span>
              <input className="field-input" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} />
            </label>
            <label className="field">
              <span className="field-label">Emoji</span>
              <input className="field-input" value={form.emoji} onChange={(event) => setForm((current) => ({ ...current, emoji: event.target.value }))} />
            </label>
            <label className="field">
              <span className="field-label">Порядок</span>
              <input className="field-input" value={form.sort_order} onChange={(event) => setForm((current) => ({ ...current, sort_order: event.target.value }))} />
            </label>
          </div>

          {furnitureDraft ? (
            <div className="field-hint">
              Для новой мебельной витрины используем каноничный slug «furniture». Тогда раздел будет вести на /tile/furniture и не смешается со старыми плитками.
            </div>
          ) : (
            <div className="field-hint">
              Для мебельного раздела можно нажать «Настроить как Мебель» - форма сама поставит правильный slug.
            </div>
          )}

          <div className="field">
            <span className="field-label">Иконка раздела</span>
            <div className="uploadBox">
              <div className="button-row">
                <label className="ghostBtn">
                  <input type="file" accept="image/*" hidden disabled={uploading} onChange={onFileChange} />
                  {uploading ? "Загружаю..." : "Выбрать файл"}
                </label>
                <button type="button" className="ghostBtn" onClick={() => setForm((current) => ({ ...current, icon_url: "" }))}>
                  Очистить
                </button>
              </div>
              {form.icon_url ? <img src={form.icon_url} alt="" className="catPreview" /> : null}
            </div>
          </div>

          <label className="field">
            <span className="field-label">Активность</span>
              <SelectField className="field-input" value={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.value }))}>
              <option value="1">Показывать</option>
              <option value="0">Скрыть</option>
              </SelectField>
          </label>

          {status ? <div className="field-hint">{status}</div> : null}

          <div className="button-row">
            <button type="submit" className="linkBtn">{editingId ? "Сохранить раздел" : "Добавить раздел"}</button>
            <button type="button" className="ghostBtn" onClick={makeFurnitureSection}>Настроить как Мебель</button>
            <button type="button" className="ghostBtn" onClick={() => void reload()}>Обновить список</button>
            <button type="button" className="ghostBtn" onClick={() => { setEditingId(null); setForm(initialForm); }}>Сброс</button>
          </div>
        </form>

        <div className="admToolbar admToolbar--searchOnly">
          <label className="field admToolbar__wide">
            <span className="field-label">Поиск</span>
            <input className="field-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ID, название" />
          </label>
        </div>

        <div className="admList">
          {filteredSections.map((section) => (
            <article key={section.id} className="admRow admRow--section">
              <div className="admRow__thumb">
                {section.icon_url ? <img src={section.icon_url} alt={section.title} /> : <span>{section.emoji || "•"}</span>}
              </div>
              <div className="admRow__main">
                <strong>{section.title}</strong>
                <div className="muted">ID: {section.id}</div>
              </div>
              <div>{section.sort_order || 0}</div>
              <div>
                <span className={`tiny-chip ${section.is_active ? "is-active" : ""}`}>{section.is_active ? "Активен" : "Скрыт"}</span>
              </div>
              <div className="button-row">
                <button type="button" className="ghostBtn" onClick={() => void toggleSection(section)}>
                  {section.is_active ? "Скрыть" : "Показать"}
                </button>
                <button type="button" className="ghostBtn" onClick={() => startEdit(section)}>Изменить</button>
                <button type="button" className="ghostBtn" onClick={() => void removeSection(section.id)}>Удалить</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
