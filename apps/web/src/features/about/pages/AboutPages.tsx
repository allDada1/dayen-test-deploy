import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { AssistantChat } from "../../../components/AssistantChat";
import { SelectField } from "../../../components/SelectField";
import { useAuth } from "../../../providers/auth";
import { api } from "../../../services/api";
import { getErrorMessage } from "../../../services/errors";

type AboutPageData = {
  slug: string;
  eyebrow: string;
  title: string;
  lead: string;
  primary?: { to: string; label: string };
  secondary?: { to: string; label: string };
  meta: Array<{ title: string; text: string }>;
  sections: Array<{
    title: string;
    text?: string;
    cards?: Array<{ title: string; text: string; to?: string }>;
    steps?: Array<{ title: string; text: string }>;
    list?: string[];
    faq?: Array<{ q: string; a: string }>;
  }>;
};

const aboutPages: Record<string, AboutPageData> = {
  about: {
    slug: "about",
    eyebrow: "О Dayen",
    title: "Маркетплейс для цифровых товаров, игровых сервисов и продавцов",
    lead: "Dayen помогает покупателям быстро находить нужные товары, а продавцам - аккуратно вести витрину, заказы и обращения. В этом разделе собраны правила, помощь, документы и короткое объяснение того, как устроен сервис.",
    primary: { to: "/about/how", label: "Как это работает" },
    secondary: { to: "/about/support", label: "Перейти в поддержку" },
    meta: [
      { title: "Для покупателей", text: "Каталог, поиск, карточки товаров, корзина, заказы, избранное и уведомления собраны в одном сценарии." },
      { title: "Для продавцов", text: "После проверки продавец получает витрину, управление товарами, продажами и обращениями по заказам." },
    ],
    sections: [
      {
        title: "Что можно делать в Dayen",
        cards: [
          { title: "Искать товары", text: "Используйте поиск, разделы, плитки и карточки продавцов, чтобы быстрее выйти на нужное предложение." },
          { title: "Покупать безопаснее", text: "Перед оформлением заказа можно проверить описание, цену, наличие, продавца и историю своих покупок." },
          { title: "Управлять аккаунтом", text: "В профиле доступны заказы, избранное, уведомления, настройки и заявка на роль продавца." },
          { title: "Развивать магазин", text: "Продавцы могут оформлять публичную витрину, добавлять товары и обрабатывать продажи." },
        ],
      },
      {
        title: "Куда перейти дальше",
        cards: [
          { title: "Как работает сервис", text: "Короткий путь от поиска товара до заказа и отслеживания покупки.", to: "/about/how" },
          { title: "Частые вопросы", text: "Ответы по аккаунту, заказам, продавцам, оплате и поддержке.", to: "/about/faq" },
          { title: "Правила и документы", text: "Основные условия использования, приватность и правила площадки.", to: "/about/documents" },
        ],
      },
    ],
  },
  how: {
    slug: "how",
    eyebrow: "Как работает",
    title: "Путь покупателя в Dayen",
    lead: "Сервис устроен так, чтобы пользователь мог быстро найти товар, проверить детали, оформить заказ и вернуться к нему в профиле.",
    primary: { to: "/catalog", label: "Открыть каталог" },
    secondary: { to: "/about/faq", label: "Посмотреть FAQ" },
    meta: [
      { title: "Главный принцип", text: "Сначала понятный выбор товара, затем прозрачное оформление заказа и история действий в профиле." },
      { title: "Если что-то пошло не так", text: "По заказам можно открывать обращения, а общие вопросы собраны в разделе поддержки." },
    ],
    sections: [
      {
        title: "Основные шаги",
        steps: [
          { title: "Найдите товар", text: "Откройте каталог, раздел, плитку или используйте поиск по названию товара и магазина." },
          { title: "Проверьте карточку", text: "Посмотрите цену, наличие, описание, изображения, продавца и отзывы, если они уже есть." },
          { title: "Добавьте в корзину", text: "Соберите нужные позиции и проверьте количество перед оформлением." },
          { title: "Оформите заказ", text: "Укажите контактные данные и подтвердите покупку. Для оформления нужна подтвержденная почта." },
          { title: "Следите за статусом", text: "История заказов доступна в профиле, а важные изменения приходят в уведомления." },
          { title: "Откройте обращение", text: "Если по заказу возник вопрос, используйте сценарий возврата или спора на странице заказа." },
        ],
      },
    ],
  },
  faq: {
    slug: "faq",
    eyebrow: "FAQ",
    title: "Частые вопросы",
    lead: "Короткие ответы по поиску, заказам, аккаунту, подтверждению почты, продавцам и обращениям.",
    primary: { to: "/about/support", label: "Нужна поддержка" },
    meta: [
      { title: "Формат", text: "Здесь только быстрые ответы. Для спорных ситуаций лучше открыть обращение по конкретному заказу." },
      { title: "Совет", text: "Если действие не проходит, сначала проверьте вход в аккаунт и подтверждение email." },
    ],
    sections: [
      {
        title: "Основное",
        faq: [
          { q: "Как найти товар?", a: "Используйте поиск в шапке, каталог, плитки на главной и страницы продавцов." },
          { q: "Почему я не могу оформить заказ?", a: "Чаще всего причина в том, что email еще не подтвержден. Перейдите на страницу подтверждения почты и запросите письмо повторно." },
          { q: "Где посмотреть мои заказы?", a: "Откройте профиль и перейдите в раздел заказов. Там доступны статусы и детали покупки." },
          { q: "Как стать продавцом?", a: "В профиле отправьте заявку продавца. После проверки администратор откроет доступ к панели продавца." },
          { q: "Куда писать по проблеме с заказом?", a: "Откройте нужный заказ и создайте обращение: возврат или спор. Так вопрос привяжется к конкретной покупке." },
        ],
      },
    ],
  },
  rules: {
    slug: "rules",
    eyebrow: "Правила",
    title: "Правила использования Dayen",
    lead: "Правила нужны, чтобы покупатели, продавцы и администраторы работали в одной понятной системе: без обмана, спама и попыток обойти ограничения.",
    primary: { to: "/about/terms", label: "Пользовательское соглашение" },
    meta: [
      { title: "Для покупателей", text: "Проверяйте товар, цену и контактные данные перед оформлением заказа." },
      { title: "Для продавцов", text: "Следите за актуальностью описаний, изображений, цены и остатков." },
    ],
    sections: [
      {
        title: "Базовые правила",
        list: [
          "Не размещайте ложную информацию о товаре, цене, наличии или продавце.",
          "Не используйте чужие данные и не пытайтесь получить доступ к чужому аккаунту.",
          "Не спамьте в обращениях, отзывах и формах поддержки.",
          "Оформляйте заказы только с корректными контактными данными.",
          "Если возник спор, описывайте ситуацию спокойно и прикладывайте детали заказа.",
        ],
      },
    ],
  },
  partners: {
    slug: "partners",
    eyebrow: "Продавцам",
    title: "Возможности для продавцов и партнеров",
    lead: "Dayen дает продавцу публичную витрину, управление товарами и отдельный рабочий кабинет для продаж.",
    primary: { to: "/profile", label: "Подать заявку" },
    secondary: { to: "/seller", label: "Панель продавца" },
    meta: [
      { title: "Старт", text: "Сначала пользователь отправляет заявку, затем администратор проверяет магазин и открывает доступ." },
      { title: "Требование", text: "Для заявки продавца нужна подтвержденная почта." },
    ],
    sections: [
      {
        title: "Что получает продавец",
        cards: [
          { title: "Публичная витрина", text: "Страница магазина с описанием, аватаром, баннером, товарами и отзывами." },
          { title: "Каталог товаров", text: "Добавление и редактирование товаров, изображений, характеристик, цены и остатков." },
          { title: "Продажи", text: "Просмотр заказов, изменение статусов и работа с историей продаж." },
          { title: "Обращения", text: "Отдельный раздел для возвратов и споров по заказам продавца." },
        ],
      },
    ],
  },
  support: {
    slug: "support",
    eyebrow: "Поддержка",
    title: "Помощь по аккаунту, заказам и работе сервиса",
    lead: "Если возник вопрос, начните с FAQ. Если проблема связана с конкретным заказом, лучше открыть обращение прямо на странице заказа.",
    primary: { to: "/about/faq", label: "Открыть FAQ" },
    secondary: { to: "/about/report", label: "Сообщить о проблеме" },
    meta: [
      { title: "Быстрее всего", text: "По заказам используйте страницу заказа: так обращение будет связано с покупкой." },
      { title: "Контакт", text: "support@dayen.kz" },
    ],
    sections: [
      {
        title: "С чем помогает поддержка",
        cards: [
          { title: "Заказы", text: "Статусы, история покупок, повтор заказа и обращения по спорным ситуациям." },
          { title: "Аккаунт", text: "Вход, регистрация, подтверждение email, профиль и настройки." },
          { title: "Продавцы", text: "Заявка продавца, публичная витрина, товары и продажи." },
          { title: "Ошибки сайта", text: "Некорректные данные, сломанные страницы, проблемы поиска или интерфейса." },
        ],
      },
    ],
  },
  documents: {
    slug: "documents",
    eyebrow: "Документы",
    title: "Правила, приватность и условия сервиса",
    lead: "Здесь собраны основные документы Dayen. Они объясняют, какие правила действуют на площадке и как сервис относится к пользовательским данным.",
    meta: [
      { title: "Навигация", text: "Откройте нужный документ из списка ниже." },
      { title: "Важно", text: "Тексты описывают продуктовую логику проекта и могут быть дополнены перед публичным запуском." },
    ],
    sections: [
      {
        title: "Список документов",
        cards: [
          { title: "Правила площадки", text: "Базовые правила поведения для покупателей и продавцов.", to: "/about/rules" },
          { title: "Политика конфиденциальности", text: "Какие данные нужны сервису и зачем они используются.", to: "/about/privacy" },
          { title: "Пользовательское соглашение", text: "Основные условия использования аккаунта, товаров и заказов.", to: "/about/terms" },
        ],
      },
    ],
  },
  privacy: {
    slug: "privacy",
    eyebrow: "Приватность",
    title: "Политика конфиденциальности",
    lead: "Dayen использует пользовательские данные только для работы основных функций: аккаунта, заказов, корзины, избранного, уведомлений, продавцов и обращений.",
    meta: [
      { title: "Минимум данных", text: "Сервису нужны только данные, без которых нельзя выполнить пользовательский сценарий." },
      { title: "Безопасность", text: "Пароли не хранятся в открытом виде, а важные действия требуют авторизации." },
    ],
    sections: [
      {
        title: "Какие данные используются",
        list: [
          "Данные аккаунта: имя, nickname, email, аватар и настройки профиля.",
          "Данные заказов: товары, сумма, статус, история действий и контактная информация.",
          "Данные продавца: магазин, описание, товары, заявки, продажи и публичная витрина.",
          "Технические данные, которые нужны для авторизации, загрузки изображений и корректной работы интерфейса.",
        ],
      },
    ],
  },
  terms: {
    slug: "terms",
    eyebrow: "Соглашение",
    title: "Пользовательское соглашение",
    lead: "Используя Dayen, пользователь принимает правила работы с аккаунтом, товарами, заказами, продавцами и обращениями.",
    meta: [
      { title: "Для покупателя", text: "Проверяйте товар, цену и контактные данные перед оформлением заказа." },
      { title: "Для продавца", text: "Поддерживайте актуальность товаров, изображений, цены и остатков." },
    ],
    sections: [
      {
        title: "Ключевые условия",
        list: [
          "Пользователь отвечает за корректность данных своего аккаунта.",
          "Администратор может ограничить доступ при нарушении правил площадки.",
          "Продавец обязан указывать достоверную информацию о товарах.",
          "Заказы, обращения и уведомления используются для фиксации важных действий на площадке.",
          "Интерфейс и функции сервиса могут обновляться по мере развития проекта.",
        ],
      },
    ],
  },
  report: {
    slug: "report",
    eyebrow: "Проблема",
    title: "Сообщить о проблеме",
    lead: "Опишите, что произошло: страницу, действие, ошибку и ожидаемый результат. Так проблему проще воспроизвести и исправить.",
    primary: { to: "/about/support", label: "Вернуться в поддержку" },
    meta: [
      { title: "Что приложить", text: "Название страницы, шаги воспроизведения, текст ошибки и скриншот, если он есть." },
      { title: "По заказам", text: "Если проблема связана с покупкой, лучше открыть обращение на странице конкретного заказа." },
    ],
    sections: [
      {
        title: "Типовые проблемы",
        list: [
          "Не открывается карточка товара или страница продавца.",
          "Не добавляется товар в корзину или избранное.",
          "Не получается оформить или оплатить заказ.",
          "В админке или панели продавца отображаются неверные данные.",
        ],
      },
    ],
  },
};

