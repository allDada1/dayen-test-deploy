import { NavLink } from "react-router-dom";

import { useAuth } from "../../../providers/auth";

type AdminNavItem = {
  to: string;
  label: string;
  end?: boolean;
  ownerOnly?: boolean;
};

const adminNavGroups: Array<{ title: string; items: AdminNavItem[] }> = [
  {
    title: "Центр",
    items: [{ to: "/admin", label: "Обзор", end: true }],
  },
  {
    title: "Операции",
    items: [
      { to: "/admin/support", label: "Поддержка" },
      { to: "/admin/claims", label: "Обращения" },
      { to: "/admin/orders", label: "Заказы" },
      { to: "/admin/audit", label: "Журнал", ownerOnly: true },
    ],
  },
  {
    title: "Каталог",
    items: [
      { to: "/admin/products", label: "Товары" },
      { to: "/admin/sections", label: "Разделы" },
      { to: "/admin/tiles", label: "Плитки" },
      { to: "/admin/home-banner", label: "Баннер" },
    ],
  },
  {
    title: "Аккаунты",
    items: [
      { to: "/admin/seller-requests", label: "Продавцы" },
      { to: "/admin/users", label: "Пользователи" },
    ],
  },
];

export function AdminNav() {
  const { user } = useAuth();

  return (
    <nav className="admNav" aria-label="Админ навигация">
      {adminNavGroups.map((group) => (
        <div key={group.title} className="admNav__group">
          <div className="admNav__groupTitle">{group.title}</div>
          <div className="admNav__groupLinks">
            {group.items.filter((item) => !item.ownerOnly || user?.is_owner).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `admNav__link ${isActive ? "is-active" : ""}`}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
