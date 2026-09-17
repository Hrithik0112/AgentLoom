import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import Landing from "./landing/Landing.tsx";
import { bootTheme } from "./lib/theme.ts";
import { usePath } from "./router.tsx";
import "./index.css";

// The debugger pulls React Flow, so it loads only when someone actually asks for it.
const App = lazy(() => import("./App.tsx"));

bootTheme();

function Routes() {
  const path = usePath();
  if (path.startsWith("/app")) {
    return (
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-meta text-text-faint">
            Loading the debugger
          </div>
        }
      >
        <App />
      </Suspense>
    );
  }
  return <Landing />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Routes />
  </StrictMode>,
);
