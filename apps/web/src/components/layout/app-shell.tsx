import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export function AppShell() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-[260px] min-h-screen">
        <Header />
        <div className="mx-auto max-w-[1600px] p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
