// lib/careerFitMap.ts

export type ThinkingTypeId =
  | "strategic_copilot"
  | "cognitive_architect"
  | "dialogue_orchestrator"
  | "insight_synthesizer"
  | "task_dispatcher"
  | "system_optimizer"
  | "process_automator"
  | "quality_overseer"
  | "data_diver"
  | "hypothesis_challenger"
  | "pattern_spotter"
  | "scenario_modeler"
  | "empathy_connector"
  | "culture_translator"
  | "resilience_balancer"
  | "learning_explorer";

export type IndustryId =
  | "consulting"
  | "investment_banking"
  | "corporate_planning"
  | "general_trading"
  | "manufacturer"
  | "it_saas"
  | "marketing_ad"
  | "hr"
  | "sales_b2b"
  | "backoffice"
  | "public_sector"
  | "startup";

export type FitSymbol = "◎" | "○" | "△" | "✕";

export const INDUSTRIES: { id: IndustryId; labelJa: string }[] = [
  { id: "consulting", labelJa: "コンサル" },
  { id: "investment_banking", labelJa: "投資銀行・ハイファイナンス" },
  { id: "corporate_planning", labelJa: "経営企画・事業企画" },
  { id: "general_trading", labelJa: "総合商社" },
  { id: "manufacturer", labelJa: "メーカー" },
  { id: "it_saas", labelJa: "IT / SaaS" },
  { id: "marketing_ad", labelJa: "広告・マーケ・PR" },
  { id: "hr", labelJa: "人事・HR" },
  { id: "sales_b2b", labelJa: "法人営業" },
  { id: "backoffice", labelJa: "バックオフィス" },
  { id: "public_sector", labelJa: "官公庁・公共" },
  { id: "startup", labelJa: "スタートアップ / 起業" }
];

// ーーーーーーーーーーーーーーーーーーーーーーー
// ここに16タイプ × 12業界の適性マップ（完全版）
// ーーーーーーーーーーーーーーーーーーーーーーー

export const CAREER_FIT_MAP: Record<
  ThinkingTypeId,
  Record<IndustryId, FitSymbol>
