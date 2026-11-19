import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { TitleBar } from "./components/TitleBar";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<StrictMode><div className="flex h-full flex-col"><TitleBar /><div className="min-h-0 flex-1"><App /></div></div></StrictMode>);
