import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { SelectField } from "../../../components/SelectField";
import { useAuth } from "../../../providers/auth";
import { useToast } from "../../../providers/toast";
import { api } from "../../../services/api";
import { getErrorMessage } from "../../../services/errors";
import type { SellerRequest } from "../../../types/api";

type SettingsForm = {
  name: string;
  nickname: string;
  theme: string;
  lang: string;
};

type PasswordForm = {
  current_password: string;
  new_password: string;
  confirm_password: string;
  totp_code: string;
};

type TwoFactorSetup = {
  secret: string;
  otpauth_url: string;
};

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function sellerRequestLabel(status?: string) {
  switch (String(status || "").toLowerCase()) {
    case "pending":
      return "Заявка на проверке";
    case "approved":
      return "Заявка одобрена";
    case "rejected":
      return "Заявка отклонена";
    case "revoked":
      return "Доступ отозван";
    default:
      return "Заявка не отправлена";
  }
}

export function SettingsPage() {
  const { user, loading, refresh, logout } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState<SettingsForm>({ name: "", nickname: "", theme: "dark", lang: "ru" });
  const [avatarUrl, setAvatarUrl] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [sendingVerify, setSendingVerify] = useState(false);
  const [sellerRequest, setSellerRequest] = useState<SellerRequest | null>(null);
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetup | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorPassword, setTwoFactorPassword] = useState("");
  const [twoFactorDisableCode, setTwoFactorDisableCode] = useState("");
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    current_password: "",
    new_password: "",
    confirm_password: "",
    totp_code: "",
  });
  const [passwordStatus, setPasswordStatus] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    if (!user) return;

    setForm({
      name: user.name || "",
      nickname: user.nickname || "",
      theme: user.theme || "dark",
      lang: user.lang || "ru",
    });
    setAvatarUrl(user.avatar_url || "");
  }, [user]);

  useEffect(() => {
    if (!user) {
      setSellerRequest(null);
      return;
    }

    void api
      .getSellerRequestStatus()
      .then((response) => setSellerRequest(response.request || null))
      .catch(() => setSellerRequest(null));
  }, [user]);

  const roleLabel = useMemo(() => {
    if (user?.is_owner) return "Владелец";
    if (user?.is_admin) return "Администратор";
    if (user?.is_seller) return "Продавец";
    return "Покупатель";
  }, [user]);

  const accountStatus = useMemo(() => {
    const statusValue = String(user?.status || "active").toLowerCase();
    if (statusValue === "banned") return "Заблокирован";
    if (statusValue === "temporarily_banned") return `Временный бан${user?.banned_until ? ` до ${formatDate(user.banned_until)}` : ""}`;
    return "Активен";
  }, [user]);

  if (!loading && !user) {
    return <Navigate to="/auth" replace />;
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setSaving(true);

    try {
      await api.updateProfile(form);
      await refresh();
      setStatus("Настройки профиля сохранены.");
      toast.success("Настройки профиля сохранены.");
    } catch (error) {
      const message = getErrorMessage(error, "Не удалось сохранить настройки.");
      setStatus(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file?: File) {
    if (!file || uploading || removingAvatar) return;

    setUploading(true);
    setStatus("");

    try {
      const response = await api.uploadProfileAvatar(file);
      setAvatarUrl(response.avatar_url);
      await refresh();
      toast.success("Фото профиля обновлено.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось загрузить фото профиля."));
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    if (!avatarUrl) return;

    setRemovingAvatar(true);
    setStatus("");

    try {
      await api.deleteProfileAvatar();
      setAvatarUrl("");
      await refresh();
      toast.success("Фото профиля удалено.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось удалить фото профиля."));
    } finally {
      setRemovingAvatar(false);
    }
  }

  async function uploadFromInput(event: ChangeEvent<HTMLInputElement>) {
    await uploadAvatar(event.target.files?.[0]);
    event.target.value = "";
  }

  async function uploadFromDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (uploading || removingAvatar) return;
    await uploadAvatar(event.dataTransfer.files?.[0]);
  }

  async function resendVerification() {
    setSendingVerify(true);
    try {
      await api.resendVerificationEmail();
      toast.success("Письмо подтверждения отправлено.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось отправить письмо подтверждения."));
    } finally {
      setSendingVerify(false);
    }
  }

  async function startTwoFactorSetup() {
    setTwoFactorLoading(true);
    try {
      const response = await api.setupTwoFactor();
      setTwoFactorSetup(response);
      toast.success("Ключ 2FA создан. Добавьте его в приложение и введите код.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось создать ключ 2FA."));
    } finally {
      setTwoFactorLoading(false);
    }
  }

  async function enableTwoFactor() {
    if (!twoFactorCode.trim()) {
      toast.warning("Введите код из приложения 2FA.");
      return;
    }

    setTwoFactorLoading(true);
    try {
      const response = await api.enableTwoFactor(twoFactorCode.trim());
      setTwoFactorCode("");
      setTwoFactorSetup(null);
      await refresh();
      toast.success(response.user?.two_factor_enabled ? "2FA включена." : "Настройки 2FA обновлены.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось включить 2FA."));
    } finally {
      setTwoFactorLoading(false);
    }
  }

  async function disableTwoFactor() {
    if (!twoFactorPassword || !twoFactorDisableCode.trim()) {
      toast.warning("Введите пароль и код 2FA.");
      return;
    }

    setTwoFactorLoading(true);
    try {
      await api.disableTwoFactor({ password: twoFactorPassword, code: twoFactorDisableCode.trim() });
      setTwoFactorPassword("");
      setTwoFactorDisableCode("");
      await refresh();
      toast.success("2FA выключена.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось выключить 2FA."));
    } finally {
      setTwoFactorLoading(false);
    }
  }

  async function changePassword() {
    setPasswordStatus("");

    if (!passwordForm.current_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      toast.warning("Заполните текущий пароль и новый пароль.");
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.warning("Новый пароль и повтор не совпадают.");
      return;
    }

    if (user?.two_factor_enabled && !passwordForm.totp_code.trim()) {
      toast.warning("Введите код 2FA для смены пароля.");
      return;
    }

    setPasswordSaving(true);
    try {
      await api.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
        totp_code: passwordForm.totp_code.trim() || undefined,
      });
      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
        totp_code: "",
      });
      setPasswordStatus("Пароль изменён. Остальные сессии аккаунта завершены.");
      toast.success("Пароль изменён.");
    } catch (error) {
      const message = getErrorMessage(error, "Не удалось изменить пароль.");
      setPasswordStatus(message);
      toast.error(message);
    } finally {
      setPasswordSaving(false);
    }
  }

  const avatarLetter = (form.name || user?.email || "D").slice(0, 1).toUpperCase();
  const needsTwoFactor = !!user?.is_owner || !!user?.is_admin;

  return (
    <div className="settingsPagePro">
      <div className="container settingsPagePro__inner">
        <section className="settingsHeroPro">
          <div>
            <span>Настройки</span>
            <h1>Центр аккаунта</h1>
            <p>Профиль, безопасность, роль продавца и системные предпочтения аккаунта.</p>
          </div>
        </section>

        <section className="settingsLayoutPro">
          <form className="settingsMainPro" onSubmit={saveSettings}>
            <section className="settingsPanelPro">
              <div className="settingsPanelPro__head">
                <div>
                  <h2>Профиль</h2>
                  <p>Имя, никнейм и фото, которые используются в личном кабинете.</p>
                </div>
                {uploading ? <span>Загрузка фото...</span> : null}
              </div>

              <div className="settingsAvatarPro">
                <label className="settingsAvatarPro__drop" onDragOver={(event) => event.preventDefault()} onDrop={uploadFromDrop}>
                  <input type="file" accept="image/*" hidden disabled={uploading || removingAvatar} onChange={uploadFromInput} />
                  {avatarUrl ? <img src={avatarUrl} alt={form.name || "Профиль"} /> : <span>{avatarLetter}</span>}
                </label>

                <div>
                  <strong>{avatarUrl ? "Фото профиля загружено" : "Фото профиля не загружено"}</strong>
                  <p>Можно выбрать изображение или перетащить файл прямо на область аватара.</p>
                  <div className="settingsAvatarPro__actions">
                    <label className="settingsGhostButton">
                      <input type="file" accept="image/*" hidden disabled={uploading || removingAvatar} onChange={uploadFromInput} />
                      {uploading ? "Загружаем..." : avatarUrl ? "Заменить фото" : "Выбрать фото"}
                    </label>
                    {avatarUrl ? (
                      <button
                        type="button"
                        className="settingsGhostButton settingsGhostButton--danger"
                        disabled={uploading || removingAvatar}
                        onClick={() => void removeAvatar()}
                      >
                        {removingAvatar ? "Удаляем..." : "Удалить фото"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="settingsFormGridPro">
                <label className="field">
                  <span className="field-label">Имя</span>
                  <input
                    className="field-input"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Ваше имя"
                  />
                </label>

                <label className="field">
                  <span className="field-label">Никнейм</span>
                  <input
                    className="field-input"
                    value={form.nickname}
                    onChange={(event) => setForm((current) => ({ ...current, nickname: event.target.value }))}
                    placeholder="Публичное имя"
                  />
                </label>
              </div>

              <label className="field">
                <span className="field-label">Email</span>
                <input className="field-input settingsReadonlyPro" value={user?.email || ""} readOnly />
              </label>
            </section>

            <section className="settingsPanelPro">
              <div className="settingsPanelPro__head">
                <div>
                  <h2>Интерфейс</h2>
                  <p>Эти поля сохраняются в профиле. Полное применение темы и языка можно расширить позже.</p>
                </div>
              </div>

              <div className="settingsFormGridPro">
                <label className="field">
                  <span className="field-label">Тема</span>
                  <SelectField
                    className="field-input"
                    value={form.theme}
                    onChange={(event) => setForm((current) => ({ ...current, theme: event.target.value }))}
                  >
                    <option value="dark">Темная</option>
                    <option value="light">Светлая</option>
                  </SelectField>
                </label>

                <label className="field">
                  <span className="field-label">Язык</span>
                  <SelectField
                    className="field-input"
                    value={form.lang}
                    onChange={(event) => setForm((current) => ({ ...current, lang: event.target.value }))}
                  >
                    <option value="ru">Русский</option>
                    <option value="kz">Қазақша</option>
                    <option value="en">English</option>
                  </SelectField>
                </label>
              </div>
            </section>

            <section
              className="settingsPanelPro settingsSecurityPanelPro"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void changePassword();
                }
              }}
            >
              <div className="settingsPanelPro__head">
                <div>
                  <h2>Безопасность</h2>
                  <p>Смена пароля требует текущий пароль. После сохранения остальные устройства будут выведены из аккаунта.</p>
                </div>
              </div>

              <div className="settingsFormGridPro">
                <label className="field">
                  <span className="field-label">Текущий пароль</span>
                  <input
                    className="field-input"
                    type="password"
                    value={passwordForm.current_password}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, current_password: event.target.value }))}
                    placeholder="Ваш текущий пароль"
                    autoComplete="current-password"
                  />
                </label>

                <label className="field">
                  <span className="field-label">Новый пароль</span>
                  <input
                    className="field-input"
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, new_password: event.target.value }))}
                    placeholder="Минимум 10 символов"
                    autoComplete="new-password"
                  />
                </label>

                <label className="field">
                  <span className="field-label">Повторите пароль</span>
                  <input
                    className="field-input"
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, confirm_password: event.target.value }))}
                    placeholder="Повтор нового пароля"
                    autoComplete="new-password"
                  />
                </label>

                {user?.two_factor_enabled ? (
                  <label className="field">
                    <span className="field-label">Код 2FA</span>
                    <input
                      className="field-input"
                      value={passwordForm.totp_code}
                      onChange={(event) => setPasswordForm((current) => ({ ...current, totp_code: event.target.value.replace(/\D/g, "").slice(0, 6) }))}
                      placeholder="123456"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                    />
                  </label>
                ) : null}
              </div>

              <div className="settingsPasswordActions">
                <button
                  type="button"
                  className="settingsGhostButton"
                  disabled={passwordSaving}
                  onClick={() => void changePassword()}
                >
                  {passwordSaving ? "Меняем пароль..." : "Изменить пароль"}
                </button>
                <span>Новый пароль должен содержать минимум 10 символов, букву и цифру.</span>
              </div>

              {passwordStatus ? <div className="settingsStatusPro">{passwordStatus}</div> : null}
            </section>

            <section className="settingsPanelPro">
              <div className="settingsPanelPro__head">
                <div>
                  <h2>Системные уведомления</h2>
                  <p>Это справочный блок: важные события приходят автоматически, а отдельные переключатели можно добавить позже.</p>
                </div>
              </div>

              <div className="settingsReadOnlyList">
                <div>
                  <span>Заказы и оплата</span>
                  <strong>Включено системой</strong>
                </div>
                <div>
                  <span>Поддержка и обращения</span>
                  <strong>Включено системой</strong>
                </div>
                <div>
                  <span>Баны и предупреждения</span>
                  <strong>Обязательно</strong>
                </div>
              </div>
            </section>

            {status ? <div className="settingsStatusPro">{status}</div> : null}

            <div className="settingsSaveBarPro">
              <button type="submit" disabled={saving || uploading || removingAvatar}>
                {saving ? "Сохраняем..." : "Сохранить изменения"}
              </button>
            </div>
          </form>

          <aside className="settingsSidePro">
            <section className="settingsPanelPro settingsPanelPro--side">
              <h2>Состояние аккаунта</h2>
              <div className="settingsInfoRowsPro">
                <div>
                  <span>Статус</span>
                  <strong>{accountStatus}</strong>
                </div>
                <div>
                  <span>Роль</span>
                  <strong>{roleLabel}</strong>
                </div>
                <div>
                  <span>Email</span>
                  <strong className={user?.email_verified ? "is-success" : "is-warning"}>
                    {user?.email_verified ? "Подтвержден" : "Не подтвержден"}
                  </strong>
                </div>
                <div>
                  <span>Предупреждения</span>
                  <strong>{user?.warning_count || 0}</strong>
                </div>
                {needsTwoFactor ? (
                  <div>
                    <span>2FA</span>
                    <strong className={user?.two_factor_enabled ? "is-success" : "is-warning"}>
                      {user?.two_factor_enabled ? "Включена" : "Нужно включить"}
                    </strong>
                  </div>
                ) : null}
              </div>

              {!user?.email_verified ? (
                <button type="button" className="settingsGhostButton settingsGhostButton--full" disabled={sendingVerify} onClick={() => void resendVerification()}>
                  {sendingVerify ? "Отправляем..." : "Отправить письмо подтверждения"}
                </button>
              ) : null}
            </section>

            {needsTwoFactor ? (
              <section className="settingsPanelPro settingsPanelPro--side">
                <h2>Защита входа</h2>
                <div className="settingsSellerStatusPro">
                  <strong>{user?.two_factor_enabled ? "2FA включена" : "2FA обязательна для админки"}</strong>
                  <p>
                    Для роли владельца и администратора вход в панель управления требует код из приложения
                    Authenticator.
                  </p>
                </div>

                {!user?.two_factor_enabled ? (
                  <>
                    <button
                      type="button"
                      className="settingsGhostButton settingsGhostButton--full"
                      disabled={twoFactorLoading}
                      onClick={() => void startTwoFactorSetup()}
                    >
                      {twoFactorLoading ? "Готовим..." : twoFactorSetup ? "Создать новый ключ" : "Настроить 2FA"}
                    </button>

                    {twoFactorSetup ? (
                      <div className="settingsReadOnlyList">
                        <div>
                          <span>Секретный ключ</span>
                          <strong>{twoFactorSetup.secret}</strong>
                        </div>
                        <div>
                          <span>Шаг 1</span>
                          <strong>Добавьте ключ в Google Authenticator</strong>
                        </div>
                        <div>
                          <span>Шаг 2</span>
                          <strong>Введите 6 цифр ниже</strong>
                        </div>
                        <label className="field">
                          <span className="field-label">Код 2FA</span>
                          <input
                            className="field-input"
                            value={twoFactorCode}
                            onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                            placeholder="123456"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                          />
                        </label>
                        <button
                          type="button"
                          className="settingsGhostButton settingsGhostButton--full"
                          disabled={twoFactorLoading}
                          onClick={() => void enableTwoFactor()}
                        >
                          Включить 2FA
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="settingsReadOnlyList">
                    <label className="field">
                      <span className="field-label">Текущий пароль</span>
                      <input
                        className="field-input"
                        type="password"
                        value={twoFactorPassword}
                        onChange={(event) => setTwoFactorPassword(event.target.value)}
                        placeholder="Пароль аккаунта"
                        autoComplete="current-password"
                      />
                    </label>
                    <label className="field">
                      <span className="field-label">Код 2FA</span>
                      <input
                        className="field-input"
                        value={twoFactorDisableCode}
                        onChange={(event) => setTwoFactorDisableCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="123456"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                      />
                    </label>
                    <button
                      type="button"
                      className="settingsGhostButton settingsGhostButton--danger settingsGhostButton--full"
                      disabled={twoFactorLoading}
                      onClick={() => void disableTwoFactor()}
                    >
                      Выключить 2FA
                    </button>
                  </div>
                )}
              </section>
            ) : null}

            <section className="settingsPanelPro settingsPanelPro--side">
              <h2>Продавец</h2>
              <div className="settingsSellerStatusPro">
                <strong>{user?.is_seller ? "Аккаунт продавца активен" : sellerRequestLabel(sellerRequest?.status)}</strong>
                {sellerRequest?.admin_comment ? <p>{sellerRequest.admin_comment}</p> : null}
              </div>
              <Link className="settingsGhostButton settingsGhostButton--full" to="/seller">
                {user?.is_seller ? "Открыть кабинет продавца" : sellerRequest ? "Посмотреть заявку" : "Стать продавцом"}
              </Link>
            </section>

            <section className="settingsPanelPro settingsPanelPro--side settingsDangerPro">
              <h2>Сессия</h2>
              <p>Выход завершит текущую авторизацию на этом устройстве.</p>
              <button type="button" onClick={() => void logout()}>
                Выйти из аккаунта
              </button>
            </section>
          </aside>
        </section>
      </div>
    </div>
  );
}
