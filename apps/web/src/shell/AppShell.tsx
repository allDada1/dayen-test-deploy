import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { AssistantWidget } from "../components/AssistantWidget";
import { CartIcon } from "../components/icons/CartIcon";
import { InstagramIcon, TelegramIcon, TikTokIcon, YoutubeIcon } from "../components/icons/SocialIcons";
import { useAuth } from "../providers/auth";
import { useCart } from "../providers/cart";
import { useToast } from "../providers/toast";
import { api } from "../services/api";
import { formatPrice } from "../services/format";
import type { MarketplaceSection, NotificationItem, Product, SearchSeller, Tile } from "../types/api";


function IconSearch() {
  return (
    <svg className="dayenHeaderIcon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="11" cy="11" r="6.2" />
      <path d="M15.7 15.7 20 20" />
    </svg>
  );
}

function IconBag() {
  return <CartIcon className="dayenHeaderIcon" />;
}

function IconBell() {
  return (
    <svg className="dayenHeaderIcon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6.8 16.4h10.4c-.8-.9-1.2-2-1.2-3.3V10a4 4 0 0 0-8 0v3.1c0 1.3-.4 2.4-1.2 3.3Z" />
      <path d="M10 19a2.1 2.1 0 0 0 4 0" />
      <path d="M12 4.2V3" />
    </svg>
  );
}

function isCatalogLike(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/home-concept" ||
    pathname.startsWith("/search") ||
    pathname.startsWith("/catalog") ||
    pathname.startsWith("/category") ||
    pathname.startsWith("/tile") ||
    pathname.startsWith("/product") ||
    pathname.startsWith("/sellers")
  );
}

function isAuthLike(pathname: string) {
  return pathname.startsWith("/auth") || pathname.startsWith("/forgot-password") || pathname.startsWith("/reset-password");
}

function sellerName(seller: SearchSeller) {
  return seller.nickname || seller.name || `seller-${seller.id}`;
}

function isFurnitureSection(section: Pick<MarketplaceSection, "slug" | "title">) {
  return /furniture|мебел|диван|sofa/i.test([section.slug, section.title].filter(Boolean).join(" "));
}

function isBeautySection(section: Pick<MarketplaceSection, "slug" | "title">) {
  return /beauty|health|wellness|красот|здоров|уход|космет|витамин|аромат/i.test([section.slug, section.title].filter(Boolean).join(" "));
}

function isShoesSection(section: Pick<MarketplaceSection, "slug" | "title">) {
  return /shoes|shoe|footwear|обув|кроссов|ботин|туфл|лофер|сандал/i.test([section.slug, section.title].filter(Boolean).join(" "));
}

function marketplaceSectionHref(section: Pick<MarketplaceSection, "slug" | "title">) {
  if (isFurnitureSection(section)) return "/tile/furniture";
  if (isBeautySection(section)) return "/tile/beauty-health";
  if (isShoesSection(section)) return "/tile/shoes";
  return `/catalog-preview#catalog-section-${section.slug}`;
}

function normalizeNotificationHref(link?: string | null) {
  const clean = String(link || "/notifications").trim();
  if (!clean) return "/notifications";
  if (clean === "orders.html") return "/orders";
  if (clean === "profile.html") return "/profile";
  return clean.startsWith("/") ? clean : `/${clean}`;
}

