import "@gravity-ui/uikit/styles/styles.css";
import { AppTheme } from "./theme";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./gravity-theme.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppTheme>
      <App />
    </AppTheme>
  </React.StrictMode>,
);
