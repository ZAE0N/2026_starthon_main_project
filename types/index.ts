/**
 * 화면 간 주고받는 데이터 형식.
 * 임의로 바꾸지 마세요. 변경이 필요하면 팀 채팅에 먼저 올립니다.
 */

/** 판정 결과 3단계 */
export type Verdict = "위법소지" | "확인필요" | "문제없음";

/** 점검 항목 8개 */
export type CheckId =
  | "contractType" // 계약 형태 (근로계약인지, 프리랜서로 위장됐는지)
  | "wage" // 시급
  | "probation" // 수습 감액
  | "hours" // 근로시간
  | "break" // 휴게시간
  | "weeklyPay" // 주휴수당
  | "penalty" // 위약금·손해배상 예정
  | "required"; // 명시 항목 누락

/** 화면에 보여줄 순서. 서버 응답이 이 순서와 달라도 이걸 기준으로 정렬합니다. */
export const CHECK_ORDER: CheckId[] = [
  "contractType",
  "wage",
  "probation",
  "hours",
  "break",
  "weeklyPay",
  "penalty",
  "required",
];

export const CHECK_LABELS: Record<CheckId, string> = {
  contractType: "계약 형태",
  wage: "시급",
  probation: "수습 감액",
  hours: "근로시간",
  break: "휴게시간",
  weeklyPay: "주휴수당",
  penalty: "위약금 조항",
  required: "명시 항목",
};

/**
 * 사진 안에서 이 조항이 적혀 있는 **글자 줄**의 자리.
 * 사진 전체를 1.0 으로 본 비율이고, 왼쪽 위가 (0, 0) 입니다.
 *
 * 형광펜으로 글자 위만 긋는 데 씁니다 (components/MarkedShot.tsx).
 * 왜 네 변을 다 쓰는지는 server/schema.py 의 Mark 주석에 있습니다.
 */
export type Mark = {
  /** 위쪽 (0.0 ~ 1.0) */
  top: number;
  /** 아래쪽 (0.0 ~ 1.0, top 보다 큽니다) */
  bottom: number;
  /** 왼쪽 (0.0 ~ 1.0) */
  left: number;
  /** 오른쪽 (0.0 ~ 1.0, left 보다 큽니다) */
  right: number;
};

/** 조항 하나의 판정 결과 */
export type Clause = {
  id: CheckId;
  label: string;
  verdict: Verdict;
  /** 계약서에 적혀 있던 내용. 못 찾았으면 빈 문자열 */
  original: string;
  /** 쉬운 말 설명 */
  plain: string;
  /** 근거 조문 번호 (예: "최저임금법 제6조") */
  law: string;
  /**
   * 근거 조문의 전문. 번호만 보여주면 사용자가 확인할 방법이 없습니다.
   * 서버가 laws.json 에서 그대로 보냅니다. AI 가 만든 문장이 아닙니다.
   * 옛 서버는 이 값을 안 보내므로 빈 문자열일 수 있습니다.
   */
  lawText: string;
  /**
   * 사진 속 자리. 계약서에 그 내용이 없으면 null 입니다.
   * 옛 서버는 이 값을 안 보내므로 undefined 일 수 있습니다.
   */
  mark?: Mark | null;
  /** 사장님에게 말할 문장. 문제없음이면 빈 문자열 */
  scripts: {
    soft: string;
    firm: string;
  };
};

/**
 * 사진을 보내기 전에 사용자가 답한 조건. (app/camera.tsx)
 *
 * 답에 따라 적용되는 법이 달라집니다. 예를 들어 야간 가산수당은
 * 상시근로자 5인 이상 사업장에만 적용됩니다.
 * 모르거나 안 골랐으면 null 이고, 그때는 5인 이상·만 18세 이상 기준으로 봅니다.
 * 미성년 기준이 더 엄격해서, 성인인데 그 기준으로 보면 없는 위법을 만들어냅니다.
 *
 * 설계: FEATURE_hidden-conditions-design.md
 */
