import { useEffect, useMemo, useState } from "react";
import { Grid3X3, List } from "lucide-react";
import { Link } from "react-router-dom";

import { CartIcon } from "../../components/icons/CartIcon";
import { useCart } from "../../providers/cart";
import { useToast } from "../../providers/toast";
import { formatDate, formatPrice } from "../../services/format";
import type { HomeHeroBanner, Product, Review, SellerProfile } from "../../types/api";

type FurnitureDisplayProduct = {
  id: string;
  productId?: number;
  title: string;
  subtitle: string;
  price: number;
  oldPrice?: number;
  badge?: string;
  tone: string;
  image?: string;
  color?: string;
  material?: string;
};

type FurnitureCategory = {
  title: string;
  slug: string;
  tone: string;
  keywords: string[];
};

type FurnitureProductTab = "description" | "specs" | "delivery" | "reviews";

const categories: FurnitureCategory[] = [
  { title: "Диваны", slug: "sofas", tone: "sofa", keywords: ["диван", "sofa"] },
  { title: "Столы", slug: "tables", tone: "table", keywords: ["стол", "table"] },
  { title: "Стулья", slug: "chairs", tone: "chair", keywords: ["стул", "стуль", "кресл", "chair", "armchair"] },
  { title: "Шкафы", slug: "wardrobes", tone: "wardrobe", keywords: ["шкаф", "wardrobe"] },
  { title: "Кровати", slug: "beds", tone: "bed", keywords: ["кровать", "кроват", "bed"] },
  { title: "Комоды", slug: "dressers", tone: "dresser", keywords: ["комод", "dresser"] },
];

const sortOptions = [
  { label: "Популярные", value: "popular" },
  { label: "Новинки", value: "new" },
  { label: "Цена: по возрастанию", value: "price_asc" },
  { label: "Цена: по убыванию", value: "price_desc" },
  { label: "Скидки", value: "sale" },
];

const colorOptions = [
  { label: "Бежевый", value: "беж", color: "#eadcc8" },
  { label: "Серый", value: "сер", color: "#d7d2c8" },
  { label: "Зелёный", value: "зелен", color: "#7e8667" },
  { label: "Коричневый", value: "корич", color: "#a07143" },
  { label: "Чёрный", value: "черн", color: "#202020" },
];

const materialOptions = ["Ткань", "Велюр", "Кожа", "Экокожа", "Рогожка"];

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

