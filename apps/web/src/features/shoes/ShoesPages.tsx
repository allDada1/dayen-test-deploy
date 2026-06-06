import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";
import { Grid3X3, List } from "lucide-react";
import { Link } from "react-router-dom";

import { CartIcon } from "../../components/icons/CartIcon";
import { useCart } from "../../providers/cart";
import { useToast } from "../../providers/toast";
import { formatDate, formatPrice } from "../../services/format";
import type { HomeHeroBanner, Product, Review, SellerProfile } from "../../types/api";

type ShoesCategory = {
  title: string;
  slug: string;
  tone: string;
  keywords: string[];
};

type ShoesDisplayProduct = {
  id: string;
  productId?: number;
  title: string;
  subtitle: string;
  price: number;
  oldPrice?: number;
  badge?: string;
  image?: string;
  tone: string;
  material?: string;
  color?: string;
  season?: string;
  sizes?: string;
};

type ShoesProductTab = "description" | "specs" | "delivery" | "reviews";

const shoesCategories: ShoesCategory[] = [
  { title: "Кроссовки", slug: "sneakers", tone: "black", keywords: ["кроссов", "sneaker", "sneakers", "atlas"] },
  { title: "Ботинки", slug: "boots", tone: "brown", keywords: ["ботин", "boots", "boot", "westwood"] },
  { title: "Туфли", slug: "dress-shoes", tone: "graphite", keywords: ["туфл", "dress shoe", "oxford", "derby"] },
  { title: "Лоферы", slug: "loafers", tone: "cognac", keywords: ["лофер", "loaf", "penny"] },
  { title: "Сандалии", slug: "sandals", tone: "sand", keywords: ["сандал", "sandals", "rivi"] },
  { title: "Детская обувь", slug: "kids", tone: "light", keywords: ["детск", "kids", "child"] },
];

const sortOptions = [
  { label: "Популярные", value: "popular" },
  { label: "Новинки", value: "new" },
  { label: "Цена ↑", value: "price_asc" },
  { label: "Цена ↓", value: "price_desc" },
  { label: "Скидки", value: "sale" },
];

const shoeSizes = ["39", "40", "41", "42", "43", "44"];
const shoeMaterials = ["Кожа", "Замша", "Текстиль", "Нубук"];

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

function specValue(specs: Array<{ key: string; value: string }>, markers: string[]) {
  const found = specs.find((spec) => {
    const key = spec.key.toLowerCase();
    return markers.some((marker) => key.includes(marker.toLowerCase()));
  });

  return found?.value || "";
}

