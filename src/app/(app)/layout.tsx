import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TrashToastProvider } from "@/components/trash/TrashToast";
import { CostBar } from "@/components/ui/CostBar";
import { TabBar } from "@/components/ui/TabBar";
import { createServerClient } from "@/lib/supabase/server";
import styles from "./layout.module.css";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // O proxy já barra quem está sem sessão; aqui é a segunda trava.
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/entrar");

  return (
    <div className={styles.shell}>
      <CostBar />
      <TrashToastProvider>
        <div className={styles.content}>{children}</div>
      </TrashToastProvider>
      <Suspense fallback={null}>
        <TabBar />
      </Suspense>
    </div>
  );
}