export type Workplace = {
  /** 상시근로자 수 */
  employeeCount: "under5" | "over5" | null;
  /** 만 18세 미만인지 */
  isMinor: boolean | null;
};

/**
 * "몰랐을 수도 있는 것" 한 덩어리.
 *
 * 판정이 아니라 안내입니다. 결과 화면에서 배지를 붙이지 마세요.
 * 위법소지처럼 보이면 사용자가 그걸 위반으로 믿습니다.
 */
export type Note = {
  /** 어떤 조건 때문에 나온 안내인지 */
  id: string;
  /** 본문. 서버가 3줄 이내로 보냅니다 */
  text: string;
  /** 근거 조문. 없으면 빈 문자열 */
  law: string;
};

/** 계약서 한 장의 검진 결과 */
export type InspectResult = {
  id: string;
  /** ISO 문자열 */
  createdAt: string;
  /** 폰에 저장된 사진 경로. 저장 전이면 빈 문자열 */
  imagePath: string;
  clauses: Clause[];
  /**
   * 판정의 전제. 예: "5인 이상 사업장 기준으로 봤어요",
   * "만 18세 이상 기준이에요". 결과 화면 아래에 그대로 보여줍니다.
   */
  assumptions: string[];
  /** 법 기준 데이터 확인 날짜 (예: "2026-09-11") */
  basedOn: string;
  /** 기록함에 표시할 이름. 사용자가 나중에 붙임 */
  title?: string;
  /** 사진을 보내기 전에 답한 조건. 옛 기록에는 없습니다 */
  workplace?: Workplace;
  /** "몰랐을 수도 있는 것". 해당되는 조건이 없으면 빈 배열 */
  notes?: Note[];
};

/**
 * 사진 한 장. 촬영과 갤러리 모두 이 형태로 돌아옵니다.
 * 만드는 곳은 lib/photo.ts, 화면 사이 전달은 lib/session.ts 입니다.
 */
export type Photo = {
  /** 임시 파일 경로. 저장하려면 lib/storage.ts 의 saveResult 에 넘깁니다. */
  uri: string;
  /** 서버로 보낼 값 */
  base64: string;
};

/* ------------------------------------------------------------------ */
/* 편의 함수                                                            */
/* ------------------------------------------------------------------ */

/** 문제가 있는 조항만 (위법소지 → 확인필요 순) */
export function getIssues(result: InspectResult): Clause[] {
  const rank: Record<Verdict, number> = {
    위법소지: 0,
    확인필요: 1,
    문제없음: 2,
  };
  return result.clauses
    .filter((c) => c.verdict !== "문제없음")
    .sort((a, b) => rank[a.verdict] - rank[b.verdict]);
}

/**
 * 사진에 표시할 조항. 문제가 있고 자리를 아는 것만 골라 위에서 아래 순으로 줍니다.
 *
 * 화면 순서(위법소지 먼저)가 아니라 사진에 적힌 순서로 정렬합니다.
 * 띠를 위에서부터 읽어야 계약서를 눈으로 따라갈 수 있습니다.
 */
export function getMarked(result: InspectResult): Clause[] {
  return result.clauses
    .filter((c) => c.verdict !== "문제없음" && c.mark != null)
    .sort((a, b) => (a.mark as Mark).top - (b.mark as Mark).top);
}

/** 문제없는 조항만 */
export function getOk(result: InspectResult): Clause[] {
  return result.clauses.filter((c) => c.verdict === "문제없음");
}

/** 위법소지 개수 */
export function countIllegal(result: InspectResult): number {
  return result.clauses.filter((c) => c.verdict === "위법소지").length;
}

/** id로 조항 찾기 */
export function findClause(
  result: InspectResult,
  id: string
): Clause | undefined {
  return result.clauses.find((c) => c.id === id);
}
