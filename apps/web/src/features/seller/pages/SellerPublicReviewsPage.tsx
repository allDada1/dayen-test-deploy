import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { SectionHeading } from "../../../components/SectionHeading";
import { api } from "../../../services/api";
import { formatDate } from "../../../services/format";
import type { Review, SellerProfile } from "../../../types/api";

export function SellerPublicReviewsPage() {
  const { id } = useParams();
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    const sellerId = Number(id);
    if (!sellerId) return;
    void api.getSeller(sellerId).then((response) => setSeller(response.seller));
    void api.getSellerPublicReviews(sellerId).then((response) => setReviews(response.items));
  }, [id]);

  return (
    <div className="page-shell shell-container section-stack sellerReviewsPage">
      <section className="page-hero page-hero--compact sellerReviewsHero">
        <SectionHeading
          eyebrow="Отзывы"
          title={seller ? `Отзывы о магазине ${seller.name}` : "Отзывы магазина"}
          description="Оценки и комментарии покупателей по товарам этого продавца."
        />
        {seller?.id ? (
          <Link to={`/sellers/${seller.id}`} className="shell-button shell-button--ghost">
            Назад в магазин
          </Link>
        ) : null}
      </section>

      {reviews.length ? (
        <div className="sellerReviewsList">
          {reviews.map((review) => {
            const productId = review.product_id_ref || review.product_id;

            return (
              <article key={review.id} className="sellerReviewCard">
                {review.product_image_url ? (
                  productId ? (
                    <Link to={`/product/${productId}`} className="sellerReviewCard__thumb">
                      <img src={review.product_image_url} alt={review.product_title || "Товар"} />
                    </Link>
                  ) : (
                    <div className="sellerReviewCard__thumb">
                      <img src={review.product_image_url} alt={review.product_title || "Товар"} />
                    </div>
                  )
                ) : null}

                <div className="sellerReviewCard__body">
                  <div className="sellerReviewCard__top">
                    <div>
                      <div className="order-card__eyebrow">{review.user_name || "Покупатель"}</div>
                      {productId ? (
                        <Link to={`/product/${productId}`} className="sellerReviewCard__product">
                          {review.product_title || "Товар"}
                        </Link>
                      ) : (
                        <strong>{review.product_title || "Товар"}</strong>
                      )}
                    </div>
                    <span className="tiny-chip is-active">★ {review.rating}</span>
                  </div>
                  <p className="order-card__note">{review.comment || "Без комментария."}</p>
                  <div className="order-card__eyebrow">{formatDate(review.created_at)}</div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="empty-panel sellerReviewsEmpty">
          <h2>Отзывов пока нет</h2>
          <p>Когда покупатели оставят оценки товарам этого продавца, они появятся здесь.</p>
          {seller?.id ? (
            <Link to={`/sellers/${seller.id}`} className="shell-button">
              Вернуться в магазин
            </Link>
          ) : null}
        </section>
      )}
    </div>
  );
}
