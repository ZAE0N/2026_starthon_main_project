/**
 * 서버 호출. 화면에서는 inspectContract() 하나만 쓰면 됩니다.
 *
 * 서버가 아직 없으면 .env 에 EXPO_PUBLIC_USE_MOCK=true 를 두세요.
 * 가짜 결과가 돌아와서 화면 개발을 바로 할 수 있습니다.
 *
 * 목 모드는 이 값을 직접 켰을 때만 돕니다. EXPO_PUBLIC_API_URL 이 비어 있으면
 * 가짜 결과로 넘어가지 않고 에러를 냅니다. (run() 안의 주석을 보세요)
 */

import {
  CHECK_LABELS,
  CHECK_ORDER,
  type CheckId,
  type Clause,
  type InspectResult,
  type Mark,
  type Note,
  type Verdict,
} from "../types";
import { mockResult } from "../constants/mock";
import { getWorkplace } from "./session";

/**
 * 배포된 서버 주소.
 *
 * .env 가 없는 PC 에서도 그냥 돌게 기본값을 둡니다. 팀원이 clone 만 해도
 * 판정이 되는 게 목적입니다. (.env 는 .gitignore 라서 clone 으로 안 따라옵니다)
 *
 * 이 주소는 비밀이 아닙니다. .env.example, PROGRESS.md, server/deploy/DEPLOY.md 에
 * 이미 적혀 있고 저장소는 공개입니다. 숨겨서 얻는 게 없습니다.
 * 토큰은 다릅니다. 그건 커밋하지 않고 .env 에만 둡니다.
 *
 * .env 에 값이 있으면 그 값이 이깁니다. 로컬 서버(127.0.0.1:8003)에 붙일 때 씁니다.
 */
const DEFAULT_API_URL = "https://smpsws.shop/albacheck";
const API_URL =
  (process.env.EXPO_PUBLIC_API_URL ?? "").trim() || DEFAULT_API_URL;
const API_TOKEN = process.env.EXPO_PUBLIC_API_TOKEN ?? "";
const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === "true";

/**
 * 지금 가짜 데이터로 돌고 있는지. 화면에서 개발용 표시를 띄울 때 씁니다.
 *
 * 목 모드는 어떤 계약서를 넣어도 같은 결과를 돌려줍니다. 그걸 모르면
 * "AI가 오판정한다" 로 오해하게 됩니다. 실제로 두 번 그랬습니다.
 * (REVIEW_2026-09-14.md 의 시스템 항목)
 */
export const USING_MOCK = USE_MOCK;

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
    // 옛 서버는 lawText 를 안 보냅니다. 그때는 빈 문자열로 두고 화면에서 숨깁니다.
    lawText: typeof o.lawText === "string" ? o.lawText : "",
    mark: toMark((raw as any)?.mark),
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
/**
 * 서버가 보낸 이유를 꺼냅니다. `{"detail": "..."}` 형태입니다. (server/main.py)
 *
 * 없거나 이상하면 빈 문자열입니다. 그때는 화면이 기본 문구만 씁니다.
 * 200자를 넘으면 버립니다 — 화면에 넣을 한 줄이지 로그가 아닙니다.
 */
async function reason(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const detail = body?.detail;
    if (typeof detail !== "string") return "";
    const text = detail.trim();
    return text.length > 0 && text.length <= 200 ? text : "";
  } catch {
    return "";
  }
}

/** 0 이상 1 이하의 실수인지 */
function ratio(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
}

/**
 * 사진 속 자리. 서버가 이미 다듬어 보내지만 한 번 더 걸러냅니다.
 *
 * 틀린 자리에 형광펜을 그으면 "엉뚱한 곳을 짚었다" 가 되어 판정 전체가
 * 의심받습니다. 애매하면 null 로 두고 아예 안 그립니다.
 *
 * 옛 서버는 이 값을 안 보내고, 세로만 보내던 중간 버전도 있습니다.
 * 둘 다 null 이 되어 표시 없이 결과만 나옵니다.
 */
function toMark(raw: any): Mark | null {
  const { top, bottom, left, right } = raw ?? {};
  if (!ratio(top) || !ratio(bottom) || !ratio(left) || !ratio(right)) return null;
  if (bottom <= top || right <= left) return null;
  return { top, bottom, left, right };
}

