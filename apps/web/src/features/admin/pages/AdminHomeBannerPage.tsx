import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { AdminNav } from "../components/AdminNav";
import { SelectField } from "../../../components/SelectField";
import { useAuth } from "../../../providers/auth";
import { api } from "../../../services/api";

const initialForm = {
  page_key: "home",
  eyebrow: "",
  title: "",
  description: "",
  cta_label: "",
  cta_href: "/catalog",
  image_url: "",
  is_active: "0",
  sort_order: "0",
};

const bannerPlacements = [
  { value: "home", label: "Главная" },
  { value: "furniture", label: "Мебель: главная" },
  { value: "furniture:sofas", label: "Мебель: диваны" },
  { value: "furniture:tables", label: "Мебель: столы" },
  { value: "furniture:chairs", label: "Мебель: стулья" },
  { value: "furniture:wardrobes", label: "Мебель: шкафы" },
  { value: "furniture:beds", label: "Мебель: кровати" },
  { value: "furniture:dressers", label: "Мебель: комоды" },
  { value: "beauty-health", label: "Красота и здоровье: главная" },
  { value: "beauty-health:skincare", label: "Красота: уход за лицом" },
  { value: "beauty-health:haircare", label: "Красота: уход за волосами" },
  { value: "beauty-health:makeup", label: "Красота: макияж" },
  { value: "beauty-health:health", label: "Красота: здоровье" },
  { value: "beauty-health:vitamins", label: "Красота: витамины" },
  { value: "beauty-health:fragrances", label: "Красота: ароматы" },
  { value: "shoes", label: "Обувь: главная" },
  { value: "shoes:sneakers", label: "Обувь: кроссовки" },
  { value: "shoes:boots", label: "Обувь: ботинки" },
  { value: "shoes:dress-shoes", label: "Обувь: туфли" },
  { value: "shoes:loafers", label: "Обувь: лоферы" },
  { value: "shoes:sandals", label: "Обувь: сандалии" },
  { value: "shoes:kids", label: "Обувь: детская обувь" },
  { value: "catalog", label: "Каталог" },
];

const CUSTOM_PLACEMENT = "__custom__";

