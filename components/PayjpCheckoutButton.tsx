// components/PayjpCheckoutButton.tsx
"use client";

import React, { useEffect, useState } from "react";

type Props = {
  amount: number;
  label?: string;
};

declare global {
  interface Window {
    onPayjpTokenCreated?: (response: any) => void;
    onPayjpFailed?: (status: number, error: any) => void;
  }
}

export const PayjpCheckoutButton: React.FC<Props> = ({
  amount,
  label = "カード情報を入力して支払う",
}) => {
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mounted) return;
    setMounted(true);

    // 決済成功時（トークン作成成功時）に呼ばれる
    window.onPayjpTokenCreated = async (response: any) => {
      try {
        setLoading(true);
        const token = response.id;

        const res = await fetch("/api/pay/charge", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token, amount }),
        });

        const text = await res.text();
        let data: any;
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }

        // ★ ここで必ず中身が見えるようにする
        if (!res.ok || !data.ok) {
          console.error("payment error:", {
            status: res.status,
            data,
          });

          alert(
            [
              "決済に失敗しました。",
              "",
              `status: ${res.status}`,
              data.error ? `error: ${data.error}` : "",
              data.message ? `message: ${data.message}` : "",
            ]
              .filter(Boolean)
              .join("\n")
          );

          setLoading(false);
          return;
        }

        console.log("payment success:", data);
        alert("決済が完了しました。ありがとうございます！");
        setLoading(false);
      } catch (e) {
        console.error("payment exception:", e);
        alert("決済処理中にエラーが発生しました。");
        setLoading(false);
      }
    };

    window.onPayjpFailed = (status: number, error: any) => {
      console.error("PAY.JP token failed", status, error);
      alert("カード情報の登録に失敗しました。内容をご確認ください。");
    };

    // PAY.JPのスクリプトを挿入
    if (document.getElementById("payjp-checkout-script")) return;

    const script = document.createElement("script");
    script.id = "payjp-checkout-script";
    script.type = "text/javascript";
    script.src = "https://checkout.pay.jp/";
    script.className = "payjp-button";

    const publicKey = process.env.NEXT_PUBLIC_PAYJP_PUBLIC_KEY;
    if (!publicKey) {
      console.error("NEXT_PUBLIC_PAYJP_PUBLIC_KEY が設定されていません");
    }

    script.setAttribute("data-payjp-key", publicKey || "");
    script.setAttribute("data-payjp-partial", "true");
    script.setAttribute("data-payjp-text", label);
    script.setAttribute("data-payjp-submit-text", "このカードで支払う");
    script.setAttribute("data-payjp-lang", "ja");
    script.setAttribute("data-payjp-on-created", "onPayjpTokenCreated");
    script.setAttribute("data-payjp-on-failed", "onPayjpFailed");

    const container = document.getElementById("payjp-button-wrapper");
    if (container) {
      container.appendChild(script);
    } else {
      console.error("payjp-button-wrapper が見つかりません");
    }
  }, [amount, label, mounted]);

  return (
    <div className="inline-flex flex-col gap-1">
      <div id="payjp-button-wrapper" />
      {loading && (
        <p className="text-[11px] text-slate-500 mt-1">決済処理中です…</p>
      )}
    </div>
  );
};
