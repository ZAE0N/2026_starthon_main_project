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
 */

import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
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
 * 진행 막대가 끝까지 차는 데 걸리는 시간 (밀리초).
 *
 * 실측으로 서버 판정이 8~9초입니다. 거기에 여유를 둬서 10초로 잡았습니다.
 * 이 값은 연출 길이일 뿐이고, 요청을 끊는 타임아웃은 lib/api.ts 의 45초입니다.
 * 둘을 같게 만들면 조금 느린 응답을 정상인데도 끊어버립니다.
 */
const PROGRESS_MS = 10_000;

/**
 * 단계별 문구. at 은 "이 초가 지나면" 이라는 뜻입니다.
 * PROGRESS_MS 10초에 맞춰 네 단계를 고르게 뒀습니다. 목 모드는 2초에 끝나서
 * 두 번째 단계까지만 보입니다.
 */
const STAGES = [
  { at: 0, label: "잠시만 기다려 주세요" },
  { at: 3, label: "계약서 글자를 읽고 있어요" },
  { at: 6, label: `항목 ${CHECK_ORDER.length}개를 하나씩 확인하고 있어요` },
  { at: 9, label: "결과를 정리하고 있어요" },
];

/**
 * 이 초가 지나면 제목을 바꿉니다. 연출 10초 + 여유 2초.
 * 요청을 끊는 타임아웃은 45초입니다 (lib/api.ts).
 */
const SLOW_AFTER = 12;

/** 정보 카드가 바뀌는 간격 (밀리초). 10초에 세 장이 한 바퀴 돕니다. */
const FACT_INTERVAL = 3300;

export default function Analyzing() {
  const [errorKind, setErrorKind] = useState<ApiErrorKind | null>(null);
  /** 다시 시도할 때 분석을 한 번 더 돌리기 위한 값 */
  const [attempt, setAttempt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [factIndex, setFactIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  /** 진행 막대. 0 → 0.9 로 움직입니다. 아래 useEffect 주석을 보세요 */
  const progress = useRef(new Animated.Value(0)).current;

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

  /*
   * 진행 막대 — 10초에 걸쳐 끊기지 않고 차오릅니다.
   *
   * 0.9(90%)까지만 갑니다. 10초가 지나도 응답이 안 오면 막대가 끝에 붙어
   * 멈춘 것처럼 보이는데, 90% 에서 기다리면 "아직 진행 중" 으로 읽힙니다.
   * 실제로는 8~9초에 결과 화면으로 넘어가서 끝을 볼 일이 거의 없습니다.
   *
   * Easing.out 을 쓰는 이유: 초반이 빠르면 같은 시간도 짧게 느껴집니다.
   * useNativeDriver 는 false 여야 합니다. width 는 네이티브 드라이버로 못 돌립니다.
   * 10초에 한 번 도는 애니메이션이라 성능 문제는 없습니다.
   */
  useEffect(() => {
    if (errorKind) return;

    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 0.9,
      duration: PROGRESS_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    });
    anim.start();

    return () => anim.stop();
  }, [errorKind, attempt, progress]);

  /* 정보 카드 넘기기 */
  useEffect(() => {
    if (errorKind) return;

    const timer = setInterval(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setFactIndex((i) => (i + 1) % FACTS.length);
        Animated.timing(fade, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }).start();
      });
    }, FACT_INTERVAL);

    return () => clearInterval(timer);
  }, [errorKind, attempt, fade]);

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
              fade.setValue(1);
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
  const fact = FACTS[factIndex];

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

        <Animated.View style={[styles.fact, { opacity: fade }]}>
          <Text style={styles.factValue}>{fact.value}</Text>
          <Text style={styles.factText}>{fact.text}</Text>
          <Text style={styles.factLaw}>{fact.law}</Text>
        </Animated.View>

        {/*
          진행 막대. 값은 progress 가 들고 있어서 화면을 다시 그리지 않고 움직입니다.
          읽어주는 기기에는 경과 시간으로 대략의 퍼센트를 알려줍니다.
        */}
        <View
          style={styles.track}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="분석 진행 중"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.min(90, Math.round((elapsed / (PROGRESS_MS / 1000)) * 90)),
          }}
        >
          <Animated.View
            style={[
              styles.fill,
              {
                width: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
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
  fact: {
    marginTop: space.xl,
    paddingHorizontal: space.md,
    alignItems: "center",
  },
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
  track: {
    width: 140,
    height: 4,
    marginTop: space.xl,
    borderRadius: radius.sm,
    backgroundColor: colors.line,
    // 채움이 둥근 모서리 밖으로 새지 않게 합니다
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.sm,
    backgroundColor: colors.mint,
  },

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
