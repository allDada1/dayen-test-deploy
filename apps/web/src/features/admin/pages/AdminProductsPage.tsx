import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

import { AdminNav } from "../components/AdminNav";
import { SelectField } from "../../../components/SelectField";
import { useAuth } from "../../../providers/auth";
import { api } from "../../../services/api";
import { formatPrice } from "../../../services/format";
import type { MarketplaceSection, Product, Tile } from "../../../types/api";

type SpecRow = { key: string; value: string };

const SECTION_GAMES = "Игры";
const SECTION_FURNITURE = "Мебель";
const SECTION_BEAUTY = "Красота и здоровье";
const FURNITURE_TILE_SLUG = "furniture";
const BEAUTY_TILE_SLUG = "beauty-health";

const FURNITURE_CATEGORIES = [
  { title: "Диваны", slug: "sofas", hint: "диваны, угловые диваны, диваны-кровати", keywords: ["диван", "sofa"] },
  { title: "Столы", slug: "tables", hint: "обеденные, письменные и журнальные столы", keywords: ["стол", "table"] },
  { title: "Стулья", slug: "chairs", hint: "стулья и кресла", keywords: ["стул", "стуль", "кресл", "chair", "armchair"] },
  { title: "Шкафы", slug: "wardrobes", hint: "шкафы и системы хранения", keywords: ["шкаф", "wardrobe"] },
  { title: "Кровати", slug: "beds", hint: "кровати и спальные решения", keywords: ["кровать", "кроват", "bed"] },
  { title: "Комоды", slug: "dressers", hint: "комоды и тумбы", keywords: ["комод", "dresser"] },
];

const FURNITURE_SPEC_FIELDS = [
  { key: "Цвет", placeholder: "Например: серый, бежевый, оливковый" },
  { key: "Материал обивки", placeholder: "Например: рогожка, велюр, экокожа" },
  { key: "Старая цена", placeholder: "Например: 600000" },
  { key: "Сторона угла", placeholder: "Левый угол / Правый угол" },
  { key: "Размеры", placeholder: "Например: 280 x 160 x 90 см" },
];

const BEAUTY_CATEGORIES = [
  { title: "Уход за лицом", slug: "skincare", hint: "сыворотки, кремы, тоники, маски", keywords: ["лиц", "кожа", "сыворот", "крем", "тоник", "маск", "skincare", "serum", "cream"] },
  { title: "Уход за волосами", slug: "haircare", hint: "шампуни, бальзамы, масла и уход для волос", keywords: ["волос", "шампун", "бальзам", "масло", "hair", "shampoo"] },
  { title: "Макияж", slug: "makeup", hint: "тональные средства, пудра, тушь, помада", keywords: ["макияж", "тональ", "пудр", "помад", "туш", "makeup"] },
  { title: "Здоровье", slug: "health", hint: "wellness и товары для заботы о себе", keywords: ["здоров", "wellness", "health"] },
  { title: "Витамины", slug: "vitamins", hint: "витамины, добавки, капсулы", keywords: ["витамин", "добав", "капсул", "vitamin"] },
  { title: "Ароматы", slug: "fragrances", hint: "духи, парфюм и ароматы для дома", keywords: ["аромат", "духи", "парф", "fragrance", "perfume"] },
];

const BEAUTY_SPEC_FIELDS = [
  { key: "Бренд", placeholder: "Например: Dayen Beauty" },
  { key: "Тип кожи", placeholder: "Например: сухая, жирная, чувствительная" },
  { key: "Назначение", placeholder: "Например: увлажнение, сияние, очищение" },
  { key: "Объём", placeholder: "Например: 30 мл" },
  { key: "Активный компонент", placeholder: "Например: ниацинамид, витамин C, ретинол" },
  { key: "Старая цена", placeholder: "Например: 4700" },
];

