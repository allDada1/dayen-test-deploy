import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { ProductCard } from "../../../components/ProductCard";
import { api } from "../../../services/api";
import type { HomeHeroBanner, MarketplaceSection, Product } from "../../../types/api";

const PAGE_STEP = 30;

const sectionFallbacks: Record<string, string> = {
  games: "🎮",
  mobile: "📱",
  apps: "🧩",
  other: "✨",
};

function isFurnitureSection(section: Pick<MarketplaceSection, "slug" | "title">) {
  return /furniture|mebel|мебел|диван|sofa/i.test([section.slug, section.title].filter(Boolean).join(" "));
}

function isBeautySection(section: Pick<MarketplaceSection, "slug" | "title">) {
  return /beauty|beautyandhealth|health|wellness|красот|здоров|уход|космет|витамин|аромат/i.test([section.slug, section.title].filter(Boolean).join(" "));
}

function isShoesSection(section: Pick<MarketplaceSection, "slug" | "title">) {
  return /shoes|shoe|footwear|обув|кроссов|ботин|туфл|лофер|сандал/i.test([section.slug, section.title].filter(Boolean).join(" "));
}

function sectionLink(section: Pick<MarketplaceSection, "slug" | "title">) {
  if (isFurnitureSection(section)) return "/tile/furniture";
  if (isBeautySection(section)) return "/tile/beauty-health";
  if (isShoesSection(section)) return "/tile/shoes";
  return `/catalog-preview#catalog-section-${section.slug}`;
}

function popularityScore(product: Product) {
  const likes = Number(product.likes || 0);
  const rating = Number(product.rating_avg || 0);
  const ratingCount = Number(product.rating_count || 0);
  return likes * 1000 + ratingCount * 30 + rating * 10;
}

export function HomeConceptPage() {
  const [sections, setSections] = useState<MarketplaceSection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [banner, setBanner] = useState<HomeHeroBanner | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP);
  const sectionsScrollerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({
    dragging: false,
    moved: false,
    startX: 0,
    startScrollLeft: 0,
  });

  useEffect(() => {
    let active = true;

    void Promise.allSettled([api.getMarketplaceSections(), api.getProducts({ sort: "likes", dir: "desc" }), api.getHomeBanner()]).then(
      ([sectionsResult, productsResult, bannerResult]) => {
        if (!active) return;

        setSections(sectionsResult.status === "fulfilled" ? sectionsResult.value.items || [] : []);
        setProducts(productsResult.status === "fulfilled" ? productsResult.value.items || [] : []);
        setBanner(bannerResult.status === "fulfilled" ? bannerResult.value.banner || null : null);
      },
    );

    return () => {
      active = false;
    };
  }, []);

  const activeBanner = useMemo(() => {
    if (!banner || !banner.is_active) return null;
    if (!banner.title?.trim()) return null;
    return banner;
  }, [banner]);

  const popularProducts = useMemo(
    () =>
      products
        .slice()
        .sort((a, b) => popularityScore(b) - popularityScore(a) || Number(b.id || 0) - Number(a.id || 0)),
    [products],
  );

  const visibleProducts = useMemo(() => popularProducts.slice(0, visibleCount), [popularProducts, visibleCount]);
  const activeSections = useMemo(() => sections.filter((section) => section.is_active !== 0), [sections]);
  const categoriesClassName = [
    "homeConceptCategories",
    activeSections.length >= 20 ? "homeConceptCategories--twoRows" : "homeConceptCategories--singleRow",
  ].join(" ");

  const handleSectionsPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const node = sectionsScrollerRef.current;
    if (!node) return;
    if ((event.target as HTMLElement).closest(".homeConceptCategory")) {
      dragStateRef.current = {
        dragging: false,
        moved: false,
        startX: 0,
        startScrollLeft: node.scrollLeft,
      };
      return;
    }
    dragStateRef.current = {
      dragging: true,
      moved: false,
      startX: event.clientX,
      startScrollLeft: node.scrollLeft,
    };
    node.setPointerCapture(event.pointerId);
  };

  const handleSectionsPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const node = sectionsScrollerRef.current;
    const drag = dragStateRef.current;
    if (!node || !drag.dragging) return;
    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 6) {
      dragStateRef.current.moved = true;
    }
    node.scrollLeft = drag.startScrollLeft - delta;
  };

  const handleSectionsPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const node = sectionsScrollerRef.current;
    if (!node) return;
    dragStateRef.current.dragging = false;
    if (node.hasPointerCapture(event.pointerId)) {
      node.releasePointerCapture(event.pointerId);
    }
  };

  const handleSectionClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (dragStateRef.current.moved) {
      event.preventDefault();
      dragStateRef.current.moved = false;
    }
  };

  return (
    <main className="homeConcept container">
      {activeBanner ? (
        <section className="homeConceptHero">
          <div className="homeConceptHero__visual">
            {activeBanner.image_url ? (
              <img src={activeBanner.image_url} alt={activeBanner.title || "Баннер"} />
            ) : (
              <div className="homeConceptHero__placeholder">Dayen</div>
            )}
          </div>

          <div className="homeConceptHero__copy">
            {activeBanner.eyebrow ? <span className="homeConceptHero__eyebrow">{activeBanner.eyebrow}</span> : null}
            <h1>{activeBanner.title}</h1>
            {activeBanner.description ? <p>{activeBanner.description}</p> : null}
            {activeBanner.cta_label ? (
              <div className="homeConceptHero__actions">
                <Link to={activeBanner.cta_href || "/catalog"} className="linkBtn homeConceptHero__primary">
                  {activeBanner.cta_label}
                </Link>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="homeConceptSection">
        <div className="homeConceptSection__head">
          <h2>Популярные категории</h2>
        </div>

        <div
          ref={sectionsScrollerRef}
          className="homeConceptCategoriesScroller"
          onPointerDown={handleSectionsPointerDown}
          onPointerMove={handleSectionsPointerMove}
          onPointerUp={handleSectionsPointerUp}
          onPointerCancel={handleSectionsPointerUp}
        >
          <div className={categoriesClassName}>
            {activeSections.map((section) => (
              <Link
                key={section.id}
                to={sectionLink(section)}
                className="homeConceptCategory"
                onClick={handleSectionClick}
              >
                <div className="homeConceptCategory__media">
                  {section.icon_url ? (
                    <img src={section.icon_url} alt={section.title} />
                  ) : (
                    <span className="homeConceptCategory__emoji">{section.emoji || sectionFallbacks[section.slug] || "✨"}</span>
                  )}
                </div>
                <strong>{section.title}</strong>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="homeConceptSection">
        <div className="homeConceptSection__head">
          <h2>Популярные товары</h2>
          <Link to="/catalog" className="homeConceptSection__more">
            Смотреть все
          </Link>
        </div>

        <div className="legacy-grid">
          {visibleProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {visibleCount < popularProducts.length ? (
          <div className="catalogShowMore">
            <button type="button" className="ghostBtn" onClick={() => setVisibleCount((current) => current + PAGE_STEP)}>
              Показать ещё
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
