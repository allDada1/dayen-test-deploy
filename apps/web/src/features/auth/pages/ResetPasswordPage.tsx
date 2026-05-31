import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { useToast } from "../../../providers/toast";
import { api } from "../../../services/api";
import { getErrorMessage } from "../../../services/errors";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !token) return;

    if (password.trim().length < 6) {
      const message = "Пароль должен содержать минимум 6 символов.";
      setStatus(message);
      toast.warning(message);
      return;
    }

    if (password !== confirmPassword) {
      const message = "Пароли не совпадают.";
      setStatus(message);
      toast.warning(message);
      return;
    }

    setStatus("");
    setLoading(true);

    try {
      const response = await api.resetPassword(token, password.trim());
      setStatus(response.message);
      toast.success(response.message);
      window.setTimeout(() => navigate("/auth"), 1200);
    } catch (error) {
      const message = getErrorMessage(error, "Не удалось обновить пароль.");
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
            <h1 className="authPanel__title authPanel__title--small">Новый пароль</h1>
            <p className="authPanel__description">
              Если ссылка еще действительна, задайте новый пароль и сразу сможете войти в аккаунт.
            </p>
          </div>

          <form className="authFormLegacy" onSubmit={submit}>
            <label className="field">
              <span className="field-label">Новый пароль</span>
              <div className="authPasswordWrap">
                <input
                  className="field-input authPasswordInput"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Минимум 6 символов"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="authPasswordToggle"
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </label>

            <label className="field">
              <span className="field-label">Повторите пароль</span>
              <div className="authPasswordWrap">
                <input
                  className="field-input authPasswordInput"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Повторите новый пароль"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="authPasswordToggle"
                  aria-label={showConfirmPassword ? "Скрыть пароль" : "Показать пароль"}
                  onClick={() => setShowConfirmPassword((current) => !current)}
                >
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </label>

            {!token ? <div className="field-error">В ссылке отсутствует токен восстановления.</div> : null}
            {status ? <div className="field-hint">{status}</div> : null}

            <div className="authActions">
              <button type="submit" className="linkBtn authSubmit" disabled={loading || !token}>
                {loading ? "Сохраняем..." : "Обновить пароль"}
              </button>
              <Link to="/auth" className="ghostBtn authSubmit authLinkButton">
                Перейти ко входу
              </Link>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.7A3 3 0 0 0 13.3 13.4" />
      <path d="M9.9 5.1A12.8 12.8 0 0 1 12 5c6.2 0 10 7 10 7a18.4 18.4 0 0 1-4.1 4.8" />
      <path d="M6.2 6.3C3.8 8.1 2 12 2 12s3.8 7 10 7a10.8 10.8 0 0 0 4.1-.8" />
    </svg>
  );
}
