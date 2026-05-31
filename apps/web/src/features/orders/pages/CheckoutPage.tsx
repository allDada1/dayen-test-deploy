import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { SectionHeading } from "../../../components/SectionHeading";
import { SelectField } from "../../../components/SelectField";
import { useAuth } from "../../../providers/auth";
import { useCart } from "../../../providers/cart";
import { useToast } from "../../../providers/toast";
import { api } from "../../../services/api";
import { getEmailValidationMessage, normalizeEmail } from "../../../services/emailValidation";
import { getErrorMessage } from "../../../services/errors";
import { formatPrice } from "../../../services/format";
import type { Product } from "../../../types/api";

const deliveryPrices = {
  courier: 2500,
  pickup: 0,
  express: 4500,
} as const;

export function CheckoutPage() {
  const navigate = useNavigate();
  const { loading, user } = useAuth();
  const { clear, items } = useCart();
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    method: "courier",
    city: "Алматы",
    address: "",
    phone: "",
    email: "",
    comment: "",
  });

  useEffect(() => {
    if (!user?.email) return;
    setForm((current) => (current.email ? current : { ...current, email: user.email }));
  }, [user?.email]);

  useEffect(() => {
    if (!items.length) {
      setProducts([]);
      return;
    }

    void api.getProducts().then((response) => {
      setProducts(response.items.filter((product) => items.includes(product.id)));
    });
  }, [items]);

  if (!loading && !user) {
    return <Navigate to="/auth" replace />;
  }

  if (!items.length) {
    return (
      <div className="page-shell shell-container">
        <section className="empty-panel">
          <strong>Оформлять пока нечего</strong>
          <p>Сначала добавьте товары в корзину, затем вернитесь к оформлению.</p>
          <Link to="/catalog" className="shell-button">
            Открыть каталог
          </Link>
        </section>
      </div>
    );
  }

  const subtotal = products.reduce((sum, product) => sum + Number(product.price || 0), 0);
  const deliveryPrice = deliveryPrices[form.method as keyof typeof deliveryPrices] ?? 0;
  const total = subtotal + deliveryPrice;

  function validateForm() {
    if (!form.method.trim()) return "Выберите способ доставки.";
    if (!form.city.trim()) return "Укажите город.";
    if (!form.address.trim()) return "Укажите адрес.";
    if (!form.phone.trim()) return "Укажите телефон.";
    if (!form.email.trim()) return "Укажите email для уведомлений о заказе.";
    const emailError = getEmailValidationMessage(form.email);
    if (emailError) return emailError;
    return "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");

    if (!user?.email_verified) {
      const message = "Сначала подтвердите email, чтобы перейти к оплате.";
      setStatus(message);
      toast.warning(message, {
        title: "Нужно подтверждение почты",
        action: { label: "Подтвердить", href: "/verify-email?reason=checkout" },
      });
      navigate("/verify-email?reason=checkout");
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setStatus(validationError);
      toast.warning(validationError);
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.createOrder({
        items: products.map((product) => ({ product_id: product.id, qty: 1 })),
        delivery: {
          method: form.method,
          city: form.city.trim(),
          address: form.address.trim(),
          phone: form.phone.trim(),
          email: normalizeEmail(form.email),
          price: deliveryPrice,
        },
        comment: form.comment.trim(),
      });

      clear({ silent: true });
      toast.order(`Заказ #${response.id} создан. Осталось выбрать способ оплаты.`, {
        title: "Заказ создан",
        action: { label: "Мои заказы", href: "/orders" },
      });
      navigate(`/payment?order=${response.id}`);
    } catch (error) {
      const message = getErrorMessage(error, "Не удалось оформить заказ.");
      setStatus(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-shell shell-container section-stack checkoutPagePro">
      <section className="page-hero">
        <SectionHeading
          eyebrow="Оформление"
          title="Оформление без лишних шагов"
          description="Укажите доставку и контакты, затем перейдите к оплате."
        />
      </section>

      <section className="checkout-layout">
        <form className="checkout-form" onSubmit={submit}>
          <label className="field">
            <span className="field-label">Способ доставки</span>
            <SelectField className="field-input" value={form.method} onChange={(event) => setForm((current) => ({ ...current, method: event.target.value }))}>
              <option value="courier">Курьер</option>
              <option value="pickup">Самовывоз</option>
              <option value="express">Экспресс</option>
            </SelectField>
          </label>

          <div className="form-grid">
            <label className="field">
              <span className="field-label">Город</span>
              <input
                className="field-input"
                value={form.city}
                onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
                placeholder="Например: Алматы"
              />
            </label>

            <label className="field">
              <span className="field-label">Телефон</span>
              <input
                className="field-input"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="+7 700 000 00 00"
              />
            </label>
          </div>

          <label className="field">
            <span className="field-label">Email для уведомлений</span>
            <input
              className="field-input"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="name@gmail.com"
              autoComplete="email"
            />
          </label>

          <label className="field">
            <span className="field-label">Адрес</span>
            <input
              className="field-input"
              value={form.address}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              placeholder="Улица, дом, квартира"
            />
          </label>

          <label className="field">
            <span className="field-label">Комментарий</span>
            <textarea
              className="field-input field-input--area"
              value={form.comment}
              onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))}
              placeholder="Например: позвонить за 30 минут"
            />
          </label>

          {status ? <div className="field-error">{status}</div> : null}

          <button type="submit" className="shell-button" disabled={submitting || !products.length}>
            {submitting ? "Создаем заказ..." : "Перейти к оплате"}
          </button>
        </form>

        <aside className="checkout-summary">
          <div className="checkout-summary__top">
            <span className="section-heading__eyebrow">Ваш заказ</span>
            <strong>{products.length} позиций</strong>
          </div>

          <div className="stack-list">
            {products.map((product) => (
              <div key={product.id} className="summary-row">
                <span>{product.title}</span>
                <strong>{formatPrice(product.price)}</strong>
              </div>
            ))}
          </div>

          <div className="summary-row">
            <span>Товары</span>
            <strong>{formatPrice(subtotal)}</strong>
          </div>
          <div className="summary-row">
            <span>Доставка</span>
            <strong>{formatPrice(deliveryPrice)}</strong>
          </div>
          <div className="summary-row summary-row--total">
            <span>Итого</span>
            <strong>{formatPrice(total)}</strong>
          </div>
        </aside>
      </section>
    </div>
  );
}
