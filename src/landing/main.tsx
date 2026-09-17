import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../tokens.css";
import Landing from "./Landing.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);
