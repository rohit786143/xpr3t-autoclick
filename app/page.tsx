import { getAdminSession } from "@/lib/auth";
import AdminDashboardPage from "@/app/admin/dashboard/page";
import AdminLoginPage from "@/app/admin/login/page";

export const dynamic = "force-dynamic";

export default async function MainAdminPage() {
  const session = await getAdminSession();

  if (!session) {
    return <AdminLoginPage />;
  }

  return <AdminDashboardPage />;
}
