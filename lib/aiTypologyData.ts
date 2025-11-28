// lib/aiTypologyData.ts
export type AITypeKey =
  | "strategic_copilot"
  | "deep_dive_analyst"
  | "visionary_architect"
  | "rapid_prototyper"
  | "calm_planner"
  | "people_connector"
  | "risk_checker"
  | "pattern_hunter"
  | "story_teller"
  | "system_tuner"
  | "data_curator"
  | "spark_seeker"
  | "precision_editor"
  | "process_pilot"
  | "bridge_builder"
  | "zen_observer";

export type AITypeDefinition = {
  key: AITypeKey;
  nameJa: string;
  nameEn: string;
  catchphrase: string;
  features: string[];
  aiStyle: string[];
  strengths: string[];
  cautions: string[];
  recommendedPath: string;
};

export const aiTypologyTypes: Record<AITypeKey, AITypeDefinition> = {
  strategic_copilot: {
    key: "strategic_copilot",
    nameJa: "Strategic Co-Pilot",
    nameEn: "Strategic Co-Pilot",
    catchphrase: "AIを右腕にして、戦略と実行を同時に走らせるタイプ。",
    features: [
      "全体像と数字の両方をバランスよく見る",
      "意思決定の前にAIに複数パターンを出させる",
      "スピードより精度を少しだけ重視する",
    ],
    aiStyle: [
      "意思決定の直前にAIでパターン出し",
      "議事録や要約ではなく「論点整理」にAIを使う",
      "毎日のタスクよりも、週単位の戦略確認で活用",
    ],
    strengths: [
      "経営層・コンサル・IBなど、判断が重い仕事と相性◎",
      "マルチプロジェクトの優先順位付けが得意",
      "AIに丸投げせず、最後の判断は自分で握れる",
    ],
    cautions: [
      "情報を集めすぎて決断が遅くなることがある",
      "AIの提案を検証せずに「それっぽい案」に流されがち",
    ],
    recommendedPath: "まずは毎週の「戦略レビュー」をAIと一緒に回す習慣から。",
  },

  deep_dive_analyst: {
    key: "deep_dive_analyst",
    nameJa: "Deep Dive Analyst",
    nameEn: "Deep Dive Analyst",
    catchphrase: "とことん掘る。AIを使って「分からない」をなくしていく研究者タイプ。",
    features: [
      "細かい前提や条件が気になる",
      "根拠のない話には納得しづらい",
      "データや一次情報を好む",
    ],
    aiStyle: [
      "調査の叩き台づくりにAIを使う",
      "論点ごとに賛成・反対意見を整理させる",
    ],
    strengths: [
      "リサーチ・投資分析・戦略立案などに強み",
      "AIのアウトプットを「鵜呑みにしない」健全な距離感",
    ],
    cautions: [
      "完璧主義になるとアウトプットが遅くなる",
      "考えすぎて行動が止まることがある",
    ],
    recommendedPath: "案件ごとに“調査テンプレ”をAIと作って、使い回すところから。",
  },

  visionary_architect: {
    key: "visionary_architect",
    nameJa: "Visionary Architect",
    nameEn: "Visionary Architect",
    catchphrase: "0→1の骨組みを描き、AIで世界観を具体化していく設計者タイプ。",
    features: [
      "アイデア発想やコンセプト設計が好き",
      "抽象的な話でもイメージで理解できる",
    ],
    aiStyle: [
      "「こういう世界観で」とAIにコンセプトを語る使い方",
      "ワークショップや企画書のドラフト生成に活用",
    ],
    strengths: [
      "新規事業・ブランド・プロダクト企画に強い",
      "人にビジョンを伝えるプレゼンが得意",
    ],
    cautions: ["実行フェーズを飽きやすい", "細かい運用を任されるとストレスになりがち"],
    recommendedPath: "AIと一緒に「ビジョン→ロードマップ→マイルストーン」に分解する練習を。",
  },

  rapid_prototyper: {
    key: "rapid_prototyper",
    nameJa: "Rapid Prototyper",
    nameEn: "Rapid Prototyper",
    catchphrase: "とりあえず形にする。AIと一緒に試作を回しまくる実験タイプ。",
    features: [
      "まず触ってみて学ぶほうが早い",
      "完璧じゃなくても出してから直したい",
    ],
    aiStyle: [
      "資料・コード・LPなどの“0.5枚目”をAIに作らせる",
      "複数パターンを一気に出させて比較する",
    ],
    strengths: [
      "スタートアップ・PdM・クリエイティブ職と相性◎",
      "スピード感のある検証が得意",
    ],
    cautions: [
      "検証設計を雑にすると“なんとなく良さそう”で終わりがち",
      "ナレッジを溜めずに流してしまうことがある",
    ],
    recommendedPath: "毎週1つ「小さなプロトタイプ」をAIと作る習慣をつける。",
  },

  calm_planner: {
    key: "calm_planner",
    nameJa: "Calm Planner",
    nameEn: "Calm Planner",
    catchphrase: "落ち着いて段取りする、静かな司令塔タイプ。",
    features: [
      "タスク分解やスケジュール管理が得意",
      "ゴールから逆算して考えるクセがある",
    ],
    aiStyle: [
      "プロジェクトのWBS（タスク分解）にAIを使う",
      "リスク洗い出しやToDo整理をAIに投げる",
    ],
    strengths: ["PM・コンサル・バックオフィスなどで真価を発揮", "抜け漏れが少ない"],
    cautions: ["スピード重視の場だと慎重さがネックになることも"],
    recommendedPath: "まずは「1案件＝1つのAI用プロジェクトブリーフ」を作成し、都度更新。",
  },

  people_connector: {
    key: "people_connector",
    nameJa: "People Connector",
    nameEn: "People Connector",
    catchphrase: "人と情報をつなぐ、ネットワーカータイプ。",
    features: [
      "人の強みやキャラを覚えている",
      "会話の中でアイデアが湧きやすい",
    ],
    aiStyle: [
      "1on1や面談のアジェンダ作成にAIを使う",
      "議事録要約＋次アクションの抽出をAIに任せる",
    ],
    strengths: ["HR・営業・コミュニティ運営に強い", "人のモチベーションを引き出せる"],
    cautions: ["情報共有が口頭中心だと、ナレッジ化されないまま終わりがち"],
    recommendedPath: "出会いやMTGごとに“メモ＋インサイト”をAIと一緒に整理する癖づけを。",
  },

  risk_checker: {
    key: "risk_checker",
    nameJa: "Risk Checker",
    nameEn: "Risk Checker",
    catchphrase: "最悪パターンを想定する、リスク感度の高いタイプ。",
    features: ["「もし〜だったら？」と考えがち", "契約書やルールを大事にする"],
    aiStyle: [
      "契約・施策のリスク洗い出しにAIを使う",
      "プランB・プランCの案出しを任せる",
    ],
    strengths: ["法務・コンプラ・経営企画などで力を発揮", "守りの戦略構築が得意"],
    cautions: ["攻めの意思決定を止めすぎてしまうことがある"],
    recommendedPath: "“リスクだけでなくリターンも評価する”ためのチェックリストをAIと共作。",
  },

  pattern_hunter: {
    key: "pattern_hunter",
    nameJa: "Pattern Hunter",
    nameEn: "Pattern Hunter",
    catchphrase: "ケースの共通項を見つける、パターン認識タイプ。",
    features: ["成功例・失敗例をコレクションするのが好き", "似た事例をすぐ思い出せる"],
    aiStyle: [
      "過去事例の要約と共通パターン抽出をAIに任せる",
      "新しい案件を、既存パターンにマッピングしてもらう",
    ],
    strengths: ["戦略・マーケ・投資判断などで強い味方", "ナレッジベース構築に向いている"],
    cautions: ["前例に引っ張られすぎて、イノベーションを抑制してしまうことがある"],
    recommendedPath: "自分専用の“ケースファイルDB”をAIと一緒に作るところから。",
  },

  story_teller: {
    key: "story_teller",
    nameJa: "Story Teller",
    nameEn: "Story Teller",
    catchphrase: "ストーリーで伝える、ナラティブ設計タイプ。",
    features: ["プレゼンや資料の“流れ”を考えるのが得意", "言葉選びにこだわりがある"],
    aiStyle: [
      "資料の構成案をAIに複数パターン出させる",
      "メッセージの“トーン違い”を書き分けてもらう",
    ],
    strengths: ["企画・営業・PR・採用ストーリーなどで活躍", "相手の感情を動かせる"],
    cautions: ["ロジックより雰囲気で押し切りがちになることも"],
    recommendedPath: "1つの提案書を“ロジック重視版 / ストーリー重視版”でAIと作り比べる。",
  },

  system_tuner: {
    key: "system_tuner",
    nameJa: "System Tuner",
    nameEn: "System Tuner",
    catchphrase: "既存システムを調整して、静かに改善し続ける職人タイプ。",
    features: ["運用・フロー改善が好き", "バグや違和感にすぐ気づく"],
    aiStyle: [
      "現状フローを書き出して、AIに改善案を出させる",
      "マニュアル・手順書のテンプレ整備にAIを使う",
    ],
    strengths: ["バックオフィス・情シス・オペレーションに強い", "継続改善が得意"],
    cautions: ["変化の大きい新規事業フェーズではストレスを感じやすい"],
    recommendedPath: "自分が触っている業務を“1枚のフローチャート”にしてAIに添削させる。",
  },

  data_curator: {
    key: "data_curator",
    nameJa: "Data Curator",
    nameEn: "Data Curator",
    catchphrase: "情報の“棚”をつくる、データの図書館司書タイプ。",
    features: ["フォルダ分け・タグ付けが好き", "情報ソースをきちんと管理したい"],
    aiStyle: [
      "ノートや議事録をAIで要約してタグを提案させる",
      "定期レポートのテンプレートをAIと設計",
    ],
    strengths: ["リサーチ・ナレッジマネジメント・アナリスト業務に向く"],
    cautions: ["構造化に時間をかけすぎて、実行が遅れることがある"],
    recommendedPath: "まずは“自分だけのリサーチノートフォーマット”をAIと作る。",
  },

  spark_seeker: {
    key: "spark_seeker",
    nameJa: "Spark Seeker",
    nameEn: "Spark Seeker",
    catchphrase: "ひらめきと偶然を大事にする、スパーク探索タイプ。",
    features: [
      "発散ブレストが好き",
      "直感的におもしろいかどうかで判断する",
    ],
    aiStyle: [
      "「めちゃくちゃにアイデア出して」とAIに無茶振りする",
      "全く違う業界の事例を混ぜてインスピレーションを得る",
    ],
    strengths: ["新規企画・コピー・デザインなどに強い", "人をワクワクさせる発想が出やすい"],
    cautions: ["まとまりがなくなり、企画が実行フェーズに乗らないことがある"],
    recommendedPath: "AIブレスト → 現実的な3案に絞るまでをワンセットにする運用を。",
  },

  precision_editor: {
    key: "precision_editor",
    nameJa: "Precision Editor",
    nameEn: "Precision Editor",
    catchphrase: "細部のクオリティにこだわる、仕上げ職人タイプ。",
    features: [
      "誤字脱字・表現の違和感にすぐ気づく",
      "仕上がりの“トーン”を揃えるのが得意",
    ],
    aiStyle: [
      "ドラフトは他の人 or AIに任せて、仕上げに集中",
      "文体・語彙・長さを指定してリライトさせる",
    ],
    strengths: ["編集・ライティング・企画書の最終レビューに強い"],
    cautions: ["いつまでも直したくなり、締切と戦いがち"],
    recommendedPath: "“ここから先は直さないライン”をAIに宣言してからレビューを始める。",
  },

  process_pilot: {
    key: "process_pilot",
    nameJa: "Process Pilot",
    nameEn: "Process Pilot",
    catchphrase: "プロセスを回し続ける、パイロットタイプ。",
    features: [
      "ルーチンを守るのが得意",
      "チェックリストがあると安心する",
    ],
    aiStyle: [
      "ルーチン業務をチェックリスト化し、AIに進捗管理を手伝わせる",
      "定型レポートの自動生成に活用",
    ],
    strengths: ["カスタマーサクセス・運用・コールセンターなどで力を発揮"],
    cautions: ["イレギュラー対応が続くと疲弊しやすい"],
    recommendedPath: "よくあるパターンを“標準フロー＋例外パターン”としてAIに整理させる。",
  },

  bridge_builder: {
    key: "bridge_builder",
    nameJa: "Bridge Builder",
    nameEn: "Bridge Builder",
    catchphrase: "立場の違う人たちをつなぐ、橋渡しタイプ。",
    features: [
      "双方の言い分を翻訳するのが上手い",
      "調整役として頼られがち",
    ],
    aiStyle: [
      "エンジニア向け / ビジネス向けに説明を“翻訳”させる",
      "ステークホルダーごとの懸念点リストをAIに作らせる",
    ],
    strengths: ["PM・BizDev・アライアンスなどに向く"],
    cautions: ["自分の意見を後回しにして疲れてしまうことがある"],
    recommendedPath: "プロジェクトごとに“関係者マップ”をAIと作る癖をつける。",
  },

  zen_observer: {
    key: "zen_observer",
    nameJa: "Zen Observer",
    nameEn: "Zen Observer",
    catchphrase: "一歩引いた視点から、静かに状況を見極めるタイプ。",
    features: [
      "感情に巻き込まれにくい",
      "物事を長期スパンで見るクセがある",
    ],
    aiStyle: [
      "感情的な議論を、AIに一度“要約＋整理”させてから考える",
      "自分の思考ログをAIと一緒に振り返る",
    ],
    strengths: ["経営・投資・研究など、長期視点の仕事に向く"],
    cautions: ["動きが遅い・冷たいと誤解されることがある"],
    recommendedPath: "週1で“思考の棚卸しセッション”をAIと行う習慣づけを。",
  },
};

