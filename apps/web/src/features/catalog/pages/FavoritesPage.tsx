import { useEffect, useMemo, useState } from "react";
import { Grid3X3, List } from "lucide-react";
import { Link, Navigate } from "react-router-dom";

import { ProductCard } from "../../../components/ProductCard";
import { useAuth } from "../../../providers/auth";
import { useCart } from "../../../providers/cart";
import { useToast } from "../../../providers/toast";
import { api } from "../../../services/api";
import { getErrorMessage } from "../../../services/errors";
import { formatPrice } from "../../../services/format";
import type { Product } from "../../../types/api";

type SortMode = "new_desc" | "price_asc" | "price_desc" | "likes_desc" | "rating_desc";
type ViewMode = "list" | "grid";

const PAGE_SIZE = 10;

function productImage(product: Product) {
  return product.images?.[0] || product.image_url || "";
}

function ratingLabel(product: Product) {
  const rating = Number(product.rating_avg || 0);
  return rating > 0 ? rating.toFixed(1) : "Без оценок";
}

export function FavoritesPage() {
  const { loading, user } = useAuth();
  const { add, has } = useCart();
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [sort, setSort] = useState<SortMode>("new_desc");
  const [view, setView] = useState<ViewMode>("grid");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      setIsLoadingFavorites(false);
      return;
    }

    let isMounted = true;

    setIsLoadingFavorites(true);
    setError("");

    void api
      .getFavorites()
      .then((response) => {
        if (!isMounted) return;
        setProducts(response.items.map((product) => ({ ...product, is_liked: true })));
      })
      .catch((requestError) => {
        if (!isMounted) return;
        setError(getErrorMessage(requestError, "Не удалось загрузить избранные товары."));
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingFavorites(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [sort, view]);

  const sortedProducts = useMemo(() => {
    const next = [...products];

    switch (sort) {
      case "price_asc":
        next.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
        break;
      case "price_desc":
        next.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
        break;
      case "likes_desc":
        next.sort((a, b) => Number(b.likes || 0) - Number(a.likes || 0));
        break;
      case "rating_desc":
        next.sort((a, b) => Number(b.rating_avg || 0) - Number(a.rating_avg || 0));
        break;
      default:
        next.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
        break;
    }

    return next;
  }, [products, sort]);

  const visibleProducts = sortedProducts.slice(0, visibleCount);

  function removeFromVisibleList(productId: number, liked: boolean) {
    if (!liked) {
      setProducts((current) => current.filter((product) => product.id !== productId));
    }
  }

  async function removeFavorite(productId: number) {
    try {
      const next = await api.likeProduct(productId);
      if (!next.liked) {
        setProducts((current) => current.filter((product) => product.id !== productId));
        toast.success("Товар удален из избранного.");
      }
    } catch (requestError) {
      toast.error(getErrorMessage(requestError, "Не удалось изменить избранное."));
    }
  }

  if (!loading && !user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="favoritesPagePro">
      <div className="container favoritesPagePro__inner">
        <section className="favoritesHeroPro">
          <div className="favoritesHeroPro__copy">
            <span>Избранное</span>
            <h1>Ваши избранные товары</h1>
            <p>Сохраняйте понравившиеся товары и возвращайтесь к ним, когда будете готовы выбрать лучшее.</p>
          </div>
        </section>

        <section className="favoritesBoard">
          <div className="favoritesBoard__toolbar">
            <div className="favoritesBoard__summary">
              <strong>Все избранные товары</strong>
              <span>{products.length} сохранено</span>
            </div>

            <div className="favoritesControls">
              <label className="favoritesSortPro">
                <span>Сортировка</span>
                <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
                  <option value="new_desc">Сначала новые</option>
                  <option value="price_asc">Цена: по возрастанию</option>
                  <option value="price_desc">Цена: по убыванию</option>
                  <option value="likes_desc">По лайкам</option>
                  <option value="rating_desc">По рейтингу</option>
                </select>
              </label>
              <div className="favoritesViewSwitch" aria-label="Вид списка">
                <button type="button" className={view === "list" ? "is-active" : ""} onClick={() => setView("list")}>
                  <List size={18} strokeWidth={2.2} />
                  Список
                </button>
                <button type="button" className={view === "grid" ? "is-active" : ""} onClick={() => setView("grid")}>
                  <Grid3X3 size={18} strokeWidth={2.2} />
                  Сетка
                </button>
              </div>
            </div>
          </div>

          {error ? <div className="favoritesNoticePro">{error}</div> : null}

          {isLoadingFavorites ? (
            <div className="favoritesSkeletonPro" aria-label="Загрузка избранных товаров">
              {Array.from({ length: 5 }).map((_, index) => (
                <div className="favoritesSkeletonPro__row" key={index} />
              ))}
            </div>
          ) : sortedProducts.length ? (
            <>
              {view === "grid" ? (
                <div className="product-grid favoritesGridPro">
                  {visibleProducts.map((product) => (
                    <ProductCard key={product.id} product={product} onLikeChange={removeFromVisibleList} />
                  ))}
                </div>
              ) : (
                <div className="favoritesListPro">
                  {visibleProducts.map((product) => {
                    const image = productImage(product);
                    return (
                      <article className="favoriteRowPro" key={product.id}>
                        <Link className="favoriteRowPro__media" to={`/product/${product.id}`} aria-label={product.title}>
                          {image ? <img src={image} alt={product.title} /> : <span>{product.category?.slice(0, 1) || "D"}</span>}
                        </Link>

                        <div className="favoriteRowPro__body">
                          <Link to={`/product/${product.id}`}>{product.title}</Link>
                          <p>{product.category || product.section || "Товар Dayen"}</p>
                          <div>
                            <span>★ {ratingLabel(product)}</span>
                            {product.likes ? <span>Лайков: {product.likes}</span> : null}
                          </div>
                        </div>

                        <div className="favoriteRowPro__side">
                          <strong>{formatPrice(product.price)}</strong>
                          <div>
                            <button type="button" onClick={() => add(product.id)}>
                              {has(product.id) ? "В корзине" : "В корзину"}
                            </button>
                            <button type="button" aria-label="Убрать из избранного" onClick={() => void removeFavorite(product.id)}>
                              ×
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {visibleCount < sortedProducts.length ? (
                <div className="favoritesMorePro">
                  <button type="button" onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}>
                    Показать еще
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <section className="favoritesEmptyPro">
              <div>0</div>
              <strong>Избранное пока пустое</strong>
              <p>Нажимайте на сердце в карточках товаров, и они появятся здесь для быстрого доступа.</p>
              <Link to="/catalog">Перейти в каталог</Link>
            </section>
          )}
        </section>
      </div>
    </div>
  );
}
