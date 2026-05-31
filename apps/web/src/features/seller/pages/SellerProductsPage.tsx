import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { SelectField } from "../../../components/SelectField";
import { useAuth } from "../../../providers/auth";
import { api } from "../../../services/api";
import { formatPrice } from "../../../services/format";
import type { Product } from "../../../types/api";

type SpecRow = { key: string; value: string };
type SellerTileFilter = { tile_slug: string; category: string };

const initialForm = {
  title: "",
  description: "",
  category: "",
  tile_slug: "",
  price: "",
  stock: "10",
  image_url: "",
  specs: [{ key: "", value: "" }] as SpecRow[],
};

export function SellerProductsPage() {
  const { loading, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [tiles, setTiles] = useState<SellerTileFilter[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [form, setForm] = useState(initialForm);
  const [query, setQuery] = useState("");
  const [tileFilter, setTileFilter] = useState("");
  const [sort, setSort] = useState("new");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  async function reload() {
    const response = await api.getSellerProducts({
      page,
      limit: pageSize,
      q: query.trim(),
      tile: tileFilter,
      sort,
    });
    setProducts(response.products);
    setTiles(response.tiles || []);
    setTotal(response.total ?? response.products.length);
  }

  useEffect(() => {
    if (!user?.is_seller) return;
    void reload();
  }, [user, page, query, tileFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function resetFilters() {
    setQuery("");
    setTileFilter("");
    setSort("new");
    setPage(1);
  }

  if (!loading && !user) {
    return <Navigate to="/auth" replace />;
  }

  if (!loading && !user?.is_seller) {
    return <Navigate to="/seller" replace />;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");

    const payload = {
      ...form,
      price: Number(form.price),
      stock: Number(form.stock),
      images: form.image_url ? [form.image_url] : [],
      specs: form.specs.filter((item) => item.key.trim() && item.value.trim()),
    };

    try {
      if (editingId) {
        await api.updateSellerProduct(editingId, payload);
        setStatus("Товар обновлён.");
      } else {
        await api.createSellerProduct(payload);
        setStatus("Товар создан.");
      }

      setForm(initialForm);
      setEditingId(null);
      setPage(1);
      await reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось сохранить товар");
    }
  }

  async function removeProduct(id: number) {
    setStatus("");
    try {
      await api.deleteSellerProduct(id);
      if (editingId === id) {
        setEditingId(null);
        setForm(initialForm);
      }
      if (products.length === 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1));
      }
      await reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось удалить товар");
    }
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setForm({
      title: product.title || "",
      description: product.description || "",
      category: product.category || "",
      tile_slug: product.tile_slug || "",
      price: String(product.price || ""),
      stock: String(product.stock || 0),
      image_url: product.images?.[0] || product.image_url || "",
      specs: parseSpecs(product),
    });
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

  return (
    <div className="container admWrap">
      <section className="contentCard">
        <div className="order-card__top">
          <div>
            <h1 className="sectionTitle">Мои товары</h1>
            <div className="muted">Добавляйте новые позиции, редактируйте карточки и управляйте характеристиками.</div>
          </div>
        </div>

        <form className="profile-form" onSubmit={submit}>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">Название</span>
              <input className="field-input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label className="field">
              <span className="field-label">Категория</span>
              <input className="field-input" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
            </label>
            <label className="field">
              <span className="field-label">Tile slug</span>
              <input className="field-input" value={form.tile_slug} onChange={(event) => setForm((current) => ({ ...current, tile_slug: event.target.value }))} />
            </label>
            <label className="field">
              <span className="field-label">Ссылка на изображение</span>
              <input className="field-input" value={form.image_url} onChange={(event) => setForm((current) => ({ ...current, image_url: event.target.value }))} />
            </label>
            <label className="field">
              <span className="field-label">Цена</span>
              <input className="field-input" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} />
            </label>
            <label className="field">
              <span className="field-label">Остаток</span>
              <input className="field-input" value={form.stock} onChange={(event) => setForm((current) => ({ ...current, stock: event.target.value }))} />
            </label>
          </div>

          <label className="field">
            <span className="field-label">Описание</span>
            <textarea className="field-input field-input--area" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </label>

          <div className="field">
            <span className="field-label">Доп. характеристики товара</span>
            <div className="stack-list">
              {form.specs.map((spec, index) => (
                <div key={index} className="summary-row">
                  <input className="field-input" placeholder="Название" value={spec.key} onChange={(event) => updateSpec(index, "key", event.target.value)} />
                  <input className="field-input" placeholder="Значение" value={spec.value} onChange={(event) => updateSpec(index, "value", event.target.value)} />
                  <button type="button" className="ghostBtn" onClick={() => removeSpec(index)}>Удалить</button>
                </div>
              ))}
            </div>
            <div className="button-row" style={{ marginTop: 12 }}>
              <button type="button" className="ghostBtn" onClick={addSpecRow}>Добавить характеристику</button>
            </div>
          </div>

          {status ? <div className="field-hint">{status}</div> : null}

          <div className="button-row">
            <button type="submit" className="linkBtn">
              {editingId ? "Сохранить изменения" : "Создать товар"}
            </button>
            {editingId ? (
              <button type="button" className="ghostBtn" onClick={() => {
                setEditingId(null);
                setForm(initialForm);
              }}>
                Отменить
              </button>
            ) : null}
          </div>
        </form>

        <div className="admToolbar admToolbar--filters sellerProductsFilters">
          <label className="field sellerProductsFilters__search">
            <span className="field-label">Поиск</span>
            <input
              className="field-input"
              placeholder="ID, название, категория"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </label>

          <label className="field">
            <span className="field-label">Плитка</span>
            <SelectField
              className="field-input"
              value={tileFilter}
              placeholder="Все плитки"
              onChange={(event) => {
                setTileFilter(event.target.value);
                setPage(1);
              }}
            >
              {tiles.map((tile) => (
                <option key={tile.tile_slug || tile.category} value={tile.tile_slug}>
                  {tile.category || tile.tile_slug || "Без плитки"}
                </option>
              ))}
            </SelectField>
          </label>

          <label className="field">
            <span className="field-label">Сортировка</span>
            <SelectField
              className="field-input"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
            >
              <option value="new">Сначала новые</option>
              <option value="old">Сначала старые</option>
              <option value="price_asc">Дешевле</option>
              <option value="price_desc">Дороже</option>
              <option value="stock_asc">Меньше остаток</option>
              <option value="stock_desc">Больше остаток</option>
            </SelectField>
          </label>

          <button type="button" className="ghostBtn sellerProductsFilters__reset" onClick={resetFilters}>
            Сбросить
          </button>
        </div>

        <div className="admPagination sellerProductsPager">
          <span>Найдено: {total}</span>
          <div className="admPagination__controls">
            <button type="button" className="ghostBtn" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              ←
            </button>
            <strong>{page} / {totalPages}</strong>
            <button type="button" className="ghostBtn" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
              →
            </button>
          </div>
        </div>

        <div className="admList">
          {products.map((product) => (
            <article key={product.id} className="admRow">
              <div className="admRow__main">
                <strong>{product.title}</strong>
                <div className="muted">{product.category}</div>
              </div>
              <div>{formatPrice(product.price)}</div>
              <div>Остаток: {product.stock}</div>
              <div className="button-row">
                <button type="button" className="ghostBtn" onClick={() => startEdit(product)}>Редактировать</button>
                <button type="button" className="ghostBtn" onClick={() => void removeProduct(product.id)}>Удалить</button>
              </div>
            </article>
          ))}
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
