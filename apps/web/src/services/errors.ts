type ApiErrorLike = Error & {
  status?: number;
  payload?: {
    error?: string;
    message?: string;
  };
};

const ERROR_MESSAGES: Record<string, string> = {
  account_banned: "Ваш аккаунт заблокирован. Если вы считаете это ошибкой, обратитесь в поддержку.",
  account_temporarily_banned: "Ваш аккаунт временно заблокирован. Попробуйте позже или обратитесь в поддержку.",
  already_seller: "У вас уже есть доступ продавца.",
  bad_credentials: "Неверный email или пароль.",
  bad_email: "Введите корректный email.",
  bad_file_type: "Можно загружать только изображения.",
  bad_google_access_token: "Не удалось подтвердить вход через Google.",
  bad_google_credentials: "Не удалось подтвердить вход через Google.",
  bad_id: "Некорректный идентификатор.",
  bad_method: "Выберите корректный способ оплаты.",
  bad_name: "Введите имя не короче двух символов.",
  bad_note: "Проверьте заметку и попробуйте снова.",
  bad_or_expired_token: "Ссылка недействительна или уже устарела.",
  bad_or_expired_verification_token: "Ссылка подтверждения недействительна или уже устарела.",
  bad_password: "Пароль слишком слабый. Используйте минимум 10 символов.",
  bad_origin: "Запрос заблокирован защитой сайта. Обновите страницу и попробуйте снова.",
  bad_2fa_code: "Неверный код 2FA.",
  bad_reason: "Опишите причину обращения.",
  bad_status: "Недопустимый статус для этого действия.",
  bad_support_category: "Выберите корректный тип обращения.",
  bad_support_image: "Не удалось прикрепить изображение к обращению.",
  bad_support_message: "Опишите проблему подробнее: минимум 10 символов.",
  bad_support_page: "Слишком длинное название страницы или раздела.",
  bad_type: "Выберите тип обращения.",
  claim_unavailable: "Возврат или спор доступны только после оплаты заказа.",
  cannot_moderate_admin: "Обычный администратор не может менять другого администратора.",
  cannot_moderate_owner: "Владельца нельзя модерировать из панели.",
  cannot_moderate_self: "Нельзя модерировать самого себя.",
  change_password_failed: "Не удалось изменить пароль. Попробуйте ещё раз.",
  delivery_address_required: "Укажите адрес доставки.",
  delivery_city_required: "Укажите город доставки.",
  delivery_method_required: "Выберите способ доставки.",
  delivery_phone_required: "Укажите телефон получателя.",
  email_exists: "Пользователь с таким email уже зарегистрирован.",
  db_error: "На сервере произошла ошибка при обработке запроса. Попробуйте чуть позже.",
  email_already_verified: "Email уже подтверждён.",
  email_taken: "Пользователь с таким email уже зарегистрирован.",
  email_not_verified: "Подтвердите email, чтобы выполнить это действие.",
  empty_items: "В заказе нет товаров.",
  forbidden: "У вас нет доступа к этому действию.",
  google_email_not_verified: "Подтвердите email в аккаунте Google и попробуйте снова.",
  google_not_configured: "Вход через Google пока не настроен.",
  invalid_credentials: "Неверный email или пароль.",
  invalid_token: "Сессия устарела. Войдите снова.",
  missing_2fa_code: "Введите код 2FA.",
  missing_google_access_token: "Google не вернул токен доступа.",
  missing_google_credential: "Google не передал данные для входа.",
  missing_token: "Ссылка для сброса пароля недействительна.",
  no_access: "У вас нет доступа к загрузке файлов.",
  no_file: "Файл не выбран.",
  no_token: "Войдите в аккаунт, чтобы выполнить действие.",
  not_enough_stock: "Для части товаров недостаточно остатка.",
  not_found: "Запись не найдена.",
  not_pending: "Эта заявка уже была обработана.",
  owner_only: "Это действие доступно только владельцу проекта.",
  rate_limited: "Слишком много попыток. Подождите немного и попробуйте снова.",
  product_not_found: "Один из товаров больше недоступен.",
  request_already_pending: "Заявка уже отправлена и ждёт решения администратора.",
  request_timeout: "Сервер слишком долго не отвечает. Перезапустите backend или попробуйте ещё раз через минуту.",
  reset_email_failed: "Не удалось отправить письмо для сброса пароля.",
  reset_password_failed: "Не удалось обновить пароль. Попробуйте ещё раз.",
  same_password: "Новый пароль должен отличаться от текущего.",
  seller_inactive: "Магазин временно недоступен.",
  seller_only: "Это действие доступно только продавцу.",
  seller_required: "Для этого действия нужен доступ продавца.",
  self_follow: "Нельзя подписаться на свой магазин.",
  telegram_login_not_enabled_yet: "Вход через Telegram пока не подключён.",
  two_factor_already_enabled: "2FA уже включена.",
  two_factor_not_configured: "Сначала создайте ключ 2FA.",
  two_factor_not_enabled: "2FA уже выключена.",
  two_factor_required: "Для входа в этот аккаунт нужен код 2FA.",
  two_factor_setup_required: "Для доступа в админку сначала включите 2FA в настройках аккаунта.",
  weak_password: "Пароль должен содержать минимум 10 символов, букву и цифру.",
  unauthorized: "Войдите в аккаунт, чтобы продолжить.",
  user_not_found: "Пользователь не найден.",
  validation_error: "Проверьте заполненные поля.",
  verification_email_failed: "Не удалось отправить письмо для подтверждения. Попробуйте ещё раз.",
  verify_email_failed: "Не удалось подтвердить email. Попробуйте ещё раз.",
};

const STATUS_MESSAGES: Record<number, string> = {
  400: "Проверьте данные и попробуйте ещё раз.",
  401: "Войдите в аккаунт, чтобы продолжить.",
  403: "У вас нет доступа к этому действию.",
  404: "Ничего не найдено.",
  409: "Это действие уже выполнено или данные конфликтуют.",
  500: "На сервере произошла ошибка. Попробуйте позже.",
};

export function translateErrorCode(code?: string, status?: number) {
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (status && STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
  return null;
}

export function getErrorMessage(
  error: unknown,
  fallback = "Что-то пошло не так. Попробуйте ещё раз.",
) {
  if (!error) return fallback;

  if (error instanceof Error) {
    const apiError = error as ApiErrorLike;
    const code = apiError.payload?.error || apiError.payload?.message || apiError.message;
    const translated = translateErrorCode(code, apiError.status);

    if (translated) return translated;
    if (code && !looksLikeCode(code)) return code;
  }

  if (typeof error === "string") {
    const translated = translateErrorCode(error);
    if (translated) return translated;
    if (!looksLikeCode(error)) return error;
  }

  return fallback;
}

function looksLikeCode(value: string) {
  return /^[a-z0-9_./-]+$/i.test(value.trim());
}
