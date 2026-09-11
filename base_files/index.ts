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

/** 조항 하나의 판정 결과 */
export type Clause = {
  id: CheckId;
  label: string;
  verdict: Verdict;
  /** 계약서에 적혀 있던 내용. 못 찾았으면 빈 문자열 */
  original: string;
  /** 쉬운 말 설명 */
  plain: string;
  /** 근거 조문 (예: "최저임금법 제6조") */
  law: string;
  /** 사장님에게 말할 문장. 문제없음이면 빈 문자열 */
  scripts: {
    soft: string;
    firm: string;
  };
};

/**
 * 사용자가 말 꺼내기를 실제로 했는지.
 * 이 프로젝트의 핵심 지표입니다. 말할 문장 화면에서 한 번 묻습니다.
 */
export type FollowUp = "요청함" | "못함" | "수정됨";

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
  /** 말 꺼내기를 실제로 했는지 */
  followUp?: FollowUp;
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
