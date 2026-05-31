import { Link } from "react-router-dom";

type ProjectMapLink = {
  label: string;
  to: string;
  note: string;
};

type ProjectMapGroup = {
  title: string;
  note: string;
  links: ProjectMapLink[];
};

const projectMapGroups: ProjectMapGroup[] = [
  {
    title: "Основные страницы",
    note: "Главный вход в витрину и общие страницы каталога.",
    links: [
      { label: "Главная", to: "/", note: "Витрина, категории и популярные товары" },
      { label: "Каталог", to: "/catalog", note: "Общий просмотр каталога" },
      { label: "Поиск", to: "/search", note: "Страница результатов поиска" },
      { label: "Избранное", to: "/favorites", note: "Сохраненные товары пользователя" },
    ],
  },
  {
    title: "Аккаунт",
    note: "Личный кабинет, настройки и уведомления.",
    links: [
      { label: "Профиль", to: "/profile", note: "Основная информация аккаунта" },
      { label: "Настройки", to: "/settings", note: "Редактирование профиля" },
      { label: "Уведомления", to: "/notifications", note: "Системные сообщения" },
    ],
  },
  {
    title: "Покупки",
    note: "Корзина, оформление и история заказов.",
    links: [
      { label: "Корзина", to: "/cart", note: "Товары перед оплатой" },
      { label: "Оформление", to: "/checkout", note: "Проверка заказа" },
      { label: "Оплата", to: "/payment", note: "Экран оплаты" },
      { label: "Успешный заказ", to: "/order-success", note: "Финальный экран покупки" },
      { label: "Мои заказы", to: "/orders", note: "История покупок" },
    ],
  },
  {
    title: "Панель продавца",
    note: "Каркас рабочих страниц продавца без публичных магазинов.",
    links: [
      { label: "Кабинет продавца", to: "/seller", note: "Сводка и заявка продавца" },
      { label: "Товары продавца", to: "/seller/products", note: "Управление своими товарами" },
      { label: "Продажи", to: "/seller/sales", note: "Заказы и выручка" },
      { label: "Обращения", to: "/seller/claims", note: "Споры и проблемы" },
    ],
  },
  {
    title: "Админка",
    note: "Все основные экраны управления проектом.",
    links: [
      { label: "Обзор", to: "/admin", note: "Центр управления" },
      { label: "Поддержка", to: "/admin/support", note: "Тикеты пользователей" },
      { label: "Обращения", to: "/admin/claims", note: "Споры и жалобы" },
      { label: "Заказы", to: "/admin/orders", note: "Админский список заказов" },
      { label: "Товары", to: "/admin/products", note: "Модерация и каталог товаров" },
      { label: "Разделы", to: "/admin/sections", note: "Разделы витрины" },
      { label: "Плитки", to: "/admin/tiles", note: "Плитки каталога" },
      { label: "Баннер", to: "/admin/home-banner", note: "Главный баннер" },
      { label: "Пользователи", to: "/admin/users", note: "Аккаунты и баны" },
      { label: "Заявки продавцов", to: "/admin/seller-requests", note: "Проверка продавцов" },
    ],
  },
  {
    title: "Информация и поддержка",
    note: "Публичные информационные страницы проекта.",
    links: [
      { label: "О проекте", to: "/about", note: "Описание Dayen" },
      { label: "Поддержка", to: "/about/support", note: "Чат и помощь" },
      { label: "Сообщить о проблеме", to: "/about/report", note: "Форма обращения" },
      { label: "FAQ", to: "/about/faq", note: "Частые вопросы" },
      { label: "Правила", to: "/about/rules", note: "Правила сервиса" },
      { label: "Документы", to: "/about/documents", note: "Юридическая информация" },
    ],
  },
  {
    title: "Авторизация",
    note: "Страницы входа, восстановления и подтверждения.",
    links: [
      { label: "Вход и регистрация", to: "/auth", note: "Единая auth-страница" },
      { label: "Подтверждение email", to: "/verify-email", note: "Статус проверки почты" },
      { label: "Забыли пароль", to: "/forgot-password", note: "Запрос восстановления" },
      { label: "Сброс пароля", to: "/reset-password", note: "Новый пароль по токену" },
    ],
  },
];

export function ProjectMapPage() {
  const totalLinks = projectMapGroups.reduce((sum, group) => sum + group.links.length, 0);

  return (
    <div className="projectMapPage">
      <div className="container projectMapPage__inner">
        <header className="projectMapHero">
          <div>
            <span className="projectMapHero__eyebrow">Карта проекта</span>
            <h1>Все основные страницы Dayen</h1>
            <p>Быстрый переход по каркасу проекта: без конкретных товаров, продавцов, плиток и разделов.</p>
          </div>
          <div className="projectMapHero__stat">
            <strong>{totalLinks}</strong>
            <span>ссылок</span>
          </div>
        </header>

        <div className="projectMapGrid">
          {projectMapGroups.map((group) => (
            <section className="projectMapCard" key={group.title}>
              <div className="projectMapCard__head">
                <h2>{group.title}</h2>
                <p>{group.note}</p>
              </div>
              <div className="projectMapLinks">
                {group.links.map((link) => (
                  <Link className="projectMapLink" to={link.to} key={link.to}>
                    <span>
                      <strong>{link.label}</strong>
                      <small>{link.note}</small>
                    </span>
                    <b>{link.to}</b>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
