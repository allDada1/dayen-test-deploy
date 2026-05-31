import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { CartIcon } from "./icons/CartIcon";
import { api } from "../services/api";
import { getErrorMessage } from "../services/errors";
import type { AssistantAction, AssistantProductSuggestion } from "../types/api";

type AssistantMessage = {
  role: "assistant" | "user";
  text: string;
  actions?: AssistantAction[];
  products?: AssistantProductSuggestion[];
};

type AssistantChatProps = {
  compact?: boolean;
  onNavigate?: () => void;
};

const starterPrompts = [
  "Помоги выбрать товар",
  "Где мой заказ?",
  "Как подтвердить email?",
  "Хочу стать продавцом",
  "Сообщить о проблеме",
];

const initialMessage: AssistantMessage = {
  role: "assistant",
  text: "Я помощник Dayen. Помогу найти товар, сравнить варианты, разобраться с заказом, подтверждением почты, заявкой продавца или обращением в поддержку. Я ничего не меняю в аккаунте и не вижу секреты.",
};

const actionIcons: Record<AssistantAction["kind"], ReactNode> = {
  product: "◇",
  catalog: "▦",
  cart: <CartIcon className="assistantAction__svgIcon" />,
  orders: "▤",
  profile: "◉",
  seller: "◈",
  support: "?",
  report: "!",
  verify_email: "✉",
};

function formatAssistantPrice(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "";
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₸`;
}

function AssistantActions({ actions, onNavigate }: { actions: AssistantAction[]; onNavigate?: () => void }) {
  if (!actions.length) return null;

  return (
    <div className="assistantActions">
      {actions.map((action, index) => (
        <Link
          key={`${action.kind}-${action.href}-${index}`}
          className={`assistantAction assistantAction--${action.kind}`}
          to={action.href}
          onClick={onNavigate}
        >
          {action.image_url ? (
            <img src={action.image_url} alt={action.title || action.label} />
          ) : (
            <span className="assistantAction__icon">{actionIcons[action.kind]}</span>
          )}
          <span className="assistantAction__body">
            <strong>{action.title || action.label}</strong>
            {action.subtitle ? <small>{action.subtitle}</small> : null}
            <b>{formatAssistantPrice(action.price) || action.label}</b>
          </span>
        </Link>
      ))}
    </div>
  );
}

export function AssistantChat({ compact = false, onNavigate }: AssistantChatProps) {
  const [messages, setMessages] = useState<AssistantMessage[]>([initialMessage]);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function sendMessage(rawMessage: string) {
    const trimmed = rawMessage.trim();
    if (!trimmed || submitting) return;

    const nextMessages: AssistantMessage[] = [...messages, { role: "user", text: trimmed }];
    setMessages(nextMessages);
    setText("");
    setSubmitting(true);

    try {
      const response = await api.chatAssistant({
        message: trimmed,
        history: nextMessages.slice(-8).map((message) => ({ role: message.role, text: message.text })),
      });
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: response.reply,
          actions: response.actions,
          products: response.product_suggestions,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: getErrorMessage(error, "Не получилось получить ответ помощника. Попробуйте ещё раз или создайте обращение через форму проблемы."),
        },
      ]);
    } finally {
      setSubmitting(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(text);
  }

  return (
    <section className={`assistantChat ${compact ? "assistantChat--compact" : ""}`}>
      <div className="chatHead">
        <h2 className="docSectionTitle">{compact ? "Помощник" : "Диалог"}</h2>
        <span className="chatTag">{submitting ? "думаю..." : "dayen assistant"}</span>
      </div>

      <div className="chatBox">
        {messages.length === 1 ? (
          <div className="assistantQuick assistantQuick--inside">
            {starterPrompts.map((prompt) => (
              <button key={prompt} type="button" onClick={() => void sendMessage(prompt)} disabled={submitting}>
                {prompt}
              </button>
            ))}
          </div>
        ) : null}

        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`msg ${message.role === "user" ? "msg--me" : ""}`}>
            <div className="msg__meta">{message.role === "user" ? "Вы" : "Помощник Dayen"}</div>
            <div>{message.text}</div>
            {message.actions?.length ? <AssistantActions actions={message.actions} onNavigate={onNavigate} /> : null}
            {!message.actions?.length && message.products?.length ? (
              <div className="assistantProducts">
                {message.products.map((product) => (
                  <Link key={product.id} className="assistantProductCard" to={product.url} onClick={onNavigate}>
                    {product.image_url ? <img src={product.image_url} alt={product.title} /> : <span className="assistantProductCard__ghost">Dayen</span>}
                    <span>
                      <strong>{product.title}</strong>
                      <small>{product.category || "Товар"} · {product.stock > 0 ? "в наличии" : "нет в наличии"}</small>
                      <b>{product.price} ₸</b>
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <form className="chatComposer" onSubmit={submit}>
        <input
          className="docInput"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={compact ? "Спросите про товар или заказ..." : "Например: помоги выбрать плитку, где мой заказ, как подтвердить почту..."}
          disabled={submitting}
        />
        <button className="docSubmitBtn" type="submit" disabled={submitting}>
          {submitting ? "Отвечаю..." : "Отправить"}
        </button>
      </form>
    </section>
  );
}
