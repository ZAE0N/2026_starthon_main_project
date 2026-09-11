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

/**
 * 목 모드에서 일부러 에러를 내고 싶을 때 씁니다. (.env 의 EXPO_PUBLIC_MOCK_ERROR)
 * 에러 화면은 종류마다 안내가 달라서 눈으로 확인하지 않으면 만들 수 없습니다.
 *   EXPO_PUBLIC_MOCK_ERROR=timeout    → "분석이 오래 걸리고 있어요"
 * 값을 바꾼 뒤에는 반드시 npx expo start -c 로 캐시를 지우고 다시 시작하세요.
 */
const MOCK_ERROR = process.env.EXPO_PUBLIC_MOCK_ERROR ?? "";

/**
 * 25초는 짧습니다. 사진 업로드 + 계약서 판독 + 8개 항목 JSON 생성까지 합치면
 * 넘는 경우가 있고, 시연 중에 타임아웃이 뜨면 그걸로 끝입니다.
 */
const TIMEOUT_MS = 45000;

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

/** 에러 이름 문자열이 실제 ApiErrorKind 인지 확인 */
const ERROR_KINDS: ApiErrorKind[] = [
  "network",
  "timeout",
  "server",
  "unreadable",
  "notContract",
];

/**
 * 진행 중인 요청. 버튼을 연타해도 한 번만 보냅니다.
 * 화면에서도 버튼을 비활성화하지만, 한 군데서 더 막아둡니다. (연타 = API 비용)
 */
let inFlight: Promise<InspectResult> | null = null;

/** 계약서 사진(base64)을 보내 판정 결과를 받습니다. */
export function inspectContract(imageBase64: string): Promise<InspectResult> {
  if (inFlight) return inFlight;
  inFlight = run(imageBase64).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function run(imageBase64: string): Promise<InspectResult> {
  if (USE_MOCK || !API_URL) {
    await new Promise((r) => setTimeout(r, 2000));
    if (MOCK_ERROR) {
      const kind = ERROR_KINDS.includes(MOCK_ERROR as ApiErrorKind)
        ? (MOCK_ERROR as ApiErrorKind)
        : "server";
      throw new ApiError(kind, "EXPO_PUBLIC_MOCK_ERROR");
    }
    return { ...mockResult, id: String(Date.now()) };
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

  /**
   * 사실상 인식 실패인지 판단합니다.
   *
   * law 나 original 이 비었다는 것만으로 판단하면 안 됩니다. 서버가 근거 조문을
   * 빠뜨리거나 해당 조항을 못 찾아 인용문이 없을 수 있는데, 그건 판정이 된 것입니다.
   * 8개가 전부 "확인필요" 이면서 인용된 원문이 하나도 없을 때만 못 읽은 것으로 봅니다.
   */
  const nothingRead =
    result.clauses.every((c) => c.verdict === "확인필요") &&
    result.clauses.every((c) => !c.original);
  if (nothingRead) throw new ApiError("unreadable");

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
