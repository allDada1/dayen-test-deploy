import express from "express";
import type { Pool } from "pg";

import type { AuthenticatedRequest } from "../../../types/app";
import { badRequest, ok, serverError } from "../../../utils/http";
import { parseRequiredString } from "../../../utils/validation";

type AuthMiddleware = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => unknown;

type AssistantRouterOptions = {
  pool: Pool;
  optionalAuth: AuthMiddleware;
};

type AssistantProduct = {
  id: number;
  title: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  section: string | null;
  tile_slug: string | null;
  image_url: string | null;
};

type AssistantHistoryItem = {
  role?: string;
  text?: string;
};

type AssistantActionKind =
  | "product"
  | "catalog"
  | "cart"
  | "orders"
  | "profile"
  | "seller"
  | "support"
  | "report"
  | "verify_email";

type AssistantAction = {
  kind: AssistantActionKind;
  label: string;
  href: string;
  title?: string;
  subtitle?: string;
  image_url?: string;
  price?: number;
};

const unsafeTopicPattern =
  /(admin|админ|парол|password|token|jwt|secret|секрет|ключ|api key|env|\.env|sql|database|база данных|исходн|код|github|deploy|server|сервер)/i;

const dayenKnowledge = `
Dayen is an online marketplace. The assistant is read-only and helps users navigate products, orders, seller applications, email verification, support, returns and disputes.
Safe public routes: /search, /catalog, /product/:id, /cart, /checkout, /orders, /profile, /seller, /about/support, /about/report, /verify-email.
Personality:
- Be warm, alive and useful, not a rigid support script.
- It is okay to chat lightly with the user, especially about product models, style, comparisons, gifts, comfort, materials, brands, routines and shopping choices.
- When comparing models or product types, explain tradeoffs in a natural way: who it fits, what to watch for, and what you would choose in their situation.
- If the user is just chatting, answer naturally and do not force navigation.
- Ask at most one short clarifying question when the choice depends on budget, size, taste or use case.
Rules:
- Do not reveal or guess passwords, tokens, secrets, source code, database structure, admin pages, private notes or other users' data.
- Do not claim you changed orders, users, products, prices, stock, tickets or seller applications.
- If the user needs an action, explain where they can do it in the UI.
- Do not paste raw URLs into the answer. Navigation buttons are rendered separately by the app.
- If a question is about a concrete order, ask the user to open the order from /orders and use the order support/claim flow.
- If the user reports a site bug, guide them to /about/report and suggest adding screenshots.
- For available Dayen products, use only the public product suggestions provided in the request. Do not invent unavailable products.
- You may give general product advice, but clearly keep it general if no matching Dayen product was provided.
- Reply in Russian, short and practical.
`;

function parseHistory(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .slice(-6)
    .map((item: AssistantHistoryItem) => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      text: String(item?.text || "").trim().slice(0, 600),
    }))
    .filter((item) => item.text);
}

function toProductSuggestion(row: AssistantProduct) {
  return {
    id: Number(row.id),
    title: row.title,
    description: row.description || "",
    price: Number(row.price || 0),
    stock: Number(row.stock || 0),
    category: row.category || "",
    section: row.section || "",
    tile_slug: row.tile_slug || "",
    image_url: row.image_url || "",
    url: `/product/${row.id}`,
  };
}

async function findPublicProducts(pool: Pool, message: string) {
  const query = message.trim();
  if (query.length < 2) return [];

  const stopWords = new Set([
    "помоги",
    "выбрать",
    "найти",
    "покажи",
    "нужен",
    "нужна",
    "нужно",
    "товар",
    "товары",
    "есть",
    "для",
    "мне",
    "хочу",
  ]);
  const terms = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3 && !stopWords.has(item))
    .slice(0, 6);
  const searchTerms = terms.length ? terms : [query];
  const searchSql = searchTerms
    .map(
      (_, index) => `
        p.title ILIKE $${index + 1}
        OR p.description ILIKE $${index + 1}
        OR p.category ILIKE $${index + 1}
        OR COALESCE(p.section, '') ILIKE $${index + 1}
        OR COALESCE(p.tile_slug, '') ILIKE $${index + 1}
      `,
    )
    .join(" OR ");

  const result = await pool.query<AssistantProduct>(
    `
    SELECT
      p.id,
      p.title,
      p.description,
      p.price,
      p.stock,
      p.category,
      p.section,
      p.tile_slug,
      COALESCE(
        (
          SELECT pi.image_url
          FROM product_images pi
          WHERE pi.product_id = p.id
          ORDER BY pi.is_cover DESC, pi.sort_order ASC, pi.id ASC
          LIMIT 1
        ),
        p.image_url,
        ''
      ) AS image_url
    FROM products p
    LEFT JOIN users seller_user ON seller_user.id = p.owner_user_id
    WHERE
      (p.owner_user_id IS NULL OR COALESCE(seller_user.is_seller, FALSE) = TRUE)
      AND (${searchSql})
    ORDER BY
      CASE WHEN p.title ILIKE $1 THEN 0 ELSE 1 END,
      p.id DESC
    LIMIT 6
    `,
    searchTerms.map((term) => `%${term}%`),
  );

  return (result.rows || []).map(toProductSuggestion);
}

