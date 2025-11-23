// app/admin/feedback/page.tsx

type Feedback = {
  id: string;
  rating: string | null;
  comment: string | null;
  email: string | null;
  page: string | null;
  created_at: string;
};

export const dynamic = "force-dynamic"; // キャッシュ防止（常に最新を取得）

async function getFeedback(): Promise<Feedback[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/beta_feedback?select=*&order=created_at.desc`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    console.error("Failed to fetch feedback");
    return [];
  }

  return res.json();
}

export default async function FeedbackAdminPage() {
  const data = await getFeedback();

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">
        β版フィードバック一覧
      </h1>

      {data.length === 0 && (
        <p className="text-slate-500 text-sm">まだフィードバックはありません。</p>
      )}

      {data.map((f) => (
        <div
          key={f.id}
          className="border border-slate-200 p-5 rounded-2xl bg-white shadow-sm space-y-2"
        >
          <p className="text-xs text-slate-500">
            {new Date(f.created_at).toLocaleString()} / {f.page}
          </p>

          <p className="text-sm">⭐ 評価: {f.rating || "未評価"}</p>

          <p className="font-medium text-slate-800">
            {f.comment || "（コメントなし）"}
          </p>

          {f.email && (
            <p className="text-xs text-slate-600">
              📩 連絡先: {f.email}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
