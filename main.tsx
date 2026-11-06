import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

try {
  if (localStorage.getItem("wilkaxyz:compact") === "1") document.documentElement.classList.add("is-compact");
} catch {
  /* abaikan */
}

document.addEventListener("gesturestart", e => e.preventDefault());

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
