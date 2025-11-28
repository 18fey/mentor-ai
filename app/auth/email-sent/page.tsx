// app/auth/email-sent/page.tsx
import { Suspense } from "react";
import { EmailSentInner } from "./EmailSentInner";

export default function EmailSentPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F5FAFF] to-white px-4">
      {/* useSearchParams を使うコンポーネントは Suspense で包む */}
      <Suspense fallback={<div className="text-sm text-slate-500">読み込み中です...</div>}>
        <EmailSentInner />
      </Suspense>
    </main>
  );
}