function moneyFromSpec(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function shoesHaystack(product: Product) {
  return [product.title, product.description, product.category, product.section, product.tile_slug]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function isShoesProduct(product: Product) {
  const haystack = shoesHaystack(product);
  return /shoes|shoe|footwear|обув|кроссов|ботин|туфл|лофер|сандал|кеды|сапог|sneaker|boots|loafers|sandals/i.test(haystack);
}

function shoesCategoryForProduct(product: Product) {
  const haystack = shoesHaystack(product);
  const kidsCategory = shoesCategories.find((category) => category.slug === "kids");
  if (kidsCategory?.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
    return kidsCategory;
  }
  return shoesCategories.find((category) => category.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) || null;
}

function oldPriceFromProduct(product: Product) {
  return moneyFromSpec(specValue(productSpecs(product), ["старая", "old price", "old_price", "до скидки"]));
}

function shoesProducts(products: Product[], categorySlug?: string) {
  const realProducts = products.filter(isShoesProduct);
  if (!categorySlug) return realProducts;
  return realProducts.filter((product) => shoesCategoryForProduct(product)?.slug === categorySlug);
}

function productsToShoes(products: Product[], categorySlug?: string) {
  return shoesProducts(products, categorySlug).slice(0, 24).map((product, index) => {
    const specs = productSpecs(product);
    const oldPrice = oldPriceFromProduct(product);
    const price = Number(product.price || 0);
    const category = shoesCategoryForProduct(product);

    return {
      id: String(product.id),
      productId: product.id,
      title: product.title,
      subtitle: product.category || category?.title || product.section || "Обувь",
      price,
      oldPrice: oldPrice > price ? oldPrice : undefined,
      badge: oldPrice > price ? "Скидка" : product.stock <= 3 ? "Мало" : index === 0 ? "Новинка" : undefined,
      image: product.images?.[0] || product.image_url || "",
      tone: category?.tone || ["black", "brown", "sand", "graphite"][index % 4],
      material: specValue(specs, ["материал", "material"]),
      color: specValue(specs, ["цвет", "color"]),
      season: specValue(specs, ["сезон", "season"]),
      sizes: specValue(specs, ["размер", "sizes"]),
    } satisfies ShoesDisplayProduct;
  });
}

function categoryCount(products: Product[], category: ShoesCategory) {
  return shoesProducts(products, category.slug).length;
}

function categoryPreviewImage(products: Product[], category: ShoesCategory) {
  const product = shoesProducts(products, category.slug).find((item) => item.images?.[0] || item.image_url);
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

function ShoesScene({ tone = "black" }: { tone?: string }) {
  return (
    <div className={`shoesScene shoesScene--${tone}`} aria-hidden="true">
      <span className="shoesScene__shadow" />
      <span className="shoesScene__shoe shoesScene__shoe--main" />
      <span className="shoesScene__shoe shoesScene__shoe--back" />
      <span className="shoesScene__lace" />
      <span className="shoesScene__sole" />
    </div>
  );
}

function ShoesButton({ to, children, soft = false }: { to: string; children: string; soft?: boolean }) {
  return (
    <Link to={to} className={soft ? "shoesButton shoesButton--soft" : "shoesButton"}>
      {children}
    </Link>
  );
}

function ShoesSectionHead({ title, action }: { title: string; action?: string }) {
  return (
    <div className="shoesSectionHead">
      <h2>{title}</h2>
      {action ? <button type="button">{action}</button> : null}
    </div>
  );
}

function ShoesManagedBanner({ banner, fallbackHref = "/tile/shoes/sneakers" }: { banner?: HomeHeroBanner | null; fallbackHref?: string }) {
  const activeBanner = isActiveBanner(banner) ? banner : null;
  if (!activeBanner) return null;

  return (
    <section className="shoesManagedBanner">
      <div className="shoesManagedBanner__copy">
        {activeBanner.eyebrow ? <span>{activeBanner.eyebrow}</span> : null}
        <h2>{activeBanner.title}</h2>
        {activeBanner.description ? <p>{activeBanner.description}</p> : null}
        {activeBanner.cta_label ? <ShoesButton to={activeBanner.cta_href || fallbackHref}>{activeBanner.cta_label}</ShoesButton> : null}
      </div>
      <div className="shoesManagedBanner__visual">
        {activeBanner.image_url ? <img src={activeBanner.image_url} alt={activeBanner.title} /> : <ShoesScene tone="brown" />}
      </div>
    </section>
  );
}

function ShoesProductCard({ product }: { product: ShoesDisplayProduct }) {
  const { add } = useCart();
  const toast = useToast();
  const href = product.productId ? `/product/${product.productId}` : "/tile/shoes/sneakers";

  function addToCart() {
    if (!product.productId) {
      toast.warning("Этот товар пока недоступен для корзины.");
      return;
    }
    add(product.productId);
    toast.success("Товар добавлен в корзину.");
  }

  return (
    <article className="shoesProductCard">
      <Link to={href} className={`shoesProductCard__media shoesProductCard__media--${product.tone}`}>
        {product.badge ? <span className="shoesBadge">{product.badge}</span> : null}
        <button type="button" className="shoesFavorite" aria-label="Добавить в избранное">
          ♡
        </button>
        {product.image ? <img src={product.image} alt={product.title} /> : <ShoesScene tone={product.tone} />}
      </Link>
      <div className="shoesProductCard__body">
        <Link to={href} className="shoesProductCard__text">
          <strong>{product.title}</strong>
          <span>{product.subtitle}</span>
          <b>
            {formatPrice(product.price)}
            {product.oldPrice ? <small>{formatPrice(product.oldPrice)}</small> : null}
          </b>
        </Link>
        <button type="button" className="shoesCartButton" onClick={addToCart} aria-label="Добавить в корзину">
          <CartIcon />
        </button>
      </div>
    </article>
  );
}

function ShoesBenefits() {
  const benefits = [
    ["✓", "Проверенные продавцы", "Товары от надёжных продавцов Dayen"],
    ["⌁", "Размеры и наличие", "Актуальные размеры в карточке товара"],
    ["↩", "Удобный возврат", "Возврат по правилам продавца"],
    ["▣", "Безопасная оплата", "Защита платежей на платформе"],
  ];

  return (
    <section className="shoesBenefits">
      {benefits.map(([icon, title, text]) => (
        <div key={title}>
          <span>{icon}</span>
          <strong>{title}</strong>
          <small>{text}</small>
        </div>
      ))}
    </section>
  );
}

export function ShoesHomePage({ products, banner, loading = false }: { products: Product[]; banner?: HomeHeroBanner | null; loading?: boolean }) {
  const displayProducts = productsToShoes(products).slice(0, 6);

  return (
    <main className="shoesPage">
      <ShoesManagedBanner banner={banner} />

      <section className="shoesHero">
        <div className="shoesHero__copy">
          <span>Обувь</span>
          <h1>Обувь для каждого шага</h1>
          <p>Кроссовки, ботинки, туфли и повседневные пары от продавцов Dayen.</p>
          <ShoesButton to="/tile/shoes/sneakers">Смотреть каталог</ShoesButton>
          <small>01 / 03</small>
        </div>
        <div className="shoesHero__visual">
          <ShoesScene tone="hero" />
        </div>
      </section>

      <ShoesBenefits />

      <section className="shoesSection">
        <ShoesSectionHead title="Популярные категории" action="Смотреть все" />
        <div className="shoesCategoryGrid">
          {shoesCategories.map((category) => {
            const image = categoryPreviewImage(products, category);
            return (
              <Link key={category.slug} to={`/tile/shoes/${category.slug}`} className="shoesCategoryCard">
                <div className={`shoesCategoryCard__image shoesCategoryCard__image--${category.tone}`}>
                  {image ? <img src={image} alt={category.title} /> : <ShoesScene tone={category.tone} />}
                </div>
                <strong>{category.title}</strong>
                <span>{productCountText(categoryCount(products, category))}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="shoesSection">
        <ShoesSectionHead title="Популярные товары" action="Смотреть все" />
        {displayProducts.length ? (
          <div className="shoesProductGrid shoesProductGrid--six">
            {displayProducts.map((product) => (
              <ShoesProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="shoesEmptyState">{loading ? "Загрузка товаров..." : "Пока нет товаров раздела «Обувь»."}</div>
        )}
      </section>

      <section className="shoesPromo">
        <div>
          <span>Коллекция сезона</span>
          <h2>Осенняя пара на каждый день</h2>
          <p>Спокойная городская обувь: кожа, замша, чистые силуэты и комфортный ритм.</p>
          <ShoesButton to="/tile/shoes/boots">Смотреть подборку</ShoesButton>
        </div>
        <ShoesScene tone="brown" />
      </section>

      <section className="shoesSection">
        <ShoesSectionHead title="Коллекции и вдохновение" action="Смотреть все" />
        <div className="shoesCollectionGrid">
          {[
            ["Городской casual", "sneakers", "black"],
            ["Кожа и замша", "boots", "brown"],
            ["Минималистичные кроссовки", "sneakers", "light"],
            ["Офисный стиль", "dress-shoes", "graphite"],
          ].map(([title, slug, tone]) => (
            <Link key={title} to={`/tile/shoes/${slug}`} className={`shoesCollectionCard shoesCollectionCard--${tone}`}>
              <ShoesScene tone={tone} />
              <strong>{title}</strong>
              <span>Подборка Dayen</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="shoesTrust">
        {["Точные данные продавцов", "Возврат по правилам", "Поддержка Dayen", "Безопасная оплата"].map((item) => (
          <div key={item}>
            <span>◇</span>
            <strong>{item}</strong>
          </div>
        ))}
      </section>

      <section className="shoesNewsletter">
        <div>
          <h2>Будьте в курсе новых пар и акций</h2>
          <p>Подписка на спокойные обновления без лишнего шума.</p>
        </div>
        <form>
          <input placeholder="Ваш e-mail" />
          <button type="button">Подписаться</button>
        </form>
      </section>
    </main>
  );
}

export function ShoesCategoryPage({ products, categorySlug = "sneakers", banner, loading = false }: { products: Product[]; categorySlug?: string; banner?: HomeHeroBanner | null; loading?: boolean }) {
  const [sort, setSort] = useState("popular");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [priceFrom, setPriceFrom] = useState("");
  const [priceTo, setPriceTo] = useState("");
  const activeCategory = shoesCategories.find((category) => category.slug === categorySlug) || shoesCategories[0];
  const displayProducts = useMemo(() => {
    const minPrice = Number(priceFrom.replace(/[^\d]/g, "") || 0);
    const maxPrice = Number(priceTo.replace(/[^\d]/g, "") || 0);
    const items = productsToShoes(products, activeCategory.slug).filter((item) => {
      if (minPrice && item.price < minPrice) return false;
      if (maxPrice && item.price > maxPrice) return false;
      return true;
    });
    if (sort === "price_asc") return [...items].sort((a, b) => a.price - b.price);
    if (sort === "price_desc") return [...items].sort((a, b) => b.price - a.price);
    if (sort === "sale") return items.filter((item) => item.oldPrice);
    return items;
  }, [activeCategory.slug, priceFrom, priceTo, products, sort]);
  const totalCount = shoesProducts(products, activeCategory.slug).length || displayProducts.length;

  return (
    <main className="shoesPage shoesCategoryPage">
      <nav className="shoesCrumbs">
        <Link to="/">Главная</Link>
        <span>›</span>
        <Link to="/tile/shoes">Обувь</Link>
        <span>›</span>
        <span>{activeCategory.title}</span>
      </nav>

      <ShoesManagedBanner banner={banner} fallbackHref={`/tile/shoes/${activeCategory.slug}`} />

      <div className={filtersOpen ? "shoesCatalogLayout filters-open" : "shoesCatalogLayout"}>
        <aside className="shoesSidebar" aria-hidden={!filtersOpen}>
          <button type="button" className="shoesFilterClose" onClick={() => setFiltersOpen(false)} aria-label="Закрыть фильтры">
            ×
          </button>
          <h1>{activeCategory.title}</h1>
          <p>{productCountText(totalCount)}</p>

          <div className="shoesFilterGroup">
            <strong>Категории</strong>
            {shoesCategories.map((item) => (
              <Link key={item.slug} to={`/tile/shoes/${item.slug}`} className={item.slug === activeCategory.slug ? "is-active" : ""}>
                {item.title}
              </Link>
            ))}
          </div>

          <div className="shoesFilterGroup">
            <strong>Цена, ₸</strong>
            <div className="shoesRange" />
            <div className="shoesInputs">
              <input value={priceFrom} onChange={(event) => setPriceFrom(event.target.value)} inputMode="numeric" placeholder="От 15 000" />
              <input value={priceTo} onChange={(event) => setPriceTo(event.target.value)} inputMode="numeric" placeholder="До 150 000" />
            </div>
          </div>

          <div className="shoesFilterGroup">
            <strong>Размер</strong>
            <div className="shoesSizes">
              {shoeSizes.map((size) => (
                <button key={size} type="button">
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="shoesFilterGroup">
            <strong>Цвет</strong>
            <div className="shoesSwatches">
              {["#171717", "#a85f3b", "#c9b59a", "#f4f1ec", "#6b6e67"].map((color) => (
                <button key={color} type="button" style={{ background: color }} aria-label={color} />
              ))}
            </div>
          </div>

          <div className="shoesFilterGroup">
            <strong>Материал</strong>
            {shoeMaterials.map((item) => (
              <label key={item} className="shoesCheck">
                <input type="checkbox" /> {item}
              </label>
            ))}
          </div>
        </aside>

        <section className="shoesCatalogMain">
          <div className="shoesSortBar">
            <button type="button" className="shoesFilterToggle" onClick={() => setFiltersOpen((current) => !current)} aria-label="Фильтры">
              ☰
            </button>
            <div className="shoesSortButtons">
              {sortOptions.map((option) => (
                <button key={option.value} type="button" className={sort === option.value ? "is-active" : ""} onClick={() => setSort(option.value)}>
                  {option.label}
                </button>
              ))}
            </div>
            <div className="shoesViewSwitch">
              <button type="button" className={viewMode === "grid" ? "is-active" : ""} onClick={() => setViewMode("grid")} aria-label="Показать сеткой">
                <Grid3X3 size={18} strokeWidth={2.2} />
              </button>
              <button type="button" className={viewMode === "list" ? "is-active" : ""} onClick={() => setViewMode("list")} aria-label="Показать списком">
                <List size={19} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          {displayProducts.length ? (
            <div className={viewMode === "list" ? "shoesProductGrid shoesProductGrid--catalog is-list" : "shoesProductGrid shoesProductGrid--catalog"}>
              {displayProducts.map((product) => (
                <ShoesProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="shoesEmptyState">{loading ? "Загрузка товаров..." : "Пока нет товаров в этой категории."}</div>
          )}
        </section>
      </div>
    </main>
  );
}

type ShoesProductPageProps = {
  product: Product;
  seller?: SellerProfile | null;
  images: string[];
  activeImage: number;
  setActiveImage: Dispatch<SetStateAction<number>>;
  specs: Array<{ key: string; value: string }>;
  reviews: Review[];
  hasInCart: boolean;
  onAddToCart: () => void;
  onBuyNow: () => void;
  onToggleLike: () => void;
  onOpenImage: () => void;
};

export function ShoesProductPage({
  product,
  seller,
  images,
  activeImage,
  setActiveImage,
  specs,
  reviews,
  hasInCart,
  onAddToCart,
  onBuyNow,
  onToggleLike,
  onOpenImage,
}: ShoesProductPageProps) {
  const [activeTab, setActiveTab] = useState<ShoesProductTab>("description");
  const pageSpecs = productSpecs(product);
  const oldPrice = oldPriceFromProduct(product);
  const price = Number(product.price || 0);
  const hasDiscount = oldPrice > price;
  const saving = hasDiscount ? oldPrice - price : 0;
  const category = shoesCategoryForProduct(product);
  const material = specValue(pageSpecs, ["материал", "material"]) || "Натуральная кожа";
  const color = specValue(pageSpecs, ["цвет", "color"]) || "Чёрный";
  const season = specValue(pageSpecs, ["сезон", "season"]) || "Весна / осень";
  const sizes = specValue(pageSpecs, ["размер", "sizes"]) || "39, 40, 41, 42, 43, 44";
  const image = images[activeImage] || "";
  const sellerName = seller?.name || seller?.username || "Продавец";
  const tabs: Array<{ id: ShoesProductTab; label: string }> = [
    { id: "description", label: "Описание" },
    { id: "specs", label: "Характеристики" },
    { id: "delivery", label: "Доставка и оплата" },
    { id: "reviews", label: `Отзывы${reviews.length ? ` (${reviews.length})` : ""}` },
  ];

  useEffect(() => {
    document.body.classList.add("shoes-product-shell");
    return () => document.body.classList.remove("shoes-product-shell");
  }, []);

  return (
    <main className="shoesPage shoesProductPage">
      <nav className="shoesCrumbs">
        <Link to="/">Главная</Link>
        <span>›</span>
        <Link to="/tile/shoes">Обувь</Link>
        <span>›</span>
        <Link to={`/tile/shoes/${category?.slug || "sneakers"}`}>{category?.title || product.category || "Кроссовки"}</Link>
        <span>›</span>
        <span>{product.title}</span>
      </nav>

      <section className="shoesProductLayout">
        <section className="shoesProductGallery">
          <div className="shoesProductGallery__main">
            {hasDiscount ? <span className="shoesBadge">-{Math.round((saving / oldPrice) * 100)}%</span> : null}
            <button type="button" className="shoesProductGallery__fav" onClick={onToggleLike} aria-label="Добавить в избранное">
              ♡
            </button>
            <button type="button" className="shoesProductGallery__open" onClick={onOpenImage} aria-label="Открыть фото товара">
              {image ? <img src={image} alt={product.title} /> : <ShoesScene tone={category?.tone || "black"} />}
            </button>
          </div>
          {images.length ? (
            <div className="shoesProductThumbs">
              {images.slice(0, 5).map((src, index) => (
                <button key={`${src}-${index}`} type="button" className={index === activeImage ? "is-active" : ""} onClick={() => setActiveImage(index)}>
                  <img src={src} alt={`${product.title} ${index + 1}`} />
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="shoesProductInfo">
          <span className="shoesProductInfo__badge">{category?.title || product.category || "Обувь"}</span>
          <h1>{product.title}</h1>
          <div className="shoesProductInfo__meta">
            <span>★ {Number(product.rating_avg || 4.7).toFixed(1)}</span>
            <span>{product.rating_count || reviews.length || 0} отзывов</span>
            <span>Арт. #{product.id}</span>
          </div>
          <div className="shoesProductPrice">
            <strong>{formatPrice(price)}</strong>
            {hasDiscount ? <span>{formatPrice(oldPrice)}</span> : null}
          </div>
          {hasDiscount ? <div className="shoesSave">Вы экономите {formatPrice(saving)}</div> : null}
          <p>{product.description || "Премиальная пара для городского ритма: чистый силуэт, мягкая посадка и спокойные материалы."}</p>

          <div className="shoesOptionBlock">
            <strong>Выберите размер</strong>
            <div className="shoesSizes">
              {sizes.split(",").map((size) => (
                <button key={size.trim()} type="button">
                  {size.trim()}
                </button>
              ))}
            </div>
          </div>

          <div className="shoesOptionBlock">
            <strong>Цвет: {color}</strong>
            <div className="shoesSwatches">
              {["#171717", "#f4f1ec", "#a85f3b", "#6b6e67"].map((item) => (
                <button key={item} type="button" style={{ background: item }} />
              ))}
            </div>
          </div>

          <div className="shoesInfoRows">
            <div><span>Материал</span><strong>{material}</strong></div>
            <div><span>Сезон</span><strong>{season}</strong></div>
            <div><span>Подошва</span><strong>{specValue(pageSpecs, ["подошва"]) || "Резина"}</strong></div>
          </div>

          <aside className="shoesStickyBuy">
            <div className="shoesProductPrice shoesProductPrice--small">
              <strong>{formatPrice(price)}</strong>
              {hasDiscount ? <span>{formatPrice(oldPrice)}</span> : null}
            </div>
            <button type="button" className="shoesButton" onClick={onAddToCart}>
              {hasInCart ? "В корзине" : "Добавить в корзину"}
            </button>
            <button type="button" className="shoesButton shoesButton--soft" onClick={onBuyNow}>
              Купить сейчас
            </button>
            <button type="button" className="shoesFavoriteWide" onClick={onToggleLike}>
              ♡ Добавить в избранное
            </button>
            {seller ? (
              <Link to={`/sellers/${seller.id}`} className="shoesSellerLink">
                <span className="shoesSellerLink__avatar">
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

      <section className="shoesProductTabs">
        <div className="shoesProductTabs__nav">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" className={activeTab === tab.id ? "is-active" : ""} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="shoesProductTabs__body">
          {activeTab === "description" ? (
            <div>
              <p>{product.description || "Универсальная пара для повседневного города: аккуратный профиль, мягкая посадка и спокойный внешний вид без лишнего шума."}</p>
              <ul>
                <li>Категория: {product.category || category?.title || "Обувь"}</li>
                <li>Материал: {material}</li>
                <li>Цвет: {color}</li>
                <li>Размеры: {sizes}</li>
              </ul>
            </div>
          ) : null}

          {activeTab === "specs" ? (
            <div className="shoesSpecTable">
              {specs.map((spec) => (
                <div key={`${spec.key}-${spec.value}`}>
                  <span>{spec.key}</span>
                  <strong>{spec.value}</strong>
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === "delivery" ? (
            <div className="shoesDeliveryGrid">
              <div><strong>Доставка</strong><span>Стоимость и срок рассчитываются при оформлении заказа.</span></div>
              <div><strong>Возврат</strong><span>По правилам продавца и платформы Dayen.</span></div>
              <div><strong>Оплата</strong><span>Безопасная оплата через корзину Dayen.</span></div>
            </div>
          ) : null}

          {activeTab === "reviews" ? (
            <div className="shoesTabReviews">
              {reviews.length ? reviews.map((review) => (
                <article key={review.id}>
                  <strong>{review.name || review.user_name || "Покупатель"} · ★ {review.rating}</strong>
                  <p>{review.comment || "Без комментария."}</p>
                  <span>{formatDate(review.created_at)}</span>
                </article>
              )) : <div className="shoesEmptyState">У этого товара пока нет отзывов.</div>}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
