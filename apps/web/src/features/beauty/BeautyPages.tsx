import { useEffect, useMemo, useState } from "react";
import { Grid3X3, List } from "lucide-react";
import { Link } from "react-router-dom";

import { CartIcon } from "../../components/icons/CartIcon";
import { useCart } from "../../providers/cart";
import { useToast } from "../../providers/toast";
import { formatDate, formatPrice } from "../../services/format";
import type { HomeHeroBanner, Product, Review, SellerProfile } from "../../types/api";

type BeautyCategory = {
  title: string;
  slug: string;
  tone: string;
  keywords: string[];
};

type BeautyDisplayProduct = {
  id: string;
  productId?: number;
  title: string;
  subtitle: string;
  price: number;
  oldPrice?: number;
  badge?: string;
  image?: string;
  tone: string;
  brand?: string;
  skinType?: string;
  purpose?: string;
  volume?: string;
};

type BeautyProductTab = "description" | "specs" | "delivery" | "reviews";

const beautyCategories: BeautyCategory[] = [
  { title: "Уход за лицом", slug: "skincare", tone: "serum", keywords: ["лиц", "кожа", "сыворот", "крем", "тоник", "маск", "skincare", "serum", "cream"] },
  { title: "Уход за волосами", slug: "haircare", tone: "hair", keywords: ["волос", "шампун", "бальзам", "масло", "hair", "shampoo"] },
  { title: "Макияж", slug: "makeup", tone: "makeup", keywords: ["макияж", "тональ", "пудр", "помад", "туш", "makeup"] },
  { title: "Здоровье", slug: "health", tone: "health", keywords: ["здоров", "уход", "wellness", "health"] },
  { title: "Витамины", slug: "vitamins", tone: "vitamins", keywords: ["витамин", "добав", "капсул", "vitamin"] },
  { title: "Ароматы", slug: "fragrances", tone: "fragrance", keywords: ["аромат", "духи", "парф", "fragrance", "perfume"] },
];

const sortOptions = [
  { label: "Популярные", value: "popular" },
  { label: "Новинки", value: "new" },
  { label: "Цена: по возрастанию", value: "price_asc" },
  { label: "Цена: по убыванию", value: "price_desc" },
  { label: "Скидки", value: "sale" },
];

const skinTypes = ["Сухая", "Жирная", "Комбинированная", "Чувствительная", "Нормальная"];
const purposes = ["Увлажнение", "Очищение", "Сияние", "Восстановление", "Антивозрастной уход"];

function specValue(specs: Array<{ key: string; value: string }>, markers: string[]) {
  const found = specs.find((spec) => {
    const key = spec.key.toLowerCase();
    return markers.some((marker) => key.includes(marker));
  });

  return found?.value || "";
}

function moneyFromSpec(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function productSpecs(product: Product) {
  if (Array.isArray(product.specs)) return product.specs;
  if (!product.specs_json) return [];

  try {
    const parsed = JSON.parse(product.specs_json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        key: String(item?.key || item?.label || item?.name || "").trim(),
        value: String(item?.value || "").trim(),
      }))
      .filter((item) => item.key || item.value);
  } catch {
    return [];
  }
}

