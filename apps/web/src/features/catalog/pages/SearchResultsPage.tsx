import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { api } from "../../../services/api";
import { formatPrice } from "../../../services/format";
import type { Product } from "../../../types/api";

export function SearchResultsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const trimmedQuery = useMemo(() => (searchParams.get("q") || "").trim(), [searchParams]);

  useEffect(() => {
    if (!trimmedQuery) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    void api
      .getSearchResults(trimmedQuery)
      .then((response) => setResults(response.items || []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [trimmedQuery]);

  return (
    <div className="page-shell container section-stack">
      <section className="searchPageHero">
        <div>
          <div className="catalogTitle">Поиск по магазину</div>
          <div className="catalogSub">
            {trimmedQuery
              ? `Результаты по запросу «${trimmedQuery}»`
              : "Введите название товара или часть запроса в верхней строке поиска."}
          </div>
        </div>
      </section>

      {loading ? <section className="empty-panel">Ищем результаты...</section> : null}

      {!loading && trimmedQuery && results.length ? (
        <section className="searchResultsList">
          {results.map((product) => {
            const image = product.images?.[0] || product.image_url || "";

            return (
              <article
                key={product.id}
                className="searchResultRow"
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/product/${product.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") navigate(`/product/${product.id}`);
                }}
              >
                <div className="searchResultRow__media">
                  {image ? (
                    <img src={image} alt={product.title} />
                  ) : (
                    <div className="searchResultRow__placeholder">{product.category?.slice(0, 1) || "D"}</div>
                  )}
                </div>

                <div className="searchResultRow__body">
                  <div className="searchResultRow__title">{product.title}</div>
                  <div className="searchResultRow__meta">
                    <span>{product.category || "Товар"}</span>
                    {product.section ? <span>{product.section}</span> : null}
                  </div>
                </div>

                <div className="searchResultRow__side">
                  <strong className="searchResultRow__price">{formatPrice(product.price)}</strong>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      {!loading && trimmedQuery && results.length === 0 ? (
        <section className="empty-panel">
          <strong>Ничего не найдено</strong>
          <p>Попробуйте упростить запрос или написать только часть названия товара.</p>
        </section>
      ) : null}

      {!loading && !trimmedQuery ? (
        <section className="empty-panel">
          <strong>Поиск ждёт запрос</strong>
          <p>Напишите название товара или хотя бы часть слова, и мы покажем похожие варианты.</p>
        </section>
      ) : null}
    </div>
  );
}
