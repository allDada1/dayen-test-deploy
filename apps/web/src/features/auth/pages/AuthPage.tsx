import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../../providers/auth";
import { useToast } from "../../../providers/toast";
import { api } from "../../../services/api";
import { getEmailValidationMessage, normalizeEmail } from "../../../services/emailValidation";
import { getErrorMessage } from "../../../services/errors";

type AuthMode = "login" | "register";

type GoogleTokenClient = {
  requestAccessToken: () => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
            error_callback?: () => void;
          }) => GoogleTokenClient;
        };
      };
    };
  }
}

export function AuthPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();

  const [mode, setMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [totpCode, setTotpCode] = useState("");
  const [totpRequired, setTotpRequired] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api.getGoogleConfig()
      .then((response) => {
        if (!cancelled) setGoogleClientId(response.clientId || null);
      })
      .catch(() => {
        if (!cancelled) setGoogleClientId(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!googleClientId) return;
    if (window.google?.accounts?.oauth2) {
      setGoogleReady(true);
      return;
    }

    const scriptId = "google-gsi-client";
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    const handleLoad = () => setGoogleReady(true);

    if (existing) {
      existing.addEventListener("load", handleLoad);
      return () => existing.removeEventListener("load", handleLoad);
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", handleLoad);
    document.head.appendChild(script);

    return () => script.removeEventListener("load", handleLoad);
  }, [googleClientId]);

  useEffect(() => {
    setTotpCode("");
    setTotpRequired(false);
    setError("");
  }, [mode]);

  const strength = useMemo(() => {
    const length = form.password.trim().length;
    if (length >= 10) return { label: "сильный", width: 100 };
    if (length >= 6) return { label: "средний", width: 66 };
    return { label: "слабый", width: Math.max(18, length * 10) };
  }, [form.password]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const validationMessage = validateForm(mode, form);
    setError("");

    if (validationMessage) {
      setError(validationMessage);
      toast.warning(validationMessage);
      return;
    }

    if (mode === "login" && totpRequired && totpCode.trim().length !== 6) {
      const message = "Введите 6-значный код 2FA.";
      setError(message);
      toast.warning(message);
      return;
    }

    setLoading(true);

    try {
      const normalizedEmail = normalizeEmail(form.email);

      if (mode === "login") {
        const response = await api.login(normalizedEmail, form.password, totpCode.trim() || undefined);
        login(response.token, response.user);
        toast.success("Вы вошли в аккаунт.");
        navigate("/profile");
      } else {
        const response = await api.register(form.name.trim(), normalizedEmail, form.password);
        toast.success(response.message);
        navigate(`/verify-email?registered=1&email=${encodeURIComponent(response.email)}`);
      }
    } catch (nextError) {
      if (mode === "login" && isTwoFactorChallenge(nextError)) {
        setTotpRequired(true);
        const code = getApiErrorCode(nextError);
        const message = code === "bad_2fa_code" ? getErrorMessage(nextError) : "Введите код 2FA для этого аккаунта.";
        setError(message);
        if (code === "bad_2fa_code") toast.error(message);
        else toast.info(message);
        return;
      }

      const message = getErrorMessage(
        nextError,
        mode === "login" ? "Не удалось войти в аккаунт." : "Не удалось создать аккаунт.",
      );
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    if (googleLoading) return;
    if (!googleClientId) {
      const message = "Вход через Google пока не настроен.";
      setError(message);
      toast.warning(message);
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      const message = "Google еще инициализируется. Попробуйте через пару секунд.";
      setError(message);
      toast.warning(message);
      return;
    }

    if (totpRequired && totpCode.trim().length !== 6) {
      const message = "Введите 6-значный код 2FA.";
      setError(message);
      toast.warning(message);
      return;
    }

    setGoogleLoading(true);
    setError("");

    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: "openid email profile",
        callback: async (response) => {
          if (!response.access_token) {
            const message = getErrorMessage(response.error || "missing_google_access_token");
            setError(message);
            toast.error(message);
            setGoogleLoading(false);
            return;
          }

          try {
            const loginResponse = await api.loginWithGoogle(response.access_token, totpCode.trim() || undefined);
            login(loginResponse.token, loginResponse.user);
            toast.success("Вы вошли через Google.");
            navigate("/profile");
          } catch (nextError) {
            if (isTwoFactorChallenge(nextError)) {
              setTotpRequired(true);
              const code = getApiErrorCode(nextError);
              const message = code === "bad_2fa_code" ? getErrorMessage(nextError) : "Введите код 2FA и повторите вход через Google.";
              setError(message);
              if (code === "bad_2fa_code") toast.error(message);
              else toast.info(message);
              return;
            }

            const message = getErrorMessage(nextError, "Не удалось войти через Google.");
            setError(message);
            toast.error(message);
          } finally {
            setGoogleLoading(false);
          }
        },
        error_callback: () => {
          const message = "Не удалось открыть окно входа через Google.";
          setError(message);
          toast.error(message);
          setGoogleLoading(false);
        },
      });

      tokenClient.requestAccessToken();
    } catch (nextError) {
      const message = getErrorMessage(nextError, "Не удалось войти через Google.");
      setError(message);
      toast.error(message);
      setGoogleLoading(false);
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
          <button
            type="button"
            className="topNav__a topNav__a--button"
            onClick={() => setMode((current) => (current === "login" ? "register" : "login"))}
          >
            {mode === "login" ? "Регистрация" : "Вход"}
          </button>
        </nav>
      </div>

      <div className="container authWrap">
        <section className="authPanel">
          <div className="authPanel__head">
            <h1 className="authPanel__title">{mode === "login" ? "Вход в аккаунт" : "Регистрация"}</h1>
          </div>

          <form className="authFormLegacy" onSubmit={submit}>
            {mode === "register" ? (
              <label className="field">
                <span className="field-label">Имя</span>
                <input
                  className="field-input"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Ваше имя"
                  autoComplete="name"
                />
              </label>
            ) : null}

            <label className="field">
              <span className="field-label">Email</span>
              <input
                className="field-input"
                type="email"
                value={form.email}
                onChange={(event) => {
                  setForm((current) => ({ ...current, email: event.target.value }));
                  if (mode === "login") {
                    setTotpCode("");
                    setTotpRequired(false);
                  }
                }}
                placeholder="example@gmail.com"
                autoComplete="email"
              />
            </label>

            <label className="field">
              <span className="field-label">Пароль</span>
              <div className="authPasswordWrap">
                <input
                  className="field-input authPasswordInput"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, password: event.target.value }));
                    if (mode === "login") {
                      setTotpCode("");
                      setTotpRequired(false);
                    }
                  }}
                  placeholder={mode === "login" ? "••••••••" : "Минимум 10 символов"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
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

            {mode === "login" && totpRequired ? (
              <label className="field">
                <span className="field-label">Код 2FA</span>
                <input
                  className="field-input"
                  value={totpCode}
                  onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6 цифр из приложения"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                />
              </label>
            ) : null}

            {mode === "register" ? (
              <>
                <label className="field">
                  <span className="field-label">Повторите пароль</span>
                  <div className="authPasswordWrap">
                    <input
                      className="field-input authPasswordInput"
                      type={showConfirm ? "text" : "password"}
                      value={form.confirmPassword}
                      onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                      placeholder="Повторите пароль"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="authPasswordToggle"
                      aria-label={showConfirm ? "Скрыть пароль" : "Показать пароль"}
                      onClick={() => setShowConfirm((current) => !current)}
                    >
                      {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </label>

                <div className="authStrength">
                  <div className="authStrength__bar">
                    <span style={{ width: `${strength.width}%` }} />
                  </div>
                  <div className="authStrength__meta">
                    <span>
                      Надежность: <b>{strength.label}</b>
                    </span>
                    <span>Минимум 10 символов, буква и цифра.</span>
                  </div>
                </div>
              </>
            ) : (
              <Link to="/forgot-password" className="authInlineLink authInlineLink--under">
                Забыли пароль?
              </Link>
            )}

            {error ? <div className="field-error">{error}</div> : null}

            <div className="authActions">
              <button type="submit" className="linkBtn authSubmit" disabled={loading}>
                {loading ? "Подождите..." : mode === "login" ? "Войти" : "Создать аккаунт"}
              </button>
              <button
                type="button"
                className="ghostBtn authSubmit"
                onClick={() => setMode((current) => (current === "login" ? "register" : "login"))}
              >
                {mode === "login" ? "Создать аккаунт" : "Уже есть аккаунт"}
              </button>
            </div>

            <div className="authProviders">
              <div className="authProviders__label">или</div>
              <div className="authProviders__grid authProviders__grid--two">
                <button
                  type="button"
                  className="authProviderBtn authProviderBtn--google"
                  onClick={handleGoogleLogin}
                  disabled={!googleClientId || !googleReady || googleLoading}
                >
                  <span className="authProviderIcon">G</span>
                  <span>{googleLoading ? "Подождите..." : "Войти через Google"}</span>
                </button>
                <button type="button" className="authProviderBtn authProviderBtn--telegram" disabled>
                  <span className="authProviderIcon">✈</span>
                  <span>Telegram</span>
                  <span className="authProviderSoon">скоро</span>
                </button>
              </div>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

function validateForm(mode: AuthMode, form: { name: string; email: string; password: string; confirmPassword: string }) {
  const emailValidationMessage = getEmailValidationMessage(form.email);
  if (emailValidationMessage) return emailValidationMessage;
  if (mode === "register" && form.name.trim().length < 2) return "Введите имя не короче двух символов.";
  if (!form.password.trim()) return "Введите пароль.";
  if (mode === "register" && form.password.trim().length < 10) return "Пароль должен содержать минимум 10 символов.";
  if (mode === "register" && (!/[a-zа-я]/i.test(form.password) || !/\d/.test(form.password))) return "Пароль должен содержать букву и цифру.";
  if (mode === "register" && form.password !== form.confirmPassword) return "Пароли не совпадают.";
  return "";
}

function getApiErrorCode(error: unknown) {
  if (error instanceof Error) {
    const apiError = error as Error & { payload?: { error?: string; message?: string } };
    return String(apiError.payload?.error || apiError.payload?.message || error.message || "").trim();
  }

  return typeof error === "string" ? error.trim() : "";
}

function isTwoFactorChallenge(error: unknown) {
  const code = getApiErrorCode(error);
  return code === "two_factor_required" || code === "missing_2fa_code" || code === "bad_2fa_code";
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
