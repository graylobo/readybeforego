import { AppLayout } from "@/components/layout/app-layout";
import { getSidebarInitialData } from "@/lib/sidebar-initial-data";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout initialSidebarData={await getSidebarInitialData()}>
      {children}
    </AppLayout>
  );
}