function beautyHaystack(product: Product) {
  return [product.title, product.description, product.category, product.section, product.tile_slug]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function isBeautyProduct(product: Product) {
  const haystack = beautyHaystack(product);
  return /beauty|health|wellness|красот|здоров|уход|кожа|лиц|волос|макияж|витамин|аромат|парф|сыворот|крем|тоник|маск|шампун/i.test(haystack);
}

function beautyCategoryForProduct(product: Product) {
  const haystack = beautyHaystack(product);
  return beautyCategories.find((category) => category.keywords.some((keyword) => haystack.includes(keyword))) || null;
}

function oldPriceFromProduct(product: Product) {
  return moneyFromSpec(specValue(productSpecs(product), ["старая", "old price", "old_price", "до скидки"]));
}

function beautyProducts(products: Product[], categorySlug?: string) {
  const realProducts = products.filter(isBeautyProduct);
  if (!categorySlug) return realProducts;
  return realProducts.filter((product) => beautyCategoryForProduct(product)?.slug === categorySlug);
}

function productsToBeauty(products: Product[], categorySlug?: string) {
  return beautyProducts(products, categorySlug).slice(0, 24).map((product, index) => {
    const specs = productSpecs(product);
    const oldPrice = oldPriceFromProduct(product);
    const price = Number(product.price || 0);
    const category = beautyCategoryForProduct(product);

    return {
      id: String(product.id),
      productId: product.id,
      title: product.title,
      subtitle: product.category || category?.title || product.section || "Красота и здоровье",
      price,
      oldPrice: oldPrice > price ? oldPrice : undefined,
      badge: oldPrice > price ? "Скидка" : product.stock <= 3 ? "Мало" : undefined,
      image: product.images?.[0] || product.image_url || "",
      tone: category?.tone || ["serum", "cream", "leaf", "pearl"][index % 4],
      brand: specValue(specs, ["бренд", "brand"]),
      skinType: specValue(specs, ["тип кожи", "кожа"]),
      purpose: specValue(specs, ["назнач", "эффект"]),
      volume: specValue(specs, ["объ", "мл", "volume"]),
    } satisfies BeautyDisplayProduct;
  });
}

function categoryCount(products: Product[], category: BeautyCategory) {
  return beautyProducts(products, category.slug).length;
}

function categoryPreviewImage(products: Product[], category: BeautyCategory) {
  const product = beautyProducts(products, category.slug).find((item) => item.images?.[0] || item.image_url);
  return product?.images?.[0] || product?.image_url || "";
}

function productCountText(count: number) {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  if (lastDigit === 1 && lastTwoDigits !== 11) return `${count} товар`;
  if ([2, 3, 4].includes(lastDigit) && ![12, 13, 14].includes(lastTwoDigits)) return `${count} товара`;
  return `${count} товаров`;
}

function isActiveBanner(banner?: HomeHeroBanner | null) {
  return Boolean(banner && banner.is_active !== 0 && banner.title?.trim());
}

function BeautyScene({ tone = "serum" }: { tone?: string }) {
  return (
    <div className={`beautyScene beautyScene--${tone}`}>
      <span className="beautyScene__leaf" />
      <span className="beautyScene__bottle beautyScene__bottle--tall" />
      <span className="beautyScene__bottle beautyScene__bottle--drop" />
      <span className="beautyScene__jar" />
      <span className="beautyScene__cream" />
    </div>
  );
}

function BeautyButton({ to, children, soft = false }: { to: string; children: string; soft?: boolean }) {
  return (
    <Link to={to} className={soft ? "beautyButton beautyButton--soft" : "beautyButton"}>
      {children}
    </Link>
  );
}

function SectionHead({ title, action }: { title: string; action?: string }) {
  return (
    <div className="beautySectionHead">
      <h2>{title}</h2>
      {action ? (
        <button type="button" className="beautyTextButton">
          {action}
        </button>
      ) : null}
    </div>
  );
}

function BeautyManagedBanner({ banner, fallbackHref = "/tile/beauty-health/skincare" }: { banner?: HomeHeroBanner | null; fallbackHref?: string }) {
  const activeBanner = isActiveBanner(banner) ? banner : null;
  if (!activeBanner) return null;

  return (
    <section className="beautyManagedBanner">
      <div className="beautyManagedBanner__copy">
        {activeBanner.eyebrow ? <span>{activeBanner.eyebrow}</span> : null}
        <h2>{activeBanner.title}</h2>
        {activeBanner.description ? <p>{activeBanner.description}</p> : null}
        {activeBanner.cta_label ? <BeautyButton to={activeBanner.cta_href || fallbackHref}>{activeBanner.cta_label}</BeautyButton> : null}
      </div>
      <div className="beautyManagedBanner__visual">
        {activeBanner.image_url ? <img src={activeBanner.image_url} alt={activeBanner.title} /> : <BeautyScene />}
      </div>
    </section>
  );
}

function BeautyProductCard({ product }: { product: BeautyDisplayProduct }) {
  const { add } = useCart();
  const toast = useToast();

  function addToCart() {
    if (!product.productId) {
      toast.warning("Этот товар пока недоступен для корзины.");
      return;
    }
    add(product.productId);
    toast.success("Товар добавлен в корзину.");
  }

  return (
    <article className="beautyProductCard">
      <Link to={product.productId ? `/product/${product.productId}` : "#"} className="beautyProductCard__image">
        {product.badge ? <span className="beautyBadge">{product.badge}</span> : null}
        <button type="button" className="beautyFavorite" aria-label="Добавить в избранное">
          ♡
        </button>
        {product.image ? <img src={product.image} alt={product.title} /> : <BeautyScene tone={product.tone} />}
      </Link>
      <div className="beautyProductCard__body">
        <Link to={product.productId ? `/product/${product.productId}` : "#"} className="beautyProductCard__details">
          <span className="beautyProductCard__title">{product.title}</span>
          <span className="beautyProductCard__subtitle">{product.subtitle}</span>
          <span className="beautyProductCard__price">
            <strong>{formatPrice(product.price)}</strong>
            {product.oldPrice ? <span>{formatPrice(product.oldPrice)}</span> : null}
          </span>
        </Link>
        <button type="button" className="beautyCartButton" onClick={addToCart} aria-label="Добавить в корзину">
          <CartIcon />
        </button>
      </div>
    </article>
  );
}

function BeautyBenefits() {
  const benefits = [
    ["✦", "Проверенные продавцы", "Только надёжные партнёры"],
    ["◌", "Бережная доставка", "Аккуратно и в срок"],
    ["◇", "Оригинальные товары", "100% подлинность"],
    ["♡", "Поддержка Dayen", "Поможем в любой ситуации"],
  ];

  return (
    <section className="beautyBenefits">
      {benefits.map(([icon, title, text]) => (
        <article key={title}>
          <span>{icon}</span>
          <div>
            <strong>{title}</strong>
            <p>{text}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

export function BeautyHomePage({ products, banner, loading = false }: { products: Product[]; banner?: HomeHeroBanner | null; loading?: boolean }) {
  const displayProducts = productsToBeauty(products).slice(0, 6);
  const activeBanner = isActiveBanner(banner);
  const collections = beautyCategories
    .map((category) => ({ ...category, count: categoryCount(products, category), image: categoryPreviewImage(products, category) }))
    .filter((category) => category.count > 0)
    .slice(0, 4);

  return (
    <main className="beautyPage">
      {activeBanner ? (
        <BeautyManagedBanner banner={banner} />
      ) : (
        <section className="beautyHero">
          <div className="beautyHero__copy">
            <span>Красота и здоровье</span>
            <h1>Красота и забота каждый день</h1>
            <p>Уход, здоровье и wellness-товары от разных продавцов Dayen.</p>
            <BeautyButton to="/tile/beauty-health/skincare">Смотреть каталог</BeautyButton>
          </div>
          <BeautyScene />
        </section>
      )}

      <BeautyBenefits />

      <section className="beautySection">
        <SectionHead title="Популярные категории" action="Смотреть все" />
        <div className="beautyCategoryGrid">
          {beautyCategories.map((category) => (
            <Link key={category.slug} to={`/tile/beauty-health/${category.slug}`} className="beautyCategoryCard">
              <span className="beautyCategoryCard__image">
                {categoryPreviewImage(products, category) ? <img src={categoryPreviewImage(products, category)} alt={category.title} /> : <BeautyScene tone={category.tone} />}
              </span>
              <strong>{category.title}</strong>
              <small>{productCountText(categoryCount(products, category))}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="beautySection">
        <SectionHead title="Популярные товары" />
        {displayProducts.length ? (
          <div className="beautyProductGrid beautyProductGrid--six">
            {displayProducts.map((product) => (
              <BeautyProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="beautyEmptyState">
            {loading ? "Загрузка товаров..." : "Пока нет товаров раздела «Красота и здоровье»."}
          </div>
        )}
      </section>

      <section className="beautyPromo">
        <div>
          <h2>Ежедневный уход без лишнего шума</h2>
          <p>Подборка мягких средств для вашей рутины, сияния и спокойного ухода.</p>
          <BeautyButton to="/tile/beauty-health/skincare">Смотреть подборку</BeautyButton>
        </div>
        <BeautyScene tone="cream" />
      </section>

      {collections.length ? (
        <section className="beautySection">
          <SectionHead title="Подборки для вас" action="Смотреть все" />
          <div className="beautyCollectionsGrid">
            {collections.map((item) => (
              <Link key={item.slug} to={`/tile/beauty-health/${item.slug}`} className="beautyCollectionCard">
                {item.image ? <img src={item.image} alt={item.title} /> : <BeautyScene tone={item.tone} />}
                <div>
                  <span>Dayen Beauty</span>
                  <strong>{item.title}</strong>
                  <p>{productCountText(item.count)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="beautyTrust">
        {["Проверка продавцов", "Безопасная оплата", "Поддержка при споре", "Удобный возврат"].map((item) => (
          <article key={item}>
            <span>♡</span>
            <strong>{item}</strong>
            <p>Dayen помогает сохранять спокойствие на каждом шаге покупки.</p>
          </article>
        ))}
      </section>
    </main>
  );
}

export function BeautyCategoryPage({ products, categorySlug = "skincare", banner, loading = false }: { products: Product[]; categorySlug?: string; banner?: HomeHeroBanner | null; loading?: boolean }) {
  const [sortView, setSortView] = useState("popular");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [priceFrom, setPriceFrom] = useState("");
  const [priceTo, setPriceTo] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedSkin, setSelectedSkin] = useState("");
  const [selectedPurpose, setSelectedPurpose] = useState("");
  const activeCategory = beautyCategories.find((category) => category.slug === categorySlug) || beautyCategories[0];
  const displayProducts = useMemo(() => productsToBeauty(products, activeCategory.slug), [products, activeCategory.slug]);
  const brands = useMemo(() => Array.from(new Set(displayProducts.map((item) => item.brand).filter(Boolean))).slice(0, 8) as string[], [displayProducts]);
  const filteredProducts = useMemo(() => {
    const minPrice = Number(priceFrom.replace(/[^\d]/g, "") || 0);
    const maxPrice = Number(priceTo.replace(/[^\d]/g, "") || 0);

    return displayProducts.filter((product) => {
      if (minPrice && product.price < minPrice) return false;
      if (maxPrice && product.price > maxPrice) return false;
      if (selectedBrand && product.brand !== selectedBrand) return false;
      if (selectedSkin && !String(product.skinType || "").toLowerCase().includes(selectedSkin.toLowerCase())) return false;
      if (selectedPurpose && !String(product.purpose || "").toLowerCase().includes(selectedPurpose.toLowerCase())) return false;
      return true;
    });
  }, [displayProducts, priceFrom, priceTo, selectedBrand, selectedSkin, selectedPurpose]);
  const sortedProducts = useMemo(() => {
    const next = [...filteredProducts];
    if (sortView === "price_asc") next.sort((a, b) => a.price - b.price);
    if (sortView === "price_desc") next.sort((a, b) => b.price - a.price);
    if (sortView === "sale") next.sort((a, b) => Number(Boolean(b.oldPrice)) - Number(Boolean(a.oldPrice)) || b.price - a.price);
    if (sortView === "new") next.sort((a, b) => Number(b.productId || 0) - Number(a.productId || 0));
    return next;
  }, [filteredProducts, sortView]);

  function resetFilters() {
    setPriceFrom("");
    setPriceTo("");
    setSelectedBrand("");
    setSelectedSkin("");
    setSelectedPurpose("");
  }

  return (
    <main className="beautyPage beautyCategoryPage">
      <nav className="beautyCrumbs">
        <Link to="/">Главная</Link>
        <span>›</span>
        <Link to="/tile/beauty-health">Красота и здоровье</Link>
        <span>›</span>
        <span>{activeCategory.title}</span>
      </nav>

      <BeautyManagedBanner banner={banner} fallbackHref={`/tile/beauty-health/${activeCategory.slug}`} />

      <div className={filtersOpen ? "beautyCatalogLayout filters-open" : "beautyCatalogLayout"}>
        <aside className="beautySidebar" aria-hidden={!filtersOpen}>
          <button type="button" className="beautyFilterClose" onClick={() => setFiltersOpen(false)} aria-label="Закрыть фильтры">×</button>
          <h1>{activeCategory.title}</h1>
          <p>{productCountText(displayProducts.length)}</p>

          <div className="beautyFilterGroup">
            <strong>Категории</strong>
            {beautyCategories.map((item) => (
              <Link key={item.slug} to={`/tile/beauty-health/${item.slug}`} className={item.slug === activeCategory.slug ? "is-active" : ""}>
                {item.title}
              </Link>
            ))}
          </div>

          <div className="beautyFilterGroup">
            <strong>
              Фильтр
              <button type="button" className="beautyResetFilter" onClick={resetFilters}>Сбросить</button>
            </strong>
            <label>Цена</label>
            <div className="beautyInputs">
              <input value={priceFrom} onChange={(event) => setPriceFrom(event.target.value)} inputMode="numeric" placeholder="От 500" />
              <input value={priceTo} onChange={(event) => setPriceTo(event.target.value)} inputMode="numeric" placeholder="До 50 000" />
            </div>
            <label>Бренд</label>
            <select value={selectedBrand} onChange={(event) => setSelectedBrand(event.target.value)}>
              <option value="">Все бренды</option>
              {brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
            </select>
            <label>Тип кожи</label>
            <select value={selectedSkin} onChange={(event) => setSelectedSkin(event.target.value)}>
              <option value="">Любой</option>
              {skinTypes.map((skin) => <option key={skin} value={skin}>{skin}</option>)}
            </select>
            <label>Назначение</label>
            <select value={selectedPurpose} onChange={(event) => setSelectedPurpose(event.target.value)}>
              <option value="">Любое</option>
              {purposes.map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}
            </select>
          </div>
        </aside>

        <section className="beautyCatalogMain">
          <div className="beautySortBar">
            <div>
              <button type="button" className="beautyFilterToggle" onClick={() => setFiltersOpen(true)} aria-label="Открыть фильтры"><span /><span /><span /></button>
              {sortOptions.map((item) => (
                <button key={item.value} type="button" className={sortView === item.value ? "is-active" : ""} onClick={() => setSortView(item.value)}>
                  {item.label}
                </button>
              ))}
            </div>
            <div className="beautyViewSwitch">
              <button type="button" className={viewMode === "grid" ? "is-active" : ""} onClick={() => setViewMode("grid")} aria-label="Показать сеткой">
                <Grid3X3 size={18} strokeWidth={2.2} />
              </button>
              <button type="button" className={viewMode === "list" ? "is-active" : ""} onClick={() => setViewMode("list")} aria-label="Показать списком">
                <List size={19} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          <div className={viewMode === "list" ? "beautyProductGrid beautyProductGrid--catalog is-list" : "beautyProductGrid beautyProductGrid--catalog"}>
            {sortedProducts.map((product) => (
              <BeautyProductCard key={product.id} product={product} />
            ))}
          </div>

          {!sortedProducts.length ? (
            <div className="beautyEmptyState">
              {loading ? "Загрузка товаров..." : "В этой категории пока нет товаров или фильтры слишком строгие."}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

type BeautyProductPageProps = {
  product: Product;
  seller?: SellerProfile | null;
  images: string[];
  activeImage: number;
  setActiveImage: (index: number) => void;
  specs: Array<{ key: string; value: string }>;
  reviews: Review[];
  hasInCart: boolean;
  onAddToCart: () => void;
  onBuyNow: () => void;
  onToggleLike: () => void;
  onOpenImage: () => void;
};

export function BeautyProductPage({ product, seller, images, activeImage, setActiveImage, specs, reviews, hasInCart, onAddToCart, onBuyNow, onToggleLike, onOpenImage }: BeautyProductPageProps) {
  const [activeTab, setActiveTab] = useState<BeautyProductTab>("description");
  const image = images[activeImage] || "";
  const oldPrice = moneyFromSpec(specValue(specs, ["старая", "old price", "old_price", "до скидки"]));
  const hasDiscount = oldPrice > Number(product.price || 0);
  const saving = hasDiscount ? oldPrice - Number(product.price || 0) : 0;
  const rating = Number(product.rating_avg || 0);
  const reviewCount = Number(product.rating_count || reviews.length || 0);
  const visibleThumbs = images.slice(0, 5);
  const brand = specValue(specs, ["бренд", "brand"]);
  const skinType = specValue(specs, ["тип кожи", "кожа"]);
  const volume = specValue(specs, ["объ", "мл", "volume"]);
  const component = specValue(specs, ["компонент", "актив"]);
  const sellerName = seller?.name || seller?.username || "Продавец";
  const tabs: Array<{ id: BeautyProductTab; label: string }> = [
    { id: "description", label: "Описание" },
    { id: "specs", label: "Характеристики" },
    { id: "delivery", label: "Доставка и оплата" },
    { id: "reviews", label: reviewCount ? `Отзывы (${reviewCount})` : "Отзывы" },
  ];

  useEffect(() => {
    document.body.classList.add("beauty-product-shell");
    return () => document.body.classList.remove("beauty-product-shell");
  }, []);

  return (
    <main className="beautyPage beautyProductPage">
      <nav className="beautyCrumbs">
        <Link to="/">Главная</Link><span>›</span><Link to="/tile/beauty-health">Красота и здоровье</Link><span>›</span><span>{product.title}</span>
      </nav>

      <section className="beautyProductLayout">
        <div className="beautyProductGallery">
          <div className="beautyProductGallery__main">
            {hasDiscount ? <span className="beautyBadge">Скидка</span> : null}
            <button type="button" className="beautyProductGallery__fav" onClick={onToggleLike} aria-label="Добавить в избранное">{product.is_liked ? "♥" : "♡"}</button>
            <button type="button" className="beautyProductGallery__arrow beautyProductGallery__arrow--prev" onClick={() => setActiveImage(Math.max(0, activeImage - 1))} disabled={activeImage <= 0} aria-label="Предыдущее фото">‹</button>
            <button type="button" className="beautyProductGallery__open" onClick={onOpenImage} aria-label="Открыть фото товара">
              {image ? <img src={image} alt={product.title} /> : <BeautyScene />}
              {image ? <span>Открыть фото</span> : null}
            </button>
            <button type="button" className="beautyProductGallery__arrow beautyProductGallery__arrow--next" onClick={() => setActiveImage(Math.min(Math.max(images.length - 1, 0), activeImage + 1))} disabled={activeImage >= images.length - 1} aria-label="Следующее фото">›</button>
          </div>

          {visibleThumbs.length > 1 ? (
            <div className="beautyProductThumbs">
              {visibleThumbs.map((src, index) => (
                <button key={`${src}-${index}`} type="button" className={index === activeImage ? "is-active" : ""} onClick={() => setActiveImage(index)}>
                  <img src={src} alt={`${product.title} ${index + 1}`} />
                </button>
              ))}
            </div>
          ) : null}

          <section className="beautyProductTabs">
            <div className="beautyProductTabs__nav">
              {tabs.map((item) => (
                <button key={item.id} type="button" className={activeTab === item.id ? "is-active" : ""} onClick={() => setActiveTab(item.id)}>{item.label}</button>
              ))}
            </div>
            <div className="beautyProductTabs__body">
              {activeTab === "description" ? (
                <div>
                  <p>{product.description || "Продавец пока не добавил подробное описание."}</p>
                  <ul>
                    <li>Категория: {product.category || "Красота и здоровье"}</li>
                    {brand ? <li>Бренд: {brand}</li> : null}
                    {skinType ? <li>Тип кожи: {skinType}</li> : null}
                    {volume ? <li>Объём: {volume}</li> : null}
                  </ul>
                </div>
              ) : null}
              {activeTab === "specs" ? (
                <div className="beautySpecTable">
                  {[...specs, { key: "Остаток", value: `${product.stock} шт.` }, { key: "Цена", value: formatPrice(product.price) }].map((spec) => (
                    <article key={`${spec.key}-${spec.value}`}><span>{spec.key}</span><strong>{spec.value}</strong></article>
                  ))}
                </div>
              ) : null}
              {activeTab === "delivery" ? (
                <div className="beautyDeliveryGrid">
                  <article><span>◌</span><strong>Бережная доставка</strong><p>Город, адрес и стоимость доставки выбираются на странице оформления заказа.</p></article>
                  <article><span>◇</span><strong>Безопасная оплата</strong><p>Оплата проходит через checkout Dayen с итоговой суммой перед подтверждением.</p></article>
                  <article><span>↩</span><strong>Возврат</strong><p>Возврат и спор открываются из страницы заказа.</p></article>
                  <article><span>✦</span><strong>Наличие</strong><p>{product.stock > 0 ? `Доступно: ${product.stock} шт.` : "Товара сейчас нет в наличии."}</p></article>
                </div>
              ) : null}
              {activeTab === "reviews" ? (
                <div className="beautyTabReviews">
                  {reviews.length ? reviews.map((review) => (
                    <article key={review.id}><div><strong>{review.name || review.user_name || "Покупатель"}</strong><span>★ {review.rating} • {formatDate(review.created_at)}</span></div><p>{review.comment || "Покупатель оставил оценку без комментария."}</p></article>
                  )) : <div className="beautyEmptyState">У этого товара пока нет отзывов.</div>}
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <section className="beautyProductInfo">
          <span className="beautyProductInfo__badge">{product.category || "Уход"}</span>
          <h1>{product.title}</h1>
          <div className="beautyProductInfo__meta">{reviewCount && rating ? <span>★ {rating.toFixed(1)} ({reviewCount})</span> : <span>Пока нет отзывов</span>}<span>ID товара: #{product.id}</span></div>
          <div className="beautyProductPrice"><strong>{formatPrice(product.price)}</strong>{hasDiscount ? <span>{formatPrice(oldPrice)}</span> : null}</div>
          {hasDiscount ? <div className="beautySave">Вы экономите {formatPrice(saving)}</div> : null}
          <p className="beautyProductLead">{product.description || "Описание пока не добавлено продавцом."}</p>
          <div className="beautyQuickSpecs">
            {brand ? <span>Бренд: <strong>{brand}</strong></span> : null}
            {skinType ? <span>Тип кожи: <strong>{skinType}</strong></span> : null}
            {volume ? <span>Объём: <strong>{volume}</strong></span> : null}
            {component ? <span>Компонент: <strong>{component}</strong></span> : null}
          </div>
          <aside className="beautyStickyBuy">
            <div className="beautyProductPrice beautyProductPrice--small"><strong>{formatPrice(product.price)}</strong>{hasDiscount ? <span>{formatPrice(oldPrice)}</span> : null}</div>
            <button type="button" className="beautyButton" onClick={onAddToCart}>{hasInCart ? "В корзине" : "Добавить в корзину"}</button>
            <button type="button" className="beautyButton beautyButton--soft" onClick={onBuyNow}>Купить сейчас</button>
            <button type="button" className="beautyFavoriteWide" onClick={onToggleLike}>♡ Добавить в избранное</button>
            {seller ? (
              <Link to={`/sellers/${seller.id}`} className="beautySellerLink">
                <span className="beautySellerLink__avatar">
                  {seller.avatar_url ? <img src={seller.avatar_url} alt={sellerName} /> : sellerName.slice(0, 1)}
                </span>
                <span>
                  <small>Продавец</small>
                  <strong>{sellerName}</strong>
                  <em>Открыть витрину</em>
                </span>
              </Link>
            ) : null}
          </aside>
        </section>
      </section>
    </main>
  );
}
