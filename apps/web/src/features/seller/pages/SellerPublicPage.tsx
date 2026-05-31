import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Grid3X3, Headphones, List, ShieldCheck, Truck } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";

import { ProductCard } from "../../../components/ProductCard";
import { ChatSocialIcon, InstagramIcon, TelegramIcon, TikTokIcon, WhatsAppIcon } from "../../../components/icons/SocialIcons";
import { useAuth } from "../../../providers/auth";
import { useToast } from "../../../providers/toast";
import { api } from "../../../services/api";
import type { Product, Review, SellerProfile, SellerStats } from "../../../types/api";

const sellerBenefits = [
  { Icon: BadgeCheck, title: "Оригинальная продукция" },
  { Icon: ShieldCheck, title: "Официальная гарантия" },
  { Icon: Truck, title: "Быстрая доставка" },
  { Icon: Headphones, title: "Поддержка 24/7" },
];

function whatsappHref(value?: string) {
  if (!value) return "";
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : trimmed;
}

export function SellerPublicPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [following, setFollowing] = useState(false);
  const [sort, setSort] = useState("default");
  const [view, setView] = useState<"grid" | "list">("grid");

  useEffect(() => {
    const sellerId = Number(id);
    if (!sellerId) return;

    void api.getSeller(sellerId).then((response) => {
      setSeller(response.seller);
      setStats(response.stats);
    });
    void api.getSellerPublicProducts(sellerId).then((response) => setProducts(response.items));
    void api.getSellerPublicReviews(sellerId).then((response) => setReviews(response.items)).catch(() => setReviews([]));

    if (user && Number(user.id) !== sellerId) {
      void api.getSellerFollowing(sellerId).then((response) => setFollowing(response.following)).catch(() => setFollowing(false));
    }
  }, [id, user]);

  if (id && Number.isNaN(Number(id))) {
    return <Navigate to="/" replace />;
  }

  async function toggleFollow() {
    if (!seller?.id) return;
    if (following) {
      await api.unfollowSeller(seller.id);
      setFollowing(false);
    } else {
      await api.followSeller(seller.id);
      setFollowing(true);
    }
  }

  async function shareSeller() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Ссылка на магазин скопирована.");
    } catch {
      toast.info(url);
    }
  }

  const sortedProducts = useMemo(() => {
    const next = [...products];
    if (sort === "cheap") next.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    if (sort === "expensive") next.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    if (sort === "name") next.sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "ru"));
    return next;
  }, [products, sort]);

  const isOwnSeller = Boolean(user && seller && Number(user.id) === Number(seller.id));
  const reviewCount = reviews.length || stats?.review_count || 0;
  const reviewAverage = reviews.length
    ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length
    : 0;

  return (
    <div className="container legacy-seller-page">
      <section className="sellerShopHero">
        <div
          className="sellerShopHero__banner"
          style={{
            backgroundImage: seller?.banner_url
              ? `linear-gradient(rgba(7,7,7,.42), rgba(7,7,7,.46)), url(${seller.banner_url})`
              : "linear-gradient(135deg, rgba(54,45,37,.92), rgba(15,15,14,.94))",
          }}
        >
          <div className="sellerShopHero__main">
            <div className="sellerShopHero__avatar">
              {seller?.avatar_url ? <img src={seller.avatar_url} alt={seller.name} /> : null}
            </div>
            <div>
              <div className="sellerShopHero__name">{seller?.name || "Магазин"}</div>
              <div className="sellerVerify">✓ Проверенный магазин</div>
            </div>
          </div>

          <div className="sellerShopHero__actions">
            {user && !isOwnSeller ? (
              <button type="button" className="sellerHeroButton sellerHeroButton--primary" onClick={() => void toggleFollow()}>
                {following ? "Вы подписаны" : "Подписаться"}
              </button>
            ) : null}
            <button type="button" className="sellerHeroButton" onClick={() => void shareSeller()}>
              Поделиться
            </button>
            {isOwnSeller ? <span className="sellerHeroButton">Это ваш магазин</span> : null}
          </div>
        </div>
      </section>

      <section className="sellerInfoGrid">
        <article className="sellerInfoCard sellerInfoCard--about">
          <h2 className="sectionTitle">О магазине</h2>
          <p className="catalogSub">{seller?.about || "Описание магазина пока не заполнено."}</p>

          <div className="sellerBenefitGrid">
            {sellerBenefits.map((benefit) => (
              <div key={benefit.title} className="sellerBenefit">
                <span aria-hidden="true">
                  <benefit.Icon size={18} strokeWidth={2.2} />
                </span>
                <strong>{benefit.title}</strong>
              </div>
            ))}
          </div>
        </article>

        <aside className="sellerInfoSide">
          <article className="sellerInfoCard sellerContactsBlock">
            <h2 className="sectionTitle">Контакты</h2>
            <div className="siteFooter__socials">
              {seller?.telegram ? (
                <a className="siteFooter__social siteFooter__social--telegram" href={seller.telegram} target="_blank" rel="noreferrer" aria-label="Telegram">
                  <TelegramIcon />
                </a>
              ) : null}
              {seller?.instagram ? (
                <a className="siteFooter__social siteFooter__social--instagram" href={seller.instagram} target="_blank" rel="noreferrer" aria-label="Instagram">
                  <InstagramIcon />
                </a>
              ) : null}
              {seller?.whatsapp ? (
                <a className="siteFooter__social siteFooter__social--whatsapp" href={whatsappHref(seller.whatsapp)} target="_blank" rel="noreferrer" aria-label="WhatsApp">
                  <WhatsAppIcon />
                </a>
              ) : (
                <Link className="siteFooter__social siteFooter__social--chat" to="/about/support" aria-label="Чат">
                  <ChatSocialIcon />
                </Link>
              )}
              {seller?.tiktok ? (
                <a className="siteFooter__social siteFooter__social--tiktok" href={seller.tiktok} target="_blank" rel="noreferrer" aria-label="TikTok">
                  <TikTokIcon />
                </a>
              ) : null}
            </div>
          </article>

          <article className="sellerRatingCard">
            <div className="sellerRatingCard__score">
              <span>★</span>
              <div>
                <strong>{reviewCount && reviewAverage ? reviewAverage.toFixed(1) : "—"}</strong>
                <small>{reviewCount ? `на основе ${reviewCount} отзывов` : "отзывов пока нет"}</small>
              </div>
            </div>

            {seller?.id ? (
              <Link to={`/sellers/${seller.id}/reviews`} className="sellerReviewsLink">
                <span>Отзывы магазина</span>
                <strong>{reviewCount}</strong>
              </Link>
            ) : null}
          </article>
        </aside>
      </section>

      <section className="sellerProductsSection">
        <div className="sellerProductsToolbar">
          <div className="sellerProductsTabs">
            <span className="sellerProductsTab is-active">Все товары</span>
          </div>

          <div className="sellerSortChips">
            <button type="button" className={sort === "default" ? "chip is-active" : "chip"} onClick={() => setSort("default")}>По умолчанию</button>
            <button type="button" className={sort === "cheap" ? "chip is-active" : "chip"} onClick={() => setSort("cheap")}>Дешёвые</button>
            <button type="button" className={sort === "expensive" ? "chip is-active" : "chip"} onClick={() => setSort("expensive")}>Дорогие</button>
            <button type="button" className={sort === "name" ? "chip is-active" : "chip"} onClick={() => setSort("name")}>По названию</button>
          </div>

          <div className="sellerViewSwitch" aria-label="Вид товаров">
            <button type="button" className={view === "grid" ? "is-active" : ""} onClick={() => setView("grid")} aria-label="Плитка">
              <Grid3X3 size={18} strokeWidth={2.2} />
            </button>
            <button type="button" className={view === "list" ? "is-active" : ""} onClick={() => setView("list")} aria-label="Список">
              <List size={19} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        <div className={`legacy-grid sellerProductsGrid sellerProductsGrid--${view}`}>
          {sortedProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
