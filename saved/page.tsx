// app/saved/page.tsx
import { SavedItemsList } from "@/components/SavedItemsList";

export default function SavedPage() {
  return (
    <div className="mx-auto w-full max-w-5xl p-4">
      <SavedItemsList />
    </div>
  );
}
