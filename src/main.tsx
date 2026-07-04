import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { EditorSettingsProvider } from "./components/editor-settings-provider";
import { ThemeProvider } from "./components/theme-provider";
import { AppShell } from "./features/app-shell";
import { AppChrome } from "./features/app-chrome";
import { SetupScreen } from "./features/setup/setup-screen";
import { useLlmConfigured } from "./hooks/settings/use-llm-configured";
import "./index.css";

document.documentElement.dataset.platform = window.storyStudio.platform;

function App() {
  const { configured, refresh } = useLlmConfigured();

  if (configured === null) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        <AppChrome />
        <div className="surface-glass flex flex-1 flex-col items-center justify-center gap-2">
          <p className="text-xs text-muted-foreground">加载中…</p>
        </div>
      </div>
    );
  }

  if (!configured) {
    return <SetupScreen onComplete={() => void refresh()} />;
  }

  return <AppShell />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <EditorSettingsProvider>
        <App />
      </EditorSettingsProvider>
    </ThemeProvider>
  </StrictMode>,
);
