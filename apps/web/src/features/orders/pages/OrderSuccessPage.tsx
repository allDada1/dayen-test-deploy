import { Link, useSearchParams } from "react-router-dom";

import { SectionHeading } from "../../../components/SectionHeading";

export function OrderSuccessPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("id");

  return (
    <div className="page-shell shell-container section-stack">
      <section className="page-hero page-hero--compact">
        <SectionHeading
          eyebrow="Готово"
          title="Заказ оформлен"
          description="Оплата успешно принята, а заказ уже доступен в истории покупок."
        />
      </section>

      <section className="empty-panel">
        <strong>{orderId ? `Заказ #${orderId}` : "Заказ создан"}</strong>
        <p>Теперь можно открыть историю заказов, посмотреть детали или вернуться на главную.</p>
        <div className="button-row">
          <Link to="/orders" className="shell-button">
            К заказам
          </Link>
          <Link to="/" className="shell-button shell-button--ghost">
            На главную
          </Link>
        </div>
      </section>
    </div>
  );
}
