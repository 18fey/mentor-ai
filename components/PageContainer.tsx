// components/PageContainer.tsx
"use client";

import type { ReactNode } from "react";

export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-4 md:px-8 md:py-8 space-y-4 md:space-y-6">
      {children}
    </div>
  );
}