function furnitureHaystack(product: Product) {
  return [product.title, product.description, product.category, product.section, product.tile_slug]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function furnitureCategoryForProduct(product: Product) {
  const haystack = furnitureHaystack(product);
  return categories.find((category) => category.keywords.some((keyword) => haystack.includes(keyword))) || null;
}

function isFurnitureProduct(product: Product) {
  const haystack = furnitureHaystack(product);
  return /furniture|мебел|диван|sofa|стол|table|стул|кресл|chair|armchair|шкаф|wardrobe|кровать|кроват|bed|комод|dresser/i.test(haystack);
}

function oldPriceFromProduct(product: Product) {
  return moneyFromSpec(specValue(productSpecs(product), ["старая", "old price", "old_price", "до скидки"]));
}

function furnitureProducts(products: Product[], categorySlug?: string) {
  const realProducts = products.filter(isFurnitureProduct);
  if (!categorySlug) return realProducts;
  return realProducts.filter((product) => furnitureCategoryForProduct(product)?.slug === categorySlug);
}

function productsToFurniture(products: Product[], categorySlug?: string) {
  const realProducts = furnitureProducts(products, categorySlug);

  return realProducts.slice(0, 24).map((product, index) => {
    const oldPrice = oldPriceFromProduct(product);
    const category = furnitureCategoryForProduct(product);
    const price = Number(product.price || 0);
    const specs = productSpecs(product);

    return {
      id: String(product.id),
      productId: product.id,
      title: product.title,
      subtitle: product.category || category?.title || product.section || "Мебель",
      price,
      oldPrice: oldPrice > price ? oldPrice : undefined,
      badge: oldPrice > price ? "Скидка" : product.stock <= 3 ? "Мало" : undefined,
      tone: category?.tone || ["sofa", "cloud", "green", "cream", "brown", "light"][index % 6],
      image: product.images?.[0] || product.image_url || "",
      color: specValue(specs, ["цвет"]),
      material: specValue(specs, ["материал", "обив"]),
    };
  });
}

function categoryCount(products: Product[], category: FurnitureCategory) {
  const count = furnitureProducts(products, category.slug).length;
  return count;
}

function categoryPreviewImage(products: Product[], category: FurnitureCategory) {
  const product = furnitureProducts(products, category.slug).find((item) => item.images?.[0] || item.image_url);
  return product?.images?.[0] || product?.image_url || "";
}

function furnitureCollections(products: Product[]) {
  return categories
    .map((category) => ({
      ...category,
      count: categoryCount(products, category),
      image: categoryPreviewImage(products, category),
    }))
    .filter((category) => category.count > 0)
    .slice(0, 4);
}

function productCountText(count: number) {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  if (lastDigit === 1 && lastTwoDigits !== 11) return `${count} товар`;
  if ([2, 3, 4].includes(lastDigit) && ![12, 13, 14].includes(lastTwoDigits)) return `${count} товара`;
  return `${count} товаров`;
}

function FurnitureScene({ tone = "hero" }: { tone?: string }) {
  return (
    <div className={`furnitureScene furnitureScene--${tone}`} aria-hidden="true">
      <span className="furnitureScene__art" />
      <span className="furnitureScene__plant" />
      <span className="furnitureScene__sofa" />
      <span className="furnitureScene__table" />
    </div>
  );
}

function SectionHead({ title, action }: { title: string; action?: string }) {
  return (
    <div className="furnitureSectionHead">
      <h2>{title}</h2>
      {action ? (
        <button type="button" className="furnitureTextButton">
          {action}
        </button>
      ) : null}
    </div>
  );
}

function FurnitureManagedBanner({
  banner,
  fallbackHref = "/tile/furniture/sofas",
  fallbackEyebrow,
  fallbackTitle,
  fallbackDescription,
  fallbackCta,
  fallbackTone = "bedroom",
}: {
  banner?: HomeHeroBanner | null;
  fallbackHref?: string;
  fallbackEyebrow?: string;
  fallbackTitle?: string;
  fallbackDescription?: string;
  fallbackCta?: string;
  fallbackTone?: string;
}) {
  const activeBanner = isActiveBanner(banner) ? banner : null;
  const title = activeBanner?.title || fallbackTitle;
  if (!title) return null;
  const eyebrow = activeBanner?.eyebrow || fallbackEyebrow;
  const description = activeBanner?.description || fallbackDescription;
  const ctaLabel = activeBanner?.cta_label || fallbackCta;
  const href = activeBanner?.cta_href || fallbackHref;

  return (
    <section className="furnitureManagedBanner">
      <div className="furnitureManagedBanner__copy">
        {eyebrow ? <span>{eyebrow}</span> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
        {ctaLabel ? (
          <Link to={href} className="furnitureButton">
            {ctaLabel}
          </Link>
        ) : null}
      </div>
      <div className="furnitureManagedBanner__visual">
        {activeBanner?.image_url ? <img src={activeBanner.image_url} alt={title} /> : <FurnitureScene tone={fallbackTone} />}
      </div>
    </section>
  );
}

function isActiveBanner(banner?: HomeHeroBanner | null) {
  return Boolean(banner && banner.is_active !== 0 && banner.title?.trim());
}

function FurnitureProductCard({ product }: { product: FurnitureDisplayProduct }) {
  const { add } = useCart();
  const toast = useToast();
  const href = product.productId ? `/product/${product.productId}` : "/tile/furniture/sofas";

  function addToCart() {
    if (product.productId) {
      add(product.productId);
      return;
    }

    toast.info("Откройте карточку товара, чтобы посмотреть подробности.");
  }

  return (
    <article className="furnitureProductCard">
      <Link to={href} className={`furnitureProductCard__image furnitureProductCard__image--${product.tone}`}>
        {product.badge ? <span className="furnitureBadge">{product.badge}</span> : null}
        <button type="button" className="furnitureFavorite" aria-label="Добавить в избранное">
          ♡
        </button>
        {product.image ? <img src={product.image} alt={product.title} /> : <FurnitureScene tone={product.tone} />}
      </Link>
      <div className="furnitureProductCard__body">
        <Link to={href} className="furnitureProductCard__details">
          <span className="furnitureProductCard__title">
            {product.title}
          </span>
          <span className="furnitureProductCard__price">
            <strong>{formatPrice(product.price)}</strong>
            {product.oldPrice ? <span>{formatPrice(product.oldPrice)}</span> : null}
          </span>
        </Link>
        <button type="button" className="furnitureCartButton" onClick={addToCart} aria-label="Добавить в корзину">
          <CartIcon />
        </button>
      </div>
    </article>
  );
}

function FurnitureBenefits() {
  const benefits = [
    ["🚚", "Быстрая доставка", "По всему Казахстану"],
    ["🛡", "Гарантия качества", "На всю мебель"],
    ["⏱", "Лёгкий возврат", "30 дней на возврат"],
    ["💳", "Безопасная оплата", "100% защита платежей"],
  ];

  return (
    <section className="furnitureBenefits">
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

export function FurnitureHomePage({ products, banner, loading = false }: { products: Product[]; banner?: HomeHeroBanner | null; loading?: boolean }) {
  const displayProducts = productsToFurniture(products).slice(0, 6);
  const collections = furnitureCollections(products);
  const activeBanner = isActiveBanner(banner);

  return (
    <main className="furniturePage">
      {activeBanner ? (
        <FurnitureManagedBanner banner={banner} />
      ) : (
        <section className="furnitureHero">
          <div className="furnitureHero__copy">
            <span>Коллекция 2026</span>
            <h1>Стиль и комфорт в вашем доме</h1>
            <p>Современная мебель, созданная для вашего уюта и вдохновения каждый день.</p>
            <Link to="/tile/furniture/sofas" className="furnitureButton">
              Смотреть каталог
            </Link>
            <div className="furnitureHero__pager">01 / 03</div>
          </div>
          <FurnitureScene />
        </section>
      )}

      <FurnitureBenefits />

      <section className="furnitureSection">
        <SectionHead title="Популярные категории" action="Смотреть все" />
        <div className="furnitureCategoryGrid">
          {categories.map((category) => (
            <Link key={category.slug} to={`/tile/furniture/${category.slug}`} className="furnitureCategoryCard">
              <div className={`furnitureCategoryCard__image furnitureCategoryCard__image--${category.tone}`}>
                {categoryPreviewImage(products, category) ? <img src={categoryPreviewImage(products, category)} alt={category.title} /> : <FurnitureScene tone={category.tone} />}
              </div>
              <strong>{category.title}</strong>
              <span>{productCountText(categoryCount(products, category))}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="furnitureSection">
        <SectionHead title="Популярные товары" />
        {displayProducts.length ? (
          <div className="furnitureProductGrid furnitureProductGrid--six">
            {displayProducts.map((product) => (
              <FurnitureProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="furnitureEmptyState">
            {loading ? "Загрузка товаров..." : "Пока нет мебельных товаров из админки. Добавьте товар с разделом «Мебель»."}
          </div>
        )}
      </section>

      <section className="furniturePromo">
        <div>
          <h2>Спальня для идеального отдыха</h2>
          <p>Создайте атмосферу уюта и спокойствия с новой коллекцией спален.</p>
          <Link to="/tile/furniture/beds" className="furnitureButton">
            Смотреть коллекцию
          </Link>
        </div>
        <FurnitureScene tone="bedroom" />
      </section>

      {collections.length ? (
        <section className="furnitureSection">
          <SectionHead title="Подборки для дома" action="Смотреть все" />
          <div className="furnitureInspirationGrid">
            {collections.map((item) => (
              <Link key={item.slug} to={`/tile/furniture/${item.slug}`} className={`furnitureInspirationCard furnitureInspirationCard--${item.tone}`}>
                {item.image ? <img src={item.image} alt={item.title} /> : <FurnitureScene tone={item.tone} />}
                <div>
                  <span>Мебель</span>
                  <strong>{item.title}</strong>
                  <p>{productCountText(item.count)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="furnitureWhy">
        <div>
          <h2>Почему выбирают Dayen?</h2>
          <p>Мы собираем мебель, которая делает дом уютнее, а жизнь спокойнее.</p>
          <Link to="/about" className="furnitureButton furnitureButton--small">
            Подробнее о нас
          </Link>
        </div>
        {["Качество материалов", "Современный дизайн", "Собственное производство", "Сервис и поддержка"].map((item) => (
          <article key={item}>
            <span>♡</span>
            <strong>{item}</strong>
            <p>Продуманное решение для вашего интерьера.</p>
          </article>
        ))}
      </section>

      <section className="furnitureNewsletter">
        <div>
          <strong>Будьте в курсе новинок и акций</strong>
          <p>Подпишитесь на рассылку и получайте специальные предложения первыми.</p>
        </div>
        <form>
          <input placeholder="Ваш e-mail" />
          <button type="button">Подписаться</button>
        </form>
      </section>
    </main>
  );
}

export function FurnitureCategoryPage({ products, categorySlug = "sofas", banner, loading = false }: { products: Product[]; categorySlug?: string; banner?: HomeHeroBanner | null; loading?: boolean }) {
  const [sortView, setSortView] = useState("popular");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [priceFrom, setPriceFrom] = useState("");
  const [priceTo, setPriceTo] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const activeCategory = categories.find((category) => category.slug === categorySlug) || categories[0];
  const displayProducts = useMemo(() => productsToFurniture(products, activeCategory.slug), [products, activeCategory.slug]);
  const filteredProducts = useMemo(() => {
    const minPrice = Number(priceFrom.replace(/[^\d]/g, "") || 0);
    const maxPrice = Number(priceTo.replace(/[^\d]/g, "") || 0);

    return displayProducts.filter((product) => {
      if (minPrice && product.price < minPrice) return false;
      if (maxPrice && product.price > maxPrice) return false;
      if (selectedColor && !String(product.color || "").toLowerCase().includes(selectedColor)) return false;
      if (selectedMaterials.length) {
        const material = String(product.material || "").toLowerCase();
        if (!selectedMaterials.some((item) => material.includes(item.toLowerCase()))) return false;
      }
      return true;
    });
  }, [displayProducts, priceFrom, priceTo, selectedColor, selectedMaterials]);
  const sortedProducts = useMemo(() => {
    const next = [...filteredProducts];
    if (sortView === "price_asc") next.sort((a, b) => a.price - b.price);
    if (sortView === "price_desc") next.sort((a, b) => b.price - a.price);
    if (sortView === "sale") next.sort((a, b) => Number(Boolean(b.oldPrice)) - Number(Boolean(a.oldPrice)) || b.price - a.price);
    if (sortView === "new") next.sort((a, b) => Number(b.productId || 0) - Number(a.productId || 0));
    return next;
  }, [filteredProducts, sortView]);
  const totalCount = furnitureProducts(products, activeCategory.slug).length || displayProducts.length;
  const filtersActive = Boolean(priceFrom || priceTo || selectedColor || selectedMaterials.length);

  function toggleMaterial(material: string) {
    setSelectedMaterials((current) =>
      current.includes(material) ? current.filter((item) => item !== material) : [...current, material],
    );
  }

  function resetFilters() {
    setPriceFrom("");
    setPriceTo("");
    setSelectedColor("");
    setSelectedMaterials([]);
  }

  return (
    <main className="furniturePage furnitureCategoryPage">
      <nav className="furnitureCrumbs">
        <Link to="/">Главная</Link>
        <span>›</span>
        <Link to="/tile/furniture">Мебель</Link>
        <span>›</span>
        <span>{activeCategory.title}</span>
      </nav>

      <FurnitureManagedBanner
        banner={banner}
        fallbackHref={`/tile/furniture/${activeCategory.slug}`}
        fallbackEyebrow="Коллекция 2026"
        fallbackTitle={`${activeCategory.title} для вашего комфорта`}
        fallbackDescription="Современные модели, созданные для уюта и отдыха каждый день."
        fallbackCta={`Смотреть ${activeCategory.title.toLowerCase()}`}
        fallbackTone={activeCategory.tone}
      />

      <div className={filtersOpen ? "furnitureCatalogLayout filters-open" : "furnitureCatalogLayout"}>

        <aside className="furnitureSidebar" aria-hidden={!filtersOpen}>
          <button type="button" className="furnitureFilterClose" aria-label="Закрыть фильтры" onClick={() => setFiltersOpen(false)}>
            ×
          </button>
          <h1>{activeCategory.title}</h1>
          <p>{productCountText(totalCount)}</p>

          <div className="furnitureFilterGroup">
            <strong>Категории</strong>
            {categories.map((item) => (
              <Link key={item.slug} to={`/tile/furniture/${item.slug}`} className={item.slug === activeCategory.slug ? "is-active" : ""}>
                {item.title}
                <span>›</span>
              </Link>
            ))}
          </div>

          <div className="furnitureFilterGroup">
            <strong>
              Фильтр
              {filtersActive ? (
                <button type="button" className="furnitureResetFilter" onClick={resetFilters}>
                  Сбросить
                </button>
              ) : null}
            </strong>
            <label>Цена</label>
            <div className="furnitureRange" />
            <div className="furnitureInputs">
              <input value={priceFrom} onChange={(event) => setPriceFrom(event.target.value)} inputMode="numeric" placeholder="От 80 000" />
              <input value={priceTo} onChange={(event) => setPriceTo(event.target.value)} inputMode="numeric" placeholder="До 1 200 000" />
            </div>
          </div>

          <div className="furnitureFilterGroup">
            <label>Цвет</label>
            <div className="furnitureSwatches">
              {colorOptions.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={selectedColor === item.value ? "is-active" : ""}
                  style={{ background: item.color }}
                  title={item.label}
                  aria-label={item.label}
                  onClick={() => setSelectedColor((current) => (current === item.value ? "" : item.value))}
                />
              ))}
            </div>
          </div>

          <div className="furnitureFilterGroup">
            <label>Материал обивки</label>
            {materialOptions.map((item) => (
              <label key={item} className="furnitureCheck">
                <input type="checkbox" checked={selectedMaterials.includes(item)} onChange={() => toggleMaterial(item)} />
                {item}
              </label>
            ))}
            <p className="furnitureSoonNote">Фильтры используют характеристики товара: «Цвет» и «Материал».</p>
          </div>
        </aside>

        <section className="furnitureCatalogMain">
          <div className="furnitureSortBar">
            <div>
              <button type="button" className="furnitureFilterToggle" onClick={() => setFiltersOpen(true)} aria-label="Открыть фильтры">
                <span />
                <span />
                <span />
              </button>
              {sortOptions.map((item) => (
                <button key={item.value} type="button" className={sortView === item.value ? "is-active" : ""} onClick={() => setSortView(item.value)}>
                  {item.label}
                </button>
              ))}
            </div>
            <div className="furnitureViewSwitch">
              <button type="button" className={viewMode === "grid" ? "is-active" : ""} onClick={() => setViewMode("grid")} aria-label="Показать сеткой">
                <Grid3X3 size={18} strokeWidth={2.2} />
              </button>
              <button type="button" className={viewMode === "list" ? "is-active" : ""} onClick={() => setViewMode("list")} aria-label="Показать списком">
                <List size={19} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          <div className={viewMode === "list" ? "furnitureProductGrid furnitureProductGrid--catalog is-list" : "furnitureProductGrid furnitureProductGrid--catalog"}>
            {sortedProducts.map((product) => (
              <FurnitureProductCard key={product.id} product={product} />
            ))}
          </div>

          {!sortedProducts.length ? (
            <div className="furnitureEmptyState">
              {loading ? "Загрузка товаров..." : "В этой мебельной категории пока нет товаров из админки."}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

type FurnitureProductPageProps = {
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

export function FurnitureProductPage({
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
}: FurnitureProductPageProps) {
  const [activeTab, setActiveTab] = useState<FurnitureProductTab>("description");
  const image = images[activeImage] || "";
  const oldPrice = moneyFromSpec(specValue(specs, ["старая", "old price", "old_price", "до скидки"]));
  const hasDiscount = oldPrice > Number(product.price || 0);
  const saving = hasDiscount ? oldPrice - Number(product.price || 0) : 0;
  const rating = Number(product.rating_avg || 0);
  const reviewCount = Number(product.rating_count || reviews.length || 0);
  const visibleThumbs = images.slice(0, 5);
  const hiddenPhotoCount = Math.max(0, images.length - visibleThumbs.length);
  const colorSpec = specValue(specs, ["цвет"]);
  const materialSpec = specValue(specs, ["материал", "обив"]);
  const cornerSpec = specValue(specs, ["угол", "сторон"]);
  const dimensionsSpec = specValue(specs, ["размер", "габарит", "ширина", "длина"]);
  const sellerName = seller?.name || seller?.username || "Продавец";
  const tabs: Array<{ id: FurnitureProductTab; label: string }> = [
    { id: "description", label: "Описание" },
    { id: "specs", label: "Характеристики" },
    { id: "delivery", label: "Доставка и оплата" },
    { id: "reviews", label: reviewCount ? `Отзывы (${reviewCount})` : "Отзывы" },
  ];

  useEffect(() => {
    document.body.classList.add("furniture-product-shell");
    return () => document.body.classList.remove("furniture-product-shell");
  }, []);

  return (
    <main className="furniturePage furnitureProductPage">
      <nav className="furnitureCrumbs">
        <Link to="/">Главная</Link>
        <span>›</span>
        <Link to="/tile/furniture">Мебель</Link>
        <span>›</span>
        <Link to="/tile/furniture/sofas">Диваны</Link>
        <span>›</span>
        <span>{product.title}</span>
      </nav>

      <section className="furnitureProductLayout">
        <div className="furnitureProductGallery">
          <div className="furnitureProductGallery__main">
            {hasDiscount ? <span className="furnitureBadge">Скидка</span> : null}
            <button type="button" className="furnitureProductGallery__fav" onClick={onToggleLike} aria-label="Добавить в избранное">
              {product.is_liked ? "♥" : "♡"}
            </button>
            <button
              type="button"
              className="furnitureProductGallery__arrow furnitureProductGallery__arrow--prev"
              onClick={() => setActiveImage(Math.max(0, activeImage - 1))}
              disabled={activeImage <= 0}
              aria-label="Предыдущее фото"
            >
              ‹
            </button>
            <button type="button" className="furnitureProductGallery__open" onClick={onOpenImage} aria-label="Открыть фото товара">
              {image ? <img src={image} alt={product.title} /> : <FurnitureScene tone="cloud" />}
              {image ? <span>Открыть фото</span> : null}
            </button>
            <button
              type="button"
              className="furnitureProductGallery__arrow furnitureProductGallery__arrow--next"
              onClick={() => setActiveImage(Math.min(Math.max(images.length - 1, 0), activeImage + 1))}
              disabled={activeImage >= images.length - 1}
              aria-label="Следующее фото"
            >
              ›
            </button>
          </div>

          {visibleThumbs.length > 1 ? (
            <div className="furnitureProductThumbs">
              {visibleThumbs.map((src, index) => (
                <button key={`${src}-${index}`} type="button" className={index === activeImage ? "is-active" : ""} onClick={() => setActiveImage(index)}>
                  <img src={src} alt={`${product.title} ${index + 1}`} />
                </button>
              ))}
              {hiddenPhotoCount > 0 ? <button type="button" className="furnitureProductThumbs__more">+{hiddenPhotoCount} фото</button> : null}
            </div>
          ) : null}

          <section className="furnitureProductTabs">
            <div className="furnitureProductTabs__nav">
              {tabs.map((item) => (
                <button key={item.id} type="button" className={activeTab === item.id ? "is-active" : ""} onClick={() => setActiveTab(item.id)}>
                  {item.label}
                </button>
              ))}
            </div>
            <div className="furnitureProductTabs__body">
              {activeTab === "description" ? (
                <>
                  <div>
                    <p>
                      {product.description || "Продавец пока не добавил подробное описание. Основные параметры можно посмотреть в характеристиках товара."}
                    </p>
                    <ul>
                      <li>Категория: {product.category || "Мебель"}</li>
                      <li>Раздел: {product.section || "Мебель"}</li>
                      <li>ID товара: #{product.id}</li>
                      {colorSpec ? <li>Цвет: {colorSpec}</li> : null}
                      {materialSpec ? <li>Материал: {materialSpec}</li> : null}
                    </ul>
                  </div>
                  {dimensionsSpec ? (
                    <div className="furnitureSizeNote">
                      <span>Размеры</span>
                      <strong>{dimensionsSpec}</strong>
                    </div>
                  ) : null}
                </>
              ) : null}

              {activeTab === "specs" ? (
                <div className="furnitureSpecTable">
                  {[...specs, { key: "Остаток", value: `${product.stock} шт.` }, { key: "Цена", value: formatPrice(product.price) }].map((spec) => (
                    <article key={`${spec.key}-${spec.value}`}>
                      <span>{spec.key}</span>
                      <strong>{spec.value}</strong>
                    </article>
                  ))}
                </div>
              ) : null}

              {activeTab === "delivery" ? (
                <div className="furnitureDeliveryGrid">
                  <article>
                    <span>🚚</span>
                    <strong>Доставка</strong>
                    <p>Город, адрес и стоимость доставки выбираются на странице оформления заказа.</p>
                  </article>
                  <article>
                    <span>💳</span>
                    <strong>Оплата</strong>
                    <p>Оплата проходит через checkout Dayen. Перед оплатой вы увидите итоговую сумму заказа.</p>
                  </article>
                  <article>
                    <span>↩</span>
                    <strong>Возврат</strong>
                    <p>Возврат и спор открываются из страницы заказа, чтобы поддержка видела товар и покупку.</p>
                  </article>
                  <article>
                    <span>📦</span>
                    <strong>Наличие</strong>
                    <p>{product.stock > 0 ? `Можно заказать сейчас, доступно: ${product.stock} шт.` : "Товара сейчас нет в наличии."}</p>
                  </article>
                </div>
              ) : null}

              {activeTab === "reviews" ? (
                <div className="furnitureTabReviews">
                  {reviews.length ? (
                    reviews.map((review) => (
                      <article key={review.id}>
                        <div>
                          <strong>{review.name || review.user_name || "Покупатель"}</strong>
                          <span>★ {review.rating} • {formatDate(review.created_at)}</span>
                        </div>
                        <p>{review.comment || "Покупатель оставил оценку без комментария."}</p>
                      </article>
                    ))
                  ) : (
                    <div className="furnitureEmptyState">У этого товара пока нет отзывов. Отзыв можно оставить после покупки и получения заказа.</div>
                  )}
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <section className="furnitureProductInfo">
          <span className="furnitureProductInfo__badge">{product.category || "Угловой диван"}</span>
          <h1>{product.title}</h1>
          <div className="furnitureProductInfo__meta">
            {reviewCount && rating ? <span>★ {rating.toFixed(1)} ({reviewCount} отзыва)</span> : <span>Пока нет отзывов</span>}
            <span>ID товара: #{product.id}</span>
          </div>

          <div className="furnitureProductPrice">
            <strong>{formatPrice(product.price)}</strong>
            {hasDiscount ? <span>{formatPrice(oldPrice)}</span> : null}
          </div>
          {hasDiscount ? <div className="furnitureSave">Вы экономите {formatPrice(saving)}</div> : null}

          <p className="furnitureProductLead">
            {product.description || "Описание пока не добавлено продавцом. Перед покупкой можно уточнить детали у магазина или поддержки."}
          </p>

          {colorSpec ? (
            <div className="furnitureOptionBlock">
              <strong>Цвет: {colorSpec}</strong>
            </div>
          ) : null}

          {materialSpec ? (
            <div className="furnitureOptionBlock">
              <strong>Материал: {materialSpec}</strong>
            </div>
          ) : null}

          {cornerSpec ? (
            <div className="furnitureOptionBlock">
              <strong>Сторона угла: {cornerSpec}</strong>
            </div>
          ) : null}

          <div className="furnitureInfoRows">
            <article>
              <span>🚚</span>
              <div>
                <strong>Доставка</strong>
                <p>Стоимость и срок рассчитываются при оформлении заказа.</p>
              </div>
            </article>
            <article>
              <span>🛡</span>
              <div>
                <strong>Гарантия</strong>
                <p>Условия зависят от продавца и характеристик товара.</p>
              </div>
            </article>
          </div>

          <aside className="furnitureStickyBuy">
            <div className="furnitureProductPrice furnitureProductPrice--small">
              <strong>{formatPrice(product.price)}</strong>
              {hasDiscount ? <span>{formatPrice(oldPrice)}</span> : null}
            </div>
            {hasDiscount ? <div className="furnitureSave">Вы экономите {formatPrice(saving)}</div> : null}
            <button type="button" className="furnitureButton" onClick={onAddToCart}>
              {hasInCart ? "В корзине" : "Добавить в корзину"}
            </button>
            <button type="button" className="furnitureButton furnitureButton--soft" onClick={onBuyNow}>
              Купить сейчас
            </button>
            <div className="furnitureStickyBuy__benefits">
              <span>🚚 Доставка при оформлении</span>
              <span>↩ Возврат по правилам продавца</span>
              <span>💳 Безопасная оплата</span>
            </div>
            <button type="button" className="furnitureFavoriteWide" onClick={onToggleLike}>
              ♡ Добавить в избранное
            </button>
            {seller ? (
              <Link to={`/sellers/${seller.id}`} className="furnitureSellerLink">
                <span className="furnitureSellerLink__avatar">
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

      {specs.length ? (
        <section className="furnitureSpecsStrip">
          {specs.slice(0, 6).map((spec) => (
            <article key={`${spec.key}-${spec.value}`}>
              <span>{spec.key}</span>
              <strong>{spec.value}</strong>
            </article>
          ))}
        </section>
      ) : null}

    </main>
  );
}
