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
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CircleAlert, CircleHelp } from "lucide-react-native";
import { ApiError, inspectContract, type ApiErrorKind } from "../lib/api";
import { getCurrentPhoto, setCurrent } from "../lib/session";
import { saveResult } from "../lib/storage";
import { copy } from "../constants/copy";
import { CHECK_ORDER, getMarked } from "../types";
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
 * 단계마다 바뀌는 안내 문구. at 은 "이 초가 지나면" 이라는 뜻입니다.
 * 전에는 진행 막대 4칸과 짝이었지만, 막대가 하나로 이어진 뒤에는 문구에만 씁니다.
 *
 * 실측으로 서버 판정이 8~9초입니다. 여유를 둬서 10초를 연출 예산으로 잡고
 * 네 단계를 고르게 뒀습니다. 이 값을 늘리면 마지막 단계("결과를 정리하고 있어요")를
 * 사용자가 볼 일이 없어집니다.
 *
 * 여기 적은 초는 연출 길이일 뿐입니다. 요청을 끊는 타임아웃은 lib/api.ts 의
 * 45초이고, 둘을 같게 만들면 조금 느린 응답을 정상인데도 끊어버립니다.
 *
 * 목 모드는 2초에 끝나서 두 번째 단계까지만 보입니다.
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

/**
 * 정보 카드가 바뀌는 간격 (밀리초).
 * 3300 은 넘기기까지 너무 길다는 지적이 있어 2200 으로 줄였습니다.
 * 10초 동안 세 장이 한 바퀴 돌고 조금 더 진행됩니다.
 */
const FACT_INTERVAL = 2200;

/**
 * 진행 막대가 느긋하게 90% 까지 올라가는 데 걸리는 시간 (밀리초).
 * 실측 응답이 8~9초라 대개 85% 쯤에서 판정이 끝납니다.
 */
const SLOW_FILL_MS = 10_000;

/**
 * 90% 이후 97% 까지 아주 느리게 기어가는 구간.
 * 막대가 끝에 붙어 완전히 멈추면 앱이 죽은 것처럼 보입니다.
 */
const CRAWL_MS = 30_000;

/** 판정이 끝나고 100% 로 올리기 전에 두는 여유 (밀리초) */
const HOLD_MS = 1_000;

/** 100% 까지 몰아서 올리는 시간 (밀리초) */
const RUSH_MS = 320;

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
  /** 진행 막대의 채움 비율 (0~1) */
  const progress = useRef(new Animated.Value(0)).current;
  /** 막대 옆에 쓸 퍼센트 (0~100) */
  const [percent, setPercent] = useState(0);

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

  /* 분석 — 서버를 부르고 저장하는 흐름입니다 */
  useEffect(() => {
    let alive = true;
    let hold: ReturnType<typeof setTimeout> | undefined;

    /**
     * 판정이 끝났을 때의 마무리.
     *
     * 1초 쉬고 막대를 100% 까지 몰아서 올린 다음 다음 화면으로 넘깁니다.
     * 90% 까지 느긋하게 차오르던 막대가 끝을 못 보고 사라지면 다 된 것인지
     * 알 수 없습니다. 100% 를 한 번 보여주고 넘기면 기다림이 끝났다는 게 남습니다.
     */
    const finishThen = (go: () => void) => {
      hold = setTimeout(() => {
        if (!alive) return;
        Animated.timing(progress, {
          toValue: 1,
          duration: RUSH_MS,
          easing: Easing.in(Easing.quad),
          useNativeDriver: false, // width 는 네이티브 드라이버로 못 돌립니다
        }).start(({ finished }) => {
          if (alive && finished) go();
        });
      }, HOLD_MS);
    };

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

        /*
         * 표시할 곳이 있으면 채점된 계약서를 한 번 보여주고 결과로 갑니다.
         * 없으면(전부 문제없음, 또는 서버가 위치를 안 보냄) 그 화면은 건너뜁니다.
         * 표시가 하나도 없는 사진을 띄우면 "그래서 뭐" 가 됩니다.
         */
        const next = getMarked(saved).length > 0 ? "/marked" : "/result";

        finishThen(() => {
          setCurrent(saved);
          router.replace(next);
        });
      } catch (e) {
        if (!alive) return;
        const kind = e instanceof ApiError ? e.kind : "server";

        // 계약서가 아님 / 글자를 못 읽음 은 서버가 사진을 보고 답한 것이므로
        // 이것도 판정입니다. 막대를 100% 까지 올린 뒤에 알려줍니다.
        // 연결이 끊긴 경우는 판정이 아니라서 기다리게 할 이유가 없습니다.
        if (kind === "notContract" || kind === "unreadable") {
          finishThen(() => setErrorKind(kind));
          return;
        }

        setErrorKind(kind);
      }
    })();

    return () => {
      alive = false;
      if (hold) clearTimeout(hold);
    };
  }, [attempt, progress]);

  /* 경과 시간 — 단계 문구가 이 값을 봅니다 (막대는 Animated 로 돌립니다) */
  useEffect(() => {
    if (errorKind) return;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [errorKind, attempt]);

  /**
   * 진행 막대 — 판정을 기다리는 동안 느긋하게 차오르는 구간.
   *
   * 90% 까지 10초, 그다음은 97% 까지 아주 느리게 기어갑니다. 두 단계로 나눈 이유는
   * 막대가 끝에 붙어 완전히 멈추면 앱이 죽은 것처럼 보이기 때문입니다.
   * 100% 는 판정이 끝났을 때만 씁니다 (위 finishThen).
   */
  useEffect(() => {
    if (errorKind) return;

    progress.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(progress, {
        toValue: 0.9,
        duration: SLOW_FILL_MS,
        easing: Easing.out(Easing.quad), // 초반이 빠르면 기다림이 짧게 느껴집니다
        useNativeDriver: false,
      }),
      Animated.timing(progress, {
        toValue: 0.97,
        duration: CRAWL_MS,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    ]);

    anim.start();
    return () => anim.stop();
  }, [errorKind, attempt, progress]);

  /**
   * 막대 옆에 쓸 퍼센트.
   *
   * Animated.Value 는 화면을 다시 그리지 않으므로 값을 따로 받아 둡니다.
   * 정수가 바뀔 때만 상태를 갱신해서 매 프레임 다시 그리지 않게 합니다.
   */
  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      const next = Math.round(value * 100);
      setPercent((prev) => (prev === next ? prev : next));
    });
    return () => progress.removeListener(id);
  }, [progress]);

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
            {/* 전에는 ? / ! 글자였습니다 */}
            {needsNewPhoto ? (
              <CircleHelp size={26} color={colors.amber} strokeWidth={2} />
            ) : (
              <CircleAlert size={26} color={colors.navySoft} strokeWidth={2} />
            )}
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
              setPercent(0);
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

        <View style={styles.progressRow}>
          <View
            style={styles.track}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="분석 진행 중"
            accessibilityValue={{ min: 0, max: 100, now: percent }}
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

          <Text style={styles.percent}>{percent}%</Text>
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

  /* 진행 막대 — 칸을 나누지 않고 하나로 이어진 막대입니다 */
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.xl,
  },
  track: {
    width: 180,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.line,
    overflow: "hidden", // 채움이 둥근 끝을 넘어가지 않게 합니다
  },
  fill: {
    height: "100%",
    borderRadius: radius.full,
    backgroundColor: colors.mint,
  },
  percent: {
    // 자릿수가 늘어도 막대가 밀리지 않게 폭을 고정합니다
    minWidth: 34,
    fontSize: font.tiny,
    color: colors.gray,
    fontVariant: ["tabular-nums"],
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