function buildSafeFallbackReply(message: string, products: ReturnType<typeof toProductSuggestion>[]) {
  if (unsafeTopicPattern.test(message)) {
    return "Я не могу помогать с паролями, токенами, админкой, кодом, базой данных или внутренними секретами. Могу подсказать только безопасные действия в интерфейсе Dayen.";
  }

  if (products.length) {
    const first = products[0];
    return `Нашёл подходящие товары. Начните с «${first.title}» за ${first.price} ₸: ${first.stock > 0 ? "есть в наличии" : "сейчас нет в наличии"}. Ниже покажу удобные кнопки для перехода.`;
  }

  if (/привет|как дела|поболт|поговор|скучно|что умеешь|кто ты/i.test(message)) {
    return "Я здесь не только как кнопка «поддержка», можно и спокойно поболтать. Могу помочь выбрать товар, сравнить модели, прикинуть, что лучше под бюджет или сценарий, и честно сказать, где я не уверен.";
  }

  if (/модель|модел|сравн|лучше|какой|какую|какие|посовет|выбрать|подобрать|бренд|материал|размер|цвет|стиль/i.test(message)) {
    return "Давай разберём как нормальный консультант, а не робот с табличкой. Скажи бюджет и для чего выбираем: повседневно, подарок, домой, работа, спорт или что-то конкретное. Тогда я сравню варианты по делу.";
  }

  if (/заказ|достав|возврат|спор|claim|order/i.test(message)) {
    return "Если вопрос по конкретному заказу, откройте мои заказы, выберите нужную покупку и создайте обращение или спор там. Так поддержка увидит контекст заказа.";
  }

  if (/почт|email|verify|подтверж/i.test(message)) {
    return "Для подтверждения почты откройте страницу подтверждения. Если письмо не пришло, запросите повторную отправку и проверьте папку «Спам».";
  }

  if (/продав|seller|магазин/i.test(message)) {
    return "Чтобы стать продавцом, войдите в аккаунт, подтвердите email и откройте раздел продавца. Если почта не подтверждена, Dayen сначала отправит вас на подтверждение.";
  }

  if (/проблем|ошиб|баг|bug|report|скрин|слом/i.test(message)) {
    return "Если это ошибка сайта, лучше открыть форму обращения и приложить скриншоты. Так проблему проще воспроизвести и исправить.";
  }

  return "Я могу помочь с выбором товаров, поиском по каталогу, заказами, профилем, подтверждением почты и обращениями. Ниже покажу подходящие кнопки для следующего шага.";
}

function buildFallbackReply(message: string, products: ReturnType<typeof toProductSuggestion>[]) {
  return buildSafeFallbackReply(message, products);

  if (unsafeTopicPattern.test(message)) {
    return "Я не могу помогать с паролями, ключами, админкой, кодом или внутренними данными. Могу подсказать только безопасные действия в интерфейсе Dayen: товары, заказы, профиль, подтверждение почты и обращения.";
  }

  if (products.length) {
    const first = products[0];
    return `Нашёл подходящие товары. Начните с «${first.title}» за ${first.price} ₸: ${first.stock > 0 ? "есть в наличии" : "сейчас нет в наличии"}. Ниже покажу карточки, можно открыть товар и сравнить варианты.`;
  }

  if (/заказ|достав|возврат|спор|claim|order/i.test(message)) {
    return "Если вопрос по конкретному заказу, откройте «Мои заказы», выберите нужный заказ и создайте обращение или спор там. Так поддержка увидит контекст покупки.";
  }

  if (/почт|email|verify|подтверж/i.test(message)) {
    return "Для подтверждения почты откройте страницу /verify-email. Если письмо не пришло, нажмите повторную отправку и проверьте папку «Спам».";
  }

  if (/продав|seller|магазин/i.test(message)) {
    return "Чтобы стать продавцом, войдите в аккаунт, подтвердите email и откройте раздел продавца. Если email не подтверждён, Dayen сначала отправит вас на подтверждение почты.";
  }

  return "Я могу помочь с выбором товаров, поиском по каталогу, заказами, профилем, подтверждением почты и обращениями. Если это ошибка сайта, лучше открыть /about/report и приложить скриншоты.";
}

function pushUniqueAction(actions: AssistantAction[], action: AssistantAction) {
  if (!action.href.startsWith("/") || action.href.startsWith("//")) return;
  if (actions.some((item) => item.kind === action.kind && item.href === action.href)) return;
  actions.push(action);
}

function isCasualAssistantMessage(message: string) {
  return /привет|как дела|поболт|поговор|скучно|что умеешь|кто ты|спасибо|благодар/i.test(message);
}

