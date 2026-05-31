import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { AdminNav } from "../components/AdminNav";
import { useAuth } from "../../../providers/auth";
import { api } from "../../../services/api";
import { formatPrice } from "../../../services/format";
import type { SellerClaim, SellerRequest } from "../../../types/api";

type DashboardState = {
  products: number;
  outOfStock: number;
  inventoryValue: number;
  sections: number;
  tiles: number;
  pendingSellerRequests: number;
  newSupportTickets: number;
  openClaims: number;
  escalatedClaims: number;
  users: number;
  bannerActive: boolean;
};

const emptyState: DashboardState = {
  products: 0,
  outOfStock: 0,
  inventoryValue: 0,
  sections: 0,
  tiles: 0,
  pendingSellerRequests: 0,
  newSupportTickets: 0,
  openClaims: 0,
  escalatedClaims: 0,
  users: 0,
  bannerActive: false,
};

function isPendingSellerRequest(request: SellerRequest) {
  return ["pending", "new", "review"].includes(String(request.status || "").toLowerCase());
}

function isOpenClaim(claim: SellerClaim) {
  return ["open", "in_review", "escalated"].includes(String(claim.status || "").toLowerCase());
}

export function AdminDashboardPage() {
  const { loading, user } = useAuth();
  const [state, setState] = useState<DashboardState>(emptyState);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!user?.is_admin && !user?.is_owner) return;

    let active = true;
    setIsLoading(true);
    setStatus("");

    async function loadDashboard() {
      const [productsResult, sectionsResult, tilesResult, requestsResult, claimsResult, supportResult, bannerResult, usersResult] =
        await Promise.allSettled([
          api.getProducts(),
          api.getAdminSections(),
          api.getAdminCategories(),
          api.getAdminSellerRequests(),
          api.getAdminClaims(),
          api.getAdminSupportTickets({ status: "new", limit: 1 }),
          api.getAdminHomeBanner(),
          api.getAdminUsers({ page: 1, limit: 1 }),
        ]);

      if (!active) return;

      const products = productsResult.status === "fulfilled" ? productsResult.value.items : [];
      const sections = sectionsResult.status === "fulfilled" ? sectionsResult.value.items : [];
      const tiles = tilesResult.status === "fulfilled" ? tilesResult.value.items : [];
      const sellerRequests = requestsResult.status === "fulfilled" ? requestsResult.value.items || requestsResult.value.requests || [] : [];
      const claims = claimsResult.status === "fulfilled" ? claimsResult.value.items : [];
      const newSupportTickets = supportResult.status === "fulfilled" ? supportResult.value.total : 0;
      const banner = bannerResult.status === "fulfilled" ? bannerResult.value.banner : null;
      const users = usersResult.status === "fulfilled" ? usersResult.value.total : 0;

      const failures = [
        productsResult,
        sectionsResult,
        tilesResult,
        requestsResult,
        claimsResult,
        supportResult,
        bannerResult,
        usersResult,
      ].filter((result) => result.status === "rejected").length;

      setState({
        products: products.length,
        outOfStock: products.filter((product) => Number(product.stock || 0) <= 0).length,
        inventoryValue: products.reduce((sum, product) => sum + Number(product.price || 0) * Number(product.stock || 0), 0),
        sections: sections.length,
        tiles: tiles.length,
        pendingSellerRequests: sellerRequests.filter(isPendingSellerRequest).length,
        newSupportTickets,
        openClaims: claims.filter(isOpenClaim).length,
        escalatedClaims: claims.filter((claim) => claim.status === "escalated").length,
        users,
        bannerActive: Boolean(banner && banner.is_active !== 0),
      });

      setStatus(failures ? `Часть данных не загрузилась: ${failures} блок(а). Остальные разделы доступны.` : "");
      setIsLoading(false);
    }

    void loadDashboard().catch(() => {
      if (!active) return;
      setStatus("Не удалось загрузить сводку. Разделы админки доступны ниже.");
      setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [user]);

  const focusItems = useMemo(
    () => [
      {
        label: "Новые тикеты",
        hint: "Из формы report",
        value: state.newSupportTickets,
        to: "/admin/support?status=new",
        tone: state.newSupportTickets ? "is-warning" : "is-active",
      },
      {
        label: "Открытые обращения",
        hint: "Возвраты и споры",
        value: state.openClaims,
        to: "/admin/claims?status=open",
        tone: state.openClaims ? "is-warning" : "is-active",
      },
      {
        label: "Эскалации",
        hint: "Требуют решения",
        value: state.escalatedClaims,
        to: "/admin/claims?status=escalated",
        tone: state.escalatedClaims ? "is-danger" : "is-active",
      },
      {
        label: "Заявки продавцов",
        hint: "На проверке",
        value: state.pendingSellerRequests,
        to: "/admin/seller-requests?status=pending",
        tone: state.pendingSellerRequests ? "is-warning" : "is-active",
      },
      {
        label: "Товары без остатка",
        hint: "Проверь каталог",
        value: state.outOfStock,
        to: "/admin/products?stock=empty",
        tone: state.outOfStock ? "is-warning" : "is-active",
      },
    ],
    [state.escalatedClaims, state.newSupportTickets, state.openClaims, state.outOfStock, state.pendingSellerRequests],
  );

  const summaryCards = useMemo(
    () => [
      {
        title: "Операционная очередь",
        text: state.newSupportTickets + state.openClaims + state.escalatedClaims
          ? "Есть задачи, которые лучше закрыть до демонстрации."
          : "Критичных обращений сейчас нет.",
        rows: [
          ["Новые тикеты", state.newSupportTickets],
          ["Открытые обращения", state.openClaims],
          ["Эскалации", state.escalatedClaims],
        ],
      },
      {
        title: "Качество каталога",
        text: state.outOfStock
          ? "Есть товары без остатка. Их стоит скрыть, пополнить или обновить."
          : "Товары с нулевым остатком не найдены.",
        rows: [
          ["Товаров", state.products],
          ["Без остатка", state.outOfStock],
          ["Плиток на разделы", state.sections ? `${state.tiles} / ${state.sections}` : state.tiles],
        ],
      },
      {
        title: "Модерация аккаунтов",
        text: state.pendingSellerRequests
          ? "Есть заявки продавцов на проверке."
          : "Очередь продавцов пустая.",
        rows: [
          ["Пользователей", state.users],
          ["Заявки продавцов", state.pendingSellerRequests],
          ["Баннер витрины", state.bannerActive ? "Активен" : "Проверьте"],
        ],
      },
    ],
    [state],
  );

  if (!loading && !user) return <Navigate to="/auth" replace />;
  if (!loading && !user?.is_admin && !user?.is_owner) return <Navigate to="/" replace />;

  return (
    <div className="container admWrap">
      <header className="admPanelHead admDashboardHero">
        <div>
          <div className="admPanelHead__title">Центр управления Dayen</div>
          <div className="admPanelHead__subtitle">Рабочая сводка по операциям, каталогу, продавцам и пользователям.</div>
        </div>
        <AdminNav />
      </header>

      {status ? <div className="notice-banner">{status}</div> : null}

      <section className="admDashboardGrid">
        <article className="contentCard admDashboardIntro">
          <span className="tiny-chip is-active">{isLoading ? "Загрузка" : "Operations"}</span>
          <h1 className="sectionTitle">Что требует внимания</h1>
          <p className="muted">
            Начинайте день отсюда: открытые обращения, эскалации, заявки продавцов и проблемные товары собраны в одну очередь.
          </p>
          <div className="admFocusGrid">
            {focusItems.map((item) => (
              <Link key={item.label} to={item.to} className={`admFocusCard ${item.tone}`}>
                <span>{item.label}</span>
                <small>{item.hint}</small>
                <strong>{item.value}</strong>
              </Link>
            ))}
          </div>
        </article>

        <aside className="contentCard admDashboardHealth">
          <h2 className="sectionTitle">Состояние витрины</h2>
          <div className="admMetricList">
            <div><span>Товаров</span><strong>{state.products}</strong></div>
            <div><span>Разделов</span><strong>{state.sections}</strong></div>
            <div><span>Плиток</span><strong>{state.tiles}</strong></div>
            <div><span>Пользователей</span><strong>{state.users}</strong></div>
            <div><span>Баннер</span><strong>{state.bannerActive ? "Активен" : "Проверьте"}</strong></div>
            <div><span>Оценка остатков</span><strong>{formatPrice(state.inventoryValue)}</strong></div>
          </div>
        </aside>
      </section>

      <section className="admOperationsGrid">
        {summaryCards.map((card) => (
          <article key={card.title} className="contentCard admOperationCard">
            <h2 className="sectionTitle">{card.title}</h2>
            <p className="muted">{card.text}</p>
            <div className="admSummaryRows">
              {card.rows.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
