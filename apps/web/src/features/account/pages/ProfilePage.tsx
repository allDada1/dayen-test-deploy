import { useEffect, useMemo, useState } from "react";
import {
  AtSign,
  BadgeCheck,
  BellRing,
  CreditCard,
  Heart,
  LogOut,
  Mail,
  Package,
  PackageCheck,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  User,
  UserRoundCog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, Navigate } from "react-router-dom";

import { useAuth } from "../../../providers/auth";
import { api } from "../../../services/api";

type ProfileRow = {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: "success" | "warning";
};

export function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const [ordersCount, setOrdersCount] = useState(0);
  const [paidCount, setPaidCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [productsCount, setProductsCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    void api.getMyOrders().then((orders) => {
      setOrdersCount(orders.length);
      setPaidCount(
        orders.filter((order) => {
          const status = String(order.status || "").toLowerCase();
          return status === "paid" || status === "delivered";
        }).length,
      );
    }).catch(() => undefined);

    void api.getFavorites().then((response) => setFavoritesCount(response.items.length)).catch(() => undefined);

    if (user.is_seller) {
      void api.getSellerProducts({ limit: 1 }).then((response) => setProductsCount(response.total ?? response.products.length)).catch(() => undefined);
    } else {
      setProductsCount(0);
    }
  }, [user]);

  const profileRows = useMemo<ProfileRow[]>(() => {
    const role = user?.is_owner ? "Владелец" : user?.is_admin ? "Администратор" : user?.is_seller ? "Продавец" : "Покупатель";

    return [
      { icon: User, label: "Имя пользователя", value: user?.name || "Не указано" },
      { icon: Mail, label: "Email", value: user?.email || "Не указан" },
      { icon: AtSign, label: "Никнейм", value: user?.nickname || user?.name || "Не указан" },
      {
        icon: BadgeCheck,
        label: "Статус email",
        value: user?.email_verified ? "Подтверждён" : "Нужно подтвердить",
        tone: user?.email_verified ? "success" : "warning",
      },
      { icon: UserRoundCog, label: "Роль аккаунта", value: role },
    ];
  }, [user]);

  if (!loading && !user) {
    return <Navigate to="/auth" replace />;
  }

  const displayName = user?.nickname || user?.name || "Профиль";
  const avatarLetter = (displayName || user?.email || "D").slice(0, 1).toUpperCase();

  return (
    <div className="container profWrap profileDashboard">
      <section className="profHero profileDashboardHero">
        <div className="profHero__main profileDashboardHero__main">
          <div className="avatar avatar--lg profileDashboardHero__avatar">
            {user?.avatar_url ? <img src={user.avatar_url} alt={displayName} /> : <span>{avatarLetter}</span>}
          </div>

          <div className="profHero__info">
            <div className="profEyebrow">Личный кабинет</div>
            <div className="profName profName--hero">{displayName}</div>
            <div className="profEmail">{user?.email}</div>
            <div className="profNickLine">Ник: {user?.nickname || user?.name || "не указан"}</div>
          </div>
        </div>

        <Link className="profileEditButton" to="/settings">
          Редактировать профиль
        </Link>
      </section>

      <section className="statsGrid profileStatsGrid" aria-label="Сводка профиля">
        <article>
          <span className="profileStatIcon"><PackageCheck size={24} strokeWidth={2.1} /></span>
          <div>
            <div className="statCard__label">Всего заказов</div>
            <div className="statCard__value">{ordersCount}</div>
          </div>
        </article>
        <article>
          <span className="profileStatIcon"><CreditCard size={24} strokeWidth={2.1} /></span>
          <div>
            <div className="statCard__label">Оплаченных</div>
            <div className="statCard__value">{paidCount}</div>
          </div>
        </article>
        <article>
          <span className="profileStatIcon"><Heart size={24} strokeWidth={2.1} /></span>
          <div>
            <div className="statCard__label">Избранное</div>
            <div className="statCard__value">{favoritesCount}</div>
          </div>
        </article>
        <article>
          <span className="profileStatIcon"><Package size={24} strokeWidth={2.1} /></span>
          <div>
            <div className="statCard__label">{user?.is_seller ? "Мои товары" : "Роль"}</div>
            <div className="statCard__value">{user?.is_seller ? productsCount : "Покупатель"}</div>
          </div>
        </article>
      </section>

      <section className="profileDashboardGrid">
        <aside className="profileSidebar">
          <Link className="profileSideLink is-active" to="/profile"><span><User size={18} strokeWidth={2.15} /></span>Мой профиль</Link>
          <Link className="profileSideLink" to="/orders"><span><PackageCheck size={18} strokeWidth={2.15} /></span>Мои заказы</Link>
          <Link className="profileSideLink" to="/favorites"><span><Heart size={18} strokeWidth={2.15} /></span>Избранное</Link>
          <Link className="profileSideLink" to="/notifications"><span><BellRing size={18} strokeWidth={2.15} /></span>Уведомления</Link>
          <Link className="profileSideLink" to="/settings"><span><Settings size={18} strokeWidth={2.15} /></span>Настройки</Link>
          <Link className="profileSideLink" to="/seller"><span><Store size={18} strokeWidth={2.15} /></span>{user?.is_seller ? "Панель продавца" : "Стать продавцом"}</Link>
          {user?.is_seller ? <Link className="profileSideLink" to="/seller/products"><span><Package size={18} strokeWidth={2.15} /></span>Мои товары</Link> : null}
          {user?.is_admin || user?.is_owner ? <Link className="profileSideLink" to="/admin"><span><ShieldCheck size={18} strokeWidth={2.15} /></span>Админ-центр</Link> : null}
          <button type="button" className="profileSideLink profileSideLink--danger" onClick={() => void logout()}>
            <span><LogOut size={18} strokeWidth={2.15} /></span>Выйти
          </button>
        </aside>

        <div className="profileMainStack">
          <section className="profileInfoPanel">
            <div className="profilePanelHead">
              <div>
                <h2>Мой профиль</h2>
                <p>Основная информация аккаунта и текущий статус.</p>
              </div>
              <Link to="/settings" className="profilePanelAction">Изменить</Link>
            </div>

            <div className="profileInfoRows">
              {profileRows.map((row) => {
                const Icon = row.icon;

                return (
                  <div key={row.label} className="profileInfoRow">
                    <span className="profileInfoRow__icon"><Icon size={18} strokeWidth={2.15} /></span>
                    <span className="profileInfoRow__label">{row.label}</span>
                    <strong className={row.tone ? `is-${row.tone}` : ""}>{row.value}</strong>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="profileActionBanner">
            <div className="profileActionBanner__icon"><Sparkles size={28} strokeWidth={2.05} /></div>
            <div>
              <h2>{user?.is_seller ? "Продолжайте развивать магазин" : "Хотите продавать на Dayen?"}</h2>
              <p>
                {user?.is_seller
                  ? "Перейдите в панель продавца, чтобы управлять товарами, продажами и обращениями."
                  : "Подайте заявку продавца и откройте собственную витрину внутри маркетплейса."}
              </p>
            </div>
            <Link to="/seller" className="profileActionBanner__button">
              {user?.is_seller ? "Открыть панель" : "Стать продавцом"}
            </Link>
          </section>
        </div>
      </section>
    </div>
  );
}
