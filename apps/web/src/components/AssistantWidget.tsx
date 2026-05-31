import { useEffect, useState } from "react";
import { MessageCircleMore } from "lucide-react";
import { useLocation } from "react-router-dom";

import { AssistantChat } from "./AssistantChat";

function shouldHideAssistant(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/about/support")
  );
}

export function AssistantWidget() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  if (shouldHideAssistant(location.pathname)) return null;

  return (
    <div className={`assistantWidget ${open ? "is-open" : ""}`}>
      {open ? (
        <div className="assistantWidget__panel" role="dialog" aria-label="Помощник Dayen">
          <div className="assistantWidget__top">
            <div>
              <strong>Помощник Dayen</strong>
              <span>Товары, заказы и поддержка</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть помощника">
              ×
            </button>
          </div>
          <AssistantChat compact onNavigate={() => setOpen(false)} />
        </div>
      ) : null}

      <button
        type="button"
        className="assistantWidget__fab"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={open ? "Закрыть помощника Dayen" : "Открыть помощника Dayen"}
      >
        <span className="assistantWidget__fabIcon" aria-hidden="true">
          <MessageCircleMore size={28} strokeWidth={2.15} />
        </span>
      </button>
    </div>
  );
}