function latestNotification(items: NotificationItem[]) {
  return [...items].sort((left, right) => Number(right.id) - Number(left.id))[0] || null;
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { items } = useCart();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTiles, setSearchTiles] = useState<Tile[]>([]);
  const [searchSellers, setSearchSellers] = useState<SearchSeller[]>([]);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [sections, setSections] = useState<MarketplaceSection[]>([]);
  const [categoryTiles, setCategoryTiles] = useState<Tile[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const categoryMenuRef = useRef<HTMLDivElement | null>(null);
  const latestNotificationIdRef = useRef<number | null>(null);
  const notificationsBootstrappedRef = useRef(false);
  const authLike = isAuthLike(location.pathname);
  const adminLike = location.pathname.startsWith("/admin");
  const furnitureLike = location.pathname.startsWith("/tile/furniture");
  const beautyLike = location.pathname.startsWith("/tile/beauty-health");
  const shoesLike = location.pathname.startsWith("/tile/shoes");
  const themeShellClass = shoesLike ? "shoes-shell" : beautyLike ? "beauty-shell" : furnitureLike ? "furniture-shell" : "";
  const toneShellClass = adminLike ? "admin-shell" : "public-light-shell";
  const shellClass = ["legacy-shell", themeShellClass, toneShellClass].filter(Boolean).join(" ");

  useEffect(() => {
    if (!isCatalogLike(location.pathname)) return;
    void Promise.all([api.getMarketplaceSections(), api.getTiles()])
      .then(([sectionsResponse, tilesResponse]) => {
        setSections((sectionsResponse.items || []).filter((item) => item.is_active !== 0));
        setCategoryTiles((tilesResponse.tiles || []).filter((item) => item.is_active !== 0));
      })
      .catch(() => {
        setSections([]);
        setCategoryTiles([]);
      });
  }, [location.pathname]);

  useEffect(() => {
    if (!user) {
      setNotificationCount(0);
      setAccountMenuOpen(false);
      latestNotificationIdRef.current = null;
      notificationsBootstrappedRef.current = false;
      return;
    }

    let alive = true;

    function loadNotificationCount() {
      void api
        .getNotifications()
        .then((response) => {
          if (!alive) return;

          setNotificationCount(response.unread_count || 0);

          const latest = latestNotification(response.items || []);
          const latestId = latest ? Number(latest.id) : null;
          const previousId = latestNotificationIdRef.current || 0;

          if (!latestId) {
            latestNotificationIdRef.current = null;
            notificationsBootstrappedRef.current = true;
            return;
          }

          if (!notificationsBootstrappedRef.current) {
            latestNotificationIdRef.current = latestId;
            notificationsBootstrappedRef.current = true;
            return;
          }

          if (latestId > previousId) {
            latestNotificationIdRef.current = latestId;
            if (!latest.is_read) {
              toast.info(latest.body || latest.title || "Новое уведомление", {
                title: latest.title || "Новое уведомление",
                action: {
                  label: "Открыть",
                  href: normalizeNotificationHref(latest.link),
                },
              });
            }
          }
        })
        .catch(() => {
          if (alive) setNotificationCount(0);
        });
    }

    loadNotificationCount();
    const timer = window.setInterval(loadNotificationCount, 30000);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [toast, user]);

  useEffect(() => {
    setAccountMenuOpen(false);
    setCategoryMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!accountMenuOpen) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (accountMenuRef.current?.contains(event.target as Node)) return;
      setAccountMenuOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [accountMenuOpen]);

  useEffect(() => {
    if (!categoryMenuOpen) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (categoryMenuRef.current?.contains(event.target as Node)) return;
      setCategoryMenuOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [categoryMenuOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchTiles([]);
      setSearchSellers([]);
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      void api
        .getSearchSuggestions(trimmed)
        .then((response) => {
          setSearchTiles((response.tiles || []).slice(0, 8));
          setSearchSellers((response.sellers || []).slice(0, 4));
          setSearchResults((response.products || []).slice(0, 8));
        })
        .catch(() => {
          setSearchTiles([]);
          setSearchSellers([]);
          setSearchResults([]);
        })
        .finally(() => setSearchLoading(false));
    }, 180);

    return () => window.clearTimeout(timer);
  }, [query, searchOpen]);

  const subLinks = useMemo(() => {
    if (!sections.length) {
      return [
        { title: "Игры", slug: "games" },
        { title: "Мобильные игры", slug: "mobile" },
        { title: "Приложения", slug: "apps" },
      ];
    }

    return sections.slice(0, 4).map((section) => ({
      title: section.title,
      slug: section.slug,
    }));
  }, [sections]);

  const categoryMenuSections = useMemo(() => {
    const groups = new Map<string, Tile[]>();
    categoryTiles
      .slice()
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.title.localeCompare(b.title))
      .forEach((tile) => {
        const group = tile.section || "Категории";
        groups.set(group, [...(groups.get(group) || []), tile]);
      });

    return Array.from(groups.entries()).map(([title, tiles]) => ({
      title,
      tiles: tiles.slice(0, 8),
    }));
  }, [categoryTiles]);

  const hasSearchResults = searchTiles.length > 0 || searchSellers.length > 0 || searchResults.length > 0;

  useEffect(() => {
    if (location.hash) return;
    window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  function closeSearch() {
    setSearchOpen(false);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    closeSearch();
    navigate(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/catalog");
  }

  function goToProduct(id: number) {
    closeSearch();
    navigate(`/product/${id}`);
  }

  function goToTile(slug: string) {
    closeSearch();
    navigate(`/tile/${slug}`);
  }

  function goToSeller(id: number) {
    closeSearch();
    navigate(`/sellers/${id}`);
  }

  function searchPlaceholder() {
    if (shoesLike) return "Поиск обуви, размеров и продавцов...";
    if (beautyLike) return "Поиск ухода, косметики и wellness...";
    if (furnitureLike) return "Поиск мебели и товаров для дома...";
    return "Поиск товаров, плиток, магазинов...";
  }

  return (
    <div className={shellClass}>
      {!authLike ? (
        <header className="topbar">
          <div className="container topbar__inner topbar__playerok">
            <Link className="brand" to="/">
              <span className="brand__dot" />
              <span className="brand__name">Dayen</span>
            </Link>

            <form className="topSearch" onSubmit={submitSearch}>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => setSearchOpen(true)}
                placeholder={searchPlaceholder()}
              />
              <button type="submit" className="topSearch__clear" aria-label="Найти">
                <IconSearch />
              </button>
            </form>

            <nav className="topNav">
              <NavLink className="topNav__a" to={isCatalogLike(location.pathname) ? "/catalog" : "/"}>
                {isCatalogLike(location.pathname) ? "Каталог" : "Главная"}
              </NavLink>
              <NavLink className="topNav__a" to="/about/support">
                Поддержка
              </NavLink>
            </nav>

            <div className="topbar__actions">
              <Link className="iconBtn iconBtn--header" to="/cart" title="Корзина" aria-label="Корзина">
                <IconBag />
                {items.length > 0 ? <span className="badge">{items.length}</span> : null}
              </Link>
              <Link className="iconBtn iconBtn--header" to="/notifications" title="Уведомления" aria-label="Уведомления">
                <IconBell />
                {notificationCount > 0 ? <span className="badge">{notificationCount}</span> : null}
              </Link>
              <div className="headerProfile" ref={accountMenuRef}>
                <button
                  type="button"
                  className="iconBtn headerProfile__trigger"
                  title="Профиль"
                  aria-expanded={accountMenuOpen}
                  onClick={() => {
                    if (!user) {
                      navigate("/auth");
                      return;
                    }
                    setAccountMenuOpen((current) => !current);
                  }}
                >
                  <span>{user?.nickname || user?.name || "Войти"}</span>
                </button>

                {user && accountMenuOpen ? (
                  <div className="headerProfile__menu">
                    {user.is_admin || user.is_owner ? <Link to="/admin">Админка</Link> : null}
                    <Link to="/profile">Профиль</Link>
                    <Link to="/orders">Мои заказы</Link>
                    <Link to="/favorites">Избранное</Link>
                    <Link to="/notifications">Уведомления</Link>
                    <Link to="/settings">Настройки</Link>
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        void logout();
                      }}
                    >
                      Выйти
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>
      ) : null}

      {!authLike && isCatalogLike(location.pathname) ? (
        <div className="subbar">
          <div className="container subbar__inner">
            <div className="catDrop" ref={categoryMenuRef}>
              <button
                className="catBtn"
                type="button"
                aria-haspopup="menu"
                aria-expanded={categoryMenuOpen}
                onClick={() => setCategoryMenuOpen((current) => !current)}
              >
                Категории ▾
              </button>
              {categoryMenuOpen ? (
                <div className="catMenu" role="menu">
                  <div className="catMenu__quick">
                    <Link to="/catalog-preview" role="menuitem">
                      <span>Все категории</span>
                      <small>Разделы, плитки и подборки</small>
                    </Link>
                    <Link to="/search" role="menuitem">
                      <span>Поиск по товарам</span>
                      <small>Найти товар, магазин или плитку</small>
                    </Link>
                  </div>

                  {categoryMenuSections.length ? (
                    <div className="catMenu__groups">
                      {categoryMenuSections.map((group) => (
                        <section className="catMenu__group" key={group.title}>
                          <div className="catMenu__title">{group.title}</div>
                          <div className="catMenu__tiles">
                            {group.tiles.map((tile) => (
                              <Link key={tile.slug} to={`/tile/${tile.slug}`} role="menuitem">
                                <span className="catMenu__icon">
                                  {tile.icon_url ? <img src={tile.icon_url} alt="" /> : <span>{tile.emoji || "•"}</span>}
                                </span>
                                <span>{tile.title}</span>
                              </Link>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <div className="catMenu__empty">Категории загружаются...</div>
                  )}
                </div>
              ) : null}
            </div>
            <div className="subLinks">
              {subLinks.map((item) => (
                <Link key={item.slug} to={marketplaceSectionHref(item)}>
                  {item.title}
                </Link>
              ))}
              <Link to="/favorites">Избранное</Link>
            </div>
          </div>
        </div>
      ) : null}

      <main>
        <Outlet />
      </main>

      {!authLike ? (
        <footer className="siteFooter">
          <div className="container siteFooter__grid">
            <div>
              <div className="siteFooter__brand">Dayen</div>
              <div className="muted">Маркетплейс товаров и услуг</div>
              <div className="muted">Покупки, продавцы и поддержка в одном месте</div>
            </div>

            <div>
              <Link className="siteFooter__h" to="/about">
                О сайте
              </Link>
              <Link className="siteFooter__a" to="/about/how">
                Как работает
              </Link>
              <Link className="siteFooter__a" to="/about/rules">
                Правила
              </Link>
              <Link className="siteFooter__a" to="/about/partners">
                Партнёрам
              </Link>
            </div>

            <div>
              <Link className="siteFooter__h" to="/about/support">
                Поддержка
              </Link>
              <Link className="siteFooter__a" to="/about/faq">
                FAQ
              </Link>
              <Link className="siteFooter__a" to="/about/support-chat">
                Чат поддержки
              </Link>
              <Link className="siteFooter__a" to="/about/report">
                Сообщить о проблеме
              </Link>
            </div>

            <div>
              <Link className="siteFooter__h" to="/about/documents">
                Документы
              </Link>
              <Link className="siteFooter__a" to="/about/privacy">
                Политика конфиденциальности
              </Link>
              <Link className="siteFooter__a" to="/about/terms">
                Пользовательское соглашение
              </Link>
            </div>

            <div>
              <div className="siteFooter__h">Связь с Dayen</div>
              <div className="siteFooter__socials">
                <Link className="siteFooter__social siteFooter__social--telegram" to="/about/support">
                  <TelegramIcon />
                </Link>
                <Link className="siteFooter__social siteFooter__social--instagram" to="/about/report">
                  <InstagramIcon />
                </Link>
                <Link className="siteFooter__social siteFooter__social--tiktok" to="/about/partners">
                  <TikTokIcon />
                </Link>
                <Link className="siteFooter__social siteFooter__social--youtube" to="/about/documents">
                  <YoutubeIcon />
                </Link>
              </div>
            </div>
          </div>

          <div className="container siteFooter__bottom">
            <div className="muted">© Dayen, 2026</div>
            <div className="muted">Контакты: support@dayen.kz</div>
          </div>
        </footer>
      ) : null}

      {!authLike && searchOpen ? (
        <div className="searchModal" onClick={closeSearch}>
          <div className="searchModal__overlay" />
          <div className="searchModal__box" onClick={(event) => event.stopPropagation()}>
            <form className="searchModal__top" onSubmit={submitSearch}>
              <input
                id="searchModalInput"
                className="searchModal__input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск товаров, плиток, магазинов..."
                autoFocus
              />
              <button type="submit" className="searchModal__btn">
                Найти
              </button>
              <button type="button" id="searchModalClose" className="searchModal__close" onClick={closeSearch} aria-label="Закрыть поиск">
                ×
              </button>
            </form>

            <div className="searchModal__results">
              {searchLoading ? <div className="searchModal__empty">Загрузка...</div> : null}
              {!searchLoading && query.trim().length >= 2 && !hasSearchResults ? <div className="searchModal__empty">Ничего не найдено</div> : null}

              {searchTiles.length ? <div className="searchModal__label">Плитки</div> : null}
              {searchTiles.length ? (
                <div className="searchTilesGrid">
                  {searchTiles.map((tile) => (
                    <button key={tile.id} type="button" className="searchTileResult" onClick={() => goToTile(tile.slug)}>
                      <span className="searchTileResult__icon">
                        {tile.icon_url ? <img src={tile.icon_url} alt={tile.title} /> : <span>{tile.emoji || "•"}</span>}
                      </span>
                      <span className="searchTileResult__body">
                        <strong>{tile.title}</strong>
                        <span>{tile.section || "Плитка"}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              {searchSellers.length ? <div className="searchModal__label">Магазины</div> : null}
              {searchSellers.length ? (
                <div className="searchStoresRow">
                  {searchSellers.map((seller) => (
                    <button key={seller.id} type="button" className="searchStoreResult" onClick={() => goToSeller(seller.id)}>
                      <span className="searchStoreResult__avatar">
                        {seller.avatar_url ? <img src={seller.avatar_url} alt={sellerName(seller)} /> : <span>{sellerName(seller).slice(0, 1).toUpperCase()}</span>}
                      </span>
                      <span className="searchStoreResult__body">
                        <strong>магазин-{sellerName(seller)}</strong>
                        <span>{seller.about || "Перейти в магазин"}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              {searchResults.length ? <div className="searchModal__label">Товары</div> : null}
              {searchResults.map((product) => (
                <button key={product.id} type="button" className="searchResult" onClick={() => goToProduct(product.id)}>
                  <div className="searchResult__main">
                    <div className="searchResult__thumb">
                      {product.images?.[0] || product.image_url ? <img src={product.images?.[0] || product.image_url} alt={product.title} /> : null}
                    </div>
                    <div className="searchResult__text">
                      <strong>{product.title}</strong>
                      <div className="searchResult__meta">
                        <span>{product.category}</span>
                        {product.section ? <span>{product.section}</span> : null}
                      </div>
                    </div>
                  </div>
                  <strong>{formatPrice(product.price)}</strong>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {!authLike ? <AssistantWidget /> : null}
    </div>
  );
}
