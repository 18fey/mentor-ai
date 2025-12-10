// lib/careerFitMap.ts

// Diagnosis16Type の TypeId と同じIDで揃える
export type ThinkingTypeId =
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
  { id: "startup", labelJa: "スタートアップ / 起業" },
];

// ーーーーーーーーーーーーーーーーーーーーーーー
// 16タイプ × 12業界の適性マップ
// （旧マップを新16タイプに概念的に対応させて移植）
// ーーーーーーーーーーーーーーーーーーーーーーー

export const CAREER_FIT_MAP: Record<
  ThinkingTypeId,
  Record<IndustryId, FitSymbol>
> = {
  // 1. Strategic Co-Pilot（旧 strategic_copilot）
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
    startup: "◎",
  },

  // 2. Cognitive Architect（旧 cognitive_architect）
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
    startup: "○",
  },

  // 3. Adaptive Visionary（旧 insight_synthesizer をベース）
  adaptive_visionary: {
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
    startup: "◎",
  },

  // 4. Precision Operator（旧 quality_overseer をベース）
  precision_operator: {
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
    startup: "△",
  },

  // 5. Intuitive Navigator（旧 pattern_spotter をベース）
  intuitive_navigator: {
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
    startup: "○",
  },

  // 6. Systemic Thinker（旧 resilience_balancer をベース）
  systemic_thinker: {
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
    startup: "○",
  },

  // 7. Creative Divergent（旧 learning_explorer をベース）
  creative_divergent: {
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
    startup: "◎",
  },

  // 8. Delegation Optimizer（旧 task_dispatcher をベース）
  delegation_optimizer: {
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
    startup: "○",
  },

  // 9. Analytical Executor（旧 data_diver をベース）
  analytical_executor: {
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
    startup: "○",
  },

  // 10. Reflective Synthesizer（旧 dialogue_orchestrator をベース）
  reflective_synthesizer: {
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
    startup: "○",
  },

  // 11. Scenario Designer（旧 scenario_modeler をベース）
  scenario_designer: {
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
    startup: "○",
  },

  // 12. Collaborative Strategist（旧 culture_translator をベース）
  collaborative_strategist: {
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
    startup: "◎",
  },

  // 13. Experimental Improver（旧 process_automator をベース）
  experimental_improver: {
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
    startup: "○",
  },

  // 14. Efficiency Engineer（旧 system_optimizer をベース）
  efficiency_engineer: {
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
    startup: "○",
  },

  // 15. Contextual Interpreter（旧 empathy_connector をベース）
  contextual_interpreter: {
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
    startup: "○",
  },

  // 16. Digital Philosopher（旧 hypothesis_challenger をベース）
  digital_philosopher: {
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
    startup: "◎",
  },
};
