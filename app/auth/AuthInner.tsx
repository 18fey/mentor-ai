// app/auth/AuthInner.tsx
"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

type AuthTab = "login" | "signup";

// 本番URL（env があればそっち優先）
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.mentor-ai.net";

// クライアント用 Supabase インスタンス
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function AuthInner() {
  const searchParams = useSearchParams();

  // /auth?mode=signup なら最初から新規登録タブ
  const [tab, setTab] = useState<AuthTab>(() =>
    searchParams.get("mode") === "signup" ? "signup" : "login"
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ 利用規約・プライポリ モーダル用ステート
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const router = useRouter();

  // ✅ URLクエリから Supabase 認証エラーを拾う（otp_expired など）
  useEffect(() => {
    const urlError = searchParams.get("error");
    const errorCode = searchParams.get("error_code");
    const errorDescription = searchParams.get("error_description");

    if (errorCode === "otp_expired") {
      setError(
        "メールの認証リンクの有効期限が切れています。お手数ですが、もう一度ログインまたは新規登録からメールを受け取り直してください。"
      );
      setTab("login");
      return;
    }

    if (urlError) {
      const desc = errorDescription
        ? decodeURIComponent(errorDescription.replace(/\+/g, " "))
        : "認証に失敗しました。もう一度お試しください。";
      setError(desc);
    }
  }, [searchParams]);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(
        error.message ||
          "ログインに失敗しました。もう一度お試しください。"
      );
      return;
    }

    // ログイン成功 → 共通のコールバックへ
    router.replace("/auth/callback");
  };

  const handleSignup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const passwordConfirm = String(formData.get("passwordConfirm") || "");

    if (password !== passwordConfirm) {
      setLoading(false);
      setError("パスワードが一致しません。");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // ✅ メールの認証後は必ず /auth/callback に戻す
        emailRedirectTo: `${SITE_URL}/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      // すでに登録済みのメールアドレスなどを少し優しく案内
      if (error.message?.toLowerCase().includes("already registered")) {
        setError(
          "このメールアドレスはすでに登録されています。ログインからお進みください。"
        );
        setTab("login");
      } else {
        setError(
          error.message ||
            "登録に失敗しました。もう一度お試しください。"
        );
      }
      return;
    }

    // メール確認フラグを見て案内画面へ
    if (data.user && !data.user.confirmed_at) {
      router.push(`/auth/email-sent?email=${encodeURIComponent(email)}`);
    } else {
      // まれに即時確認される場合はそのままコールバックへ
      router.replace("/auth/callback");
    }
  };

  return (
    <>
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-10">
        {/* 左カラム：ブランドエリア */}
        <section className="hidden flex-1 flex-col pr-10 md:flex">
          <div className="mb-10">
            <div className="text-xs font-semibold tracking-[0.25em] text-slate-500">
              ELITE CAREER PLATFORM
            </div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">
              Mentor.AI
            </div>
          </div>

          <h1 className="mb-6 text-3xl font-semibold leading-snug text-slate-900">
            AIと一緒に、
            <br />
            あなた専属の就活戦略を。
          </h1>

          <p className="mb-6 max-w-xl text-sm leading-relaxed text-slate-600">
            ケース・フェルミ・一般面接・ES添削・業界研究を一気通貫でサポート。
            あなたのためのAIキャリアダッシュボードです。
          </p>

          <dl className="mt-4 space-y-3 text-sm text-slate-600">
            <div>
              <dt className="font-medium text-slate-900">ユースケース</dt>
              <dd className="mt-1">
                ・面接練習と即時フィードバック
                <br />
                ・思考力の可視化
                <br />
                ・進捗ダッシュボード
              </dd>
            </div>
          </dl>

          <div className="pointer-events-none mt-12 h-40 w-72 rounded-3xl bg-white/40 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-[30px]" />
        </section>

        {/* 右カラム：認証カード */}
        <section className="flex-1">
          <div className="mx-auto w-full max-w-md rounded-3xl border border-white/40 bg-white/60 p-8 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-[28px]">
            {/* モバイル用ロゴ */}
            <div className="mb-6 flex items-center justify-between md:hidden">
              <div>
                <div className="text-[10px] font-semibold tracking-[0.25em] text-slate-500">
                  ELITE CAREER PLATFORM
                </div>
                <div className="mt-1 text-xl font-semibold text-slate-900">
                  Mentor.AI
                </div>
              </div>
              <span className="rounded-full bg-sky-100 px-3 py-1 text-[11px] font-medium text-sky-700">
                Beta
              </span>
            </div>

            {/* タブ */}
            <div className="flex rounded-full bg-slate-100 p-1 text-xs font-medium text-slate-500">
              <button
                type="button"
                onClick={() => setTab("login")}
                className={`flex-1 rounded-full px-3 py-2 transition ${
                  tab === "login"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "hover:text-slate-800"
                }`}
              >
                ログイン
              </button>
              <button
                type="button"
                onClick={() => setTab("signup")}
                className={`flex-1 rounded-full px-3 py-2 transition ${
                  tab === "signup"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "hover:text-slate-800"
                }`}
              >
                新規登録
              </button>
            </div>

            {/* エラー表示 */}
            {error && (
              <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-2 text-xs text-rose-700">
                {error}
              </p>
            )}

            {/* フォーム本体 */}
            {tab === "login" ? (
              <LoginForm loading={loading} onSubmit={handleLogin} />
            ) : (
              <SignupForm
                loading={loading}
                onSubmit={handleSignup}
                onOpenTerms={() => setShowTerms(true)}
                onOpenPrivacy={() => setShowPrivacy(true)}
              />
            )}
          </div>

          <div className="mx-auto mt-6 max-w-md text-center text-xs text-slate-500">
            はじめての方は{" "}
            <Link
              href="/guide/first-steps"
              className="font-medium text-sky-600 underline-offset-2 hover:underline"
            >
              使い方ガイド
            </Link>{" "}
            からご覧いただけます。
          </div>
        </section>
      </div>

      {/* 利用規約モーダル */}
      {showTerms && (
        <LegalModal
          title="利用規約"
          body={TERMS_TEXT}
          onClose={() => setShowTerms(false)}
          linkHref="/terms"
          linkLabel=""
        />
      )}

      {/* プライバシーポリシー・モーダル */}
      {showPrivacy && (
        <LegalModal
          title="プライバシーポリシー"
          body={PRIVACY_TEXT}
          onClose={() => setShowPrivacy(false)}
          linkHref="/privacy"
          linkLabel=""
        />
      )}
    </>
  );
}

/* ------------------ フォーム用コンポーネント ------------------ */

type AuthFormProps = {
  loading: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
};

type SignupFormProps = AuthFormProps & {
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
};

function LoginForm({ loading, onSubmit }: AuthFormProps) {
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5">
      <div>
        <label className="block text-xs font-medium text-slate-600">
          メールアドレス
        </label>
        <input
          type="email"
          name="email"
          required
          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600">
          パスワード
        </label>
        <input
          type="password"
          name="password"
          required
          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          placeholder="••••••••"
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <div />
        <Link
          href="/auth/reset-password"
          className="text-sky-600 hover:text-sky-700"
        >
          パスワードをお忘れの方
        </Link>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-2 flex w-full items-center justify-center rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "ログイン中..." : "ログイン"}
      </button>

      <p className="pt-2 text-center text-xs text-slate-500">
        アカウントをお持ちでない方は{" "}
        <Link
          href="/auth?mode=signup"
          className="font-medium text-sky-600 hover:text-sky-700"
        >
          新規登録
        </Link>
      </p>
    </form>
  );
}

function SignupForm({
  loading,
  onSubmit,
  onOpenTerms,
  onOpenPrivacy,
}: SignupFormProps) {
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5">
      <div>
        <label className="block text-xs font-medium text-slate-600">
          メールアドレス
        </label>
        <input
          type="email"
          name="email"
          required
          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600">
          パスワード
        </label>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          placeholder="8文字以上"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600">
          パスワード確認
        </label>
        <input
          type="password"
          name="passwordConfirm"
          required
          minLength={8}
          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          placeholder="もう一度入力してください"
        />
      </div>

      <label className="flex items-start gap-2 text-[11px] text-slate-500">
        <input
          type="checkbox"
          required
          className="mt-[3px] h-3 w-3 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
        />
        <span>
          <button
            type="button"
            onClick={onOpenTerms}
            className="font-medium text-sky-600 hover:text-sky-700 underline-offset-2 hover:underline"
          >
            利用規約
          </button>
          と{" "}
          <button
            type="button"
            onClick={onOpenPrivacy}
            className="font-medium text-sky-600 hover:text-sky-700 underline-offset-2 hover:underline"
          >
            プライバシーポリシー
          </button>
          に同意します
        </span>
      </label>

      <button
        type="submit"
        disabled={loading}
        className="mt-2 flex w-full items-center justify-center rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "送信中..." : "アカウントを作成"}
      </button>

      <p className="pt-2 text-center text-xs text-slate-500">
        すでにアカウントをお持ちの方は{" "}
        <Link
          href="/auth"
          className="font-medium text-sky-600 hover:text-sky-700"
        >
          ログイン
        </Link>
      </p>
    </form>
  );
}

/* ------------------ モーダルコンポーネント ------------------ */

type LegalModalProps = {
  title: string;
  body: string;
  onClose: () => void;
  linkHref: string;
  linkLabel: string;
};

function LegalModal({
  title,
  body,
  onClose,
  linkHref,
  linkLabel,
}: LegalModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <p className="mb-3 text-xs text-slate-500">
          {title}の全文です。スクロールして内容をご確認いただけます。
        </p>

        <div className="mb-4 max-h-[60vh] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap">
          {body}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <Link
            href={linkHref}
            target="_blank"
            className="font-medium text-sky-600 hover:text-sky-700 underline-offset-2 hover:underline"
          >
            {linkLabel}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-4 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

// ここは元ファイルにあった定数をそのまま使ってね（長文なので省略していた場合は元のを残してOK）






// ここに送ってくれた原稿をそのままプレーンテキストで入れているよ
declare const TERMS_TEXT:string;`
Mentor.AI 利用規約

本利用規約（以下「本規約」といいます）は、Mentor.AI（以下「当社」といいます）が提供する AI 診断・面接支援サービス（以下「本サービス」といいます）の利用条件を定めるものです。個人ユーザー、企業ユーザー、OEM パートナー、API 利用者その他本サービスを利用するすべての者（以下「ユーザー」といいます）は、本規約に同意したうえで本サービスを利用するものとします。

第1条（適用範囲）
1. 本規約は、本サービスの提供条件および本サービスの利用に関わる当社とユーザーとの一切の関係に適用されます。
2. 当社が別途定めるガイドライン・特約・契約書（以下「個別規約」）は、本規約の一部を構成するものとします。
3. 企業向け・OEM向けに別途契約（API利用契約、ライセンス契約、秘密保持契約等）を締結した場合には、当該契約が本規約に優先します。

第2条（定義）
本規約において使用する主要な用語の定義は以下のとおりとします。
・個人ユーザー：個人として本サービスを利用する者
・企業ユーザー：法人・団体として契約し、従業員向け等に本サービスを利用する者
・OEMパートナー：人事システム等に当社の診断エンジンを組み込む事業者
・API 利用者：当社が提供する API・SDK・プラグインを利用する者
・診断ロジック：当社が提供する16タイプ診断・AI解析・アルゴリズム等の総称

第3条（利用登録）
1. ユーザーは本規約に同意したうえで、当社所定の手続きに従って利用登録を行います。
2. 当社は以下に該当する場合、登録を拒否することがあります。
  (1) 虚偽の情報を申請したとき
  (2) 過去に規約違反があった者
  (3) 反社会的勢力に該当すると当社が判断した場合
  (4) その他当社が不適切と判断した場合

第4条（アカウント管理）
1. アカウント情報は、ユーザー自身の責任で管理するものとします。
2. 企業ユーザーは、従業員アカウントの管理について責任を負うものとします。
3. API キー、プラグインキー等の認証情報は第三者に開示できません。

第5条（サービス内容）
本サービスは次の機能を含む場合があります。
1. AI 思考タイプ診断（16タイプ分類、スコア分析 等）
2. AI 面接支援
3. レポート生成・分析
4. API / SDK / プラグインによる診断エンジン提供
5. 企業向けダッシュボード・分析機能
6. 外部サービスとの連携
7. その他、当社が定める機能

第6条（AI利用に関する特則）
1. 本サービスは OpenAI API（GPT-4.1 含む）等の外部 AI モデルを利用して動作します。
2. 入力されたデータの一部が AI モデル提供会社に送信される場合があります。
3. OpenAI API を利用する場合、送信データはモデルの再学習には利用されません。
4. AI の出力は統計的予測に基づくものであり、正確性・完全性・適合性を保証しません。
5. 本サービスの診断結果は、医学的診断・人格評価・選考合否判断の唯一の根拠とすることを禁止します。
6. 企業ユーザーは、従業員の採用・昇進等に本サービスの結果を唯一の判断基準として用いてはなりません。

第7条（禁止事項）
ユーザーは、法令・公序良俗に反する行為、本サービスの運営を妨げる行為、第三者の権利侵害、リバースエンジニアリング等の行為を行ってはなりません。

第8条（料金と決済）
1. 個人向け有料プランは月額 2,980円（税込）とします（別途プラン設定がある場合は当社サイトに掲載します）。
2. 決済方法は PAY.JP を利用したクレジットカード決済とします。
3. 有料プランは自動更新されます。
4. 途中解約の場合も返金は行われません。

第9条（API・OEM提供の特則）
1. 当社は API / SDK / プラグイン等により診断エンジンを外部システムに提供することがあります。
2. 企業ユーザーおよび OEM パートナーは利用目的を明確にし、当社の許可なく再販売・再配布してはなりません。
3. 診断ロジック・スコア計算方式・プロンプト等の技術情報は当社の知的財産として保護されます。
4. API キー管理はユーザーの責任となります。
5. OEM パートナーは、自システムで表示する画面について当社の表示要件に従うものとします。

第10条（データの取り扱い：企業向け）
1. 当社は企業ユーザーの従業員データを、委託された目的の範囲内で取り扱います。
2. 診断結果の永続保存を必ずしも行わず、契約に基づいて削除・保持の設定が変わる場合があります。
3. OEM 提供の場合、従業員データは OEM 側が管理主体となり、当社は保持しない構成も可能です。
4. 当社は企業との契約に基づき、論理分離によるデータ管理を行います。

第11条（免責事項）
1. 本サービスの提供により生じたいかなる損害についても、当社の責任は過去12ヶ月間に当社が受領した利用料金を上限とします。
2. 当社は、外部 AI モデルの仕様変更・停止に起因する障害について責任を負いません。
3. 本サービスを利用した選考活動・評価業務の結果について、当社は責任を負いません。

第12条（規約の変更）
本規約は、当社の判断により変更されることがあります。

第13条（準拠法・管轄）
日本法を準拠法とし、東京都を管轄する裁判所を第一審の専属管轄裁判所とします。
`;

declare const PRIVACY_TEXT: string; `
Mentor.AI プライバシーポリシー

制定日：2025年11月25日
最終更新日：2025年12月2日

Mentor.AI（以下「当社」といいます）は、当社が提供する AI 診断・面接支援サービス「Mentor.AI」（以下「本サービス」といいます）において取り扱うユーザー情報の保護を最優先とし、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定め、適切な管理・運用を行います。

第1条（適用範囲）
1. 本ポリシーは、本サービスの利用を通じて当社が取得するユーザー情報の取扱い全般に適用されます。
2. 個人ユーザー、企業ユーザー、OEM パートナー、API 利用者、その他本サービスを利用するすべての者に適用されます。
3. 企業契約・OEM 契約・API 契約において別の取り決めがある場合、当該契約が優先されます。

第2条（取得する情報）
当社は、利用形態に応じて以下の情報を取得することがあります。

1. 個人ユーザーから取得する情報
・氏名・ニックネーム
・メールアドレス
・大学名・学部・学年
・志望業界・志望企業等のプロフィール
・診断への回答内容
・AI 面接・ES添削等の入力データ
・利用履歴・ログイン履歴
・端末情報（IPアドレス、ブラウザ情報等）

2. 企業ユーザーから取得する情報
・従業員ID
・従業員のプロファイル情報（企業契約内容による）
・診断回答
・管理者アカウントの操作ログ
※企業側が保持し、当社は業務委託の範囲内で処理する構成も選択可能です。

3. OEMパートナー・API利用者から取得する情報
・APIキー利用状況
・API経由の入力データ（回答内容、テキスト等）
・API呼び出しのログ
・技術的なトラブル時の情報
※個人識別不要の場合は匿名処理した形式で処理します。

第3条（利用目的）
当社は取得した情報を以下の目的のために利用します。
1. 本サービスの提供（診断・AI回答生成・面接支援等）
2. 外部AI（OpenAI API等）を利用して診断・回答生成を行うため
3. 本サービスの改善・品質向上・新機能開発
4. ユーザーサポート・お問い合わせ対応
5. 不正行為・セキュリティ対策
6. 統計データ・匿名加工データの生成
7. サーバー保守や障害対応に必要な範囲での処理
8. 法令または官公庁の要請による対応

第4条（外部 AI モデルの利用について）
1. 本サービスは OpenAI API（GPT-4.1 等）その他の外部 AI モデルを利用して機能を提供します。
2. AIモデルへの入力データは必要最小限とし、機密情報を含まない設計を行います。
3. OpenAI API を利用する場合、OpenAI は API 経由データをモデル再学習に利用しません。
4. 外部 AI モデルの仕様変更・停止により生じた影響について、当社は責任を負いません。

第5条（第三者への提供）
当社は、以下の場合を除き、個人情報を第三者に提供しません。
1. 本人の同意がある場合
2. 法令に基づく場合
3. 人の生命・身体・財産の保護のため必要な場合
4. 事業譲渡・統合に伴う提供
5. 企業との契約で定めた業務委託に必要な範囲での提供
この場合、当社は委託先に対し適切な監督を行います。

第6条（業務委託・OEM 再委託）
1. 当社は、本サービス運営の一部を外部事業者に委託する場合があります（例：サーバー管理、AI API 推論、分析処理、決済業務など）。
2. 人事システムパートナーに組み込む場合、OEM 提供として業務を再委託することがあります。

第7条（データの保存期間）
1. 個人ユーザーのデータは、退会から一定期間経過後に削除します。
2. 企業ユーザーの場合、契約内容に基づき保持期間が決まります。
3. API 利用者のデータはログ目的で一定期間保持し、その後自動削除されます。

第8条（Cookie・アクセス解析）
当社は必要に応じて Cookie を使用します。ユーザーはブラウザ設定で Cookie を拒否できますが、一部機能が利用できない場合があります。

第9条（個人情報の開示・訂正・削除）
ユーザーまたは企業管理者は、当社に対し、保有する個人情報の開示・訂正・利用停止・削除等を請求することができます。

第10条（セキュリティ）
当社は、以下の対策を講じます。
・データの暗号化
・アクセス権限管理
・外部 API 通信の暗号化
・ログの最小化
・不正アクセス対策

第11条（ポリシー変更）
必要に応じて本ポリシーは変更されます。

第12条（お問い合わせ窓口）
Mentor.AI
〒104-0061 東京都中央区銀座一丁目22番11号 銀座大竹ビジデンス2F
support@mentor-ai.net
`;
