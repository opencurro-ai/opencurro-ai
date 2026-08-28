import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./globals.css";
import { App } from "./App";
import { installFetchLogger } from "@/lib/devlog";

// Instrument fetch before anything renders so every /api/* request the app makes is captured in
// the dev console's live network stream.
installFetchLogger();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
