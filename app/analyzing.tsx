/**
 * 분석 중 화면. 담당: 나영웅
 *
 * 이 화면이 서버 호출과 저장까지 담당합니다. 흐름은 건드리지 말고
 * 보이는 부분(스피너, 문구, 통계 카드, 진행 막대)만 다듬어 주세요.
 *
 * 에러 화면 만드는 법: 서버가 없어도 .env 에서 에러를 만들어낼 수 있습니다.
 *   EXPO_PUBLIC_MOCK_ERROR=timeout   →  npx expo start -c  (캐시 지우기 필수)
 *   timeout / network / server / unreadable / notContract 다섯 가지
 *
 * 시안 3번과 다르게 만든 곳 (의도된 차이)
 *   - 시안의 "34.8%" 통계는 출처가 아직 확보되지 않았습니다(PROGRESS.md R6).
 *     발표에서 출처를 못 대면 곤란해지는 숫자라, 대신 laws.json 이 근거로 쓰는
 *     법 조문을 돌아가며 보여줍니다. 출처가 확보되면 FACTS 배열에 넣으면 됩니다.
 *   - 항목 개수는 CHECK_ORDER 에서 세서 씁니다. 숫자를 적어두면 항목이 늘거나
 *     줄었을 때 화면 문구가 거짓이 됩니다. (시안의 "7개 항목" 이 그렇게 틀렸습니다)
 *
 * 정보 카드 3장
 *   손으로 좌우로 넘길 수 있습니다. 한 번 넘기면 자동 전환은 멈춥니다.
 *   (읽는 중에 저절로 넘어가면 오히려 불편합니다)
 *   목 모드는 분석이 2초에 끝나서 자동 전환이 한 번도 일어나지 않습니다.
 *   그래서 nextStart 로 화면이 열릴 때마다 다른 카드부터 시작합니다.
 *   자동 전환을 눈으로 보려면 FACT_INTERVAL 을 600 정도로 잠깐 낮추세요.
 */

import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ApiError, inspectContract, type ApiErrorKind } from "../lib/api";
import { getCurrentPhoto, setCurrent } from "../lib/session";
import { saveResult } from "../lib/storage";
import { copy } from "../constants/copy";
import { CHECK_ORDER } from "../types";
import {
  colors,
  font,
  minTouch,
  radius,
  screenPadding,
  space,
  weight,
} from "../constants/theme";

/**
 * 기다리는 동안 보여줄 정보. 시안 3번의 통계 카드 자리입니다.
 * 숫자 하나 + 한 문장 + 근거 조문으로 맞췄습니다. 근거 없는 숫자는 넣지 않습니다.
 */
const FACTS = [
  {
    value: "제17조",
    text: "근로계약서는 일을 시작하기 전에 서면으로 받는 게 원칙이에요",
    law: "근로기준법 제17조",
  },
  {
    value: "30분",
    text: "4시간을 일하면 30분 이상 쉴 수 있어요",
    law: "근로기준법 제54조",
  },
  {
    value: "0원",
    text: "중간에 그만둘 때 내야 하는 위약금은 계약서에 넣을 수 없어요",
    law: "근로기준법 제20조",
  },
];

/**
 * 진행 막대 4칸과 그때 보여줄 문구.
 * at 은 "이 초가 지나면" 이라는 뜻입니다. 목 모드는 2초, 실제 서버는 보통 10~20초입니다.
 */
const STAGES = [
  { at: 0, label: "잠시만 기다려 주세요" },
  { at: 4, label: "계약서 글자를 읽고 있어요" },
  { at: 10, label: `항목 ${CHECK_ORDER.length}개를 하나씩 확인하고 있어요` },
  { at: 18, label: "결과를 정리하고 있어요" },
];

/** 이 초가 지나면 제목을 바꿉니다. 타임아웃은 45초입니다. */
const SLOW_AFTER = 20;

/**
 * 정보 카드가 바뀌는 간격 (밀리초).
 * 한 장을 읽는 데 3초쯤 걸리므로 그보다 조금 길게 잡았습니다.
 */
const FACT_INTERVAL = 3500;

/**
 * 다음에 이 화면이 열릴 때 먼저 보여줄 카드 번호.
 *
 * 분석이 몇 초 만에 끝나면 카드가 한 번도 안 바뀝니다. 그때 항상 같은 카드만
 * 나오면 세 장을 넣은 의미가 없으므로, 화면이 열릴 때마다 다음 카드부터
 * 시작하게 합니다. (앱을 완전히 껐다 켜면 다시 0번부터입니다)
 */
let nextStart = 0;

