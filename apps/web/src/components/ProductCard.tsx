import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../providers/auth";
import { useCart } from "../providers/cart";
import { useToast } from "../providers/toast";
import { api } from "../services/api";
import { getErrorMessage } from "../services/errors";
import { formatPrice } from "../services/format";
import type { Product } from "../types/api";

type ProductCardProps = {
  product: Product;
  onLikeChange?: (productId: number, liked: boolean) => void;
};

export function ProductCard({ product, onLikeChange }: ProductCardProps) {
  const navigate = useNavigate();
  const { add, has } = useCart();
  const { user } = useAuth();
  const toast = useToast();
  const [liked, setLiked] = useState(Boolean(product.is_liked));

  const image = product.images?.[0] || product.image_url || "";
  const rating = Number(product.rating_avg || 0);

  function openProduct() {
    navigate(`/product/${product.id}`);
  }

  function openProductByKeyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter") openProduct();
  }

  function stopCardClick(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();
  }

  async function toggleLike() {
    if (!user) {
      toast.warning("Войдите в аккаунт, чтобы добавить товар в избранное.");
      return;
    }

    try {
      const next = await api.likeProduct(product.id);
      setLiked(next.liked);
      onLikeChange?.(product.id, next.liked);
      if (next.liked) {
        toast.favorite("Товар сохранён в вашем избранном.", {
          action: { label: "Перейти в избранное", href: "/favorites" },
        });
      } else {
        toast.info("Товар удалён из избранного.", {
          title: "Избранное обновлено",
        });
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось изменить избранное."));
    }
  }

  return (
    <article className="card" role="link" tabIndex={0} onClick={openProduct} onKeyDown={openProductByKeyboard}>
      <Link to={`/product/${product.id}`} className="card__img" onClick={stopCardClick}>
        {image ? (
          <img src={image} alt={product.title} />
        ) : (
          <div className="product-card__placeholder">{product.category?.slice(0, 1) || "D"}</div>
        )}
        <span className="card__tag">{product.category}</span>
      </Link>

      <button
        type="button"
        className={`card__fav ${liked ? "is-liked" : ""}`}
        onClick={(event) => {
          event.stopPropagation();
          void toggleLike();
        }}
        title={liked ? "Убрать из избранного" : "В избранное"}
        aria-label={liked ? "Убрать из избранного" : "Добавить в избранное"}
        aria-pressed={liked}
      >
        {liked ? "♥" : "♡"}
      </button>

      <div className="card__body">
        <h3 className="card__title">{product.title}</h3>

        <div className="card__row">
          <div className="card__priceRow">
            <div className="price">{formatPrice(product.price)}</div>
            <span className="ratingBadge">{rating > 0 ? `★ ${rating.toFixed(1)}` : "Без оценок"}</span>
          </div>

          <div className="product-card__actions" onClick={stopCardClick}>
            <button type="button" className="linkBtn" onClick={() => add(product.id)}>
              {has(product.id) ? "В корзине" : "В корзину"}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
