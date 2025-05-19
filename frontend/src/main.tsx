// frontend/src/main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const container = document.getElementById("root")!;
createRoot(container).render(
  // <React.StrictMode> // opcional
    <App />
  // </React.StrictMode>
);
