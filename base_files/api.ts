/**
 * 서버 호출. 화면에서는 inspectContract() 하나만 쓰면 됩니다.
 *
 * 서버가 아직 없으면 .env 에 EXPO_PUBLIC_USE_MOCK=true 를 두세요.
 * 가짜 결과가 돌아와서 화면 개발을 바로 할 수 있습니다.
 */

import {
  CHECK_LABELS,
  CHECK_ORDER,
  type CheckId,
  type Clause,
  type InspectResult,
  type Verdict,
} from "../types";
import { mockResult } from "../constants/mock";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";
const API_TOKEN = process.env.EXPO_PUBLIC_API_TOKEN ?? "";
const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === "true";

const TIMEOUT_MS = 25000;

/** 에러 종류. 화면은 이 값으로 안내 문구를 고릅니다. (constants/copy.ts) */
export type ApiErrorKind =
  | "network"
  | "timeout"
  | "server"
  | "unreadable"
  | "notContract";

export class ApiError extends Error {
  kind: ApiErrorKind;
  constructor(kind: ApiErrorKind, message?: string) {
    super(message ?? kind);
    this.kind = kind;
  }
}

/* ------------------------------------------------------------------ */
/* 응답 보정                                                            */
/* ------------------------------------------------------------------ */

const VERDICTS: Verdict[] = ["위법소지", "확인필요", "문제없음"];

function toClause(raw: unknown, id: CheckId): Clause {
  const o = (raw ?? {}) as Partial<Clause>;
  const verdict: Verdict =
    o.verdict && VERDICTS.includes(o.verdict) ? o.verdict : "확인필요";

  return {
    id,
    label: o.label || CHECK_LABELS[id],
    verdict,
    original: typeof o.original === "string" ? o.original : "",
    plain:
      typeof o.plain === "string" && o.plain
        ? o.plain
        : "이 항목은 확인하지 못했어요.",
    law: typeof o.law === "string" ? o.law : "",
    scripts: {
      soft: o.scripts?.soft ?? "",
      firm: o.scripts?.firm ?? "",
    },
  };
}

/**
 * 서버가 항목을 빠뜨리거나 순서를 뒤섞어 보내도
 * 항상 8개를 정해진 순서로 맞춰줍니다.
 * 이게 없으면 "8개 중 2개 문제"라는 화면 문구가 거짓이 됩니다.
 */
function normalize(raw: any): InspectResult {
  const incoming: any[] = Array.isArray(raw?.clauses) ? raw.clauses : [];
  const byId = new Map<string, any>();
  incoming.forEach((c) => {
    if (c && typeof c.id === "string") byId.set(c.id, c);
  });

  const clauses = CHECK_ORDER.map((id) => toClause(byId.get(id), id));

  return {
    id: typeof raw?.id === "string" && raw.id ? raw.id : String(Date.now()),
    createdAt:
      typeof raw?.createdAt === "string"
        ? raw.createdAt
        : new Date().toISOString(),
    imagePath: "",
    clauses,
    assumptions: Array.isArray(raw?.assumptions)
      ? raw.assumptions.filter((s: unknown) => typeof s === "string")
      : [],
    basedOn: typeof raw?.basedOn === "string" ? raw.basedOn : "",
    title: typeof raw?.title === "string" ? raw.title : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* 호출                                                                 */
/* ------------------------------------------------------------------ */

/** 계약서 사진(base64)을 보내 판정 결과를 받습니다. */
export async function inspectContract(
  imageBase64: string
): Promise<InspectResult> {
  if (USE_MOCK || !API_URL) {
    await new Promise((r) => setTimeout(r, 2000));
    return mockResult;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/inspect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(API_TOKEN ? { "X-App-Token": API_TOKEN } : {}),
      },
      body: JSON.stringify({ imageBase64 }),
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timer);
    if (e?.name === "AbortError") throw new ApiError("timeout");
    throw new ApiError("network");
  }
  clearTimeout(timer);

  if (res.status === 422) throw new ApiError("unreadable");
  if (res.status === 415) throw new ApiError("notContract");
  if (!res.ok) throw new ApiError("server", `HTTP ${res.status}`);

  let raw: any;
  try {
    raw = await res.json();
  } catch {
    throw new ApiError("server", "응답 형식 오류");
  }

  const result = normalize(raw);

  // 전부 "확인하지 못했어요"면 사실상 인식 실패입니다.
  const allUnknown = result.clauses.every((c) => !c.law && !c.original);
  if (allUnknown) throw new ApiError("unreadable");

  return result;
}

/** 서버가 살아 있는지 확인 (발표 직전 점검용) */
export async function ping(): Promise<boolean> {
  if (!API_URL) return false;
  try {
    const res = await fetch(`${API_URL}/health`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}
