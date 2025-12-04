"use client";

import React, { useState } from "react";
import { CareerGapSectionMulti } from "@/components/CareerGapSectionMulti";

// ============================
// Mentor.AI 16タイプ診断
// Stage1 : 直感アンケート（10問）
// ============================

type AxisKey = "strategic" | "analytical" | "intuitive" | "creative";

type AxisScore = Record<AxisKey, number>;

type QuestionOption = {
  text: string;
  score: Partial<AxisScore>;
};

type Question = {
  id: number;
  text: string;
  options: QuestionOption[];
};

type TypeId =
  | "strategic_copilot"
  | "cognitive_architect"
  | "adaptive_visionary"
  | "precision_operator"
  | "intuitive_navigator"
  | "systemic_thinker"
  | "creative_divergent"
  | "delegation_optimizer"
  | "analytical_executor"
  | "reflective_synthesizer"
  | "scenario_designer"
  | "collaborative_strategist"
  | "experimental_improver"
  | "efficiency_engineer"
  | "contextual_interpreter"
  | "digital_philosopher";

type TypeProfile = {
  id: TypeId;
  nameEn: string;
  nameJa: string;
  tagLine: string;
  summary: string;
  strengths: string[];
  cautions: string[];
  recommended: string[];
};

// ーーー 直感アンケート10問 ーーー

const QUESTIONS: Question[] = [
  {
    id: 1,
    text: "AIに何か頼むとき、いちばん意識していることは？",
    options: [
      { text: "目的とゴールをまず共有する", score: { strategic: 2 } },
      { text: "ロジックが破綻しないようにする", score: { analytical: 2 } },
      { text: "自分の感覚に合うかどうか", score: { intuitive: 2 } },
      { text: "新しいアイデアが出るかどうか", score: { creative: 2 } },
    ],
  },
  {
    id: 2,
    text: "AIの出力がイマイチだったとき、あなたは？",
    options: [
      {
        text: "原因を分析してプロンプトを修正する",
        score: { analytical: 2, strategic: 1 },
      },
      { text: "とりあえずもう一度、違う角度で聞いてみる", score: { intuitive: 2 } },
      { text: "自分の方で編集してしまう", score: { creative: 2 } },
      { text: "ゴールとのズレを指摘して方向性を戻す", score: { strategic: 2 } },
    ],
  },
  {
    id: 3,
    text: "新しいプロジェクトでAIを使うとしたら、まず何をする？",
    options: [
      { text: "全体の進め方・役割分担を設計する", score: { strategic: 2 } },
      { text: "前提情報・制約条件を整理する", score: { analytical: 2 } },
      { text: "どんなアウトプットが面白いかイメージする", score: { creative: 2 } },
      { text: "まず軽く聞いて感触をつかむ", score: { intuitive: 2 } },
    ],
  },
  {
    id: 4,
    text: "AIへのプロンプトを書くときのクセに近いのは？",
    options: [
      { text: "条件や箇条書きが多くなる", score: { analytical: 2 } },
      {
        text: "比喩やトーンの指定が多い",
        score: { creative: 2, intuitive: 1 },
      },
      { text: "誰が・何のために使うかを強く意識する", score: { strategic: 2 } },
      { text: "その場のノリで書きながら調整する", score: { intuitive: 2 } },
    ],
  },
  {
    id: 5,
    text: "AIとの理想的な関係性にいちばん近いのは？",
    options: [
      { text: "優秀な右腕・コ・パイロット", score: { strategic: 2 } },
      { text: "冷静な分析担当の同僚", score: { analytical: 2 } },
      { text: "アイデア出しをしてくれるクリエイター", score: { creative: 2 } },
      { text: "自分の感覚を支えてくれる相棒", score: { intuitive: 2 } },
    ],
  },
  {
    id: 6,
    text: "資料づくりでAIを使うとしたら、どこに一番力を借りたい？",
    options: [
      { text: "ストーリーラインや構成案", score: { strategic: 2 } },
      { text: "データ整理・ロジックチェック", score: { analytical: 2 } },
      { text: "表現・コピー・ビジュアルの方向性", score: { creative: 2 } },
      { text: "仮説出しや視点の広げ方", score: { intuitive: 2 } },
    ],
  },
  {
    id: 7,
    text: "自分の思考スタイルを一言で言うと？",
    options: [
      {
        text: "全体最適を意識して組み立てる",
        score: { strategic: 2, analytical: 1 },
      },
      { text: "ロジックを積み上げていく", score: { analytical: 2 } },
      { text: "直感で方向性を決めてから詰める", score: { intuitive: 2 } },
      { text: "まず広げてから、あとで整理する", score: { creative: 2 } },
    ],
  },
  {
    id: 8,
    text: "AIの回答に「違うんだよな」と感じたとき、最初にするのは？",
    options: [
      { text: "ズレている前提・条件を特定する", score: { analytical: 2 } },
      { text: "ゴールとの距離感を言語化して伝え直す", score: { strategic: 2 } },
      {
        text: "「もっとこんな雰囲気で」と感覚的に修正する",
        score: { intuitive: 2, creative: 1 },
      },
      {
        text: "一度自分で書き直してから再度AIに渡す",
        score: { creative: 2 },
      },
    ],
  },
  {
    id: 9,
    text: "AI活用でいちばんワクワクする瞬間は？",
    options: [
      {
        text: "自分一人では組めない戦略・構造が見えたとき",
        score: { strategic: 2, analytical: 1 },
      },
      { text: "ロジックや数字が綺麗にそろったとき", score: { analytical: 2 } },
      { text: "想像していなかった切り口が出てきたとき", score: { intuitive: 2 } },
      {
        text: "表現や世界観が一気に立ち上がったとき",
        score: { creative: 2 },
      },
    ],
  },
  {
    id: 10,
    text: "これからAIと付き合っていくうえで、伸ばしたいと思うのは？",
    options: [
      { text: "AIとの役割分担やワークフロー設計", score: { strategic: 2 } },
      { text: "プロンプトの正確さ・再現性", score: { analytical: 2 } },
      { text: "AIとの対話を通じた洞察・直感力", score: { intuitive: 2 } },
      { text: "AIを使った表現・企画の幅", score: { creative: 2 } },
    ],
  },
];

