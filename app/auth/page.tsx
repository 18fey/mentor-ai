// app/auth/page.tsx
import { Suspense } from "react";
import { AuthInner } from "./AuthInner";

export default function AuthPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F5FAFF] to-white">
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
            読み込み中です...
          </div>
        }
      >
        <AuthInner />
      </Suspense>
    </main>
  );
}
