import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OperationInfo } from "../types/OperationInfo";
import type { OperationVisualState } from "../types/OperationVisualState";
import { isAbortError } from "../utils/isAbortError";

function getOperationTitle(text: string): string {
  if (text.includes("運転を見合わせ")) return "運転見合わせ";
  if (text.includes("折返し運転")) return "折返し運転";
  if (text.includes("運転を再開")) {
    return text.includes("ダイヤが乱れ") ? "運転再開・ダイヤ乱れ" : "運転再開";
  }
  if (text.includes("直通運転を中止")) return "直通運転中止";
  if (text.includes("直通運転を再開")) return "直通運転再開";
  if (text.includes("運休")) {
    const m = text.match(/(メトロ[^\s、。]+号)/);
    return m ? `${m[1]}運休` : "列車運休";
  }
  if (text.includes("一部の列車に遅れ")) return "一部列車遅延";
  if (text.includes("ダイヤが乱れ")) return "ダイヤ乱れ";
  if (text.includes("平常どおり運転")) return "平常運転";
  return "運行情報";
}

function getOperationVisualState(text: string): OperationVisualState {
  if (text.includes("運転を見合わせ")) return "suspended";
  if (text.includes("平常どおり運転")) return "normal";
  if (text.includes("運転を再開") && text.includes("ダイヤが乱れ")) return "delay";

  if (
    text.includes("ダイヤが乱れ") ||
    text.includes("遅れ") ||
    text.includes("運休") ||
    text.includes("折返し運転") ||
    text.includes("直通運転を中止")
  ) {
    return "delay";
  }

  return "normal";
}

function parseOperationInfo(text: string) {
  return {
    title: getOperationTitle(text),
    state: getOperationVisualState(text),
  };
}

export function useOperationInfo() {
  const [operationInfo, setOperationInfo] = useState<OperationInfo | null>(null);
  const [isOperationOpen, setIsOperationOpen] = useState(false);

  const operationAbortRef = useRef<AbortController | null>(null);
  const operationEtagRef = useRef<string | null>(null);

  const fetchOperationInfo = useCallback(
    async (opts?: { preserveOnError?: boolean; bustCache?: boolean }) => {
      operationAbortRef.current?.abort();
      const controller = new AbortController();
      operationAbortRef.current = controller;

      try {
        const OPERATION_URL =
          "https://throbbing-dust-144d.kitaayase-worker.workers.dev";
        const url = opts?.bustCache ? `${OPERATION_URL}?t=${Date.now()}` : OPERATION_URL;

        const res = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
          headers: operationEtagRef.current
            ? {
                "If-None-Match": operationEtagRef.current,
              }
            : undefined,
        });

        if (res.status === 304) return true;
        if (!res.ok) throw new Error("failed to fetch operation info");

        const etag = res.headers.get("etag");
        if (etag) operationEtagRef.current = etag;

        const data: OperationInfo = await res.json();
        setOperationInfo(data);
        return true;
      } catch (e: unknown) {
        if (isAbortError(e)) return false;
        if (!opts?.preserveOnError) setOperationInfo(null);
        return false;
      }
    },
    []
  );

  useEffect(() => {
    fetchOperationInfo();
    return () => operationAbortRef.current?.abort();
  }, [fetchOperationInfo]);

  useEffect(() => {
    if (!operationInfo) return;
    if (getOperationVisualState(operationInfo.text) !== "normal") {
      setIsOperationOpen(true);
    }
  }, [operationInfo]);

  const parsedOperationInfo = useMemo(() => {
    if (!operationInfo) return null;
    return parseOperationInfo(operationInfo.text);
  }, [operationInfo]);

  return {
    operationInfo,
    parsedOperationInfo,
    isOperationOpen,
    setIsOperationOpen,
    fetchOperationInfo,
  };
}
