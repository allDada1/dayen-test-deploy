import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../../../providers/auth";
import { useToast } from "../../../providers/toast";
import { api } from "../../../services/api";
import { getErrorMessage } from "../../../services/errors";

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const registered = useMemo(() => searchParams.get("registered") === "1", [searchParams]);
  const emailFromQuery = useMemo(() => searchParams.get("email") || "", [searchParams]);
  const reason = useMemo(() => searchParams.get("reason") || "", [searchParams]);

  const [status, setStatus] = useState(token ? "Подтверждаем почту..." : "");
  const [loading, setLoading] = useState(Boolean(token));
  const [resending, setResending] = useState(false);
  const [verifiedByToken, setVerifiedByToken] = useState(false);

  useEffect(() => {
    if (token) return;
    if (registered && emailFromQuery) {
      setStatus("Регистрация успешна. Мы отправили письмо для подтверждения почты.");
      return;
    }
    if (reason === "seller") {
      setStatus("Чтобы отправить заявку продавца, сначала подтвердите email.");
      return;
    }
    if (reason === "checkout") {
      setStatus("Чтобы перейти к оплате, сначала подтвердите email.");
    }
  }, [emailFromQuery, reason, registered, token]);

  useEffect(() => {
    let active = true;

    async function runVerification() {
      if (!token) return;

      try {
        const response = await api.verifyEmail(token);
        if (!active) return;
        setVerifiedByToken(true);
        setStatus(response.message);
        toast.success(response.message);
        await refresh();
      } catch (error) {
        if (!active) return;
        const message = getErrorMessage(error, "Не удалось подтвердить email.");
        setStatus(message);
        toast.error(message);
      } finally {
        if (active) setLoading(false);
      }
    }

    void runVerification();

    return () => {
      active = false;
    };
  }, [refresh, toast, token]);

  async function handleResend() {
    if (resending) return;

    setResending(true);
    try {
      const response = user
        ? await api.resendVerificationEmail()
        : await api.resendVerificationEmailPublic(emailFromQuery);
      setStatus(response.message);
      toast.success(response.message);
    } catch (error) {
      const message = getErrorMessage(error, "Не удалось отправить письмо повторно.");
      setStatus(message);
      toast.error(message);
    } finally {
      setResending(false);
    }
  }

  const email = user?.email || emailFromQuery || "";
  const isVerified = Boolean(user?.email_verified) || verifiedByToken;
  const canResend = Boolean(user || emailFromQuery);

  return (
    <div className="authStandalone">
      <div className="container authWrap">
        <section className="authPanel authPanel--narrow">
          <div className="authPanel__head authPanel__head--left">
            <h1 className="authPanel__title authPanel__title--small">Подтверждение почты</h1>
            <p className="authPanel__description">
              {isVerified
                ? "Email уже подтверждён. Теперь вам доступны все важные действия в аккаунте."
                : "Подтвердите почту, чтобы оформлять заказы, подавать заявку на продавца и пользоваться всеми возможностями Dayen."}
            </p>
          </div>

          <div className="authFormLegacy">
            <label className="field">
              <span className="field-label">Email</span>
              <input className="field-input" value={email} readOnly placeholder="Сначала укажите email" />
            </label>

            {status ? <div className="field-hint">{status}</div> : null}
            {loading ? <div className="field-hint">Проверяем ссылку подтверждения...</div> : null}

            <div className="authActions">
              {isVerified ? (
                <Link to={user ? "/profile" : "/auth"} className="linkBtn authSubmit authLinkButton">
                  {user ? "Перейти в профиль" : "Перейти ко входу"}
                </Link>
              ) : (
                <button
                  type="button"
                  className="linkBtn authSubmit"
                  onClick={handleResend}
                  disabled={resending || !canResend}
                >
                  {resending ? "Отправляем..." : "Отправить письмо еще раз"}
                </button>
              )}

              <button
                type="button"
                className="ghostBtn authSubmit"
                onClick={() => {
                  if (reason === "seller") navigate("/seller");
                  else if (reason === "checkout") navigate("/checkout");
                  else navigate("/auth");
                }}
              >
                {reason === "seller"
                  ? "Вернуться к заявке"
                  : reason === "checkout"
                    ? "Вернуться к оформлению"
                    : "Перейти ко входу"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
