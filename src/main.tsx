import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { getHoopsFantasyFaviconPool } from "@/lib/hoopsfantasy-brand";

const faviconPool = getHoopsFantasyFaviconPool();
const randomFavicon = faviconPool[Math.floor(Math.random() * faviconPool.length)];

if (typeof document !== "undefined" && randomFavicon) {
  let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/png";
  link.href = randomFavicon;
}

createRoot(document.getElementById("root")!).render(<App />);
