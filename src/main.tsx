import { createRoot } from "react-dom/client";
import { App } from "./App";
import "../styles.css";

if (import.meta.env.DEV && "serviceWorker" in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => void registration.unregister());
  });
}

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js"));
}

const root = document.querySelector<HTMLDivElement>("#root");

if (!root) {
  throw new Error("How Are We Crazy application root was not found.");
}

createRoot(root).render(<App />);
