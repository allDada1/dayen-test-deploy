import { lazy, Suspense, type ComponentType, type ReactElement } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import { AppShell } from "./shell/AppShell";
import { useAuth } from "./providers/auth";
import { NotFoundPage } from "./features/system/pages";

function lazyPage<T extends Record<string, unknown>, K extends keyof T>(loader: () => Promise<T>, name: K) {
  return lazy(async () => {
    const module = await loader();
    return { default: module[name] as ComponentType };
  });
}

const HomePage = lazyPage(() => import("./features/home/pages/HomePage"), "HomePage");
const HomeConceptPage = lazyPage(() => import("./features/home/pages/HomeConceptPage"), "HomeConceptPage");
const ProjectMapPage = lazyPage(() => import("./features/system/pages/ProjectMapPage"), "ProjectMapPage");

const SearchResultsPage = lazyPage(() => import("./features/catalog/pages/SearchResultsPage"), "SearchResultsPage");
const CatalogPreviewPage = lazyPage(() => import("./features/catalog/pages/CatalogPreviewPage"), "CatalogPreviewPage");
const CatalogPage = lazyPage(() => import("./features/catalog/pages/CatalogPage"), "CatalogPage");
const TilePage = lazyPage(() => import("./features/catalog/pages/TilePage"), "TilePage");
const ProductPage = lazyPage(() => import("./features/catalog/pages/ProductPage"), "ProductPage");
const FavoritesPage = lazyPage(() => import("./features/catalog/pages/FavoritesPage"), "FavoritesPage");

const CartPage = lazyPage(() => import("./features/orders/pages/CartPage"), "CartPage");
const CheckoutPage = lazyPage(() => import("./features/orders/pages/CheckoutPage"), "CheckoutPage");
const PaymentPage = lazyPage(() => import("./features/orders/pages/PaymentPage"), "PaymentPage");
const OrderSuccessPage = lazyPage(() => import("./features/orders/pages/OrderSuccessPage"), "OrderSuccessPage");
const OrdersPage = lazyPage(() => import("./features/orders/pages/OrdersPage"), "OrdersPage");
const OrderDetailsPage = lazyPage(() => import("./features/orders/pages/OrderDetailsPage"), "OrderDetailsPage");

const NotificationsPage = lazyPage(() => import("./features/account/pages/NotificationsPage"), "NotificationsPage");
const ProfilePage = lazyPage(() => import("./features/account/pages/ProfilePage"), "ProfilePage");
const SettingsPage = lazyPage(() => import("./features/account/pages/SettingsPage"), "SettingsPage");

const SellerDashboardPage = lazyPage(() => import("./features/seller/pages/SellerDashboardPage"), "SellerDashboardPage");
const SellerProductsPage = lazyPage(() => import("./features/seller/pages/SellerProductsPage"), "SellerProductsPage");
const SellerSalesPage = lazyPage(() => import("./features/seller/pages/SellerSalesPage"), "SellerSalesPage");
const SellerClaimsPage = lazyPage(() => import("./features/seller/pages/SellerClaimsPage"), "SellerClaimsPage");
const SellerPublicPage = lazyPage(() => import("./features/seller/pages/SellerPublicPage"), "SellerPublicPage");
const SellerPublicReviewsPage = lazyPage(() => import("./features/seller/pages/SellerPublicReviewsPage"), "SellerPublicReviewsPage");

const AuthPage = lazyPage(() => import("./features/auth/pages/AuthPage"), "AuthPage");
const VerifyEmailPage = lazyPage(() => import("./features/auth/pages/VerifyEmailPage"), "VerifyEmailPage");
const ForgotPasswordPage = lazyPage(() => import("./features/auth/pages/ForgotPasswordPage"), "ForgotPasswordPage");
const ResetPasswordPage = lazyPage(() => import("./features/auth/pages/ResetPasswordPage"), "ResetPasswordPage");

const AboutPage = lazyPage(() => import("./features/about/pages/AboutPages"), "AboutPage");
const ReportPage = lazyPage(() => import("./features/about/pages/AboutPages"), "ReportPage");
const SupportChatPage = lazyPage(() => import("./features/about/pages/AboutPages"), "SupportChatPage");

