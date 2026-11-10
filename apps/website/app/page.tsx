import type { Metadata } from "next";
import Splash from "@/components/Splash";
import "@/styles/tw/splash.css";

export const metadata: Metadata = { title: "505th Expeditionary Force" };

export default function Page() {
  return <Splash />;
}
