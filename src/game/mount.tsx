import React from "react";
import { createRoot } from "react-dom/client";
import { GameApp } from "./GameApp";
import "./game.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GameApp />
  </React.StrictMode>
);
