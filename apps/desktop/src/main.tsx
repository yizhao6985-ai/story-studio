import "./lib/monaco-setup";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { EditorSettingsProvider } from "./components/editor-settings-provider";
import { ThemeProvider } from "./components/theme-provider";
import { AppShell } from "./features/app-shell";
import { initThemeFromStorage } from "./lib/theme";
import "./index.css";

initThemeFromStorage();
document.documentElement.dataset.platform = window.storyStudio.platform;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <EditorSettingsProvider>
        <AppShell />
      </EditorSettingsProvider>
    </ThemeProvider>
  </StrictMode>,
);
