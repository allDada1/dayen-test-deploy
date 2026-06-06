import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { ProductCard } from "../../../components/ProductCard";
import { BeautyCategoryPage, BeautyHomePage } from "../../beauty/BeautyPages";
import { FurnitureCategoryPage, FurnitureHomePage } from "../../furniture/FurniturePages";
import { ShoesCategoryPage, ShoesHomePage } from "../../shoes/ShoesPages";
import { api } from "../../../services/api";
import type { HomeHeroBanner, Product, Tile } from "../../../types/api";

const themedTileSlugs = new Set(["furniture", "beauty-health", "shoes"]);

export function TilePage() {
  const { slug, category } = useParams();
  const [tile, setTile] = useState<Tile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [banner, setBanner] = useState<HomeHeroBanner | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!slug) return;

    let alive = true;
    setLoading(true);

    const productsRequest = themedTileSlugs.has(slug) ? api.getProducts() : api.getTileProducts(slug);
    const bannerRequest =
      themedTileSlugs.has(slug)
        ? api.getPageBanner(category ? `${slug}:${category}` : slug).catch(() => ({ banner: null }))
        : Promise.resolve({ banner: null });

    void Promise.allSettled([api.getTiles(), productsRequest, bannerRequest] as const)
      .then(([tilesResult, productsResult, bannerResult]) => {
        if (!alive) return;
        setTile(tilesResult.status === "fulfilled" ? tilesResult.value.tiles.find((item) => item.slug === slug) || null : null);
        setProducts(productsResult.status === "fulfilled" ? productsResult.value.items : []);
        setBanner(bannerResult.status === "fulfilled" ? bannerResult.value.banner || null : null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [slug, category]);

  if (slug === "furniture") {
    if (category) {
      return <FurnitureCategoryPage products={products} categorySlug={category} banner={banner} loading={loading} />;
    }

    return <FurnitureHomePage products={products} banner={banner} loading={loading} />;
  }

  if (slug === "beauty-health") {
    if (category) {
      return <BeautyCategoryPage products={products} categorySlug={category} banner={banner} loading={loading} />;
    }

    return <BeautyHomePage products={products} banner={banner} loading={loading} />;
  }

  if (slug === "shoes") {
    if (category) {
      return <ShoesCategoryPage products={products} categorySlug={category} banner={banner} loading={loading} />;
    }

    return <ShoesHomePage products={products} banner={banner} loading={loading} />;
  }

  return (
    <main className="container catalogPage legacy-admin-page">
      <section className="catalogBlock">
        <div>
          <div className="catalogTitle">{tile?.title || "Плитка"}</div>
          <div className="catalogSub">Раздел: {tile?.section || "—"}</div>
          <div className="muted" style={{ marginTop: 8 }}>
            Найдено: {products.length}
          </div>
        </div>

        {products.length ? (
          <div className="legacy-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <section className="contentCard">
            <strong>Пока пусто</strong>
            <div className="muted">В этой плитке ещё нет товаров.</div>
          </section>
        )}
      </section>
    </main>
  );
}