const aliases: Record<string, string> = {
  "about.html": "about",
  "how.html": "how",
  "faq.html": "faq",
  "rules.html": "rules",
  "partners.html": "partners",
  "support.html": "support",
  "documents.html": "documents",
  "privacy.html": "privacy",
  "terms.html": "terms",
  "report.html": "report",
};

export function AboutPage() {
  const params = useParams();
  const rawSlug = params.slug || "about";
  const slug = aliases[rawSlug] || rawSlug.replace(/\.html$/, "");
  const page = aboutPages[slug];

  if (!page) return <Navigate to="/about" replace />;

  return (
    <div className="aboutPage">
      <div className="container docWrap">
        <div className="docPage">
          <section className="docHero">
            <div>
              <div className="docHero__eyebrow">{page.eyebrow}</div>
              <h1>{page.title}</h1>
              <p className="docLead">{page.lead}</p>
              <div className="docActions">
                {page.primary ? <Link className="docBtn docBtn--primary" to={page.primary.to}>{page.primary.label}</Link> : null}
                {page.secondary ? <Link className="docBtn" to={page.secondary.to}>{page.secondary.label}</Link> : null}
              </div>
            </div>

            <aside className="docHeroStats">
              {page.meta.map((item) => (
                <article key={item.title} className="docMiniCard">
                  <div className="docMiniLabel">{item.title}</div>
                  <div className="docMiniNote">{item.text}</div>
                </article>
              ))}
            </aside>
          </section>

          {page.sections.map((section) => (
            <section key={section.title} className="docCard">
              <div className="docCardHeader">
                <h2 className="docSectionTitle">{section.title}</h2>
              </div>
              {section.text ? <p>{section.text}</p> : null}
              {section.cards ? <CardGrid cards={section.cards} /> : null}
              {section.steps ? <StepGrid steps={section.steps} /> : null}
              {section.list ? <ul className="docList">{section.list.map((item) => <li key={item}>{item}</li>)}</ul> : null}
              {section.faq ? <FaqList items={section.faq} /> : null}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SupportChatPage() {
  return (
    <div className="aboutPage">
      <div className="container docWrap">
        <div className="docPage">
          <section className="docHero">
            <div>
              <div className="docHero__eyebrow">AI-помощник</div>
              <h1>Помощник Dayen</h1>
              <p className="docLead">Спросите про товары, выбор, поиск, заказы, профиль, подтверждение почты или поддержку. Помощник работает только в режиме подсказок и не меняет данные.</p>
            </div>
            <aside className="docMiniCard">
              <div className="docMiniLabel">Безопасность</div>
              <div className="docMiniValue">Read-only</div>
              <div className="docMiniNote">Ассистент не знает пароли, ключи, код, админские данные и не может менять заказы, товары или пользователей.</div>
            </aside>
          </section>

          <section className="chatShell">
            <AssistantChat />
          </section>
        </div>
      </div>
    </div>
  );
}

export function ReportPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    email: "",
    category: "site",
    page_url: "",
    message: "",
  });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [ticketId, setTicketId] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const page = aboutPages.report;

  useEffect(() => {
    if (!user?.email) return;
    setForm((current) => (current.email ? current : { ...current, email: user.email }));
  }, [user?.email]);

  function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []).slice(0, 5);
    setImageFiles(files);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setTicketId(null);
    setSubmitting(true);

    try {
      let imageUrls: string[] = [];
      if (imageFiles.length) {
        const uploaded = await Promise.all(imageFiles.map((file) => api.uploadImage(file, "support")));
        imageUrls = uploaded.map((item) => item.url);
      }

      const response = await api.createSupportTicket({ ...form, image_url: imageUrls[0] || "", image_urls: imageUrls });
      setTicketId(response.ticket.id);
      setStatus(response.message || "Обращение принято.");
      setForm((current) => ({ ...current, page_url: "", message: "" }));
      setImageFiles([]);
    } catch (error) {
      setStatus(getErrorMessage(error, "Не удалось отправить обращение. Проверьте поля и попробуйте ещё раз."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="aboutPage">
      <div className="container docWrap">
        <div className="docPage">
          <section className="docHero docHero--single">
            <div>
              <div className="docHero__eyebrow">{page.eyebrow}</div>
              <h1>{page.title}</h1>
              <p className="docLead">{page.lead}</p>
            </div>
          </section>

          <section className="docCard">
            <h2 className="docSectionTitle">Форма обращения</h2>
            <form className="docForm" onSubmit={submit}>
              <div className="docFormGrid">
                <input
                  className="docInput"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="Ваш email"
                  readOnly={Boolean(user?.email)}
                  required
                />
                <SelectField
                  className="docSelect"
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                >
                  <option value="site">Ошибка на сайте</option>
                  <option value="order">Проблема с заказом</option>
                  <option value="payment">Проблема с оплатой</option>
                  <option value="seller">Проблема с продавцом</option>
                  <option value="account">Проблема с аккаунтом</option>
                  <option value="other">Другое</option>
                </SelectField>
              </div>
              <input
                className="docInput"
                value={form.page_url}
                onChange={(event) => setForm((current) => ({ ...current, page_url: event.target.value }))}
                placeholder="Страница или раздел"
              />
              <textarea
                className="docTextarea"
                value={form.message}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                placeholder="Опишите проблему и шаги, как ее повторить"
                minLength={10}
                required
              />
              <label className={`docFileField ${!user ? "is-disabled" : ""}`}>
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={onImageChange} disabled={!user} />
                <span className="docFileField__title">Добавить скриншоты или фото</span>
                <span className="docFileField__button">{user ? "Выбрать изображения" : "Войдите для загрузки фото"}</span>
                <small>
                  {user
                    ? "До 5 изображений, каждое до 10 МБ. Подойдут PNG, JPG, WEBP или GIF."
                    : "Гостевое обращение можно отправить без файла."}
                </small>
              </label>
              {imageFiles.length ? (
                <div className="docFileList">
                  {imageFiles.map((file) => (
                    <div key={`${file.name}-${file.size}`} className="docFilePill">
                      <span>{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setImageFiles((current) => current.filter((item) => item !== file))}
                      >
                        Убрать
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <button className="docSubmitBtn" type="submit" disabled={submitting}>
                {submitting ? "Отправляем..." : "Отправить обращение"}
              </button>
              {status ? (
                <div className={`docSuccess is-visible ${ticketId ? "" : "is-error"}`}>
                  {ticketId ? `Обращение #${ticketId} принято. ` : ""}
                  {status}
                </div>
              ) : null}
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

function CardGrid({ cards }: { cards: NonNullable<AboutPageData["sections"][number]["cards"]> }) {
  return (
    <div className="docGrid docGrid--3">
      {cards.map((card) => {
        const content = (
          <>
            <h3>{card.title}</h3>
            <p>{card.text}</p>
          </>
        );

        return card.to ? (
          <Link key={card.title} className="docLinkCard" to={card.to}>{content}</Link>
        ) : (
          <article key={card.title} className="docMiniCard">{content}</article>
        );
      })}
    </div>
  );
}

function StepGrid({ steps }: { steps: NonNullable<AboutPageData["sections"][number]["steps"]> }) {
  return (
    <div className="docGrid docGrid--3">
      {steps.map((step, index) => (
        <article key={step.title} className="docMiniCard">
          <span className="docBadge">{index + 1}</span>
          <h3>{step.title}</h3>
          <p>{step.text}</p>
        </article>
      ))}
    </div>
  );
}

function FaqList({ items }: { items: NonNullable<AboutPageData["sections"][number]["faq"]> }) {
  const sorted = useMemo(() => items, [items]);

  return (
    <div className="docFaqList">
      {sorted.map((item) => (
        <details key={item.q} className="docFaqItem">
          <summary>{item.q}</summary>
          <div className="docFaqBody">{item.a}</div>
        </details>
      ))}
    </div>
  );
}
