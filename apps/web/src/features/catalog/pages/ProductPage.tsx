import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { SelectField } from "../../../components/SelectField";
import { BeautyProductPage, isBeautyProduct } from "../../beauty/BeautyPages";
import { FurnitureProductPage } from "../../furniture/FurniturePages";
import { ShoesProductPage, isShoesProduct } from "../../shoes/ShoesPages";
import { useAuth } from "../../../providers/auth";
import { useCart } from "../../../providers/cart";
import { useToast } from "../../../providers/toast";
import { api } from "../../../services/api";
import { getErrorMessage } from "../../../services/errors";
import { formatDate, formatPrice } from "../../../services/format";
import type { Product, Review, SellerProfile } from "../../../types/api";

function saveRecentProduct(product: Product) {
  try {
    const current = JSON.parse(localStorage.getItem("market_recent_products_v1") || "[]");
    const list = Array.isArray(current) ? current.filter((item) => Number(item?.id) !== product.id) : [];
    list.unshift(product);
    localStorage.setItem("market_recent_products_v1", JSON.stringify(list.slice(0, 8)));
  } catch {
    // Local storage can be unavailable in private modes.
  }
}

function readRecentProducts(currentId: number): Product[] {
  try {
    const raw = JSON.parse(localStorage.getItem("market_recent_products_v1") || "[]");
    return Array.isArray(raw) ? raw.filter((item) => Number(item?.id) !== currentId).slice(0, 8) : [];
  } catch {
    return [];
  }
}

function buildProductSpecs(product: Product | null) {
  if (!product) return [];

  const base = [
    { key: "Категория", value: product.category || "—" },
    { key: "Раздел", value: product.section || "Игры" },
    { key: "ID товара", value: `#${product.id}` },
  ];

  if (Array.isArray(product.specs) && product.specs.length) {
    return [...base, ...product.specs.filter((item) => item.key && item.value)];
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
          .filter((item) => item.key && item.value);
        return [...base, ...normalized];
      }
    } catch {
      // Ignore legacy invalid JSON.
    }
  }

  return base;
}

function isFurnitureProduct(product: Product) {
  const text = [product.tile_slug, product.section, product.category, product.title]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return ["furniture", "мебель", "диван", "sofa", "кровать", "стол", "стул", "шкаф", "комод"].some((marker) => text.includes(marker));
}