export function AdminHomeBannerPage() {
  const { loading, user } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);

  async function reload(pageKey = form.page_key) {
    const response = pageKey === "home" ? await api.getAdminHomeBanner() : await api.getAdminPageBanner(pageKey);
    const banner = response.banner;

    if (!banner) {
      setForm({ ...initialForm, page_key: pageKey, cta_href: defaultCtaHref(pageKey) });
      return;
    }

    setForm({
      page_key: pageKey,
      eyebrow: banner.eyebrow || "",
      title: banner.title || "",
      description: banner.description || "",
      cta_label: banner.cta_label || "",
      cta_href: banner.cta_href || defaultCtaHref(pageKey),
      image_url: banner.image_url || "",
      is_active: String(Number(Boolean(banner.is_active))),
      sort_order: String(banner.sort_order || 0),
    });
  }

  useEffect(() => {
    if (!user?.is_admin && !user?.is_owner) return;
    void reload();
  }, [user]);

  if (!loading && !user) return <Navigate to="/auth" replace />;
  if (!loading && !user?.is_admin && !user?.is_owner) return <Navigate to="/" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");

    const pageKey = form.page_key.trim().toLowerCase();
    if (!/^[a-z0-9:_-]{2,120}$/.test(pageKey)) {
      setStatus("Укажите корректный ключ страницы: латиница, цифры, :, _ или -.");
      return;
    }

    try {
      const payload = {
        ...form,
        page_key: pageKey,
        is_active: form.is_active === "1",
        sort_order: Number(form.sort_order || 0),
      };
      if (pageKey === "home") {
        await api.updateAdminHomeBanner(payload);
      } else {
        await api.updateAdminPageBanner(pageKey, payload);
      }
      setStatus("Баннер обновлён.");
      await reload(pageKey);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось сохранить баннер");
    }
  }

  function defaultCtaHref(pageKey: string) {
    if (pageKey === "home") return "/catalog";
    if (pageKey === "furniture") return "/tile/furniture/sofas";
    if (pageKey.startsWith("furniture:")) return `/tile/furniture/${pageKey.split(":")[1]}`;
    if (pageKey === "beauty-health") return "/tile/beauty-health/skincare";
    if (pageKey.startsWith("beauty-health:")) return `/tile/beauty-health/${pageKey.split(":")[1]}`;
    if (pageKey === "shoes") return "/tile/shoes/sneakers";
    if (pageKey.startsWith("shoes:")) return `/tile/shoes/${pageKey.split(":")[1]}`;
    return `/${pageKey}`;
  }

  function changePlacement(pageKey: string) {
    setStatus("");
    if (pageKey === CUSTOM_PLACEMENT) {
      setForm((current) => ({ ...current, page_key: bannerPlacements.some((placement) => placement.value === current.page_key) ? "" : current.page_key }));
      return;
    }

    setForm((current) => ({ ...current, page_key: pageKey }));
    void reload(pageKey);
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setStatus("");

    try {
      const uploaded = await api.uploadImage(file, "misc");
      setForm((current) => ({ ...current, image_url: uploaded.url }));
      setStatus("Изображение баннера загружено.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось загрузить изображение");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  return (
    <div className="container admWrap">
      <header className="admPanelHead">
        <div>
          <div className="admPanelHead__title">Баннер</div>
          <div className="admPanelHead__subtitle">Главный промо-блок на домашней странице. Если выключен, место не занимает.</div>
        </div>
        <AdminNav />
      </header>

      <section className="contentCard">
        <div className="order-card__top">
          <div>
            <h1 className="sectionTitle">Hero-баннер</h1>
            <div className="muted">Управление баннерами для главной, мебели и будущих страниц по ключу показа.</div>
          </div>
          <span className={`tiny-chip ${form.is_active === "1" ? "is-active" : ""}`}>{form.is_active === "1" ? "Активен" : "Выключен"}</span>
        </div>

        <form className="profile-form" onSubmit={submit}>
          <label className="field">
            <span className="field-label">Где показывать</span>
            <SelectField
              className="field-input"
              value={bannerPlacements.some((placement) => placement.value === form.page_key) ? form.page_key : CUSTOM_PLACEMENT}
              onChange={(event) => changePlacement(event.target.value)}
            >
              {bannerPlacements.map((placement) => (
                <option key={placement.value} value={placement.value}>
                  {placement.label}
                </option>
              ))}
              <option value={CUSTOM_PLACEMENT}>Другой ключ страницы</option>
            </SelectField>
          </label>

          <label className="field">
            <span className="field-label">Ключ страницы</span>
            <input
              className="field-input"
              value={form.page_key}
              placeholder="Например: furniture:sofas, about, catalog"
              onChange={(event) => setForm((current) => ({ ...current, page_key: event.target.value.trim().toLowerCase() }))}
            />
          </label>

          <div className="form-grid">
            <label className="field">
              <span className="field-label">Надпись сверху</span>
              <input className="field-input" value={form.eyebrow} onChange={(event) => setForm((current) => ({ ...current, eyebrow: event.target.value }))} />
            </label>
            <label className="field">
              <span className="field-label">Кнопка</span>
              <input className="field-input" value={form.cta_label} onChange={(event) => setForm((current) => ({ ...current, cta_label: event.target.value }))} />
            </label>
            <label className="field">
              <span className="field-label">Заголовок</span>
              <input className="field-input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label className="field">
              <span className="field-label">Ссылка кнопки</span>
              <input className="field-input" value={form.cta_href} onChange={(event) => setForm((current) => ({ ...current, cta_href: event.target.value }))} />
            </label>
          </div>

          <label className="field">
            <span className="field-label">Описание</span>
            <textarea className="field-input field-input--area" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </label>

          <div className="form-grid">
            <label className="field">
              <span className="field-label">Активность</span>
              <SelectField className="field-input" value={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.value }))}>
                <option value="1">Показывать</option>
                <option value="0">Скрыть</option>
              </SelectField>
            </label>
            <label className="field">
              <span className="field-label">Порядок</span>
              <input className="field-input" value={form.sort_order} onChange={(event) => setForm((current) => ({ ...current, sort_order: event.target.value }))} />
            </label>
          </div>

          <div className="field">
            <span className="field-label">Изображение</span>
            <div className="uploadBox">
              <div className="button-row">
                <label className="ghostBtn">
                  <input type="file" accept="image/*" hidden disabled={uploading} onChange={onFileChange} />
                  {uploading ? "Загружаю..." : "Выбрать файл"}
                </label>
                <button type="button" className="ghostBtn" onClick={() => setForm((current) => ({ ...current, image_url: "" }))}>
                  Очистить
                </button>
              </div>
              {form.image_url ? <img src={form.image_url} alt="" className="admBannerPreview" /> : null}
            </div>
          </div>

          {status ? <div className="field-hint">{status}</div> : null}

          <div className="button-row">
            <button type="submit" className="linkBtn">Сохранить баннер</button>
            <button type="button" className="ghostBtn" onClick={() => void reload()}>Перезагрузить</button>
          </div>
        </form>
      </section>
    </div>
  );
}
