import React from "react";
import { createRoot } from "react-dom/client";

const rootElement = document.getElementById("react-root");

if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<React.Fragment />);
}
