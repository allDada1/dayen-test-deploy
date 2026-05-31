import { Link } from "react-router-dom";

export function NotFoundPage() {
  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.assign("/");
  };

  return (
    <div className="notFoundPage">
      <section className="notFoundHero" aria-labelledby="not-found-title">
        <div className="notFoundHero__shade" />
        <div className="notFoundHero__content">
          <span className="notFoundHero__badge">404</span>
          <h1 id="not-found-title">Похоже, вы улетели не туда</h1>
          <p>
            Страница, которую вы ищете, скорее всего переместилась в другую
            галактику или перестала существовать. Давайте вернём вас на
            правильный курс.
          </p>

          <div className="notFoundHero__actions">
            <Link to="/" className="notFoundHero__primary">
              На главную
            </Link>
            <button type="button" className="notFoundHero__secondary" onClick={goBack}>
              Назад
            </button>
          </div>

          <div className="notFoundQuick">
            <span className="notFoundQuick__label">Или попробуйте:</span>
            <div className="notFoundQuick__grid">
              <Link to="/catalog-preview" className="notFoundQuick__card">
                <span className="notFoundQuick__icon">▦</span>
                <strong>Каталог товаров</strong>
                <small>Исследуйте все разделы</small>
              </Link>
              <Link to="/" className="notFoundQuick__card">
                <span className="notFoundQuick__icon">●</span>
                <strong>Популярное</strong>
                <small>Посмотрите, что в тренде</small>
              </Link>
              <Link to="/about/support" className="notFoundQuick__card">
                <span className="notFoundQuick__icon">?</span>
                <strong>Поддержка</strong>
                <small>Мы всегда на связи</small>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
