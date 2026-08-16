import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { installPlatformGeometry } from "./lib/platformGeometry";

// Run before React mounts so the first painted frame has the correct viewport
// and (on Android) can pull the native insets that may have arrived on about:blank.
installPlatformGeometry();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
