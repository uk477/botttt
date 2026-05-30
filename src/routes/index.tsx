import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

// Client-only: HashRouter + Telegram WebApp SDK touch window/document.
export const Route = createFileRoute("/")({
  component: FanvueShell,
});

function FanvueShell() {
  const [App, setApp] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    let mounted = true;
    import("@/fanvue/App").then((m) => {
      if (mounted) setApp(() => m.default);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!App) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[#0a0a0c]">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-white/70" />
      </div>
    );
  }

  return <App />;
}
