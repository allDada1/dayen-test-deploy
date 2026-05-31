import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { ProductCard } from "../../../components/ProductCard";
import { SectionHeading } from "../../../components/SectionHeading";
import { api } from "../../../services/api";
import type { Category, Product } from "../../../types/api";

export function CatalogPage() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [visibleCount, setVisibleCount] = useState(25);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    void api.getCategories().then((response) => setCategories(response.items));
  }, []);

  useEffect(() => {
    if (slug) {
      void api.getTileProducts(slug).then((response) => setProducts(response.items));
      return;
    }

    void api.getProducts().then((response) => setProducts(response.items));
  }, [slug]);

  useEffect(() => {
    setVisibleCount(25);
  }, [slug, deferredQuery]);

  useEffect(() => {
    const trimmed = query.trim();
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (trimmed) next.set("q", trimmed);
      else next.delete("q");
      return next;
    });
  }, [query, setSearchParams]);

  const filteredProducts = useMemo(() => {
    const lowered = deferredQuery.trim().toLowerCase();
    if (!lowered) return products;
    return products.filter((product) =>
      [product.title, product.description, product.category].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(lowered),
      ),
    );
  }, [deferredQuery, products]);

  return (
    <div className="page-shell shell-container section-stack">
      <section className="catalog-hero">
        <div>
          <SectionHeading
            eyebrow={slug ? "Раздел" : "Каталог"}
            title={slug ? "Товары выбранной категории" : "Каталог товаров"}
            description="Ищите по названию, описанию и категории, затем открывайте нужную карточку."
          />
        </div>

        <div className="catalog-panel">
          <label className="field-label" htmlFor="catalog-search">
            Поиск по каталогу
          </label>
          <input
            id="catalog-search"
            className="field-input"
            placeholder="Например: Steam, аккаунт, подписка"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <div className="catalog-panel__chips">
            {categories.slice(0, 12).map((category) => (
              <span key={category.id} className={category.slug === slug ? "tiny-chip is-active" : "tiny-chip"}>
                {category.title}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="product-grid">
        {filteredProducts.slice(0, visibleCount).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {visibleCount < filteredProducts.length ? (
        <div className="catalogShowMore">
          <button type="button" className="ghostBtn" onClick={() => setVisibleCount((current) => current + 25)}>
            Показать ещё
          </button>
        </div>
      ) : null}

      {filteredProducts.length === 0 ? (
        <section className="empty-panel">
          <strong>Ничего не найдено</strong>
          <p>Попробуйте изменить запрос или выбрать другую категорию.</p>
        </section>
      ) : null}
    </div>
  );
}
