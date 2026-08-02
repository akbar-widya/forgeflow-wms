import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { RequireAuth, RequirePublicOnly } from "@/components/auth/guards";
import { LoginPage } from "@/pages/login";
import { DashboardPage } from "@/pages/dashboard";
import { ReceivingPage } from "@/pages/receiving";
import { JobAllocationPage } from "@/pages/job-allocation";
import { MovementsPage } from "@/pages/movements";
import { NotificationsPage } from "@/pages/notifications";
import { ProfilePage } from "@/pages/profile";
import { MasterDataPage } from "@/pages/master-data";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<RequirePublicOnly />}>
        <Route index element={<LoginPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/inbound/receiving" element={<ReceivingPage />} />
          <Route path="/outbound/job-allocation" element={<JobAllocationPage />} />
          <Route path="/outbound/job-allocation/:jobId" element={<JobAllocationPage />} />
          <Route path="/movements" element={<MovementsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/master-data" element={<MasterDataPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
