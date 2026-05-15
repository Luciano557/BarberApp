import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Forzar tema claro: el dark mode aún no está diseñado/revisado.
// Removemos la clase `dark` y normalizamos cualquier valor previo en localStorage.
try {
  document.documentElement.classList.remove("dark");
  for (const key of ["theme", "vite-ui-theme"]) {
    const v = localStorage.getItem(key);
    if (v === "dark" || v === "system") localStorage.setItem(key, "light");
  }
} catch {
  // noop
}

createRoot(document.getElementById("root")!).render(<App />);