const initialProductForm = {
  title: "",
  description: "",
  category: "",
  tile_slug: "",
  section: SECTION_GAMES,
  price: "",
  stock: "10",
  image_url: "",
  images: [] as string[],
  specs: [{ key: "", value: "" }] as SpecRow[],
};

const PAGE_SIZE = 25;

function isFurnitureSectionName(value?: string | null) {
  return /furniture|мебел/i.test(String(value || ""));
}

function isBeautySectionName(value?: string | null) {
  return /beauty|health|wellness|красот|здоров|уход/i.test(String(value || ""));
}

function furnitureCategoryByValue(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;

  return (
    FURNITURE_CATEGORIES.find((category) => {
      return (
        category.slug === normalized ||
        category.title.toLowerCase() === normalized ||
        category.keywords.some((keyword) => normalized.includes(keyword))
      );
    }) || null
  );
}

function beautyCategoryByValue(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;

  return (
    BEAUTY_CATEGORIES.find((category) => {
      return (
        category.slug === normalized ||
        category.title.toLowerCase() === normalized ||
        category.keywords.some((keyword) => normalized.includes(keyword))
      );
    }) || null
  );
}

function isFurnitureProduct(product: Product) {
  const haystack = [product.title, product.description, product.category, product.section, product.tile_slug]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /furniture|мебел|диван|sofa|стол|table|стул|стуль|кресл|chair|armchair|шкаф|wardrobe|кровать|кроват|bed|комод|dresser/i.test(haystack);
}

function isBeautyProduct(product: Product) {
  const haystack = [product.title, product.description, product.category, product.section, product.tile_slug]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /beauty|health|wellness|красот|здоров|уход|кожа|лиц|волос|макияж|витамин|аромат|парф|сыворот|крем|тоник|маск|шампун/i.test(haystack);
}