export function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { add, has } = useCart();
  const toast = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [related, setRelated] = useState<Product[]>([]);
  const [recent, setRecent] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [reviewStatus, setReviewStatus] = useState("");
  const [reviewForm, setReviewForm] = useState({ rating: "5", comment: "" });
  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeProductTab, setActiveProductTab] = useState<"description" | "specs" | "reviews">("description");

  const images = useMemo(() => {
    if (!product) return [];
    const prepared = Array.isArray(product.images) && product.images.length ? product.images : product.image_url ? [product.image_url] : [];
    return prepared.filter(Boolean);
  }, [product]);
  const image = images[activeImage] || "";
  const specs = useMemo(() => buildProductSpecs(product), [product]);
  const ratingValue = Number(product?.rating_avg || 0);
  const reviewCount = Number(product?.rating_count || reviews.length || 0);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const productId = Number(id);
    let alive = true;

    setLoading(true);
    setProduct(null);
    setSeller(null);
    setRelated([]);

    void api
      .getProduct(id)
      .then((response) => {
        if (!alive) return;

        setProduct(response.product);
        saveRecentProduct(response.product);
        setRecent(readRecentProducts(response.product.id));
        setActiveImage(0);
        setLightboxOpen(false);

        if (response.product.owner_user_id) {
          void api
            .getSeller(response.product.owner_user_id)
            .then((sellerResponse) => {
              if (alive) setSeller(sellerResponse.seller);
            })
            .catch(() => {
              if (alive) setSeller(null);
            });
        }

        if (response.product.category) {
          void api
            .getProducts({ cat: response.product.category })
            .then((relatedResponse) => {
              if (alive) setRelated(relatedResponse.items.filter((item) => item.id !== response.product.id).slice(0, 8));
            })
            .catch(() => {
              if (alive) setRelated([]);
            });
        }
      })
      .catch((error) => {
        if (!alive) return;
        toast.error(getErrorMessage(error, "Не удалось открыть товар."));
        navigate("/");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    void api
      .getProductReviews(productId)
      .then((response) => {
        if (alive) setReviews(response.items);
      })
      .catch(() => {
        if (alive) setReviews([]);
      });
    if (user) {
      void api
        .canReviewProduct(productId)
        .then((response) => {
          if (alive) setCanReview(response.can_review);
        })
        .catch(() => {
          if (alive) setCanReview(false);
        });
    } else {
      setCanReview(false);
    }

    return () => {
      alive = false;
    };
  }, [id, navigate, toast, user]);

  useEffect(() => {
    if (!lightboxOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setLightboxOpen(false);
      if (event.key === "ArrowLeft") setActiveImage((current) => Math.max(0, current - 1));
      if (event.key === "ArrowRight") setActiveImage((current) => Math.min(images.length - 1, current + 1));
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("is-lightbox-open");

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("is-lightbox-open");
    };
  }, [images.length, lightboxOpen]);

  if (!product) {
    return loading ? <div className="container contentCard">Загрузка товара...</div> : null;
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReviewStatus("");
    if (!product) return;

    try {
      await api.createReview({
        product_id: product.id,
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment,
      });
      setReviewForm({ rating: "5", comment: "" });
      setReviewStatus("Отзыв отправлен.");
      toast.success("Отзыв отправлен.");
      const response = await api.getProductReviews(product.id);
      setReviews(response.items);
      setCanReview(false);
    } catch (error) {
      const message = getErrorMessage(error, "Не удалось отправить отзыв.");
      setReviewStatus(message);
      toast.error(message);
    }
  }

  async function toggleLike() {
    if (!product) return;
    if (!user) {
      toast.warning("Войдите в аккаунт, чтобы добавить товар в избранное.");
      return;
    }

    try {
      const response = await api.likeProduct(product.id);
      setProduct((current) => (current ? { ...current, is_liked: response.liked, likes: response.likes } : current));
      if (response.liked) {
        toast.favorite("Товар сохранён в вашем избранном.", {
          action: { label: "Перейти в избранное", href: "/favorites" },
        });
      } else {
        toast.info("Товар удалён из избранного.", {
          title: "Избранное обновлено",
        });
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось обновить избранное."));
    }
  }

  function buyNow() {
    if (!product) return;
    add(product.id);
    navigate("/checkout");
  }

  if (isFurnitureProduct(product)) {
    return (
      <>
        <FurnitureProductPage
          product={product}
          seller={seller}
          images={images}
          activeImage={activeImage}
          setActiveImage={setActiveImage}
          specs={specs}
          reviews={reviews}
          hasInCart={has(product.id)}
          onAddToCart={() => add(product.id)}
          onBuyNow={buyNow}
          onToggleLike={() => void toggleLike()}
          onOpenImage={() => image && setLightboxOpen(true)}
        />

        {lightboxOpen && image ? (
          <div className="imageLightbox" role="dialog" aria-modal="true" aria-label="Просмотр фото товара" onClick={() => setLightboxOpen(false)}>
            <button type="button" className="imageLightbox__close" onClick={() => setLightboxOpen(false)} aria-label="Закрыть">
              ×
            </button>
            <button
              type="button"
              className="imageLightbox__nav imageLightbox__nav--prev"
              disabled={activeImage <= 0}
              onClick={(event) => {
                event.stopPropagation();
                setActiveImage((current) => Math.max(0, current - 1));
              }}
              aria-label="Предыдущее фото"
            >
              ‹
            </button>
            <img src={image} alt={product.title} onClick={(event) => event.stopPropagation()} />
            <button
              type="button"
              className="imageLightbox__nav imageLightbox__nav--next"
              disabled={activeImage >= images.length - 1}
              onClick={(event) => {
                event.stopPropagation();
                setActiveImage((current) => Math.min(images.length - 1, current + 1));
              }}
              aria-label="Следующее фото"
            >
              ›
            </button>
          </div>
        ) : null}
      </>
    );
  }

  if (isBeautyProduct(product) && !isShoesProduct(product)) {
    return (
      <>
        <BeautyProductPage
          product={product}
          seller={seller}
          images={images}
          activeImage={activeImage}
          setActiveImage={setActiveImage}
          specs={specs}
          reviews={reviews}
          hasInCart={has(product.id)}
          onAddToCart={() => add(product.id)}
          onBuyNow={buyNow}
          onToggleLike={() => void toggleLike()}
          onOpenImage={() => image && setLightboxOpen(true)}
        />

        {lightboxOpen && image ? (
          <div className="imageLightbox" role="dialog" aria-modal="true" aria-label="Просмотр фото товара" onClick={() => setLightboxOpen(false)}>
            <button type="button" className="imageLightbox__close" onClick={() => setLightboxOpen(false)} aria-label="Закрыть">
              ×
            </button>
            <button
              type="button"
              className="imageLightbox__nav imageLightbox__nav--prev"
              disabled={activeImage <= 0}
              onClick={(event) => {
                event.stopPropagation();
                setActiveImage((current) => Math.max(0, current - 1));
              }}
              aria-label="Предыдущее фото"
            >
              ‹
            </button>
            <img src={image} alt={product.title} onClick={(event) => event.stopPropagation()} />
            <button
              type="button"
              className="imageLightbox__nav imageLightbox__nav--next"
              disabled={activeImage >= images.length - 1}
              onClick={(event) => {
                event.stopPropagation();
                setActiveImage((current) => Math.min(images.length - 1, current + 1));
              }}
              aria-label="Следующее фото"
            >
              ›
            </button>
          </div>
        ) : null}
      </>
    );
  }

  if (isShoesProduct(product)) {
    return (
      <>
        <ShoesProductPage
          product={product}
          seller={seller}
          images={images}
          activeImage={activeImage}
          setActiveImage={setActiveImage}
          specs={specs}
          reviews={reviews}
          hasInCart={has(product.id)}
          onAddToCart={() => add(product.id)}
          onBuyNow={buyNow}
          onToggleLike={() => void toggleLike()}
          onOpenImage={() => image && setLightboxOpen(true)}
        />

        {lightboxOpen && image ? (
          <div className="imageLightbox" role="dialog" aria-modal="true" aria-label="Просмотр фото товара" onClick={() => setLightboxOpen(false)}>
            <button type="button" className="imageLightbox__close" onClick={() => setLightboxOpen(false)} aria-label="Закрыть">
              ×
            </button>
            <button
              type="button"
              className="imageLightbox__nav imageLightbox__nav--prev"
              disabled={activeImage <= 0}
              onClick={(event) => {
                event.stopPropagation();
                setActiveImage((current) => Math.max(0, current - 1));
              }}
              aria-label="Предыдущее фото"
            >
              ‹
            </button>
            <img src={image} alt={product.title} onClick={(event) => event.stopPropagation()} />
            <button
              type="button"
              className="imageLightbox__nav imageLightbox__nav--next"
              disabled={activeImage >= images.length - 1}
              onClick={(event) => {
                event.stopPropagation();
                setActiveImage((current) => Math.min(images.length - 1, current + 1));
              }}
              aria-label="Следующее фото"
            >
              ›
            </button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="legacy-product-page container">
      <nav className="crumbs" aria-label="Хлебные крошки">
        <Link to="/">Главная</Link>
        <span>›</span>
        <Link to={product.category ? `/catalog?cat=${encodeURIComponent(product.category)}` : "/catalog"}>{product.category || "Категория"}</Link>
        <span>›</span>
        <span>{product.title}</span>
      </nav>

      <section className="productLayout">
        <section className="galleryCard">
          <div className="p__media">
            <button
              type="button"
              className={`favBtn ${product.is_liked ? "is-on" : ""}`}
              onClick={() => void toggleLike()}
              aria-label={product.is_liked ? "Убрать из избранного" : "Добавить в избранное"}
              aria-pressed={Boolean(product.is_liked)}
            >
              <span className="favBtn__icon">{product.is_liked ? "♥" : "♡"}</span>
              <span className="favBtn__text">{product.likes || 0}</span>
            </button>
            <button type="button" className="heroBox heroBox--button" onClick={() => image && setLightboxOpen(true)} aria-label="Открыть фото товара">
              {image ? <img src={image} alt={product.title} className="product-media__image" /> : <span className="heroBox__empty">Нет фото</span>}
              {image ? <span className="heroBox__zoom">Открыть фото</span> : null}
            </button>
            {images.length > 1 ? (
              <>
                <button
                  type="button"
                  className="productImageNav productImageNav--prev"
                  disabled={activeImage <= 0}
                  onClick={() => setActiveImage((current) => Math.max(0, current - 1))}
                  aria-label="Предыдущее фото"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="productImageNav productImageNav--next"
                  disabled={activeImage >= images.length - 1}
                  onClick={() => setActiveImage((current) => Math.min(images.length - 1, current + 1))}
                  aria-label="Следующее фото"
                >
                  ›
                </button>
              </>
            ) : null}
          </div>
          <div className="thumbs">
            {images.map((src, index) => (
              <button key={`${src}-${index}`} type="button" className={index === activeImage ? "is-active" : ""} onClick={() => setActiveImage(index)}>
                <img src={src} alt={`${product.title} ${index + 1}`} />
              </button>
            ))}
          </div>
        </section>

        <section className="infoCard">
          <div className="infoHead">
            <h1>{product.title}</h1>
            <div className="productMetaLine">
              <span>{product.category || "Категория"}</span>
              <span>{ratingValue > 0 ? `★ ${ratingValue.toFixed(1)}` : "Без оценок"}</span>
              <span>{reviewCount ? `${reviewCount} отзывов` : "Отзывов пока нет"}</span>
            </div>
          </div>

          {seller ? (
            <Link to={`/sellers/${seller.id}`} className="sellerMiniCard">
              <span className="sellerMiniCard__avatar">
                {seller.avatar_url ? <img src={seller.avatar_url} alt={seller.name} /> : null}
              </span>
              <span className="sellerMiniCard__text">
                <span className="sellerMiniCard__name">{seller.name}</span>
                <span className="sellerMiniCard__meta">Перейти в магазин</span>
              </span>
            </Link>
          ) : null}

          <div className="p__buy">
            <div className="buyTopRow">
              <div>
                <div className="buyLabel">Цена</div>
                <div className="p__price">{formatPrice(product.price)}</div>
              </div>
              <div className="stockBadge">{product.stock > 0 ? `В наличии: ${product.stock}` : "Нет в наличии"}</div>
            </div>

            <div className="p__btns">
              <button type="button" className="linkBtn" onClick={() => add(product.id)}>
                {has(product.id) ? "В корзину добавлено" : "В корзину"}
              </button>
              <button type="button" className="linkBtn" onClick={buyNow}>
                Купить сейчас
              </button>
            </div>
          </div>

        </section>
      </section>

      <section className="contentCard productTabsCard">
        <div className="productTabs" role="tablist" aria-label="Информация о товаре">
          <button type="button" className={activeProductTab === "description" ? "is-active" : ""} onClick={() => setActiveProductTab("description")}>
            Описание
          </button>
          <button type="button" className={activeProductTab === "specs" ? "is-active" : ""} onClick={() => setActiveProductTab("specs")}>
            Характеристики
          </button>
          <button type="button" className={activeProductTab === "reviews" ? "is-active" : ""} onClick={() => setActiveProductTab("reviews")}>
            Отзывы <span>{reviews.length}</span>
          </button>
        </div>

        {activeProductTab === "description" ? (
          <div className="productTabPanel productDescriptionCard">
            <p>{product.description || "Без описания"}</p>
          </div>
        ) : null}

        {activeProductTab === "specs" ? (
          <div className="productTabPanel">
            <div className="specGrid">
              {specs.map((spec) => (
                <div key={`${spec.key}-${spec.value}`} className="spec">
                  <div className="spec__k">{spec.key}</div>
                  <div className="spec__v">{spec.value}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {activeProductTab === "reviews" ? (
          <div className="productTabPanel productReviewsPreview">
            <div className="productReviewsPreview__head">
              <div>
                <h2 className="sectionTitle">Отзывы покупателей</h2>
                <span>{ratingValue > 0 ? `★ ${ratingValue.toFixed(1)}` : "Пока без оценки"}</span>
              </div>
              <span>{reviews.length}</span>
            </div>

            {reviews.length ? (
              <div className="productReviewsPreview__list">
                {reviews.map((review) => (
                  <article key={review.id} className="productReviewMini">
                    <div>
                      <strong>{review.name || review.user_name || "Покупатель"}</strong>
                      <span>★ {review.rating}</span>
                    </div>
                    <p>{review.comment || "Без комментария."}</p>
                    <small>{formatDate(review.created_at)}</small>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">Отзывов пока нет.</p>
            )}

            <form className="profile-form productReviewFormCard" onSubmit={submitReview}>
              <label className="field">
                <span className="field-label">Оценка</span>
                <SelectField className="field-input" value={reviewForm.rating} onChange={(event) => setReviewForm((current) => ({ ...current, rating: event.target.value }))}>
                  <option value="5">5</option>
                  <option value="4">4</option>
                  <option value="3">3</option>
                  <option value="2">2</option>
                  <option value="1">1</option>
                </SelectField>
              </label>
              <label className="field productReviewFormCard__comment">
                <span className="field-label">Комментарий</span>
                <textarea className="field-input field-input--area" value={reviewForm.comment} onChange={(event) => setReviewForm((current) => ({ ...current, comment: event.target.value }))} />
              </label>
              {reviewStatus ? <div className="field-hint">{reviewStatus}</div> : null}
              <button type="submit" className="linkBtn" disabled={!canReview}>
                Оставить отзыв
              </button>
            </form>
          </div>
        ) : null}
      </section>

      {related.length ? (
        <section className="showcase-row productRecommendations" style={{ marginTop: 22 }}>
          <div className="showcase-row__head">
            <div className="showcase-row__title">Похожие товары</div>
          </div>
          <div className="legacy-grid">
            {related.map((item) => (
              <Link key={item.id} to={`/product/${item.id}`} className="card">
                <div className="card__img">
                  {item.images?.[0] || item.image_url ? <img src={item.images?.[0] || item.image_url} alt={item.title} /> : null}
                </div>
                <div className="card__body">
                  <div className="card__title">{item.title}</div>
                  <div className="price">{formatPrice(item.price)}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {recent.length ? (
        <section className="showcase-row productRecommendations" style={{ marginTop: 22 }}>
          <div className="showcase-row__head">
            <div className="showcase-row__title">Вы недавно смотрели</div>
          </div>
          <div className="legacy-grid">
            {recent.map((item) => (
              <Link key={item.id} to={`/product/${item.id}`} className="card">
                <div className="card__img">
                  {item.images?.[0] || item.image_url ? <img src={item.images?.[0] || item.image_url} alt={item.title} /> : null}
                </div>
                <div className="card__body">
                  <div className="card__title">{item.title}</div>
                  <div className="price">{formatPrice(item.price)}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {lightboxOpen && image ? (
        <div className="imageLightbox" role="dialog" aria-modal="true" aria-label="Просмотр фото товара" onClick={() => setLightboxOpen(false)}>
          <button type="button" className="imageLightbox__close" onClick={() => setLightboxOpen(false)} aria-label="Закрыть">
            ×
          </button>
          <button
            type="button"
            className="imageLightbox__nav imageLightbox__nav--prev"
            disabled={activeImage <= 0}
            onClick={(event) => {
              event.stopPropagation();
              setActiveImage((current) => Math.max(0, current - 1));
            }}
            aria-label="Предыдущее фото"
          >
            ‹
          </button>
          <img src={image} alt={product.title} onClick={(event) => event.stopPropagation()} />
          <button
            type="button"
            className="imageLightbox__nav imageLightbox__nav--next"
            disabled={activeImage >= images.length - 1}
            onClick={(event) => {
              event.stopPropagation();
              setActiveImage((current) => Math.min(images.length - 1, current + 1));
            }}
            aria-label="Следующее фото"
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  );
}