// ーーー 16タイププロファイル ーーー

const TYPE_PROFILES: Record<TypeId, TypeProfile> = {
  strategic_copilot: {
    id: "strategic_copilot",
    nameEn: "Strategic Co-Pilot",
    nameJa: "A：戦略的コ・パイロット型",
    tagLine: "AIを「右腕」にしながら、全体戦略から逆算して動くタイプ。",
    summary:
      "AIを単なるツールではなく、戦略実行のパートナーとして扱えるタイプです。ゴールから逆算し、どこにAIを組み込むかを設計する力に優れています。",
    strengths: [
      "目的・ゴールから逆算してAIの使いどころを決められる",
      "タスクではなく「ワークフロー単位」でAI活用を考えられる",
      "人とAIの役割分担を意識したプロジェクト設計が得意",
    ],
    cautions: [
      "細かいプロンプト設計を「まあいけるだろう」で省略しがち",
      "AIの出力検証を人に任せすぎてしまうリスク",
      "戦略設計に時間を使いすぎて、手を動かすフェーズが遅れやすい",
    ],
    recommended: [
      "具体的なプロンプトテンプレを複数パターン持ち、再現性を高める",
      "AIに任せる部分と最終チェックの基準を明文化しておく",
      "定型業務にもAIを組み込むことで、戦略思考の時間をさらに確保する",
    ],
  },
  cognitive_architect: {
    id: "cognitive_architect",
    nameEn: "Cognitive Architect",
    nameJa: "B：思考構造アーキテクト型",
    tagLine: "情報や論点を構造化し、AIを高度な設計ツールとして使うタイプ。",
    summary:
      "複雑なテーマを分解し、構造として整理する力に優れたタイプです。AIに渡す前の“思考の設計図”を描くのが得意で、戦略・資料作りなどで真価を発揮します。",
    strengths: [
      "論点の整理・構造化が速く、抜け漏れを減らせる",
      "AIに渡す前の前提整理・要件定義が丁寧",
      "長期的な設計やシステム思考に強い",
    ],
    cautions: [
      "構造化に時間をかけすぎて手が止まることがある",
      "細部の表現やトーンに興味が向きにくい",
      "相手の感情や空気感よりも、構造の正しさを優先しがち",
    ],
    recommended: [
      "AIに「たたき台」を先に出させてから、構造を調整する使い方も試す",
      "構造だけでなく“一文の温度感”もAIに相談してみる",
      "チームメンバーとの認識合わせに、AI生成の図解を使ってみる",
    ],
  },
  adaptive_visionary: {
    id: "adaptive_visionary",
    nameEn: "Adaptive Visionary",
    nameJa: "C：適応ビジョナリー型",
    tagLine: "未来の方向性を見据えつつ、AIの特性に合わせて柔軟に舵を切るタイプ。",
    summary:
      "大きなビジョンや方向性を描きながら、その場その場でAIの力を借りて進め方を調整できるタイプです。変化の激しい環境で、AIとともに進路を探るのが得意です。",
    strengths: [
      "ビジョンと現実のバランスをとりながらAI活用を考えられる",
      "新しいツールや機能に対する適応が速い",
      "AIを使った新しい仕事のスタイルを試すのが得意",
    ],
    cautions: [
      "やりたいことが多くなりすぎて、フォーカスがぼやけるリスク",
      "長期運用を見据えた地味な仕組みづくりを後回しにしがち",
      "“ワクワク”を優先しすぎて、細部の詰めが甘くなることがある",
    ],
    recommended: [
      "AI活用の「守り」と「攻め」を分けてロードマップを作る",
      "新しいアイデアは、小さな実験から始めて検証サイクルを回す",
      "VisionをAIに説明し、言語化・整理してもらう習慣をつくる",
    ],
  },
  precision_operator: {
    id: "precision_operator",
    nameEn: "Precision Operator",
    nameJa: "D：精密オペレーター型",
    tagLine: "細部の条件や精度にこだわり、AIの出力品質をコントロールするタイプ。",
    summary:
      "プロンプトの文言や条件設定の“わずかな違い”に敏感で、AIの出力精度を高く保つことに長けたタイプです。高品質が求められる資料や分析で強みを発揮します。",
    strengths: [
      "条件や制約を細かく定義して、精度を高められる",
      "AIの出力の揺れやノイズを抑えた運用ができる",
      "同じクオリティを継続的に再現するのが得意",
    ],
    cautions: [
      "完璧を目指しすぎて作業スピードが落ちることがある",
      "「一旦たたき台でOK」という場面でも詰めすぎてしまう",
      "抽象度の高い発想や大胆な方向転換が苦手になりやすい",
    ],
    recommended: [
      "あえて“ラフに出すプロンプト”用のテンプレも持っておく",
      "スピード重視の場面と精度重視の場面を事前に決めておく",
      "チームに対して、品質基準やチェックポイントをAIで可視化する",
    ],
  },
  intuitive_navigator: {
    id: "intuitive_navigator",
    nameEn: "Intuitive Navigator",
    nameJa: "E：直感ナビゲーター型",
    tagLine: "感覚的な「しっくり感」を大事にしながら、AIと対話して方向を探るタイプ。",
    summary:
      "言語化しきれないニュアンスや“なんとなく違う”という感覚を頼りに、AIとの対話を調整していくタイプです。言葉になりにくいテーマや企画の初期探索で強みを発揮します。",
    strengths: [
      "言語化しづらいイメージや世界観をAIに伝えるのが上手い",
      "AIの出力に対して、微妙なトーンの違いを感じ取れる",
      "準備しすぎず、その場で対話しながら進められる",
    ],
    cautions: [
      "条件や前提を明示せずに“ふわっと”依頼してしまうことがある",
      "同じクオリティを再現するのが難しくなりがち",
      "他の人にプロセスを共有・引き継ぎしづらい",
    ],
    recommended: [
      "直感で「しっくりきた」プロンプトは、必ずメモして資産化する",
      "感覚だけでなく、簡単な条件・目的もセットで書く癖をつける",
      "AIに自分の好みや世界観を学習させるための例文をストックする",
    ],
  },
  systemic_thinker: {
    id: "systemic_thinker",
    nameEn: "Systemic Thinker",
    nameJa: "F：システミックシンカー型",
    tagLine: "個別タスクではなく、仕組み・システムとしてAI活用を考えるタイプ。",
    summary:
      "一つ一つのタスクではなく、全体のフローや組織の動きの中でAIを位置づけて考えるタイプです。業務設計や組織レベルでのAI導入に向いています。",
    strengths: [
      "部分最適ではなく全体最適の視点を持てる",
      "AIを組み込んだ業務フローやルールづくりが得意",
      "長期運用を見据えた設計・ドキュメント化ができる",
    ],
    cautions: [
      "実際に手を動かすフェーズが後回しになりやすい",
      "細かな表現・UIなどには興味が向きにくい",
      "短期の成果を求められる場面では焦りを感じやすい",
    ],
    recommended: [
      "小さなPoC（実証実験）を短期間で回す習慣をつける",
      "業務フロー図や責任分担表をAIに描かせて検討材料にする",
      "人・AI・ツールの役割を“見える化”してチームと共有する",
    ],
  },
  creative_divergent: {
    id: "creative_divergent",
    nameEn: "Creative Divergent",
    nameJa: "G：クリエイティブ・ダイバージェント型",
    tagLine: "発想を広げるための相棒としてAIを使う、企画・表現寄りのタイプ。",
    summary:
      "AIを使って「まだ見たことのない案」や「新しい表現」を次々と出していくタイプです。企画・コピー・デザインなど、クリエイティブな文脈で力を発揮します。",
    strengths: [
      "数多くのアイデア・バリエーションを出すのが得意",
      "表現の雰囲気や世界観に敏感で、AIと遊べる",
      "仮説ベースでどんどん試せるスピード感がある",
    ],
    cautions: [
      "アイデアは豊富でも、絞り込み・実装が後回しになりがち",
      "精度・ロジックよりも感覚を優先しすぎることがある",
      "プロンプトが属人的になりやすく、再現性を持たせにくい",
    ],
    recommended: [
      "出したアイデアを、AIに「評価軸付き」で整理させる",
      "採用されたアウトプットのプロンプトをテンプレ化して管理する",
      "ロジックが必要な部分は、分析寄りのAI指示と組み合わせて使う",
    ],
  },
  delegation_optimizer: {
    id: "delegation_optimizer",
    nameEn: "Delegation Optimizer",
    nameJa: "H：委任オプティマイザー型",
    tagLine: "AIに“何を・どこ까지”任せるかのライン設計が上手いタイプ。",
    summary:
      "AIを部下や外注のように扱い、「任せる領域」と「自分で判断する領域」を切り分けるのが得意なタイプです。マネジメント視点でのAI活用に向いています。",
    strengths: [
      "タスクの分解と、AIへの委任設計が上手い",
      "自分がやるべきコア業務に集中しやすい",
      "AIのアウトプットを前提にしたチーム設計ができる",
    ],
    cautions: [
      "自分自身のスキルアップを後回しにしてしまうリスク",
      "「とりあえずAIに」という丸投げモードになりやすい",
      "AIの前提誤りに気づくための最低限の専門知識が必要",
    ],
    recommended: [
      "AIに丸投げしたタスクの“検収チェックリスト”を作る",
      "AIに任せない領域（判断・責任範囲）を明確に言語化する",
      "自分もプロンプト設計の基礎は押さえておく",
    ],
  },
  analytical_executor: {
    id: "analytical_executor",
    nameEn: "Analytical Executor",
    nameJa: "I：アナリティカル・エグゼキューター型",
    tagLine: "分析と実行をセットで回し、AIをオペレーションに溶け込ませるタイプ。",
    summary:
      "数字・ロジックに強く、AIを使った分析やシミュレーションを好むタイプです。その結果をもとに、具体的なアクションまで落とし込む動きが得意です。",
    strengths: [
      "データやテキストの要約・分析をAIに上手く任せられる",
      "AIを使った仮説検証サイクルを高速で回せる",
      "アウトプットを具体的な施策・行動に変換できる",
    ],
    cautions: [
      "定性的な要素や感情の扱いが後手になりやすい",
      "「正しさ」を重視しすぎてスピードを落とすことがある",
      "全体の物語やビジョンづくりは後回しになりがち",
    ],
    recommended: [
      "分析結果のストーリーテリング部分はAIに提案させてみる",
      "数字だけでなく「ユーザーの声」もAIに整理させる",
      "意思決定プロセスをAIに説明させて、論理の穴をチェックする",
    ],
  },
  reflective_synthesizer: {
    id: "reflective_synthesizer",
    nameEn: "Reflective Synthesizer",
    nameJa: "J：リフレクティブ・シンセサイザー型",
    tagLine: "AIとの対話を通して内省し、複数の視点を統合していくタイプ。",
    summary:
      "AIを“鏡”のように使いながら、自分の考えを深めていくタイプです。対話を通して思考を整理し、異なる視点を統合していくプロセスで力を発揮します。",
    strengths: [
      "自分の思考・経験を言語化するのが得意",
      "AIを通して多様な視点を取り入れられる",
      "感情や価値観を含めた意思決定ができる",
    ],
    cautions: [
      "考え続けてしまい、アウトプットが遅れるリスク",
      "「自分はどうしたいか」より、他者視点を重視しすぎることがある",
      "意思決定の締切がないと、議論を続けてしまいがち",
    ],
    recommended: [
      "内省タイムとは別に「アウトプット締切」をAIと一緒に決める",
      "AIに「あなたの今の前提」を要約させて、思考の癖を可視化する",
      "統合した結論を1枚のスライドにまとめる練習をする",
    ],
  },
  scenario_designer: {
    id: "scenario_designer",
    nameEn: "Scenario Designer",
    nameJa: "K：シナリオ・デザイナー型",
    tagLine: "複数のシナリオを描き、AIにそれぞれの展開を試させるタイプ。",
    summary:
      "「もしこうしたら？」というシナリオを複数描き、それぞれをAIにシミュレーションさせるのが得意なタイプです。意思決定や事業検討の場面で強く機能します。",
    strengths: [
      "複数の未来パターンを並行して検討できる",
      "AIに想定外のパターンを出させる使い方が上手い",
      "リスク・リターンのバランスを冷静に見られる",
    ],
    cautions: [
      "シナリオを考えすぎて、実行が遅れるリスク",
      "一つの選択肢にコミットするのが怖くなることがある",
      "関係者にとっては情報過多に感じられる場合もある",
    ],
    recommended: [
      "シナリオは“3つまで”など上限を決めて検討する",
      "AIに「最終的に推奨する案」を1つ選ばせて、理由も聞く",
      "意思決定後は、「選ばなかったシナリオ」をアーカイブ化する",
    ],
  },
  collaborative_strategist: {
    id: "collaborative_strategist",
    nameEn: "Collaborative Strategist",
    nameJa: "L：コラボレーティブ・ストラテジスト型",
    tagLine: "人とAIの両方を巻き込みながら、戦略を共同で作っていくタイプ。",
    summary:
      "チームメンバーとAIの両方から意見やアイデアを集めて、戦略を組み立てていくタイプです。ファシリテーションや合意形成の場で力を発揮します。",
    strengths: [
      "人の意見とAIの提案をうまく混ぜ合わせられる",
      "会議やディスカッションの前後でAIを活用できる",
      "関係者の視点を踏まえた戦略づくりが得意",
    ],
    cautions: [
      "みんなの意見を取り入れすぎて、方向性がぼやけることがある",
      "AIの提案を“第三者の意見”として押し付けてしまうリスク",
      "1人で決めるべき場面でも、合意を求めすぎることがある",
    ],
    recommended: [
      "会議前にAIに論点整理をさせて、議題を絞る",
      "AIの意見は“選択肢の一つ”として扱う前提を共有する",
      "決めるべきポイントをAIにリストアップさせてから議論する",
    ],
  },
  experimental_improver: {
    id: "experimental_improver",
    nameEn: "Experiment-Driven Improver",
    nameJa: "M：実験ドリブン・インプルーバー型",
    tagLine: "小さな実験をAIと繰り返しながら、改善を積み上げていくタイプ。",
    summary:
      "完璧な計画よりも、小さな試行錯誤を重ねることで前に進むタイプです。AIを使ったABテストや、日々の業務改善などで強みを発揮します。",
    strengths: [
      "まず試す・やってみるのスピードが速い",
      "AIを使った改善サイクルを習慣化しやすい",
      "失敗からの学びを次の実験にすぐ反映できる",
    ],
    cautions: [
      "全体像や長期方針を軽視しがち",
      "KPIや評価軸を決めないまま実験を増やしてしまうことがある",
      "周りからは「何をしているのか分かりにくい」と見える場合も",
    ],
    recommended: [
      "実験の前に「何をもって成功とするか」をAIと一緒に定義する",
      "週1回、実験ログをAIに要約させて振り返る",
      "長期目標とのつながりを定期的に確認する時間をつくる",
    ],
  },
  efficiency_engineer: {
    id: "efficiency_engineer",
    nameEn: "Efficiency Engineer",
    nameJa: "N:エフィシェンシー・エンジニア型",
    tagLine: "業務フローとツールを組み合わせ、効率を最大化するタイプ。",
    summary:
      "AIだけでなく、既存のツールやシステムも含めた業務効率化を考えるタイプです。自動化やテンプレ整備など、“見えにくい生産性向上”に貢献します。",
    strengths: [
      "日々のルーチンを観察し、AIで置き換えられる部分を見つけられる",
      "テンプレやマニュアルをAIと一緒に整備できる",
      "属人化を減らし、チーム全体の生産性向上につなげられる",
    ],
    cautions: [
      "「効率の良さ」が目的化してしまうリスク",
      "余白や遊びの要素を削りすぎてしまうことがある",
      "導入ハードルの高い自動化に手を出しすぎる場合も",
    ],
    recommended: [
      "効率化の前に「何を残したいか（価値）」を言語化する",
      "AIによる自動化は、最初は“半自動”から始める",
      "チームで使うテンプレやスクリプトはAIにドキュメント化させる",
    ],
  },
  contextual_interpreter: {
    id: "contextual_interpreter",
    nameEn: "Contextual Interpreter",
    nameJa: "O:コンテクスチュアル・インタープリター型",
    tagLine: "文脈や背景を読み取りながら、AIの出力を調整するタイプ。",
    summary:
      "相手や状況の文脈を読み、AIの出力をその場にフィットさせるのが得意なタイプです。顧客対応や社内調整、コミュニケーション設計などで真価を発揮します。",
    strengths: [
      "同じ情報でも、相手に合わせた伝え方をAIに指示できる",
      "AIの出力に足りない文脈や前提を補完できる",
      "「この場ではどこまで言うべきか」の線引きを考えられる",
    ],
    cautions: [
      "相手のことを考えすぎて、自己主張が弱くなることがある",
      "AIの出力を調整しすぎて時間がかかるリスク",
      "抽象度の高い議論より、具体的なケース対応に偏りがち",
    ],
    recommended: [
      "よくあるシチュエーションごとに、AI用のコンテクストテンプレを作る",
      "AIに「この人の立場・関心・不安」を整理させてから文章を書かせる",
      "コミュニケーションのパターンをAIに分類・命名させてみる",
    ],
  },
  digital_philosopher: {
    id: "digital_philosopher",
    nameEn: "Digital Philosopher",
    nameJa: "P：デジタル・フィロソファー型",
    tagLine: "AI時代の意思決定や倫理・意味を問い続けるタイプ。",
    summary:
      "AIの使い方そのものや、データ・アルゴリズムの影響について考え続けるタイプです。長期的なリスクや社会的な意味を踏まえた議論で力を発揮します。",
    strengths: [
      "AI活用の前提・影響・倫理面に敏感でいられる",
      "短期的な効率だけでなく、長期的な意味・価値を考えられる",
      "議論の質を高める問いを立てるのが得意",
    ],
    cautions: [
      "実務から離れた抽象論に入りすぎてしまうことがある",
      "スピード重視の現場とはテンポが合わない場合も",
      "「完璧な答え」を探し続けて決めきれないリスク",
    ],
    recommended: [
      "実務チームとペアになり、具体的なプロジェクトにも関わる",
      "AIに“悪影響になりうるケース”をリストアップさせて検討する",
      "問いを立てるだけでなく、「暫定ルール」も一緒に提案する",
    ],
  },
};

