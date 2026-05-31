import type { FormEvent } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { useToast } from "../../../providers/toast";
import { api } from "../../../services/api";
import { getEmailValidationMessage, normalizeEmail } from "../../../services/emailValidation";
import { getErrorMessage } from "../../../services/errors";

export function ForgotPasswordPage() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const normalizedEmail = normalizeEmail(email);
    const validationMessage = getEmailValidationMessage(normalizedEmail);
    if (validationMessage) {
      setStatus(validationMessage);
      toast.warning(validationMessage);
      return;
    }

    setStatus("");
    setLoading(true);

    try {
      const response = await api.forgotPassword(normalizedEmail);
      setStatus(response.message);
      toast.success(response.message);
    } catch (error) {
      const message = getErrorMessage(error, "Не удалось отправить письмо для сброса пароля.");
      setStatus(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="authStandalone">
      <div className="container authTopbar">
        <Link className="brand" to="/">
          <span className="brand__dot" />
          <span className="brand__name">Dayen</span>
        </Link>

        <nav className="authTopbar__nav">
          <Link className="topNav__a" to="/">
            Главная
          </Link>
          <Link className="topNav__a topNav__a--button" to="/auth">
            Вход
          </Link>
        </nav>
      </div>

      <div className="container authWrap">
        <section className="authPanel authPanel--narrow">
          <div className="authPanel__head authPanel__head--left">
            <h1 className="authPanel__title authPanel__title--small">Восстановление пароля</h1>
            <p className="authPanel__description">
              Введите email, и мы отправим ссылку для сброса доступа. Если почтовый сервис ещё не настроен,
              тестовая ссылка появится в логе сервера.
            </p>
          </div>

          <form className="authFormLegacy" onSubmit={submit}>
            <label className="field">
              <span className="field-label">Email</span>
              <input
                className="field-input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="example@gmail.com"
                autoComplete="email"
              />
            </label>

            {status ? <div className="field-hint">{status}</div> : null}

            <div className="authActions">
              <button type="submit" className="linkBtn authSubmit" disabled={loading}>
                {loading ? "Отправляем..." : "Отправить ссылку"}
              </button>
              <Link to="/auth" className="ghostBtn authSubmit authLinkButton">
                Вернуться ко входу
              </Link>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
