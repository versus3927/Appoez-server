import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Appoez — Discord Bot Dashboard",
  description:
    "Дашборд Discord-бота: статистика участников, статус бота и базы данных.",
};

export const viewport: Viewport = {
  themeColor: "#08080d",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="bg-void font-sans text-zinc-200 antialiased">
        {children}
      </body>
    </html>
  );
}
