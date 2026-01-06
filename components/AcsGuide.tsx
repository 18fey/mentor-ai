"use client";

import React, { useMemo, useState } from "react";

type StepKey = "step1" | "step2" | "step3" | "checklist" | "cases";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <span className="text-xs text-slate-500">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function Pill({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // fallback: do nothing
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="text-xs font-semibold text-slate-700">{label}</div>
        <button
          type="button"
          onClick={onCopy}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {copied ? "コピーしました" : "コピー"}
        </button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-3 text-xs leading-relaxed text-slate-800">
        {text}
      </pre>
    </div>
  );
}

function Checklist({
  title,
  items,
  storageKey,
}: {
  title: string;
  items: string[];
  storageKey: string;
}) {
  const initial = useMemo(() => {
    if (typeof window === "undefined") return items.map(() => false);
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return items.map(() => false);
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === items.length) return parsed;
      return items.map(() => false);
    } catch {
      return items.map(() => false);
    }
  }, [items, storageKey]);

  const [checked, setChecked] = useState<boolean[]>(initial);

  function toggle(i: number) {
    const next = checked.map((v, idx) => (idx === i ? !v : v));
    setChecked(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  const done = checked.filter(Boolean).length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">
          {done}/{items.length}
        </div>
      </div>
      <div className="space-y-2">
        {items.map((t, i) => (
          <label
            key={i}
            className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50"
          >
            <input
              type="checkbox"
              checked={checked[i]}
              onChange={() => toggle(i)}
              className="mt-0.5 h-4 w-4"
            />
            <span className="text-sm text-slate-800">{t}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function AcsGuide() {
  const [tab, setTab] = useState<StepKey>("step1");

  const step1Template = `あなたは〇〇の専門家です。
目的は〇〇です。

制約条件：
・〇〇
・〇〇

出力形式：
・〇〇字程度
・〇〇形式`;

  const step2Good = `構造は良いが、前提条件が弱い。
制約をもう一度整理して、前提→結論の流れで修正してください。`;

  const step3Good = `以下はAI案をベースに、人が判断した内容です。
実行時は〇〇に注意が必要です（前提・リスク・例外を明記）。`;

  return (
    <div className="min-h-[calc(100vh-64px)] w-full bg-gradient-to-b from-slate-50 to-white px-4 py-6">
      <div className="mx-auto w-full max-w-4xl">
        {/* Header */}
        <div className="mb-5 rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur">
          <div className="text-xs font-semibold tracking-widest text-sky-600">
            ACS 攻略ガイド
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            AIと仕事を進めるための思考プラクティス
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            ACSはテストではありません。ここは
            <span className="font-semibold text-slate-800">
              「AIと一緒に、どう考えるか」
            </span>
            を練習する場所です。正解よりも「設計→修正→収束」のプロセスが大事です。
          </p>

          {/* Tabs */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Pill active={tab === "step1"} onClick={() => setTab("step1")}>
              Step1：最初の指示（設計）
            </Pill>
            <Pill active={tab === "step2"} onClick={() => setTab("step2")}>
              Step2：対話（修正）
            </Pill>
            <Pill active={tab === "step3"} onClick={() => setTab("step3")}>
              Step3：成果物（収束）
            </Pill>
            <Pill active={tab === "checklist"} onClick={() => setTab("checklist")}>
              チェックリスト
            </Pill>
            <Pill active={tab === "cases"} onClick={() => setTab("cases")}>
              ケース別ミニ攻略
            </Pill>
          </div>
        </div>

        {/* Content */}
        {tab === "step1" && (
          <div className="space-y-4">
            <Section title="Step1 攻略：最初の指示は「3点セット」" defaultOpen>
              <div className="space-y-3 text-sm text-slate-700">
                <p className="rounded-xl border border-slate-200 bg-white p-3">
                  最初のプロンプトでは必ず
                  <span className="font-semibold text-slate-900">①役割 ②制約 ③出力</span>
                  を入れてください。これだけで再現性が上がり、AIが迷いにくくなります。
                </p>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold text-slate-900">① 役割</div>
                    <p className="mt-2 text-sm text-slate-700">
                      AIを何の専門家として動かすかを決める。立場が曖昧だと出力がブレる。
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold text-slate-900">② 制約</div>
                    <p className="mt-2 text-sm text-slate-700">
                      守る条件・やらないことを書く。安全性と再現性が上がる。
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold text-slate-900">③ 出力</div>
                    <p className="mt-2 text-sm text-slate-700">
                      文字数・形式・用途を明示。ゴールが先に決まると収束が早い。
                    </p>
                  </div>
                </div>

                <CopyBlock label="最低限テンプレ（そのままコピペOK）" text={step1Template} />
              </div>
            </Section>

            <Section title="よくある失敗と修正" defaultOpen={false}>
              <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
                <li>目的が曖昧 → 「誰に・いつ・何のために使うか」を1行足す</li>
                <li>制約がない → 「やってはいけないこと」を最低1つ入れる</li>
                <li>出力が自由すぎる → 「箇条書き/200〜300字/結論→理由」のように形を決める</li>
              </ul>
            </Section>
          </div>
        )}

        {tab === "step2" && (
          <div className="space-y-4">
            <Section title="Step2 攻略：対話ログは「一点修正」がコツ" defaultOpen>
              <div className="space-y-3 text-sm text-slate-700">
                <p className="rounded-xl border border-slate-200 bg-white p-3">
                  Step2は<strong>「修正の仕方」</strong>が一番ログに出ます。
                  全部直させず、直す場所を一つに絞って「なぜ直すか」を言葉にしてください。
                </p>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold text-emerald-700">良い例</div>
                    <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{step2Good}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold text-rose-700">NG例</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                      <li>「なんか違う、直して」</li>
                      <li>「全部やり直して」</li>
                      <li>「もっと良くして（基準なし）」</li>
                    </ul>
                  </div>
                </div>

                <CopyBlock
                  label="修正指示の型（コピペ用）"
                  text={`（どこが問題か）：
（なぜ問題か）：
（どう直してほしいか）：
（出力形式の再指定：必要なら）：`}
                />
              </div>
            </Section>

            <Section title="コツ：効率を落とさずに詰める" defaultOpen={false}>
              <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
                <li>「条件を追加」→「構造を固定」→「例外/リスク」の順で詰める</li>
                <li>修正は最大2回まで（それ以上はStep1の設計に戻る）</li>
                <li>指示が長いとブレるので、短文＋箇条書きに寄せる</li>
              </ul>
            </Section>
          </div>
        )}

        {tab === "step3" && (
          <div className="space-y-4">
            <Section title="Step3 攻略：収束できる人の共通点" defaultOpen>
              <div className="space-y-3 text-sm text-slate-700">
                <p className="rounded-xl border border-slate-200 bg-white p-3">
                  最後は<strong>「人としての判断」</strong>が入ると強いです。
                  「AIに任せた範囲」と「人が判断した範囲」を分け、前提・注意点・リスクを入れて収束させます。
                </p>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold text-slate-900">良い締め方例</div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{step3Good}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold text-slate-900">入れると強い要素</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                      <li>前提（何が成立している前提か）</li>
                      <li>注意点（運用/安全/法務）</li>
                      <li>例外（当てはまらないケース）</li>
                      <li>次アクション（何からやるか）</li>
                    </ul>
                  </div>
                </div>

                <CopyBlock
                  label="成果物テンプレ（200〜300字用）"
                  text={`【結論】（一文）
【理由】（2〜3点）
【AIに任せた範囲】（一文）
【人が判断する範囲】（一文）
【注意点/前提】（一文）
【次アクション】（一文）`}
                />
              </div>
            </Section>
          </div>
        )}

        {tab === "checklist" && (
          <div className="grid gap-4 md:grid-cols-3">
            <Checklist
              title="Step1 チェック"
              storageKey="acs_check_step1"
              items={["役割を書いた", "制約を書いた（最低1つ）", "出力形式を決めた（文字数/形式/用途）"]}
            />
            <Checklist
              title="Step2 チェック"
              storageKey="acs_check_step2"
              items={["修正は一点集中", "なぜ直すかを書いた", "必要なら出力形式を再指定した"]}
            />
            <Checklist
              title="Step3 チェック"
              storageKey="acs_check_step3"
              items={["AIに任せた範囲を明記", "人が判断する範囲を明記", "注意点/前提/リスクのどれかを入れた"]}
            />
          </div>
        )}

        {tab === "cases" && (
          <div className="space-y-4">
            <Section title="ケース別ミニ攻略（既存シナリオにそのまま対応）" defaultOpen>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">コンサル（導入/PoC設計）</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    <li>制約を多めに書く（社内データ/期限/人員）</li>
                    <li>「実行可能性」を最優先に明記</li>
                    <li>次アクションを具体（1週間以内のToDo）</li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">金融（リサーチ/メモ）</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    <li>推測と事実を分ける（断定回避）</li>
                    <li>前提とリスク（データ不足）を明記</li>
                    <li>見出し＋箇条書きで構造化</li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">事業開発（仮説→実行）</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    <li>判断軸（KPI/制約）を最初に置く</li>
                    <li>AI案＋人の判断を分ける</li>
                    <li>検証プラン（最小実験）を入れる</li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">バックオフィス（社内運用/規程）</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    <li>守るべき規定・禁止事項を明記</li>
                    <li>「例外」を先に書く（運用事故防止）</li>
                    <li>チェック項目形式にする</li>
                  </ul>
                </div>
              </div>
            </Section>

            <Section title="（おすすめ）タブ冒頭に置く一文" defaultOpen={false}>
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                ここは評価される場所ではありません。AIと一緒に「考え方」を練習する場所です。
              </div>
            </Section>
          </div>
        )}

        {/* Footer note */}
        <div className="mt-6 text-center text-xs text-slate-500">
          v1.0 / ACS攻略ガイド（mentor.ai）
        </div>
      </div>
    </div>
  );
}
