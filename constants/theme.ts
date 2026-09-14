/**
 * 디자인 토큰. 색·간격·글자크기는 반드시 여기서 가져다 씁니다.
 * 화면 파일에 #12294D 같은 값을 직접 쓰지 마세요.
 *
 * 수정 권한: 전정현
 */

import type { Verdict } from "../types";

export const colors = {
  // 기본
  navy: "#12294D", // 제목, 본문, 주요 버튼 배경
  navySoft: "#33456B", // 보조 본문
  navyPressed: "#0C1D38", // 버튼 누를 때

  /**
   * 민트는 포인트 색입니다.
   * 흰 배경 위 대비가 낮아서 글자색으로 쓰면 안 됩니다.
   * - mint     : 테두리, 아이콘, 진행바 등 장식
   * - mintText : 민트 계열 글자가 필요할 때 (대비 통과)
   * - mintBg   : 연한 배경
   */
  mint: "#00C2A8",
  mintText: "#00776A",
  mintBg: "#EAFAF7",

  // 판정 3색 (색만으로 구분하지 말고 항상 글자를 같이 씁니다)
  red: "#C6342F",
  redBg: "#FDECEC",
  amber: "#9A6209",
  amberBg: "#FDF3E3",
  green: "#1E7A42",
  greenBg: "#E8F6EE",

  // 무채색
  white: "#FFFFFF",
  bg: "#FFFFFF",
  surface: "#F7F9FC", // 인용구 배경
  line: "#E6E9EF", // 테두리
  gray: "#6B7585", // 보조 텍스트 (대비 통과하도록 조정)
  grayLight: "#C5CCD8", // 아이콘, 화살표
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  full: 999,
} as const;

/**
 * 글자 크기.
 * 화면 높이를 고정값으로 잡지 마세요. 사용자가 시스템 글씨를 키우면 잘립니다.
 */
export const font = {
  /**
   * 통계 숫자처럼 크게 보여줄 때만 씁니다. (랜딩의 "89%" 같은 것)
   * 제목에는 쓰지 마세요. 제목은 h1 입니다.
   */
  display: 36,
  h1: 26,
  h2: 21,
  body: 15,
  small: 13,
  tiny: 11,
} as const;

export const weight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

/** 화면 좌우 기본 여백 */
export const screenPadding = space.lg;

/** 터치 영역 최소 크기 */
export const minTouch = 44;

/**
 * 판정별 색과 표시 문구.
 * 사용: const s = verdictStyle[clause.verdict];
 */
export const verdictStyle: Record<
  Verdict,
  { color: string; bg: string; label: string }
> = {
  위법소지: { color: colors.red, bg: colors.redBg, label: "위법 소지" },
  확인필요: { color: colors.amber, bg: colors.amberBg, label: "확인 필요" },
  문제없음: { color: colors.green, bg: colors.greenBg, label: "문제없음" },
};