// 軸ごとのタイプグループ（主軸ごとに4タイプ）
const AXIS_TYPE_GROUPS: Record<AxisKey, TypeId[]> = {
  strategic: [
    "strategic_copilot",
    "delegation_optimizer",
    "collaborative_strategist",
    "scenario_designer",
  ],
  analytical: [
    "cognitive_architect",
    "precision_operator",
    "analytical_executor",
    "efficiency_engineer",
  ],
  intuitive: [
    "intuitive_navigator",
    "adaptive_visionary",
    "contextual_interpreter",
    "digital_philosopher",
  ],
  creative: [
    "creative_divergent",
    "experimental_improver",
    "reflective_synthesizer",
    "systemic_thinker",
  ],
};

// 初期スコア
const INITIAL_SCORE: AxisScore = {
  strategic: 0,
  analytical: 0,
  intuitive: 0,
  creative: 0,
};

// ーーー メインコンポーネント ーーー

export default function Diagnosis16TypePage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState<AxisScore>(INITIAL_SCORE);
  const [resultId, setResultId] = useState<TypeId | null>(null);
  const [copied, setCopied] = useState(false);

  const totalQuestions = QUESTIONS.length;

  const handleSelect = (option: QuestionOption) => {
    setScore((prev) => ({
      strategic: prev.strategic + (option.score.strategic ?? 0),
      analytical: prev.analytical + (option.score.analytical ?? 0),
      intuitive: prev.intuitive + (option.score.intuitive ?? 0),
      creative: prev.creative + (option.score.creative ?? 0),
    }));

    const next = currentIndex + 1;
    if (next >= totalQuestions) {
      // 診断計算
      const typeId = decideType({
        strategic: score.strategic + (option.score.strategic ?? 0),
        analytical: score.analytical + (option.score.analytical ?? 0),
        intuitive: score.intuitive + (option.score.intuitive ?? 0),
        creative: score.creative + (option.score.creative ?? 0),
      });
      setResultId(typeId);
    } else {
      setCurrentIndex(next);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setScore(INITIAL_SCORE);
    setResultId(null);
    setCopied(false);
  };

  const handleCopyShare = () => {
    if (!resultId) return;
    const profile = TYPE_PROFILES[resultId];
    const url =
      typeof window !== "undefined"
        ? window.location.origin + "/diagnosis-16type"
        : "https://mentor.ai";

    const text = `Mentor.AI 16タイプ診断の結果は「${profile.nameEn}（${profile.nameJa}）」でした🧠✨\nAIとの付き合い方が可視化される診断。\n${url}`;

    if (navigator && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const progress = resultId
    ? 100
    : Math.round(((currentIndex + 1) / totalQuestions) * 100);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-4 py-10">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-500">
          Mentor.AI Typology β
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">
          Mentor.AI 16タイプ診断
        </h1>
        <p className="text-sm text-slate-600">
          直感アンケート10問で、あなたの「AIとの付き合い方」と「思考スタイル」を16タイプにマッピングします。
        </p>
      </header>

      {/* Progress */}
      <section className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            {resultId
              ? "診断完了"
              : `Question ${currentIndex + 1} / ${totalQuestions}`}
          </span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-sky-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </section>

      {!resultId ? (
        <QuestionCard
          question={QUESTIONS[currentIndex]}
          onSelect={handleSelect}
        />
      ) : (
        <ResultSection
          typeId={resultId}
          score={score}
          onRestart={handleRestart}
          onCopyShare={handleCopyShare}
          copied={copied}
        />
      )}
    </main>
  );
}

// ーーー タイプ決定ロジック ーーー

function decideType(axisScore: AxisScore): TypeId {
  // 軸スコアの中で最大のものを主軸とする
  const entries = Object.entries(axisScore) as [AxisKey, number][];
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  const mainAxis = sorted[0][0];
  const mainScore = sorted[0][1];

  // 主軸のスコアから、4タイプのどれかに割り当て（適当なばらけ方でOK）
  const group = AXIS_TYPE_GROUPS[mainAxis];
  const index = mainScore % group.length;

  return group[index];
}

// ーーー サブコンポーネント ーーー

function QuestionCard({
  question,
  onSelect,
}: {
  question: Question;
  onSelect: (option: QuestionOption) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white/80 p-5 shadow-sm shadow-slate-100 backdrop-blur">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">
        質問 {question.id}
      </h2>
      <p className="mb-4 text-sm text-slate-800">{question.text}</p>
      <div className="space-y-2">
        {question.options.map((opt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelect(opt)}
            className="flex w-full items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-left text-sm text-slate-800 shadow-sm hover:border-sky-200 hover:bg-sky-50"
          >
            <span className="mt-0.5 text-[11px] text-slate-400">
              {String.fromCharCode(65 + idx)}.
            </span>
            <span>{opt.text}</span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-slate-400">
        直感で選んでOKです。正解・不正解はありません。
      </p>
    </section>
  );
}

function ResultSection({
  typeId,
  score,
  onRestart,
  onCopyShare,
  copied,
}: {
  typeId: TypeId;
  score: AxisScore;
  onRestart: () => void;
  onCopyShare: () => void;
  copied: boolean;
}) {
  const profile = TYPE_PROFILES[typeId];

  const total =
    score.strategic + score.analytical + score.intuitive + score.creative || 1;

  const pct = (v: number) => Math.round((v / total) * 100);

  return (
    <>
      <section className="rounded-2xl border border-sky-100 bg-white/90 p-6 shadow-sm shadow-sky-100 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-500">
          Result
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">
          {profile.nameEn}
        </h2>
        <p className="text-xs font-medium text-slate-600">{profile.nameJa}</p>
        <p className="mt-3 text-sm text-slate-700">{profile.tagLine}</p>
        <p className="mt-2 text-xs text-slate-600">{profile.summary}</p>

        {/* Axis radar (simple bars) */}
        <div className="mt-5 space-y-2 text-[11px] text-slate-600">
          <p className="font-semibold text-slate-700">あなたの思考バランス</p>
          <AxisBar label="Strategic / 戦略" value={pct(score.strategic)} />
          <AxisBar label="Analytical / 分析" value={pct(score.analytical)} />
          <AxisBar label="Intuitive / 直感" value={pct(score.intuitive)} />
          <AxisBar label="Creative / 創造" value={pct(score.creative)} />
        </div>

        {/* Strengths & Cautions */}
        <div className="mt-5 grid gap-3 text-[11px] md:grid-cols-2">
          <div className="rounded-xl bg-sky-50/80 p-3">
            <p className="text-[11px] font-semibold text-sky-700">
              Strengths / 強み
            </p>
            <ul className="mt-1 list-disc pl-4 text-sky-900">
              {profile.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-rose-50/80 p-3">
            <p className="text-[11px] font-semibold text-rose-700">
              Cautions / 気をつけたいポイント
            </p>
            <ul className="mt-1 list-disc pl-4 text-rose-900">
              {profile.cautions.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Recommended training */}
        <div className="mt-5 rounded-xl bg-slate-50/90 p-3 text-[11px] text-slate-700">
          <p className="text-[11px] font-semibold text-slate-700">
            Next Step / 伸ばすと相性がいい力
          </p>
          <ul className="mt-1 list-disc pl-4">
            {profile.recommended.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>

        {/* Buttons */}
        <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4 text-[11px] md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-[11px] text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            >
              もう一度診断する →
            </button>
            <button
              type="button"
              onClick={onCopyShare}
              className="inline-flex items-center gap-1 rounded-full bg-sky-500 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm shadow-sky-200 hover:bg-sky-600"
            >
              {copied ? "コピーしました ✓" : "診断結果をコピーしてシェア"}
            </button>
          </div>
          <div className="text-[10px] text-slate-400">
            実務でのAI活用を「練習」したい人は、
            <a
              href="/mentor-ai-index"
              className="font-semibold text-sky-600 underline-offset-2 hover:underline"
            >
              Mentor.AI Index（AI思考トレーニング）
            </a>
            へ。
          </div>
        </div>
      </section>

      {/* ▶ 診断タイプ × 志望業界のマッチ・ギャップセクション */}
      <CareerGapSectionMulti
        thinkingTypeId={typeId}
        thinkingTypeNameJa={profile.nameJa}
        thinkingTypeNameEn={profile.nameEn}
        typeSummary={profile.summary}
      />
    </>
  );
}

function AxisBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-[10px] text-slate-400">
          {value}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-sky-500 transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
