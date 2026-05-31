import type { PropsWithChildren } from "react";

import { AuthProvider } from "./auth";
import { CartProvider } from "./cart";
import { ToastProvider } from "./toast";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AuthProvider>
      <ToastProvider>
        <CartProvider>{children}</CartProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