const AdminDashboardPage = lazyPage(() => import("./features/admin/pages/AdminDashboardPage"), "AdminDashboardPage");
const AdminSupportTicketsPage = lazyPage(() => import("./features/admin/pages/AdminSupportTicketsPage"), "AdminSupportTicketsPage");
const AdminProductsPage = lazyPage(() => import("./features/admin/pages/AdminProductsPage"), "AdminProductsPage");
const AdminOrdersPage = lazyPage(() => import("./features/admin/pages/AdminOrdersPage"), "AdminOrdersPage");
const AdminClaimsPage = lazyPage(() => import("./features/admin/pages/AdminClaimsPage"), "AdminClaimsPage");
const AdminAuditLogsPage = lazyPage(() => import("./features/admin/pages/AdminAuditLogsPage"), "AdminAuditLogsPage");
const AdminSectionsPage = lazyPage(() => import("./features/admin/pages/AdminSectionsPage"), "AdminSectionsPage");
const AdminHomeBannerPage = lazyPage(() => import("./features/admin/pages/AdminHomeBannerPage"), "AdminHomeBannerPage");
const AdminTilesPage = lazyPage(() => import("./features/admin/pages/AdminTilesPage"), "AdminTilesPage");
const AdminUsersPage = lazyPage(() => import("./features/admin/pages/AdminUsersPage"), "AdminUsersPage");
const AdminSellerRequestsPage = lazyPage(() => import("./features/admin/pages/AdminSellerRequestsPage"), "AdminSellerRequestsPage");

function RouteFrame({ children }: { children: ReactElement }) {
  return <Suspense fallback={<div className="page-shell shell-container" />}>{children}</Suspense>;
}

function page(element: ReactElement) {
  return <RouteFrame>{element}</RouteFrame>;
}

function AdminGuard({ children }: { children: ReactElement }) {
  const { loading, user } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!user.is_admin && !user.is_owner) return <Navigate to="/" replace />;
  if (!user.two_factor_enabled) return <Navigate to="/settings" replace />;
  return children;
}

function adminPage(element: ReactElement) {
  return page(<AdminGuard>{element}</AdminGuard>);
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: page(<HomePage />) },
      { path: "home-concept", element: page(<HomeConceptPage />) },
      { path: "project-map", element: page(<ProjectMapPage />) },
      { path: "search", element: page(<SearchResultsPage />) },
      { path: "catalog", element: page(<CatalogPreviewPage />) },
      { path: "catalog-preview", element: page(<CatalogPreviewPage />) },
      { path: "category/:slug", element: page(<CatalogPage />) },
      { path: "tile/:slug", element: page(<TilePage />) },
      { path: "tile/:slug/:category", element: page(<TilePage />) },
      { path: "product/:id", element: page(<ProductPage />) },
      { path: "favorites", element: page(<FavoritesPage />) },
      { path: "cart", element: page(<CartPage />) },
      { path: "checkout", element: page(<CheckoutPage />) },
      { path: "payment", element: page(<PaymentPage />) },
      { path: "order-success", element: page(<OrderSuccessPage />) },
      { path: "orders", element: page(<OrdersPage />) },
      { path: "orders/:id", element: page(<OrderDetailsPage />) },
      { path: "notifications", element: page(<NotificationsPage />) },
      { path: "seller", element: page(<SellerDashboardPage />) },
      { path: "seller/products", element: page(<SellerProductsPage />) },
      { path: "seller/sales", element: page(<SellerSalesPage />) },
      { path: "seller/claims", element: page(<SellerClaimsPage />) },
      { path: "sellers/:id", element: page(<SellerPublicPage />) },
      { path: "sellers/:id/reviews", element: page(<SellerPublicReviewsPage />) },
      { path: "auth", element: page(<AuthPage />) },
      { path: "verify-email", element: page(<VerifyEmailPage />) },
      { path: "forgot-password", element: page(<ForgotPasswordPage />) },
      { path: "reset-password", element: page(<ResetPasswordPage />) },
      { path: "profile", element: page(<ProfilePage />) },
      { path: "settings", element: page(<SettingsPage />) },
      { path: "about", element: page(<AboutPage />) },
      { path: "about/report", element: page(<ReportPage />) },
      { path: "about/report.html", element: page(<ReportPage />) },
      { path: "about/support", element: page(<SupportChatPage />) },
      { path: "about/support.html", element: page(<SupportChatPage />) },
      { path: "about/support-chat", element: page(<SupportChatPage />) },
      { path: "about/support-chat.html", element: page(<SupportChatPage />) },
      { path: "about/:slug", element: page(<AboutPage />) },
      { path: "admin", element: adminPage(<AdminDashboardPage />) },
      { path: "admin/support", element: adminPage(<AdminSupportTicketsPage />) },
      { path: "admin/products", element: adminPage(<AdminProductsPage />) },
      { path: "admin/orders", element: adminPage(<AdminOrdersPage />) },
      { path: "admin/claims", element: adminPage(<AdminClaimsPage />) },
      { path: "admin/audit", element: adminPage(<AdminAuditLogsPage />) },
      { path: "admin/sections", element: adminPage(<AdminSectionsPage />) },
      { path: "admin/home-banner", element: adminPage(<AdminHomeBannerPage />) },
      { path: "admin/tiles", element: adminPage(<AdminTilesPage />) },
      { path: "admin/users", element: adminPage(<AdminUsersPage />) },
      { path: "admin/seller-requests", element: adminPage(<AdminSellerRequestsPage />) },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