export type AIQuestionOption = {
  id: string;
  label: string;
  typeKey: AITypeKey;
};

export type AIQuestion = {
  id: string;
  text: string;
  options: AIQuestionOption[];
};

// 10問・4択（各選択肢がどこかのタイプにひも付く）
export const aiTypologyQuestions: AIQuestion[] = [
  {
    id: "q1",
    text: "新しいプロジェクトを任されたとき、最初にどんな動きをしますか？",
    options: [
      {
        id: "q1-a",
        label: "全体像とゴールを整理し、AIに論点を出させる",
        typeKey: "strategic_copilot",
      },
      {
        id: "q1-b",
        label: "過去事例やデータをAIで集めて、徹底的に調べる",
        typeKey: "deep_dive_analyst",
      },
      {
        id: "q1-c",
        label: "まずはコンセプトや世界観をAIとブレストする",
        typeKey: "visionary_architect",
      },
      {
        id: "q1-d",
        label: "とりあえず叩き台（資料やプロトタイプ）をAIで作ってみる",
        typeKey: "rapid_prototyper",
      },
    ],
  },
  {
    id: "q2",
    text: "スケジュールがタイトな時、あなたの動きに一番近いのは？",
    options: [
      {
        id: "q2-a",
        label: "段取りを整理し、AIでタスク分解と優先順位を決める",
        typeKey: "calm_planner",
      },
      {
        id: "q2-b",
        label: "関係者を巻き込んで、AIで共有用の資料や議事録を整える",
        typeKey: "people_connector",
      },
      {
        id: "q2-c",
        label: "リスクと制約をAIに洗い出させ、守るべきラインを決める",
        typeKey: "risk_checker",
      },
      {
        id: "q2-d",
        label: "まずは似ているケースをAIに探させ、パターンを真似る",
        typeKey: "pattern_hunter",
      },
    ],
  },
  {
    id: "q3",
    text: "プレゼン資料を作るとき、どこに一番こだわりますか？",
    options: [
      {
        id: "q3-a",
        label: "ストーリーラインやメッセージの流れ",
        typeKey: "story_teller",
      },
      {
        id: "q3-b",
        label: "構成や情報の抜け漏れ、ロジック",
        typeKey: "strategic_copilot",
      },
      {
        id: "q3-c",
        label: "細かい表現・言葉のトーン・見た目の整い方",
        typeKey: "precision_editor",
      },
      {
        id: "q3-d",
        label: "聞き手ごとに説明の仕方を変えること",
        typeKey: "bridge_builder",
      },
    ],
  },
  {
    id: "q4",
    text: "日々の仕事の中で、AIをどう位置づけたいですか？",
    options: [
      {
        id: "q4-a",
        label: "自分の思考を写す“鏡”として使いたい",
        typeKey: "zen_observer",
      },
      {
        id: "q4-b",
        label: "アイデアの火花を増やす相棒にしたい",
        typeKey: "spark_seeker",
      },
      {
        id: "q4-c",
        label: "情報整理とナレッジ蓄積を任せたい",
        typeKey: "data_curator",
      },
      {
        id: "q4-d",
        label: "プロセスや仕組みの改善パートナーにしたい",
        typeKey: "system_tuner",
      },
    ],
  },
  {
    id: "q5",
    text: "チームでよく頼まれる役割に近いのは？",
    options: [
      {
        id: "q5-a",
        label: "みんなの意見をまとめて結論を出す人",
        typeKey: "process_pilot",
      },
      {
        id: "q5-b",
        label: "ビジネス側と現場・技術側の翻訳者",
        typeKey: "bridge_builder",
      },
      {
        id: "q5-c",
        label: "場をあたため、人を巻き込むムードメーカー",
        typeKey: "people_connector",
      },
      {
        id: "q5-d",
        label: "冷静に一歩引いて全体を見ている人",
        typeKey: "zen_observer",
      },
    ],
  },
  {
    id: "q6",
    text: "“学び方”として一番しっくりくるのは？",
    options: [
      {
        id: "q6-a",
        label: "事例をたくさん見てパターンを掴む",
        typeKey: "pattern_hunter",
      },
      {
        id: "q6-b",
        label: "まずは自分で手を動かして試してみる",
        typeKey: "rapid_prototyper",
      },
      {
        id: "q6-c",
        label: "じっくり本やレポートを読み込む",
        typeKey: "deep_dive_analyst",
      },
      {
        id: "q6-d",
        label: "人に話しながら・教えながら覚える",
        typeKey: "story_teller",
      },
    ],
  },
  {
    id: "q7",
    text: "AIに一つだけ強くなってほしいことを選ぶなら？",
    options: [
      {
        id: "q7-a",
        label: "戦略や構造の整理",
        typeKey: "visionary_architect",
      },
      {
        id: "q7-b",
        label: "細部のチェックと仕上げ",
        typeKey: "precision_editor",
      },
      {
        id: "q7-c",
        label: "情報の整理・タグ付け・検索性UP",
        typeKey: "data_curator",
      },
      {
        id: "q7-d",
        label: "人間関係やコミュニケーションの設計",
        typeKey: "bridge_builder",
      },
    ],
  },
  {
    id: "q8",
    text: "トラブルが起きたとき、最初にする行動は？",
    options: [
      {
        id: "q8-a",
        label: "状況を俯瞰して、まず落ち着いて全体像を整理する",
        typeKey: "zen_observer",
      },
      {
        id: "q8-b",
        label: "関係者を集めて、事実ベースでヒアリングする",
        typeKey: "calm_planner",
      },
      {
        id: "q8-c",
        label: "最悪パターンを想定し、被害を最小化する",
        typeKey: "risk_checker",
      },
      {
        id: "q8-d",
        label: "とりあえず応急処置を打ちながら情報を集める",
        typeKey: "process_pilot",
      },
    ],
  },
  {
    id: "q9",
    text: "“理想の働き方”に一番近いものは？",
    options: [
      {
        id: "q9-a",
        label: "少人数で、裁量の大きいプロジェクトを回す",
        typeKey: "strategic_copilot",
      },
      {
        id: "q9-b",
        label: "専門性を深めて、分析やリサーチで価値を出す",
        typeKey: "deep_dive_analyst",
      },
      {
        id: "q9-c",
        label: "新しいサービスやブランドを次々と生み出す",
        typeKey: "visionary_architect",
      },
      {
        id: "q9-d",
        label: "多様な人と関わりながら、橋渡し役として動く",
        typeKey: "bridge_builder",
      },
    ],
  },
  {
    id: "q10",
    text: "AI時代のキャリアで、一番大事だと思うスタンスは？",
    options: [
      {
        id: "q10-a",
        label: "静かに自分の感性と軸を磨き続けること",
        typeKey: "zen_observer",
      },
      {
        id: "q10-b",
        label: "小さく早く試し続けること",
        typeKey: "rapid_prototyper",
      },
      {
        id: "q10-c",
        label: "人とAIの“いい分業”を設計すること",
        typeKey: "system_tuner",
      },
      {
        id: "q10-d",
        label: "人とのつながりと物語を紡ぎ続けること",
        typeKey: "story_teller",
      },
    ],
  },
];

// 回答から一番スコアの高いタイプを返す簡易ロジック
export function calculateAIType(resultKeys: AITypeKey[]): AITypeKey {
  const scores: Partial<Record<AITypeKey, number>> = {};
  for (const key of resultKeys) {
    scores[key] = (scores[key] ?? 0) + 1;
  }

  let bestKey: AITypeKey = resultKeys[0] ?? "strategic_copilot";
  let bestScore = -Infinity;

  (Object.keys(scores) as AITypeKey[]).forEach((key) => {
    const score = scores[key] ?? 0;
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  });

  return bestKey;
}