export function AdminProductsPage() {
  const { loading, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [sections, setSections] = useState<MarketplaceSection[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterTile, setFilterTile] = useState("");
  const [sortView, setSortView] = useState("new");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(initialProductForm);

  const sectionTitles = useMemo(() => {
    const base = sections.length ? sections.map((section) => section.title) : ["Игры", "Мобильные игры", "Приложения"];
    return Array.from(new Set([...base, SECTION_FURNITURE, SECTION_BEAUTY]));
  }, [sections]);

  const furnitureSectionTitle = useMemo(
    () => sectionTitles.find((section) => isFurnitureSectionName(section)) || SECTION_FURNITURE,
    [sectionTitles],
  );
  const beautySectionTitle = useMemo(
    () => sectionTitles.find((section) => isBeautySectionName(section)) || SECTION_BEAUTY,
    [sectionTitles],
  );

  const isFurnitureForm = isFurnitureSectionName(form.section) || form.tile_slug === FURNITURE_TILE_SLUG;
  const isBeautyForm = isBeautySectionName(form.section) || form.tile_slug === BEAUTY_TILE_SLUG;
  const isThemedForm = isFurnitureForm || isBeautyForm;
  const selectedFurnitureCategory = furnitureCategoryByValue(form.category) || FURNITURE_CATEGORIES[0];
  const selectedBeautyCategory = beautyCategoryByValue(form.category) || BEAUTY_CATEGORIES[0];

  async function reload() {
    const [productsResponse, tilesResponse, sectionsResponse] = await Promise.all([
      api.getProducts(),
      api.getAdminCategories(),
      api.getAdminSections(),
    ]);
    setProducts(productsResponse.items);
    setTiles(tilesResponse.items);
    setSections(sectionsResponse.items);
  }

  useEffect(() => {
    if (!user?.is_admin && !user?.is_owner) return;
    void reload();
  }, [user]);

  const filteredTiles = useMemo(
    () => tiles.filter((tile) => (tile.section || SECTION_GAMES) === form.section),
    [tiles, form.section],
  );

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const next = products.filter((product) => {
      if (filterSection && (product.section || "") !== filterSection) return false;
      if (filterTile && (product.tile_slug || "") !== filterTile) return false;
      if (!query) return true;

      const haystack = [product.id, product.title, product.category, product.section, product.tile_slug, product.price]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });

    next.sort((a, b) => {
      if (sortView === "old") return a.id - b.id;
      if (sortView === "title") return (a.title || "").localeCompare(b.title || "", "ru");
      if (sortView === "price_asc") return Number(a.price || 0) - Number(b.price || 0);
      if (sortView === "price_desc") return Number(b.price || 0) - Number(a.price || 0);
      return b.id - a.id;
    });

    return next;
  }, [products, search, filterSection, filterTile, sortView]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (!loading && !user) return <Navigate to="/auth" replace />;
  if (!loading && !user?.is_admin && !user?.is_owner) return <Navigate to="/" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");

    const furnitureCategory = isFurnitureForm ? selectedFurnitureCategory : null;
    const beautyCategory = isBeautyForm ? selectedBeautyCategory : null;
    const selectedTile = tiles.find((tile) => tile.slug === form.tile_slug);
    const payload = {
      ...form,
      section: furnitureCategory ? furnitureSectionTitle : beautyCategory ? beautySectionTitle : form.section,
      tile_slug: furnitureCategory ? FURNITURE_TILE_SLUG : beautyCategory ? BEAUTY_TILE_SLUG : form.tile_slug,
      category: furnitureCategory?.title || beautyCategory?.title || selectedTile?.title || form.category,
      price: Number(form.price),
      stock: Number(form.stock),
      image_url: form.images[0] || form.image_url,
      images: form.images.length ? form.images : form.image_url ? [form.image_url] : [],
      specs: form.specs.filter((item) => item.key.trim() && item.value.trim()),
    };

    try {
      if (editingId) {
        await api.updateAdminProduct(editingId, payload);
        setStatus("Товар обновлён.");
      } else {
        await api.createAdminProduct(payload);
        setStatus("Товар добавлен в каталог.");
      }

      setEditingId(null);
      setForm({ ...initialProductForm, section: sectionTitles[0] || SECTION_GAMES });
      await reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось сохранить товар");
    }
  }

  async function removeProduct(id: number) {
    try {
      await api.deleteAdminProduct(id);
      await reload();
      setStatus("Товар удалён.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось удалить товар");
    }
  }

  function startEdit(product: Product) {
    const furnitureProduct = isFurnitureProduct(product);
    const beautyProduct = isBeautyProduct(product);
    const furnitureCategory = furnitureCategoryByValue(product.category) || furnitureCategoryByValue(product.title) || FURNITURE_CATEGORIES[0];
    const beautyCategory = beautyCategoryByValue(product.category) || beautyCategoryByValue(product.title) || BEAUTY_CATEGORIES[0];

    setEditingId(product.id);
    setForm({
      title: product.title || "",
      description: product.description || "",
      category: furnitureProduct ? furnitureCategory.title : beautyProduct ? beautyCategory.title : product.category || "",
      tile_slug: furnitureProduct ? FURNITURE_TILE_SLUG : beautyProduct ? BEAUTY_TILE_SLUG : product.tile_slug || "",
      section: furnitureProduct ? product.section || furnitureSectionTitle : beautyProduct ? product.section || beautySectionTitle : product.section || sectionTitles[0] || SECTION_GAMES,
      price: String(product.price || ""),
      stock: String(product.stock || 0),
      image_url: product.images?.[0] || product.image_url || "",
      images: product.images?.length ? product.images : product.image_url ? [product.image_url] : [],
      specs: parseSpecs(product),
    });
  }

  async function uploadImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setUploading(true);
    setStatus("");

    try {
      const uploaded = await Promise.all(files.map((file) => api.uploadImage(file, "products")));
      const urls = uploaded.map((item) => item.url).filter(Boolean);
      setForm((current) => ({
        ...current,
        image_url: current.image_url || urls[0] || "",
        images: [...current.images, ...urls],
      }));
      setStatus(`Загружено фото: ${urls.length}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось загрузить фото");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  function removeImage(index: number) {
    setForm((current) => {
      const images = current.images.filter((_, itemIndex) => itemIndex !== index);
      return { ...current, images, image_url: images[0] || "" };
    });
  }

  function moveImage(index: number, direction: -1 | 1) {
    setForm((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.images.length) return current;

      const images = [...current.images];
      const [item] = images.splice(index, 1);
      images.splice(nextIndex, 0, item);
      return { ...current, images, image_url: images[0] || "" };
    });
  }

  function setCover(index: number) {
    setForm((current) => {
      const images = [...current.images];
      const [item] = images.splice(index, 1);
      images.unshift(item);
      return { ...current, images, image_url: images[0] || "" };
    });
  }

  function resetListFilters() {
    setSearch("");
    setFilterSection("");
    setFilterTile("");
    setSortView("new");
    setPage(1);
  }

  function changeSection(nextSection: string) {
    if (isFurnitureSectionName(nextSection)) {
      setForm((current) => ({
        ...current,
        section: nextSection,
        tile_slug: FURNITURE_TILE_SLUG,
        category: furnitureCategoryByValue(current.category)?.title || FURNITURE_CATEGORIES[0].title,
      }));
      return;
    }

    if (isBeautySectionName(nextSection)) {
      setForm((current) => ({
        ...current,
        section: nextSection,
        tile_slug: BEAUTY_TILE_SLUG,
        category: beautyCategoryByValue(current.category)?.title || BEAUTY_CATEGORIES[0].title,
      }));
      return;
    }

    setForm((current) => ({ ...current, section: nextSection, tile_slug: "", category: "" }));
  }

  function changeFurnitureCategory(nextSlug: string) {
    const nextCategory = furnitureCategoryByValue(nextSlug) || FURNITURE_CATEGORIES[0];
    setForm((current) => ({
      ...current,
      section: furnitureSectionTitle,
      tile_slug: FURNITURE_TILE_SLUG,
      category: nextCategory.title,
    }));
  }

  function changeBeautyCategory(nextSlug: string) {
    const nextCategory = beautyCategoryByValue(nextSlug) || BEAUTY_CATEGORIES[0];
    setForm((current) => ({
      ...current,
      section: beautySectionTitle,
      tile_slug: BEAUTY_TILE_SLUG,
      category: nextCategory.title,
    }));
  }

  function addSpecRow() {
    setForm((current) => ({ ...current, specs: [...current.specs, { key: "", value: "" }] }));
  }

  function updateSpec(index: number, field: keyof SpecRow, value: string) {
    setForm((current) => ({
      ...current,
      specs: current.specs.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }));
  }

  function removeSpec(index: number) {
    setForm((current) => ({
      ...current,
      specs: current.specs.length === 1 ? [{ key: "", value: "" }] : current.specs.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function getSpecValue(key: string) {
    const normalizedKey = key.toLowerCase();
    return form.specs.find((item) => item.key.trim().toLowerCase() === normalizedKey)?.value || "";
  }

  function setThemedSpec(key: string, value: string) {
    setForm((current) => {
      const normalizedKey = key.toLowerCase();
      const existingIndex = current.specs.findIndex((item) => item.key.trim().toLowerCase() === normalizedKey);

      if (existingIndex >= 0) {
        return {
          ...current,
          specs: current.specs.map((item, index) => (index === existingIndex ? { ...item, key, value } : item)),
        };
      }

      const cleanedSpecs = current.specs.filter((item) => item.key.trim() || item.value.trim());
      return { ...current, specs: [...cleanedSpecs, { key, value }] };
    });
  }

  return (
    <div className="container admWrap">
      <header className="admPanelHead">
        <div>
          <div className="admPanelHead__title">Товары</div>
          <div className="admPanelHead__subtitle">Добавляй, редактируй и фильтруй карточки товаров.</div>
        </div>
        <AdminNav />
      </header>

      <section className="contentCard">
        <div className="order-card__top">
          <div>
            <h1 className="sectionTitle">Товары</h1>
            <div className="muted">Управление карточками каталога, фото и дополнительными характеристиками.</div>
          </div>
          <span className="tiny-chip is-active">Доступ: администратор</span>
        </div>

        <form className="profile-form" onSubmit={submit}>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">Раздел</span>
              <SelectField className="field-input" value={form.section} onChange={(event) => changeSection(event.target.value)}>
                {sectionTitles.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </SelectField>
            </label>

            {isFurnitureForm ? (
              <label className="field">
                <span className="field-label">Мебельная категория</span>
                <SelectField className="field-input" value={selectedFurnitureCategory.slug} onChange={(event) => changeFurnitureCategory(event.target.value)}>
                  {FURNITURE_CATEGORIES.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.title}
                    </option>
                  ))}
                </SelectField>
              </label>
            ) : isBeautyForm ? (
              <label className="field">
                <span className="field-label">Категория красоты и здоровья</span>
                <SelectField className="field-input" value={selectedBeautyCategory.slug} onChange={(event) => changeBeautyCategory(event.target.value)}>
                  {BEAUTY_CATEGORIES.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.title}
                    </option>
                  ))}
                </SelectField>
              </label>
            ) : (
              <label className="field">
                <span className="field-label">Плитка</span>
                <SelectField
                  className="field-input"
                  value={form.tile_slug}
                  placeholder={filteredTiles.length ? "Выберите плитку" : "Сначала выберите раздел"}
                  onChange={(event) => {
                    const nextSlug = event.target.value;
                    const nextTile = filteredTiles.find((tile) => tile.slug === nextSlug);
                    setForm((current) => ({ ...current, tile_slug: nextSlug, category: nextTile?.title || "" }));
                  }}
                >
                  {filteredTiles.map((tile) => (
                    <option key={tile.id} value={tile.slug}>
                      {tile.title}
                    </option>
                  ))}
                </SelectField>
              </label>
            )}

            <label className="field">
              <span className="field-label">Название</span>
              <input className="field-input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            </label>

            <label className="field">
              <span className="field-label">Цена</span>
              <input className="field-input" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} />
            </label>

            <label className="field">
              <span className="field-label">Описание</span>
              <input className="field-input" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </label>

            <label className="field">
              <span className="field-label">Наличие (stock)</span>
              <input className="field-input" value={form.stock} onChange={(event) => setForm((current) => ({ ...current, stock: event.target.value }))} />
            </label>
          </div>

          {isFurnitureForm ? (
            <div className="field-hint">
              Мебельный товар будет сохранён как раздел «{furnitureSectionTitle}», системный slug «{FURNITURE_TILE_SLUG}» и категория «{selectedFurnitureCategory.title}». Он появится на странице /tile/furniture/{selectedFurnitureCategory.slug}.
              <br />
              Подсказка: {selectedFurnitureCategory.hint}.
            </div>
          ) : null}

          {isBeautyForm ? (
            <div className="field-hint">
              Товар красоты будет сохранён как раздел «{beautySectionTitle}», системный slug «{BEAUTY_TILE_SLUG}» и категория «{selectedBeautyCategory.title}». Он появится на странице /tile/beauty-health/{selectedBeautyCategory.slug}.
              <br />
              Подсказка: {selectedBeautyCategory.hint}.
            </div>
          ) : null}

          <div className="field">
            <span className="field-label">Фото товара (можно несколько)</span>
            <div className="uploadBox productUploadBox">
              <div className="muted">Перетащи несколько файлов сюда или нажми «Выбрать фото».</div>
              <div className="button-row" style={{ marginTop: 10 }}>
                <label className="ghostBtn">
                  <input type="file" accept="image/*" multiple hidden onChange={uploadImages} />
                  {uploading ? "Загружаю..." : "Выбрать фото"}
                </label>
                <button type="button" className="ghostBtn" onClick={() => setForm((current) => ({ ...current, image_url: "", images: [] }))}>
                  Очистить
                </button>
                <div className="muted">{form.images.length ? `Фото выбрано: ${form.images.length}` : "Фото не выбраны"}</div>
              </div>

              {form.images.length ? (
                <div className="productUploadPreview">
                  {form.images.map((image, index) => (
                    <div key={`${image}-${index}`} className="productUploadPreview__item">
                      <img src={image} alt="" />
                      <div className="productUploadPreview__actions">
                        <button type="button" onClick={() => moveImage(index, -1)} disabled={index === 0}>
                          ←
                        </button>
                        <button type="button" className={index === 0 ? "is-cover" : ""} onClick={() => setCover(index)}>
                          {index === 0 ? "Обложка" : "Сделать"}
                        </button>
                        <button type="button" onClick={() => moveImage(index, 1)} disabled={index === form.images.length - 1}>
                          →
                        </button>
                      </div>
                      <button type="button" className="productUploadPreview__remove" onClick={() => removeImage(index)}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {isFurnitureForm ? (
            <div className="field">
              <span className="field-label">Мебельные характеристики для фильтров</span>
              <div className="field-hint">
                Эти поля сохраняются как характеристики товара и используются на /tile/furniture для фильтров, скидки и карточки товара.
              </div>
              <div className="form-grid">
                {FURNITURE_SPEC_FIELDS.map((item) => (
                  <label key={item.key} className="field">
                    <span className="field-label">{item.key}</span>
                    <input
                      className="field-input"
                      value={getSpecValue(item.key)}
                      placeholder={item.placeholder}
                      onChange={(event) => setThemedSpec(item.key, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {isBeautyForm ? (
            <div className="field">
              <span className="field-label">Beauty-характеристики для фильтров</span>
              <div className="field-hint">
                Эти поля сохраняются как характеристики товара и используются на /tile/beauty-health для бренда, типа кожи, назначения, скидки и карточки товара.
              </div>
              <div className="form-grid">
                {BEAUTY_SPEC_FIELDS.map((item) => (
                  <label key={item.key} className="field">
                    <span className="field-label">{item.key}</span>
                    <input
                      className="field-input"
                      value={getSpecValue(item.key)}
                      placeholder={item.placeholder}
                      onChange={(event) => setThemedSpec(item.key, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="field">
            <span className="field-label">Доп. характеристики товара</span>
            <div className="stack-list">
              {form.specs.map((spec, index) => (
                <div key={index} className="summary-row">
                  <input className="field-input" placeholder="Название" value={spec.key} onChange={(event) => updateSpec(index, "key", event.target.value)} />
                  <input className="field-input" placeholder="Значение" value={spec.value} onChange={(event) => updateSpec(index, "value", event.target.value)} />
                  <button type="button" className="ghostBtn" onClick={() => removeSpec(index)}>
                    Удалить
                  </button>
                </div>
              ))}
            </div>
            <div className="button-row" style={{ marginTop: 12 }}>
              <button type="button" className="ghostBtn" onClick={addSpecRow}>
                Добавить характеристику
              </button>
            </div>
          </div>

          {status ? <div className="field-hint">{status}</div> : null}

          <div className="button-row">
            <button type="submit" className="linkBtn">
              {editingId ? "Сохранить" : "Добавить"}
            </button>
            <button type="button" className="ghostBtn" onClick={() => void reload()}>
              Обновить список
            </button>
            <button type="button" className="ghostBtn" onClick={() => { setEditingId(null); setForm({ ...initialProductForm, section: sectionTitles[0] || SECTION_GAMES }); }}>
              Сбросить
            </button>
          </div>
        </form>

        <div className="admToolbar admToolbar--searchOnly">
          <label className="field admToolbar__wide">
            <span className="field-label">Поиск</span>
            <input
              className="field-input"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="ID, название, категория, раздел"
            />
          </label>
        </div>

        <div className="admToolbar admToolbar--filters">
          <label className="field">
            <span className="field-label">Раздел</span>
            <SelectField
              className="field-input"
              value={filterSection}
              placeholder="Все разделы"
              onChange={(event) => {
                setFilterSection(event.target.value);
                setFilterTile("");
                setPage(1);
              }}
            >
              {sectionTitles.map((section) => (
                <option key={section} value={section}>
                  {section}
                </option>
              ))}
            </SelectField>
          </label>

          <label className="field">
            <span className="field-label">Плитка</span>
            <SelectField
              className="field-input"
              value={filterTile}
              placeholder="Все плитки"
              onChange={(event) => {
                setFilterTile(event.target.value);
                setPage(1);
              }}
            >
              {tiles
                .filter((tile) => !filterSection || tile.section === filterSection)
                .map((tile) => (
                  <option key={tile.id} value={tile.slug}>
                    {tile.title}
                  </option>
                ))}
            </SelectField>
          </label>

          <label className="field">
            <span className="field-label">Сортировка</span>
            <SelectField
              className="field-input"
              value={sortView}
              onChange={(event) => {
                setSortView(event.target.value);
                setPage(1);
              }}
            >
              <option value="new">Сначала новые</option>
              <option value="old">Сначала старые</option>
              <option value="title">По названию</option>
              <option value="price_asc">Дешёвые</option>
              <option value="price_desc">Дорогие</option>
            </SelectField>
          </label>

          <div className="field admToolbar__action">
            <button type="button" className="ghostBtn ghostBtn--wide" onClick={resetListFilters}>
              Сбросить фильтры
            </button>
          </div>
        </div>

        <div className="muted">Найдено товаров: {filteredProducts.length}</div>

        <div className="admList">
          {visibleProducts.map((product) => (
            <article key={product.id} className="admRow admProductRow">
              <div className="admRow__thumb">
                {product.images?.[0] || product.image_url ? <img src={product.images?.[0] || product.image_url} alt={product.title} /> : <span>■</span>}
              </div>
              <div className="admRow__main">
                <strong>{product.title}</strong>
                <div className="muted">ID: {product.id} • {product.category || "без категории"}</div>
              </div>
              <div>{product.tile_slug || "—"}</div>
              <div>{formatPrice(product.price)}</div>
              <div>{product.stock} шт.</div>
              <div className="button-row">
                <button type="button" className="ghostBtn" onClick={() => startEdit(product)}>
                  Редактировать
                </button>
                <button type="button" className="ghostBtn" onClick={() => void removeProduct(product.id)}>
                  Удалить
                </button>
              </div>
            </article>
          ))}
        </div>

        <div className="admPagination">
          <button type="button" className="admPageBtn" disabled={currentPage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            ←
          </button>
          <span className="admPageInfo">
            {currentPage} / {totalPages}
          </span>
          <button type="button" className="admPageBtn" disabled={currentPage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
            →
          </button>
        </div>
      </section>
    </div>
  );
}

function parseSpecs(product: Product) {
  if (Array.isArray(product.specs) && product.specs.length) {
    return product.specs.map((item) => ({ key: item.key || "", value: item.value || "" }));
  }

  if (product.specs_json) {
    try {
      const parsed = JSON.parse(product.specs_json);
      if (Array.isArray(parsed)) {
        const normalized = parsed
          .map((item) => ({
            key: String(item?.key || item?.label || item?.name || "").trim(),
            value: String(item?.value || "").trim(),
          }))
          .filter((item) => item.key || item.value);

        if (normalized.length) return normalized;
      }
    } catch {
      // ignore invalid legacy specs
    }
  }

  return [{ key: "", value: "" }];
}
