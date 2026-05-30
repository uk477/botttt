import "./styles.css";
import "./fanvue/globals.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./fanvue/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
