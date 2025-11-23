// components/StatCard.tsx

type StatCardProps = {
  label: string;
  value: string;
  helper?: string; // ← これがポイント（あってもなくてもOKなおまけテキスト）
};

export function StatCard({ label, value, helper }: StatCardProps) {
  return (
    <div className="rounded-2xl bg-white shadow-sm px-6 py-5">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      {helper && (
        <p className="mt-1 text-[11px] text-slate-400">{helper}</p>
      )}
    </div>
  );
}

