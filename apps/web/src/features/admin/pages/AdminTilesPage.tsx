import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

import { AdminNav } from "../components/AdminNav";
import { SelectField } from "../../../components/SelectField";
import { useAuth } from "../../../providers/auth";
import { api } from "../../../services/api";
import type { MarketplaceSection, Tile } from "../../../types/api";

const initialForm = {
  section: "Игры",
  title: "",
  slug: "",
  emoji: "",
  icon_url: "",
  sort_order: "10",
  is_active: "1",
};

const PAGE_SIZE = 10;

function isFurnitureSectionName(value?: string | null) {
  return /furniture|мебел/i.test(String(value || ""));
}

export function AdminTilesPage() {
  const { loading, user } = useAuth();
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [sections, setSections] = useState<MarketplaceSection[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterActive, setFilterActive] = useState("");
  const [sortView, setSortView] = useState("section");
  const [page, setPage] = useState(1);
  const [iconName, setIconName] = useState("Иконка не выбрана");
  const [iconUploading, setIconUploading] = useState(false);
  const [form, setForm] = useState(initialForm);

  const sectionTitles = useMemo(
    () => (sections.length ? sections.map((section) => section.title) : ["Игры", "Мобильные игры", "Приложения"]),
    [sections],
  );

  async function reload() {
    const [tilesResponse, sectionsResponse] = await Promise.all([api.getAdminCategories(), api.getAdminSections()]);
    setTiles(tilesResponse.items);
    setSections(sectionsResponse.items);
  }

  useEffect(() => {
    if (!user?.is_admin && !user?.is_owner) return;
    void reload();
  }, [user]);

  const filteredTiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    const next = tiles.filter((tile) => {
      if (filterSection && (tile.section || "") !== filterSection) return false;
      if (filterActive !== "" && String(Number(Boolean(tile.is_active))) !== filterActive) return false;
      if (!query) return true;

      const haystack = [tile.id, tile.title, tile.slug, tile.section, tile.emoji].join(" ").toLowerCase();
      return haystack.includes(query);
    });

    next.sort((a, b) => {
      if (sortView === "sort") return Number(a.sort_order || 0) - Number(b.sort_order || 0);
      if (sortView === "title") return (a.title || "").localeCompare(b.title || "", "ru");
      if (sortView === "new") return b.id - a.id;
      if (sortView === "old") return a.id - b.id;
      return `${a.section || ""}-${a.sort_order || 0}`.localeCompare(`${b.section || ""}-${b.sort_order || 0}`, "ru");
    });

    return next;
  }, [tiles, search, filterSection, filterActive, sortView]);

  useEffect(() => {
    setPage(1);
  }, [search, filterSection, filterActive, sortView]);

  const totalPages = Math.max(1, Math.ceil(filteredTiles.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const furnitureTileDraft = isFurnitureSectionName(form.section);
  const paginatedTiles = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTiles.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredTiles]);

  if (!loading && !user) return <Navigate to="/auth" replace />;
  if (!loading && !user?.is_admin && !user?.is_owner) return <Navigate to="/" replace />;

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
        await api.updateAdminCategory(editingId, payload);
        setStatus("Плитка обновлена.");
      } else {
        await api.createAdminCategory(payload);
        setStatus("Плитка добавлена.");
      }

      clearEditor();
      await reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось сохранить плитку");
    }
  }

  function clearEditor() {
    setEditingId(null);
    setForm({ ...initialForm, section: sectionTitles[0] || "Игры" });
    setIconName("Иконка не выбрана");
  }

  function startEdit(tile: Tile) {
    setEditingId(tile.id);
    setForm({
      section: tile.section || sectionTitles[0] || "Игры",
      title: tile.title || "",
      slug: tile.slug || "",
      emoji: tile.emoji || "",
      icon_url: tile.icon_url || "",
      sort_order: String(tile.sort_order || 0),
      is_active: String(Number(Boolean(tile.is_active))),
    });
    setIconName(tile.icon_url ? "Иконка загружена" : "Иконка не выбрана");
  }

  async function removeTile(id: number) {
    try {
      await api.deleteAdminCategory(id);
      await reload();
      setStatus("Плитка удалена.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось удалить плитку");
    }
  }

  async function toggleVisibility(tile: Tile) {
    try {
      await api.updateAdminCategory(tile.id, { is_active: !tile.is_active });
      await reload();
      setStatus(tile.is_active ? "Плитка скрыта." : "Плитка снова показывается.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось изменить статус плитки");
    }
  }

  function resetFilters() {
    setSearch("");
    setFilterSection("");
    setFilterActive("");
    setSortView("section");
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIconUploading(true);
    setStatus("");

    try {
      const uploaded = await api.uploadImage(file, "tiles");
      setForm((current) => ({ ...current, icon_url: uploaded.url }));
      setIconName(file.name);
      setStatus("Иконка загружена.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось загрузить иконку");
    } finally {
      setIconUploading(false);
      event.target.value = "";
    }
  }

  return (
    <div className="container admWrap">
      <header className="admPanelHead">
        <div>
          <div className="admPanelHead__title">Плитки</div>
          <div className="admPanelHead__subtitle">Создавай, редактируй и упорядочивай плитки каталога.</div>
        </div>
        <AdminNav />
      </header>

      <section className="contentCard">
        <div className="order-card__top">
          <div>
            <h1 className="sectionTitle">Плитки каталога</h1>
            <div className="muted">Настройка витрин внутри разделов и быстрых переходов к товарам.</div>
          </div>
          <span className="tiny-chip is-active">Доступ: администратор</span>
        </div>

        <form className="profile-form" onSubmit={submit}>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">Раздел</span>
              <SelectField className="field-input" value={form.section} onChange={(e) => setForm((current) => ({ ...current, section: e.target.value }))}>
                {sectionTitles.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </SelectField>
            </label>

            {furnitureTileDraft ? (
              <div className="field">
                <span className="field-label">Подсказка по мебели</span>
                <div className="field-hint">
                  Новая мебельная витрина уже работает через /tile/furniture и категории товаров: Диваны, Столы, Стулья, Шкафы, Кровати, Комоды. Старые плитки внутри раздела «Мебель» лучше создавать только если нужен отдельный нестандартный вход.
                </div>
              </div>
            ) : null}

            <label className="field">
              <span className="field-label">Название плитки</span>
              <input className="field-input" value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} placeholder="Steam" />
            </label>

            <label className="field">
              <span className="field-label">Slug</span>
              <input className="field-input" value={form.slug} onChange={(e) => setForm((current) => ({ ...current, slug: e.target.value }))} placeholder="steam" />
            </label>

            <label className="field">
              <span className="field-label">Emoji</span>
              <input className="field-input" value={form.emoji} onChange={(e) => setForm((current) => ({ ...current, emoji: e.target.value }))} placeholder="🎮" />
            </label>
          </div>

          <div className="field">
            <span className="field-label">Иконка плитки</span>
            <div className="uploadBox">
              <div className="muted">Перетащи файл сюда или нажми «Выбрать файл».</div>
              <div className="button-row" style={{ marginTop: 10 }}>
                <label className="ghostBtn">
                  <input type="file" accept="image/*" hidden disabled={iconUploading} onChange={onFileChange} />
                  Выбрать файл
                </label>
                <button
                  type="button"
                  className="ghostBtn"
                  onClick={() => {
                    setForm((current) => ({ ...current, icon_url: "" }));
                    setIconName("Иконка не выбрана");
                  }}
                >
                  Удалить иконку
                </button>
                <div className="muted">{iconName}</div>
              </div>
              {form.icon_url ? <img src={form.icon_url} alt="" className="catPreview" /> : null}
            </div>
          </div>

          <div className="form-grid">
            <label className="field">
              <span className="field-label">Порядок</span>
              <input className="field-input" value={form.sort_order} onChange={(e) => setForm((current) => ({ ...current, sort_order: e.target.value }))} />
            </label>

            <label className="field">
              <span className="field-label">Статус</span>
              <SelectField className="field-input" value={form.is_active} onChange={(e) => setForm((current) => ({ ...current, is_active: e.target.value }))}>
                <option value="1">Активна</option>
                <option value="0">Скрыта</option>
              </SelectField>
            </label>
          </div>

          {status ? <div className="field-hint">{status}</div> : null}

          <div className="button-row">
            <button type="submit" className="linkBtn">
              {editingId ? "Сохранить плитку" : "Добавить плитку"}
            </button>
            <button type="button" className="ghostBtn" onClick={() => void reload()}>
              Обновить список
            </button>
            <button type="button" className="ghostBtn" onClick={clearEditor}>
              {editingId ? "Отмена" : "Сбросить"}
            </button>
          </div>
        </form>

        <div className="admToolbar admToolbar--searchOnly">
          <label className="field admToolbar__wide">
            <span className="field-label">Поиск</span>
            <input className="field-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ID, название, slug, раздел" />
          </label>
        </div>

        <div className="admToolbar admToolbar--filters">
          <label className="field">
            <span className="field-label">Раздел</span>
            <SelectField className="field-input" value={filterSection} onChange={(e) => setFilterSection(e.target.value)} placeholder="Все разделы">
              {sectionTitles.map((section) => (
                <option key={section} value={section}>
                  {section}
                </option>
              ))}
            </SelectField>
          </label>

          <label className="field">
            <span className="field-label">Статус</span>
            <SelectField className="field-input" value={filterActive} onChange={(e) => setFilterActive(e.target.value)} placeholder="Все плитки">
              <option value="1">Только активные</option>
              <option value="0">Только скрытые</option>
            </SelectField>
          </label>

          <label className="field">
            <span className="field-label">Сортировка</span>
            <SelectField className="field-input" value={sortView} onChange={(e) => setSortView(e.target.value)}>
              <option value="section">По разделу</option>
              <option value="sort">По порядку</option>
              <option value="title">По названию</option>
              <option value="new">Сначала новые</option>
              <option value="old">Сначала старые</option>
            </SelectField>
          </label>

          <div className="field admToolbar__action">
            <button type="button" className="ghostBtn ghostBtn--wide" onClick={resetFilters}>
              Сбросить фильтры
            </button>
          </div>
        </div>

        <div className="muted">Найдено плиток: {filteredTiles.length}</div>

        <div className="admList">
          {paginatedTiles.map((tile) => (
            <article key={tile.id} className="admRow admRow--tile">
              <div className="admRow__thumb">
                {tile.icon_url ? <img src={tile.icon_url} alt={tile.title} /> : <span>{tile.emoji || "🎮"}</span>}
              </div>
              <div className="admRow__main">
                <strong>{tile.title}</strong>
                <div className="muted">ID: {tile.id} • {tile.emoji || "без emoji"}</div>
              </div>
              <div>{tile.section}</div>
              <div>{tile.slug}</div>
              <div>{tile.sort_order || 0}</div>
              <div>
                <span className={`tiny-chip ${tile.is_active ? "is-active" : ""}`}>{tile.is_active ? "Активна" : "Скрыта"}</span>
              </div>
              <div className="button-row">
                <button type="button" className="ghostBtn" onClick={() => void toggleVisibility(tile)}>
                  {tile.is_active ? "Скрыть" : "Показать"}
                </button>
                <button type="button" className="ghostBtn" onClick={() => startEdit(tile)}>
                  Изменить
                </button>
                <button type="button" className="ghostBtn" onClick={() => void removeTile(tile.id)}>
                  Удалить
                </button>
              </div>
            </article>
          ))}
        </div>

        {totalPages > 1 ? (
          <div className="admPagination">
            <button type="button" className="admPageBtn" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1}>
              ←
            </button>
            <div className="admPageInfo">
              {currentPage} / {totalPages}
            </div>
            <button type="button" className="admPageBtn" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages}>
              →
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
