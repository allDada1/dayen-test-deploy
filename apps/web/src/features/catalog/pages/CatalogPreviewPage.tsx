import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { api } from "../../../services/api";
import { formatPrice } from "../../../services/format";
import type { MarketplaceSection, Product, Tile } from "../../../types/api";

function normalizeSection(section?: string | null) {
  return String(section || "").trim().toLowerCase();
}

function isFurnitureSection(section?: Pick<MarketplaceSection, "slug" | "title"> | string | null) {
  const value =
    typeof section === "string"
      ? section
      : [section?.slug, section?.title].filter(Boolean).join(" ");

  return /furniture|мебел|диван|sofa/i.test(value || "");
}

function isBeautySection(section?: Pick<MarketplaceSection, "slug" | "title"> | string | null) {
  const value =
    typeof section === "string"
      ? section
      : [section?.slug, section?.title].filter(Boolean).join(" ");

  return /beauty|health|wellness|красот|здоров|уход|космет|витамин|аромат/i.test(value || "");
}

function isShoesSection(section?: Pick<MarketplaceSection, "slug" | "title"> | string | null) {
  const value =
    typeof section === "string"
      ? section
      : [section?.slug, section?.title].filter(Boolean).join(" ");

  return /shoes|shoe|footwear|обув|кроссов|ботин|туфл|лофер|сандал/i.test(value || "");
}

function sectionHref(section: MarketplaceSection) {
  if (isFurnitureSection(section)) return "/tile/furniture";
  if (isBeautySection(section)) return "/tile/beauty-health";
  if (isShoesSection(section)) return "/tile/shoes";
  return `#catalog-section-${section.slug}`;
}

function tileImage(tile: Tile) {
  return tile.icon_url || "";
}

function productImage(product: Product) {
  return product.images?.[0] || product.image_url || "";
}

function productCountLabel(count: number) {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  if (lastDigit === 1 && lastTwoDigits !== 11) return `${count} товар`;
  if ([2, 3, 4].includes(lastDigit) && ![12, 13, 14].includes(lastTwoDigits)) return `${count} товара`;
  return `${count} товаров`;
}

function showcaseCountLabel(count: number) {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  if (lastDigit === 1 && lastTwoDigits !== 11) return `${count} витрина`;
  if ([2, 3, 4].includes(lastDigit) && ![12, 13, 14].includes(lastTwoDigits)) return `${count} витрины`;
  return `${count} витрин`;
}