function buildAssistantActions(message: string, products: ReturnType<typeof toProductSuggestion>[]) {
  const actions: AssistantAction[] = [];

  for (const product of products.slice(0, 3)) {
    pushUniqueAction(actions, {
      kind: "product",
      label: "Открыть товар",
      href: product.url,
      title: product.title,
      subtitle: `${product.category || "Товар"} · ${product.stock > 0 ? "в наличии" : "нет в наличии"}`,
      image_url: product.image_url,
      price: product.price,
    });
  }

  if (/заказ|достав|возврат|спор|claim|order/i.test(message)) {
    pushUniqueAction(actions, {
      kind: "orders",
      label: "Открыть мои заказы",
      href: "/orders",
      title: "Мои заказы",
      subtitle: "Статусы, обращения и споры по покупкам",
    });
  }

  if (/почт|email|verify|подтверж/i.test(message)) {
    pushUniqueAction(actions, {
      kind: "verify_email",
      label: "Перейти к подтверждению",
      href: "/verify-email",
      title: "Подтверждение почты",
      subtitle: "Статус email и повторная отправка письма",
    });
  }

  if (/проблем|ошиб|баг|bug|report|скрин|слом/i.test(message)) {
    pushUniqueAction(actions, {
      kind: "report",
      label: "Сообщить о проблеме",
      href: "/about/report",
      title: "Форма обращения",
      subtitle: "Опишите проблему и приложите фото",
    });
  }

  if (/поддерж|support|чат|помощ/i.test(message)) {
    pushUniqueAction(actions, {
      kind: "support",
      label: "Открыть поддержку",
      href: "/about/support",
      title: "Поддержка Dayen",
      subtitle: "Помощь по сайту, заказам и обращениям",
    });
  }

  if (/продав|seller|магазин|витрин/i.test(message)) {
    pushUniqueAction(actions, {
      kind: "seller",
      label: "Открыть раздел продавца",
      href: "/seller",
      title: "Раздел продавца",
      subtitle: "Заявка, товары и панель магазина",
    });
  }

  if (/корзин|cart/i.test(message)) {
    pushUniqueAction(actions, {
      kind: "cart",
      label: "Открыть корзину",
      href: "/cart",
      title: "Корзина",
      subtitle: "Проверьте товары перед оформлением",
    });
  }

  if (/профил|аккаунт|настрой/i.test(message)) {
    pushUniqueAction(actions, {
      kind: "profile",
      label: "Открыть профиль",
      href: "/profile",
      title: "Профиль",
      subtitle: "Данные аккаунта и быстрые разделы",
    });
  }

  if (!actions.length && isCasualAssistantMessage(message)) {
    return [];
  }

  if (!actions.length || /каталог|товар|найти|поиск|выбрать/i.test(message)) {
    pushUniqueAction(actions, {
      kind: "catalog",
      label: "Перейти в каталог",
      href: "/catalog-preview",
      title: "Каталог товаров",
      subtitle: "Разделы, плитки и витрины Dayen",
    });
  }

  return actions.slice(0, 5);
}

function extractOpenAiText(payload: any) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();

  const parts: string[] = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === "string") parts.push(content.text);
    }
  }

  return parts.join("\n").trim();
}

async function askOpenAi(message: string, history: ReturnType<typeof parseHistory>, products: ReturnType<typeof toProductSuggestion>[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const context = {
    products,
    history,
    user_message: message,
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: dayenKnowledge,
      input: `Safe Dayen context JSON:\n${JSON.stringify(context, null, 2)}`,
      max_output_tokens: 500,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenAI response failed: ${response.status} ${text.slice(0, 300)}`);
  }

  const payload = await response.json();
  return extractOpenAiText(payload);
}

export function createAssistantRouter({ pool, optionalAuth }: AssistantRouterOptions) {
  const router = express.Router();

  router.post("/assistant/chat", optionalAuth, async (req: AuthenticatedRequest, res) => {
    const message = parseRequiredString(req.body?.message, { min: 2, max: 1000, normalize: true });
    const history = parseHistory(req.body?.history);

    if (!message) return badRequest(res, "bad_assistant_message");

    try {
      const products = unsafeTopicPattern.test(message) ? [] : await findPublicProducts(pool, message);
      let aiReply: string | null = null;

      if (!unsafeTopicPattern.test(message)) {
        try {
          aiReply = await askOpenAi(message, history, products);
        } catch (error) {
          console.error("POST /api/assistant/chat OpenAI fallback:", error);
        }
      }

      const reply = aiReply || buildFallbackReply(message, products);

      return ok(res, {
        reply,
        actions: buildAssistantActions(message, products),
        product_suggestions: products,
        mode: aiReply ? "ai" : "fallback",
      });
    } catch (error) {
      console.error("POST /api/assistant/chat error:", error);
      return serverError(res);
    }
  });

  return router;
}
