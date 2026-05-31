import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { SectionHeading } from "../../../components/SectionHeading";
import { useAuth } from "../../../providers/auth";
import { useToast } from "../../../providers/toast";
import { api } from "../../../services/api";
import { getErrorMessage } from "../../../services/errors";
import { formatDate } from "../../../services/format";
import type { SellerProfile, SellerRequest } from "../../../types/api";

type UploadTarget = "avatar_url" | "banner_url";

const emptyForm = {
  shop_name: "",
  shop_slug: "",
  avatar_url: "",
  banner_url: "",
  contacts: "",
  about: "",
  telegram: "",
  instagram: "",
  whatsapp: "",
  tiktok: "",
};

export function SellerDashboardPage() {
  const navigate = useNavigate();
  const { loading, user, refresh } = useAuth();
  const toast = useToast();
  const [request, setRequest] = useState<SellerRequest | null>(null);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<UploadTarget | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!user) return;

    void api.getSellerRequestStatus().then((response) => {
      setRequest(response.request);
      if (response.request?.status === "approved" && !user.is_seller) {
        void refresh();
      }
    });

    if (user.is_seller) {
      void api.getSellerMe().then((response) => {
        setSeller(response.seller);
        setForm((current) => ({
          ...current,
          shop_name: response.seller.name || "",
          shop_slug: response.seller.username || "",
          avatar_url: response.seller.avatar_url || "",
          banner_url: response.seller.banner_url || "",
          about: response.seller.about || "",
          telegram: response.seller.telegram || "",
          instagram: response.seller.instagram || "",
          whatsapp: response.seller.whatsapp || "",
          tiktok: response.seller.tiktok || "",
        }));
      });
      return;
    }

    setForm((current) => ({
      ...current,
      shop_name: current.shop_name || user.name || "",
      shop_slug: current.shop_slug || user.nickname || "",
    }));
  }, [user, refresh]);

  if (!loading && !user) {
    return <Navigate to="/auth" replace />;
  }

  async function uploadImageFile(target: UploadTarget, file?: File) {
    if (!file) return;

    setUploading(target);
    setStatus("");

    try {
      const bucket = target === "avatar_url" ? "seller-avatars" : "seller-banners";
      const response = await api.uploadImage(file, bucket);
      setForm((current) => ({ ...current, [target]: response.url }));
      toast.success(target === "avatar_url" ? "Фото магазина загружено." : "Баннер магазина загружен.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось загрузить изображение."));
    } finally {
      setUploading(null);
    }
  }

  async function uploadFromInput(target: UploadTarget, event: ChangeEvent<HTMLInputElement>) {
    await uploadImageFile(target, event.target.files?.[0]);
    event.target.value = "";
  }

  async function uploadFromDrop(target: UploadTarget, event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    await uploadImageFile(target, event.dataTransfer.files?.[0]);
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");

    if (!user?.email_verified) {
      const message = "Сначала подтвердите email, чтобы отправить заявку продавца.";
      setStatus(message);
      toast.error(message);
      navigate("/verify-email?reason=seller");
      return;
    }

    setSaving(true);

    try {
      if (user?.is_seller) {
        await api.updateSellerProfile({
          shop_name: form.shop_name,
          avatar_url: form.avatar_url,
          banner_url: form.banner_url,
          about: form.about,
          telegram: form.telegram,
          instagram: form.instagram,
          whatsapp: form.whatsapp,
          tiktok: form.tiktok,
        });
        setStatus("Профиль магазина обновлён.");
        toast.success("Профиль магазина сохранён.");
      } else {
        const response = await api.applySeller({
          shop_name: form.shop_name,
          shop_slug: form.shop_slug,
          contacts: form.contacts,
          about: form.about,
        });
        setStatus(response.message || "Заявка отправлена.");
        toast.success("Заявка продавца отправлена.");
        const next = await api.getSellerRequestStatus();
        setRequest(next.request);
      }
    } catch (error) {
      const message = getErrorMessage(error, "Не удалось сохранить изменения.");
      setStatus(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-shell shell-container section-stack sellerDashboardPage">
      <section className="page-hero">
        <SectionHeading
          eyebrow="Seller"
          title={user?.is_seller ? "Кабинет продавца" : "Стать продавцом"}
          description="Управление заявкой, витриной магазина, товарами и продажами."
        />
      </section>

      {user?.is_seller ? (
        <section className="dashboard-grid">
          <article className="stat-card sellerDashboardCard">
            <div className="sellerDashboardCard__avatar">
              {form.avatar_url ? <img src={form.avatar_url} alt={seller?.name || user.name} /> : <span>{(seller?.name || user.name || "S").slice(0, 1)}</span>}
            </div>
            <div>
              <span className="section-heading__eyebrow">Магазин</span>
              <strong>{seller?.name || user.name}</strong>
              <p>Slug: @{seller?.username || user.nickname || "shop"}</p>
            </div>
          </article>

          <article className="stat-card">
            <span className="section-heading__eyebrow">Управление</span>
            <div className="button-row">
              <Link to="/seller/products" className="shell-button">
                Товары
              </Link>
              <Link to="/seller/sales" className="shell-button shell-button--ghost">
                Продажи
              </Link>
              <Link to="/seller/claims" className="shell-button shell-button--ghost">
                Обращения
              </Link>
              {seller?.id ? (
                <Link to={`/sellers/${seller.id}`} className="shell-button shell-button--ghost">
                  Витрина
                </Link>
              ) : null}
            </div>
          </article>
        </section>
      ) : request ? (
        <section className="notice-banner">
          <strong>Статус заявки: {formatSellerRequestStatus(request.status)}</strong>
          <span>{request.admin_comment || `Заявка отправлена ${formatDate(request.created_at)}. Ожидайте решения администратора.`}</span>
        </section>
      ) : null}

      <form className="profile-form" onSubmit={submitApplication}>
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Название магазина</span>
            <input
              className="field-input"
              value={form.shop_name}
              onChange={(event) => setForm((current) => ({ ...current, shop_name: event.target.value }))}
              placeholder="Например, DADA Store"
            />
          </label>

          {!user?.is_seller ? (
            <label className="field">
              <span className="field-label">Slug магазина</span>
              <input
                className="field-input"
                value={form.shop_slug}
                onChange={(event) => setForm((current) => ({ ...current, shop_slug: event.target.value }))}
                placeholder="dada-store"
              />
            </label>
          ) : (
            <label className="field">
              <span className="field-label">Публичный адрес</span>
              <input className="field-input" value={`@${seller?.username || user.nickname || "shop"}`} disabled />
            </label>
          )}
        </div>

        {user?.is_seller ? (
          <div className="sellerUploadGrid">
            <UploadBox
              title="Фото магазина"
              hint="Квадратное изображение, лучше 512×512."
              value={form.avatar_url}
              uploading={uploading === "avatar_url"}
              onClear={() => setForm((current) => ({ ...current, avatar_url: "" }))}
              onDrop={(event) => uploadFromDrop("avatar_url", event)}
              onChange={(event) => uploadFromInput("avatar_url", event)}
            />

            <UploadBox
              title="Баннер магазина"
              hint="Широкое изображение, например 1600×420."
              value={form.banner_url}
              uploading={uploading === "banner_url"}
              wide
              onClear={() => setForm((current) => ({ ...current, banner_url: "" }))}
              onDrop={(event) => uploadFromDrop("banner_url", event)}
              onChange={(event) => uploadFromInput("banner_url", event)}
            />
          </div>
        ) : null}

        {!user?.is_seller ? (
          <label className="field">
            <span className="field-label">Контакты</span>
            <input
              className="field-input"
              value={form.contacts}
              onChange={(event) => setForm((current) => ({ ...current, contacts: event.target.value }))}
              placeholder="@telegram, WhatsApp, email"
            />
          </label>
        ) : null}

        <label className="field">
          <span className="field-label">О магазине</span>
          <textarea
            className="field-input field-input--area"
            value={form.about}
            onChange={(event) => setForm((current) => ({ ...current, about: event.target.value }))}
            placeholder="Коротко расскажите покупателям, что продаёте и чем полезен магазин."
          />
        </label>

        {user?.is_seller ? (
          <div className="form-grid">
            <label className="field">
              <span className="field-label">Telegram</span>
              <input className="field-input" value={form.telegram} onChange={(event) => setForm((current) => ({ ...current, telegram: event.target.value }))} />
            </label>
            <label className="field">
              <span className="field-label">Instagram</span>
              <input className="field-input" value={form.instagram} onChange={(event) => setForm((current) => ({ ...current, instagram: event.target.value }))} />
            </label>
            <label className="field">
              <span className="field-label">WhatsApp</span>
              <input className="field-input" value={form.whatsapp} onChange={(event) => setForm((current) => ({ ...current, whatsapp: event.target.value }))} />
            </label>
            <label className="field">
              <span className="field-label">TikTok</span>
              <input className="field-input" value={form.tiktok} onChange={(event) => setForm((current) => ({ ...current, tiktok: event.target.value }))} />
            </label>
          </div>
        ) : null}

        {status ? <div className="field-hint">{status}</div> : null}

        <button type="submit" className="shell-button" disabled={saving || Boolean(uploading)}>
          {saving ? "Сохраняем..." : user?.is_seller ? "Сохранить магазин" : "Отправить заявку"}
        </button>
      </form>
    </div>
  );
}

function formatSellerRequestStatus(status?: string) {
  switch (status) {
    case "approved":
      return "Одобрена";
    case "rejected":
      return "Отклонена";
    case "revoked":
      return "Доступ снят";
    case "pending":
    default:
      return "На рассмотрении";
  }
}

type UploadBoxProps = {
  title: string;
  hint: string;
  value: string;
  uploading: boolean;
  wide?: boolean;
  onClear: () => void;
  onDrop: (event: DragEvent<HTMLLabelElement>) => void;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

function UploadBox({ title, hint, value, uploading, wide, onClear, onDrop, onChange }: UploadBoxProps) {
  return (
    <div className={`sellerUploadBox${wide ? " sellerUploadBox--wide" : ""}`}>
      <label className="sellerUploadBox__drop" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
        <input type="file" accept="image/*" hidden onChange={onChange} />
        {value ? (
          <img src={value} alt={title} />
        ) : (
          <span>
            <strong>{title}</strong>
            <small>{hint}</small>
            <em>{uploading ? "Загружаем..." : "Перетащите файл или выберите с устройства"}</em>
          </span>
        )}
      </label>

      <div className="sellerUploadBox__actions">
        <label className="shell-button shell-button--ghost">
          Выбрать фото
          <input type="file" accept="image/*" hidden onChange={onChange} />
        </label>
        {value ? (
          <button type="button" className="shell-button shell-button--ghost" onClick={onClear}>
            Очистить
          </button>
        ) : null}
      </div>
    </div>
  );
}