> = {
  strategic_copilot: {
    consulting: "◎",
    investment_banking: "◎",
    corporate_planning: "◎",
    general_trading: "○",
    manufacturer: "○",
    it_saas: "◎",
    marketing_ad: "△",
    hr: "○",
    sales_b2b: "○",
    backoffice: "△",
    public_sector: "○",
    startup: "◎"
  },
  cognitive_architect: {
    consulting: "◎",
    investment_banking: "○",
    corporate_planning: "◎",
    general_trading: "△",
    manufacturer: "○",
    it_saas: "◎",
    marketing_ad: "△",
    hr: "○",
    sales_b2b: "△",
    backoffice: "○",
    public_sector: "○",
    startup: "○"
  },
  dialogue_orchestrator: {
    consulting: "◎",
    investment_banking: "△",
    corporate_planning: "○",
    general_trading: "○",
    manufacturer: "○",
    it_saas: "○",
    marketing_ad: "◎",
    hr: "◎",
    sales_b2b: "◎",
    backoffice: "△",
    public_sector: "○",
    startup: "○"
  },
  insight_synthesizer: {
    consulting: "◎",
    investment_banking: "○",
    corporate_planning: "◎",
    general_trading: "○",
    manufacturer: "○",
    it_saas: "◎",
    marketing_ad: "◎",
    hr: "○",
    sales_b2b: "○",
    backoffice: "△",
    public_sector: "○",
    startup: "◎"
  },
  task_dispatcher: {
    consulting: "○",
    investment_banking: "○",
    corporate_planning: "◎",
    general_trading: "○",
    manufacturer: "◎",
    it_saas: "◎",
    marketing_ad: "○",
    hr: "○",
    sales_b2b: "○",
    backoffice: "◎",
    public_sector: "○",
    startup: "○"
  },
  system_optimizer: {
    consulting: "◎",
    investment_banking: "○",
    corporate_planning: "◎",
    general_trading: "○",
    manufacturer: "◎",
    it_saas: "◎",
    marketing_ad: "○",
    hr: "○",
    sales_b2b: "△",
    backoffice: "◎",
    public_sector: "○",
    startup: "○"
  },
  process_automator: {
    consulting: "○",
    investment_banking: "△",
    corporate_planning: "○",
    general_trading: "△",
    manufacturer: "◎",
    it_saas: "◎",
    marketing_ad: "△",
    hr: "○",
    sales_b2b: "△",
    backoffice: "◎",
    public_sector: "○",
    startup: "○"
  },
  quality_overseer: {
    consulting: "△",
    investment_banking: "○",
    corporate_planning: "○",
    general_trading: "△",
    manufacturer: "◎",
    it_saas: "○",
    marketing_ad: "○",
    hr: "○",
    sales_b2b: "△",
    backoffice: "◎",
    public_sector: "◎",
    startup: "△"
  },
  data_diver: {
    consulting: "◎",
    investment_banking: "◎",
    corporate_planning: "◎",
    general_trading: "○",
    manufacturer: "○",
    it_saas: "◎",
    marketing_ad: "◎",
    hr: "△",
    sales_b2b: "△",
    backoffice: "◎",
    public_sector: "○",
    startup: "○"
  },
  hypothesis_challenger: {
    consulting: "◎",
    investment_banking: "◎",
    corporate_planning: "◎",
    general_trading: "○",
    manufacturer: "○",
    it_saas: "◎",
    marketing_ad: "○",
    hr: "△",
    sales_b2b: "○",
    backoffice: "△",
    public_sector: "○",
    startup: "◎"
  },
  pattern_spotter: {
    consulting: "◎",
    investment_banking: "○",
    corporate_planning: "○",
    general_trading: "○",
    manufacturer: "○",
    it_saas: "○",
    marketing_ad: "◎",
    hr: "○",
    sales_b2b: "◎",
    backoffice: "○",
    public_sector: "○",
    startup: "○"
  },
  scenario_modeler: {
    consulting: "◎",
    investment_banking: "◎",
    corporate_planning: "◎",
    general_trading: "○",
    manufacturer: "○",
    it_saas: "○",
    marketing_ad: "△",
    hr: "○",
    sales_b2b: "△",
    backoffice: "◎",
    public_sector: "◎",
    startup: "○"
  },
  empathy_connector: {
    consulting: "○",
    investment_banking: "△",
    corporate_planning: "○",
    general_trading: "○",
    manufacturer: "○",
    it_saas: "○",
    marketing_ad: "◎",
    hr: "◎",
    sales_b2b: "◎",
    backoffice: "△",
    public_sector: "◎",
    startup: "○"
  },
  culture_translator: {
    consulting: "◎",
    investment_banking: "○",
    corporate_planning: "○",
    general_trading: "◎",
    manufacturer: "○",
    it_saas: "◎",
    marketing_ad: "◎",
    hr: "○",
    sales_b2b: "○",
    backoffice: "△",
    public_sector: "○",
    startup: "◎"
  },
  resilience_balancer: {
    consulting: "○",
    investment_banking: "△",
    corporate_planning: "○",
    general_trading: "○",
    manufacturer: "◎",
    it_saas: "○",
    marketing_ad: "○",
    hr: "○",
    sales_b2b: "○",
    backoffice: "◎",
    public_sector: "◎",
    startup: "○"
  },
  learning_explorer: {
    consulting: "○",
    investment_banking: "○",
    corporate_planning: "○",
    general_trading: "○",
    manufacturer: "○",
    it_saas: "◎",
    marketing_ad: "◎",
    hr: "○",
    sales_b2b: "○",
    backoffice: "△",
    public_sector: "○",
    startup: "◎"
  }
};