export default function Analyzing() {
  const [errorKind, setErrorKind] = useState<ApiErrorKind | null>(null);
  /** 다시 시도할 때 분석을 한 번 더 돌리기 위한 값 */
  const [attempt, setAttempt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  /** 지금 보이는 카드의 자리 번호 (0부터, cards 기준) */
  const [factIndex, setFactIndex] = useState(0);
  /** 손으로 한 번 넘겼는지. 넘긴 뒤에는 자동 전환을 멈춥니다 */
  const [manual, setManual] = useState(false);
  /** 카드 한 장의 너비. 화면 폭을 재서 넣습니다 (페이지 단위로 넘기려면 필요) */
  const [cardWidth, setCardWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  /**
   * 이번에 먼저 보여줄 카드.
   * 스크롤 위치를 옮기는 대신 카드 순서를 돌려서 넣습니다. 그러면 항상 맨
   * 왼쪽에서 시작하므로 처음 위치를 맞추는 코드가 필요 없습니다.
   */
  const startIndex = useRef(nextStart).current;
  const cards = FACTS.map((_, k) => FACTS[(startIndex + k) % FACTS.length]);

  /* 다음에 이 화면이 열릴 때는 그다음 카드부터 보이게 해 둡니다 */
  useEffect(() => {
    nextStart = (nextStart + 1) % FACTS.length;
  }, []);

  /* 분석 — 이 흐름은 건드리지 않습니다 */
  useEffect(() => {
    let alive = true;

    (async () => {
      const photo = getCurrentPhoto();
      if (!photo) {
        router.replace("/camera");
        return;
      }

      try {
        const result = await inspectContract(photo.base64);

        // 사진을 폰에 복사하고 경로가 채워진 결과를 돌려받습니다.
        // 이 반환값을 setCurrent 에 넣어야 결과·기록함 화면에 사진이 보입니다.
        const saved = await saveResult(result, photo.uri);

        if (!alive) return;
        setCurrent(saved);
        router.replace("/result");
      } catch (e) {
        if (!alive) return;
        setErrorKind(e instanceof ApiError ? e.kind : "server");
      }
    })();

    return () => {
      alive = false;
    };
  }, [attempt]);

  /* 경과 시간 — 문구와 진행 막대가 이 값을 봅니다 */
  useEffect(() => {
    if (errorKind) return;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [errorKind, attempt]);

  /* 정보 카드 자동 전환 — 손으로 넘긴 뒤에는 멈춥니다 */
  useEffect(() => {
    if (errorKind || manual || cardWidth === 0) return;

    const timer = setTimeout(() => {
      const next = (factIndex + 1) % cards.length;
      setFactIndex(next);
      scrollRef.current?.scrollTo({ x: next * cardWidth, animated: true });
    }, FACT_INTERVAL);

    return () => clearTimeout(timer);
  }, [errorKind, manual, cardWidth, attempt, factIndex, cards.length]);

  /* ---------------------------------------------------------------- */
  /* 에러 화면                                                          */
  /* ---------------------------------------------------------------- */

  if (errorKind) {
    const msg = copy.errors[errorKind];

    // 사진을 새로 받아야 하는 에러와, 같은 사진으로 다시 보내면 되는 에러를
    // 구분합니다. 읽지 못한 사진을 그대로 또 보내면 같은 결과만 나옵니다.
    const needsNewPhoto =
      errorKind === "unreadable" || errorKind === "notContract";

    return (
      <View style={styles.screen}>
        <View style={styles.center}>
          <View
            style={[
              styles.badge,
              needsNewPhoto ? styles.badgeAttention : styles.badgeCalm,
            ]}
            accessible={false}
          >
            <Text
              style={[
                styles.badgeMark,
                needsNewPhoto ? styles.badgeMarkAttention : styles.badgeMarkCalm,
              ]}
            >
              {needsNewPhoto ? "?" : "!"}
            </Text>
          </View>

          <Text style={styles.title}>{msg.title}</Text>
          <Text style={styles.sub}>{msg.body}</Text>
        </View>

        <View style={styles.foot}>
          <Pressable
            style={({ pressed }) => [
              styles.primary,
              pressed && styles.primaryPressed,
            ]}
            onPress={() => {
              if (needsNewPhoto) {
                router.replace("/camera");
                return;
              }
              // 같은 사진으로 다시 보냅니다. 사진은 아직 session 에 있습니다.
              setErrorKind(null);
              setElapsed(0);
              setFactIndex(0);
              setManual(false);
              setAttempt((n) => n + 1);
            }}
            accessibilityRole="button"
            accessibilityLabel={msg.action}
          >
            <Text style={styles.primaryText}>{msg.action}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondary,
              pressed && styles.secondaryPressed,
            ]}
            onPress={() => router.replace(needsNewPhoto ? "/" : "/camera")}
            accessibilityRole="button"
            accessibilityLabel={needsNewPhoto ? "처음으로" : "다시 찍기"}
          >
            <Text style={styles.secondaryText}>
              {needsNewPhoto ? "처음으로" : "다시 찍기"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  /* ---------------------------------------------------------------- */
  /* 분석 중 화면                                                       */
  /* ---------------------------------------------------------------- */

  const slow = elapsed >= SLOW_AFTER;
  const stage = lastPassed(elapsed);

  return (
    <View style={styles.screen}>
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.mint} />

        <Text style={styles.title}>
          {slow ? "조금만 더 걸려요" : "계약서를 읽고 있어요"}
        </Text>
        <Text style={styles.sub}>
          {slow ? "거의 다 됐어요. 화면을 닫지 말고 기다려 주세요." : STAGES[stage].label}
        </Text>

        <View
          style={styles.factArea}
          onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}
        >
          {cardWidth > 0 && (
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScrollBeginDrag={() => setManual(true)}
              onMomentumScrollEnd={(e) => {
                const raw = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
                setFactIndex(Math.min(cards.length - 1, Math.max(0, raw)));
              }}
            >
              {cards.map((f) => (
                <View
                  key={f.law}
                  style={[styles.factPage, { width: cardWidth }]}
                >
                  <Text style={styles.factValue}>{f.value}</Text>
                  <Text style={styles.factText}>{f.text}</Text>
                  <Text style={styles.factLaw}>{f.law}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.dots}>
          {cards.map((f, i) => (
            <View
              key={f.law}
              style={[styles.dot, i === factIndex && styles.dotOn]}
            />
          ))}
        </View>

        <View
          style={styles.bars}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="분석 진행 중"
        >
          {STAGES.map((s, i) => (
            <View
              key={s.at}
              style={[styles.bar, i <= stage && styles.barOn]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

/** 지금까지 지나온 단계 중 마지막 것의 번호 */
function lastPassed(seconds: number): number {
  let index = 0;
  STAGES.forEach((s, i) => {
    if (seconds >= s.at) index = i;
  });
  return index;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: screenPadding,
    justifyContent: "space-between",
    backgroundColor: colors.bg,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  title: {
    marginTop: space.lg,
    fontSize: font.h2,
    fontWeight: weight.semibold,
    color: colors.navy,
    textAlign: "center",
  },
  sub: {
    marginTop: space.sm,
    fontSize: font.body,
    color: colors.gray,
    textAlign: "center",
    lineHeight: 22,
  },

  /* 기다리는 동안 보여줄 정보 (시안 3번의 통계 카드 자리) */
  factArea: {
    alignSelf: "stretch",
    marginTop: space.xl,
    minHeight: 128,
    justifyContent: "center",
  },
  factPage: {
    paddingHorizontal: space.md,
    alignItems: "center",
    justifyContent: "center",
  },
  dots: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.line,
  },
  dotOn: { backgroundColor: colors.mint },
  factValue: {
    fontSize: font.h1,
    fontWeight: weight.bold,
    color: colors.mintText,
    textAlign: "center",
  },
  factText: {
    marginTop: space.sm,
    fontSize: font.small,
    color: colors.navySoft,
    textAlign: "center",
    lineHeight: 21,
  },
  factLaw: {
    marginTop: space.sm,
    fontSize: font.tiny,
    color: colors.gray,
    textAlign: "center",
  },

  /* 진행 막대 */
  bars: { flexDirection: "row", gap: space.xs, marginTop: space.xl },
  bar: {
    width: 22,
    height: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.line,
  },
  barOn: { backgroundColor: colors.mint },

  /* 에러 표시 */
  badge: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeCalm: { backgroundColor: colors.surface },
  badgeAttention: { backgroundColor: colors.amberBg },
  badgeMark: { fontSize: font.h2, fontWeight: weight.bold },
  badgeMarkCalm: { color: colors.navySoft },
  badgeMarkAttention: { color: colors.amber },

  /* 하단 버튼 */
  foot: { gap: space.sm },
  primary: {
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    minHeight: minTouch,
    paddingVertical: space.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryPressed: { backgroundColor: colors.navyPressed },
  primaryText: {
    color: colors.white,
    fontSize: font.body,
    fontWeight: weight.semibold,
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    minHeight: minTouch,
    paddingVertical: space.md,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryPressed: { backgroundColor: colors.surface },
  secondaryText: {
    color: colors.navy,
    fontSize: font.body,
    fontWeight: weight.semibold,
  },
});
