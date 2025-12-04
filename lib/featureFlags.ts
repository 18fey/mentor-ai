// lib/featureFlags.ts

// APP_MODE は "production" / "classroom" / "closed" を想定
// なにも設定されていなければ "production" として扱う
const APP_MODE = process.env.NEXT_PUBLIC_APP_MODE || "production";

export const appMode = APP_MODE as "production" | "classroom" | "closed";

export const isClassroom = appMode === "classroom";
export const isProduction = appMode === "production";
export const isClosed = appMode === "closed";

// 今後ここに機能フラグを増やしていくイメージ
export const features = {
  payment: isProduction, // 決済は本番モードのみ

  // 授業で隠したいページ判定用（必要になったら使う）
  hideServiceOverviewInClassroom: true,
  hidePricingInClassroom: true,
  hideSettingsInClassroom: true,
};
