import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useCart } from "../../../providers/cart";
import { useToast } from "../../../providers/toast";
import { api } from "../../../services/api";
import { formatPrice } from "../../../services/format";
import type { Product } from "../../../types/api";

export function CartPage() {
  const { items, clear, remove } = useCart();
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!items.length) {
      setProducts([]);
      return;
    }

    void api.getProducts().then((response) => {
      setProducts(response.items.filter((product) => items.includes(product.id)));
    });
  }, [items]);

  const total = products.reduce((sum, product) => sum + Number(product.price || 0), 0);

  return (
    <main className="container cartWrap cartPageLegacy">
      <section className="cartMain">
        <div className="cartHead">
          <div>
            <div className="cartTitle">Корзина</div>
            <div className="cartSub">
              {products.length ? `Товаров в корзине: ${products.length}` : "В корзине пока нет товаров"}
            </div>
          </div>
        </div>

        <div className="cartList">
          {products.length ? (
            products.map((product) => (
              <article key={product.id} className="cartItemCard">
                <Link className="cartItemCard__media" to={`/product/${product.id}`}>
                  {product.images?.[0] || product.image_url ? <img src={product.images?.[0] || product.image_url} alt={product.title} /> : null}
                </Link>

                <div className="cartItemCard__main">
                  <Link className="cartItemCard__title" to={`/product/${product.id}`}>
                    {product.title}
                  </Link>
                  <div className="muted">{product.category || "Категория не указана"}</div>

                  <div className="cartItemCard__meta">
                    {product.section ? <span className="tiny-chip">{product.section}</span> : null}
                  </div>
                </div>

                <div className="cartItemCard__side">
                  <strong>{formatPrice(product.price)}</strong>
                  <div className="button-row">
                    <Link className="ghostBtn" to={`/product/${product.id}`}>
                      Открыть товар
                    </Link>
                    <button
                      type="button"
                      className="ghostBtn"
                      onClick={() => {
                        remove(product.id);
                        toast.info("Товар убран из корзины.", {
                          title: "Корзина обновлена",
                          action: { label: "В каталог", href: "/catalog" },
                        });
                      }}
                    >
                      Убрать
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="cartEmpty">
              <strong>Корзина пока пустая</strong>
              <p>Добавьте товары с витрины или карточки товара, и они появятся здесь.</p>
              <div className="button-row">
                <Link to="/catalog" className="linkBtn">
                  Перейти в каталог
                </Link>
                <Link to="/favorites" className="ghostBtn">
                  Открыть избранное
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      <aside className="cartSide">
        <section className="cartCard cartCard--summary">
          <div className="cartSummary__title">Сводка заказа</div>

          <div className="cartSummary__lines">
            <div className="sumLine">
              <span>Товары</span>
              <b>{products.length}</b>
            </div>
            <div className="sumLine">
              <span>Сумма</span>
              <b>{formatPrice(total)}</b>
            </div>
            <div className="sumLine">
              <span>Доставка</span>
              <span>Рассчитается на следующем шаге</span>
            </div>
          </div>

          <div className="cartBtns">
            <button
              type="button"
              className="ghostBtn ghostBtn--wide"
              disabled={!products.length}
              onClick={() => {
                clear();
                toast.info("Корзина очищена.", { title: "Корзина обновлена" });
              }}
            >
              Очистить
            </button>
            {products.length ? (
              <Link to="/checkout" className="linkBtn cartBtnPrimary">
                К оформлению
              </Link>
            ) : (
              <span className="linkBtn cartBtnPrimary is-disabled" aria-disabled="true">
                К оформлению
              </span>
            )}
          </div>
        </section>
      </aside>
    </main>
  );
}