export function CatalogPreviewPage() {
  const location = useLocation();
  const [sections, setSections] = useState<MarketplaceSection[]>([]);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const selectedSectionSlug = useMemo(() => {
    const prefix = "#catalog-section-";
    return location.hash.startsWith(prefix) ? decodeURIComponent(location.hash.slice(prefix.length)) : "";
  }, [location.hash]);

  useEffect(() => {
    if (selectedSectionSlug) {
      window.scrollTo(0, 0);
    }
  }, [selectedSectionSlug]);

  useEffect(() => {
    void Promise.all([api.getMarketplaceSections(), api.getTiles(), api.getProducts()]).then(([sectionsResponse, tilesResponse, productsResponse]) => {
      setSections((sectionsResponse.items || []).filter((section) => section.is_active !== 0));
      setTiles(tilesResponse.tiles || []);
      setProducts(productsResponse.items || []);
    });
  }, []);

  const productCountByTile = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) {
      const slug = product.tile_slug || product.category;
      if (!slug) continue;
      counts.set(slug, (counts.get(slug) || 0) + 1);
    }
    return counts;
  }, [products]);

  const sectionCards = useMemo(() => {
    return sections.map((section) => {
      const sectionTiles = tiles.filter((tile) => normalizeSection(tile.section) === normalizeSection(section.title));
      return {
        ...section,
        tiles: sectionTiles,
        count: sectionTiles.length,
      };
    });
  }, [sections, tiles]);

  const visibleSections = useMemo(() => {
    const lowered = deferredQuery.trim().toLowerCase();

    return sectionCards
      .filter((section) => !isFurnitureSection(section) && !isBeautySection(section) && !isShoesSection(section))
      .filter((section) => !selectedSectionSlug || section.slug === selectedSectionSlug)
      .map((section) => ({
        ...section,
        tiles: section.tiles.filter((tile) => {
          if (!lowered) return true;
          return [tile.title, tile.slug, tile.section].some((value) => String(value || "").toLowerCase().includes(lowered));
        }),
      }))
      .filter((section) => section.tiles.length > 0 || !lowered);
  }, [deferredQuery, sectionCards, selectedSectionSlug]);

  const productsBySection = useMemo(() => {
    return new Map(
      visibleSections.map((section) => {
        const sectionTileSlugs = new Set(section.tiles.map((tile) => tile.slug));
        const sectionTileTitles = new Set(section.tiles.map((tile) => normalizeSection(tile.title)));
        const sectionProducts = products.filter((product) => {
          const productTile = product.tile_slug || product.category;
          const productCategory = normalizeSection(product.category);
          const productSection = normalizeSection(product.section);

          return (
            (productTile && sectionTileSlugs.has(productTile)) ||
            (productCategory && sectionTileSlugs.has(productCategory)) ||
            (productCategory && sectionTileTitles.has(productCategory)) ||
            productSection === normalizeSection(section.title)
          );
        });

        return [section.slug, sectionProducts.slice(0, 12)] as const;
      }),
    );
  }, [products, visibleSections]);

  return (
    <main className={["catalogPreview", "shell-container", selectedSectionSlug ? "is-selected" : ""].filter(Boolean).join(" ")}>
      <section className="catalogPreviewHero">
        <div className="catalogPreviewHero__content">
          <h1>Каталог разделов</h1>
          <p>Выберите направление маркетплейса. Обычные разделы открывают свои витрины и товары, а мебель и beauty ведут в отдельные тематические страницы.</p>
        </div>

        <div className="catalogPreviewSearch">
          <label htmlFor="catalog-preview-search">Поиск по витринам</label>
          <input
            id="catalog-preview-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Например: игры, приложения, мебель"
          />
          <div className="catalogPreviewSearch__hint">Можно искать по названию плитки или разделу.</div>
        </div>
      </section>

      <section className="catalogPreviewSectionCards" aria-label="Разделы каталога">
        {sectionCards.map((section) => (
          <Link
            key={section.id}
            to={sectionHref(section)}
            className={[
              "catalogPreviewSectionCard",
              isFurnitureSection(section) || isBeautySection(section) || isShoesSection(section) ? "is-featured" : "",
              selectedSectionSlug === section.slug ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="catalogPreviewSectionCard__icon">
              {section.icon_url ? <img src={section.icon_url} alt={section.title} /> : <span>{section.emoji || "✨"}</span>}
            </div>
            <div>
              <strong>{section.title}</strong>
              <span>{isFurnitureSection(section) ? "Открыть мебельный раздел" : isBeautySection(section) ? "Открыть beauty-раздел" : isShoesSection(section) ? "Открыть раздел обуви" : showcaseCountLabel(section.count)}</span>
            </div>
          </Link>
        ))}
      </section>

      {selectedSectionSlug ? (
        <div className="catalogPreviewSelectedNote">
          <span>Открыт один раздел: сначала плитки, ниже товары.</span>
          <Link to="/catalog-preview">Показать все разделы</Link>
        </div>
      ) : null}

      <div className="catalogPreviewSections">
        {visibleSections.map((section) => {
          const sectionProducts = productsBySection.get(section.slug) || [];

          return (
            <section key={section.id} id={`catalog-section-${section.slug}`} className="catalogPreviewSection">
              <div className="catalogPreviewSection__head">
                <div>
                  <span className="catalogPreviewSection__icon">{section.emoji || "✨"}</span>
                  <h2>{section.title}</h2>
                  <p>Плитки этого раздела ведут к отдельным витринам, а ниже можно сразу посмотреть товары.</p>
                </div>
                <span className="catalogPreviewSection__count">{section.tiles.length}</span>
              </div>

              {section.tiles.length ? (
                <div className="catalogPreviewGrid">
                  {section.tiles.map((tile) => {
                    const count = productCountByTile.get(tile.slug) || productCountByTile.get(tile.title) || 0;
                    const image = tileImage(tile);

                    return (
                      <Link key={tile.id} to={`/tile/${tile.slug}`} className="catalogPreviewTile">
                        <div className="catalogPreviewTile__image">
                          {image ? <img src={image} alt={tile.title} /> : <span>{tile.emoji || section.emoji || "✨"}</span>}
                        </div>
                        <div className="catalogPreviewTile__body">
                          <strong>{tile.title}</strong>
                          {count > 0 ? <span>{productCountLabel(count)}</span> : null}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="catalogPreviewEmpty">В этом разделе пока нет плиток.</div>
              )}

              {sectionProducts.length ? (
                <div className="catalogPreviewProductsBlock">
                  <div className="catalogPreviewProductsHead">
                    <h3>Товары раздела</h3>
                    <span>{productCountLabel(sectionProducts.length)}</span>
                  </div>
                  <div className="catalogPreviewProducts">
                    {sectionProducts.map((product) => {
                      const image = productImage(product);

                      return (
                        <Link key={product.id} to={`/product/${product.id}`} className="catalogPreviewProduct">
                          <span className="catalogPreviewProduct__image">
                            {image ? <img src={image} alt={product.title} /> : <span>{section.emoji || "✨"}</span>}
                          </span>
                          <span className="catalogPreviewProduct__body">
                            <strong>{product.title}</strong>
                            <small>{product.category || product.section || section.title}</small>
                            <b>{formatPrice(product.price)}</b>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      {visibleSections.length === 0 ? <section className="catalogPreviewEmpty catalogPreviewEmpty--page">Ничего не найдено. Попробуйте изменить запрос.</section> : null}
    </main>
  );
}
