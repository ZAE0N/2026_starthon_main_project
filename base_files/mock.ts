/**
 * 가짜 데이터. 서버가 준비되기 전에 화면을 만들 때 씁니다.
 * .env 에 EXPO_PUBLIC_USE_MOCK=true 를 두면 자동으로 이 데이터가 돌아옵니다.
 */

import type { Clause, InspectResult } from "../types";

const clauses: Clause[] = [
  {
    id: "contractType",
    label: "계약 형태",
    verdict: "문제없음",
    original: "근로계약서",
    plain: "근로계약서가 맞아요. 근로기준법과 최저임금법이 적용돼요.",
    law: "근로기준법 제2조",
    scripts: { soft: "", firm: "" },
  },
  {
    id: "wage",
    label: "시급",
    verdict: "위법소지",
    original: "제3조(임금) 시간급 9,800원으로 한다.",
    plain:
      "2026년 최저임금은 10,320원인데 계약서에는 9,800원으로 적혀 있어요. 최저임금보다 낮게 정한 부분은 효력이 없어요.",
    law: "최저임금법 제6조",
    scripts: {
      soft: "사장님, 제가 잘 몰라서 그런데 시급 부분만 한 번 확인 부탁드려도 될까요?",
      firm: "시급이 최저임금보다 낮게 적혀 있어서요. 수정해 주시면 바로 서명하겠습니다.",
    },
  },
  {
    id: "probation",
    label: "수습 감액",
    verdict: "확인필요",
    original: "수습기간 3개월간 임금의 90%를 지급한다.",
    plain:
      "계약기간이 1년 이상일 때만 수습 감액이 가능해요. 계약기간이 언제부터 언제까지인지 확인해 주세요.",
    law: "최저임금법 제5조 제2항",
    scripts: {
      soft: "계약기간이 어떻게 되는지 여쭤봐도 될까요? 수습 부분이랑 같이 보고 싶어서요.",
      firm: "1년 미만 계약이면 수습 감액이 안 되는 걸로 알고 있어서요. 계약기간 확인 부탁드립니다.",
    },
  },
  {
    id: "hours",
    label: "근로시간",
    verdict: "문제없음",
    original: "주 20시간 (월·수·금 13:00~18:00)",
    plain: "주 40시간을 넘지 않아 문제없어요.",
    law: "근로기준법 제50조",
    scripts: { soft: "", firm: "" },
  },
  {
    id: "break",
    label: "휴게시간",
    verdict: "문제없음",
    original: "4시간 근무 시 30분의 휴게시간을 부여한다.",
    plain: "법에서 정한 기준을 지키고 있어요.",
    law: "근로기준법 제54조",
    scripts: { soft: "", firm: "" },
  },
  {
    id: "weeklyPay",
    label: "주휴수당",
    verdict: "문제없음",
    original: "주휴수당은 별도 지급한다.",
    plain: "주 15시간 이상 일하면 주휴수당을 받을 수 있고, 계약서에 적혀 있어요.",
    law: "근로기준법 제55조",
    scripts: { soft: "", firm: "" },
  },
  {
    id: "penalty",
    label: "위약금 조항",
    verdict: "문제없음",
    original: "",
    plain: "중도 퇴사 시 위약금을 정한 조항이 없어요.",
    law: "근로기준법 제20조",
    scripts: { soft: "", firm: "" },
  },
  {
    id: "required",
    label: "명시 항목",
    verdict: "문제없음",
    original: "",
    plain: "임금, 근로시간, 휴일, 연차 관련 내용이 모두 적혀 있어요.",
    law: "근로기준법 제17조",
    scripts: { soft: "", firm: "" },
  },
];

export const mockResult: InspectResult = {
  id: "mock-1",
  createdAt: "2026-09-11T16:21:00+09:00",
  imagePath: "",
  title: "○○편의점",
  basedOn: "2026-09-11",
  assumptions: [
    "만 18세 이상, 5인 이상 사업장 기준으로 봤어요.",
    "사진에 보이는 내용만 확인했어요. 뒷장이 있다면 따로 확인해 주세요.",
  ],
  clauses,
};

/** 기록함 화면 테스트용 */
export const mockHistory: InspectResult[] = [
  mockResult,
  {
    ...mockResult,
    id: "mock-2",
    title: "△△카페",
    createdAt: "2026-08-02T19:05:00+09:00",
    followUp: "수정됨",
    clauses: clauses.map((c): Clause => ({ ...c, verdict: "문제없음" })),
  },
];
