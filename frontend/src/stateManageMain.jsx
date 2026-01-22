import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import StateManage from "./StateManage.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <StateManage />
  </StrictMode>
);