/** "몰랐을 수도 있는 것" 한 덩어리. 이상한 값이 와도 화면이 안 깨지게 다듬습니다 */
function toNote(raw: any): Note {
  return {
    id: typeof raw?.id === "string" ? raw.id : "",
    text: typeof raw?.text === "string" ? raw.text : "",
    law: typeof raw?.law === "string" ? raw.law : "",
  };
}

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
    // 서버가 안 보내도 앱이 깨지지 않아야 합니다. 배포 순서가 어긋날 수 있습니다.
    notes: Array.isArray(raw?.notes)
      ? raw.notes.map(toNote).filter((n: Note) => n.text !== "")
      : [],
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
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 2000));
    if (MOCK_ERROR) {
      const kind = ERROR_KINDS.includes(MOCK_ERROR as ApiErrorKind)
        ? (MOCK_ERROR as ApiErrorKind)
        : "server";
      throw new ApiError(kind, "EXPO_PUBLIC_MOCK_ERROR");
    }
    return { ...mockResult, id: String(Date.now()) };
  }

  /**
   * 주소가 비어 있으면 예전에는 목 모드로 넘어갔습니다. 그게 제일 나쁜 동작이었습니다.
   * 앱은 정상으로 보이는데 어떤 계약서를 넣어도 결과가 같아서, 고장났다는 걸
   * 알아차릴 방법이 없습니다. (판정이 안 된다며 반나절을 여기 썼습니다)
   *
   * DEFAULT_API_URL 이 있으므로 지금은 여기까지 오지 않습니다. 그 기본값을
   * 누가 지웠을 때를 대비한 안전장치로 남겨둡니다. 목으로 빠지는 일은 없어야 합니다.
   */
  if (!API_URL) {
    console.error(
      "[albacheck] EXPO_PUBLIC_API_URL 이 비어 있습니다. " +
        ".env 를 저장소 루트에 두고 npx expo start -c 로 다시 시작하세요.",
    );
    throw new ApiError("server", "EXPO_PUBLIC_API_URL 이 비어 있습니다");
  }

  /**
   * 토큰이 비면 헤더를 아예 안 보냅니다. 서버가 토큰을 요구하면 전부 401 이고,
   * 화면에는 "지금은 분석할 수 없어요" 로만 보여 원인을 알 수 없습니다.
   * 서버의 APP_TOKEN 이 비어 있으면 검사를 건너뛰므로 막지는 않고 알리기만 합니다.
   */
  if (!API_TOKEN) {
    console.warn(
      "[albacheck] EXPO_PUBLIC_API_TOKEN 이 비어 있습니다. " +
        "서버가 토큰을 요구하면 모든 요청이 401 로 막힙니다.",
    );
  }

  const workplace = getWorkplace();

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
      body: JSON.stringify({
        imageBase64,
        // 사진 보내기 전에 답한 조건. 안 골랐으면 null 이 그대로 간다.
        // 서버는 null 이면 5인 이상·만 18세 이상 기준으로 보고 전제에 밝힌다.
        employeeCount: workplace.employeeCount,
        isMinor: workplace.isMinor,
      }),
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timer);
    if (e?.name === "AbortError") throw new ApiError("timeout");
    throw new ApiError("network");
  }
  clearTimeout(timer);

  if (res.status === 422) {
    // 서버가 왜 못 읽었는지 알려줍니다. 분석중 화면이 한 줄 더 보여줍니다.
    // 이유를 못 받으면(옛 서버) 기본 문구만 나옵니다.
    throw new ApiError("unreadable", await reason(res));
  }
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

/** 사진 안에서 종이가 차지한 자리. 0~1 비율입니다. (server/paperbox.py) */
export type PaperBox = { x0: number; y0: number; x1: number; y1: number };

/**
 * 촬영 화면의 실시간 안내용. 이 시간(밀리초) 안에 답이 없으면 버립니다.
 *
 * 판정(45초)과 완전히 다른 기준입니다. 2초 뒤에 오는 답은 이미 다른 화면을
 * 가리키고 있어서 쓸 수가 없습니다. 기다리는 것보다 버리고 다음 장을 찍는 게
 * 낫습니다.
 */
const FRAME_TIMEOUT_MS = 2000;

/**
 * findPaper 의 결과.
 *
 * **두 가지 실패를 구분해야 합니다.**
 *   asked: false        → 서버에 못 물었다 (네트워크·타임아웃·목 모드)
 *   asked: true, null   → 서버가 답했고, 종이를 못 찾았다
 *
 * 앞은 "모르겠다" 라서 다른 판단(기울기)으로 넘어가야 하고, 뒤는 "종이가
 * 제대로 안 들어왔다" 라서 네모를 회색으로 둬야 합니다. 둘을 null 하나로
 * 합치면 서버가 종이를 못 찾았는데 기울기만 맞아서 초록이 켜집니다.
 */
export type PaperResult =
  | { asked: true; box: PaperBox | null }
  | { asked: false };

/**
 * 작은 사진을 보내 종이의 자리를 받아옵니다. (lib/frameFit.ts 가 씁니다)
 *
 * **절대 throw 하지 않습니다.** 이건 촬영을 돕는 안내일 뿐이라, 실패했다고
 * 화면에 에러를 띄우면 안 됩니다. 서버가 죽어도 사진은 찍을 수 있어야 합니다.
 *
 * 목 모드에서는 부르지 않습니다. 서버가 없으니 부를 곳도 없습니다.
 */
export async function findPaper(
  imageBase64: string,
): Promise<PaperResult> {
  if (USE_MOCK || !API_URL) return { asked: false };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FRAME_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_URL}/frame`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(API_TOKEN ? { "X-App-Token": API_TOKEN } : {}),
      },
      body: JSON.stringify({ imageBase64 }),
      signal: controller.signal,
    });
    // 401 이나 5xx 는 서버에 못 물은 것으로 봅니다. 토큰이 틀렸는데
    // "종이를 못 찾았다" 로 읽으면 원인을 영원히 못 찾습니다.
    if (!res.ok) return { asked: false };

    const raw = await res.json();
    const b = raw?.box;

    // 서버가 답했지만 종이를 못 찾은 경우입니다. 에러가 아닙니다.
    if (!b || typeof b !== "object") return { asked: true, box: null };

    const { x0, y0, x1, y1 } = b;
    if (!ratio(x0) || !ratio(y0) || !ratio(x1) || !ratio(y1)) {
      return { asked: true, box: null };
    }
    if (x1 <= x0 || y1 <= y0) return { asked: true, box: null };

    return { asked: true, box: { x0, y0, x1, y1 } };
  } catch {
    // 타임아웃·네트워크·형식 오류 전부 여기로 옵니다. 조용히 포기합니다.
    return { asked: false };
  } finally {
    clearTimeout(timer);
  }
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
