/**
 * 질문 화면 가운데에 놓는 큰 그림. 담당: 전정현
 *
 * 토스처럼 **연한 원 배경 + 단순한 도형** 조합입니다. 질문 하나만 있는 화면은
 * 비어 보이는데, 그림이 있으면 무엇을 묻는지 읽기 전에 눈으로 먼저 압니다.
 *
 * 왜 SVG 가 아니라 View 인가:
 *   원과 둥근 네모만 쓰면 View 로 충분합니다. 그러면 조각마다 Animated 를 따로
 *   걸 수 있어서 시차를 두고 나타나게 하기가 쉽습니다. react-native-svg 는
 *   설치돼 있지만 조각별 애니메이션을 붙이려면 더 번거롭습니다.
 *
 * 왜 reanimated 가 아닌가:
 *   설치는 돼 있지만 이 저장소에 babel 설정이 없습니다(babel.config.js 없음).
 *   플러그인 없이 쓰면 런타임에 터집니다. 내장 Animated 로 충분한 움직임입니다.
 *
 * 움직임 — 눈에 띄지 않게
 *   1. 들어올 때: 원이 먼저 살짝 커지며 나타나고(520ms), 조각들이 60ms 씩
 *      차이를 두고 아래에서 올라옵니다
 *   2. 그 뒤: 아주 느리게(3.2초) 위아래로 3px 씩 떠다닙니다.
 *      멈춰 있는 그림보다 화면이 살아 있어 보입니다
 *
 * 시스템 "동작 줄이기" 가 켜져 있으면 둘 다 하지 않고 그냥 보여줍니다.
 */

import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import { colors, radius } from "../constants/theme";

/** 그림 전체가 차지하는 정사각형의 한 변 (px) */
const SIZE = 200;

/** 들어오는 데 걸리는 시간 (밀리초) */
const ENTER_MS = 520;

/** 조각들이 차례로 올라올 때의 시차 (밀리초) */
const STAGGER_MS = 60;

/** 떠다니는 거리 (px) 와 한 번 왕복하는 시간 (밀리초) */
const FLOAT_PX = 3;
const FLOAT_MS = 3200;

type Props = {
  kind: "people" | "age";
};

export default function AskArt({ kind }: Props) {
  /** 원 배경: 0 → 1 */
  const bloom = useRef(new Animated.Value(0)).current;
  /** 조각 3개. 각각 0 → 1 */
  const pieces = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  /** 떠다니기: -1 → 1 */
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    const anims: Animated.CompositeAnimation[] = [];

    const play = () => {
      const enter = Animated.parallel([
        Animated.timing(bloom, {
          toValue: 1,
          duration: ENTER_MS,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }),
        Animated.stagger(
          STAGGER_MS,
          pieces.map((p) =>
            Animated.timing(p, {
              toValue: 1,
              duration: ENTER_MS,
              easing: Easing.bezier(0.22, 1, 0.36, 1),
              useNativeDriver: true,
            })
          )
        ),
      ]);

      const drift = Animated.loop(
        Animated.sequence([
          Animated.timing(float, {
            toValue: 1,
            duration: FLOAT_MS / 2,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(float, {
            toValue: 0,
            duration: FLOAT_MS / 2,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );

      anims.push(enter, drift);
      enter.start(({ finished }) => {
        if (finished && alive) drift.start();
      });
    };

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (!alive) return;
        if (reduce) {
          // 움직임 없이 완성된 모습으로 둡니다
          bloom.setValue(1);
          pieces.forEach((p) => p.setValue(1));
          return;
        }
        play();
      })
      .catch(() => {
        if (alive) play();
      });

    return () => {
      alive = false;
      anims.forEach((a) => a.stop());
    };
  }, [bloom, pieces, float, kind]);

  /** 조각 하나의 등장 스타일. 아래에서 올라오며 나타납니다 */
  const rise = (i: number) => ({
    opacity: pieces[i],
    transform: [
      {
        translateY: pieces[i].interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
    ],
  });

  const drift = {
    transform: [
      {
        translateY: float.interpolate({
          inputRange: [0, 1],
          outputRange: [FLOAT_PX, -FLOAT_PX],
        }),
      },
    ],
  };

  return (
    <View style={styles.wrap} accessible={false} pointerEvents="none">
      {/* 연한 원 배경. 살짝 커지며 나타납니다 */}
      <Animated.View
        style={[
          styles.bloom,
          {
            opacity: bloom,
            transform: [
              {
                scale: bloom.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.86, 1],
                }),
              },
            ],
          },
        ]}
      />

      <Animated.View style={[styles.stage, drift]}>
        {kind === "people" ? <People rise={rise} /> : <Age rise={rise} />}
      </Animated.View>
    </View>
  );
}

type RiseFn = (i: number) => object;

/**
 * 사람 셋. 오른쪽 하나는 연한 색입니다 — "몇 명인지" 를 묻는 그림이라
 * 수가 정해지지 않았다는 느낌을 줍니다.
 */
function People({ rise }: { rise: RiseFn }) {
  return (
    <View style={styles.people}>
      {[
        { head: colors.navy, body: colors.navy, size: 1 },
        { head: colors.mint, body: colors.mint, size: 1.16 },
        { head: colors.grayLight, body: colors.grayLight, size: 0.92 },
      ].map((p, i) => (
        <Animated.View key={i} style={[styles.person, rise(i)]}>
          <View
            style={[
              styles.head,
              {
                backgroundColor: p.head,
                width: 26 * p.size,
                height: 26 * p.size,
                borderRadius: 26 * p.size,
              },
            ]}
          />
          <View
            style={[
              styles.body,
              {
                backgroundColor: p.body,
                width: 38 * p.size,
                height: 44 * p.size,
              },
            ]}
          />
        </Animated.View>
      ))}
    </View>
  );
}

/**
 * 신분증 같은 카드. 나이를 묻는 화면에 씁니다.
 * 카드 → 얼굴 → 글줄 순으로 나타납니다.
 */
function Age({ rise }: { rise: RiseFn }) {
  return (
    <Animated.View style={[styles.card, rise(0)]}>
      <Animated.View style={[styles.avatar, rise(1)]} />

      <Animated.View style={[styles.lines, rise(2)]}>
        <View style={[styles.line, { width: 54 }]} />
        <View style={[styles.line, { width: 38, backgroundColor: colors.mint }]} />
        <View style={[styles.line, { width: 46 }]} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },

  /* 연한 원 배경 */
  bloom: {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.mintBg,
  },

  stage: { alignItems: "center", justifyContent: "center" },

  /* ── 사람 셋 ─────────────────────────────────────────────── */
  people: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  person: { alignItems: "center", gap: 5 },
  head: {},
  body: {
    /* 위쪽만 둥글게. 어깨처럼 보입니다 */
    borderTopLeftRadius: 19,
    borderTopRightRadius: 19,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },

  /* ── 신분증 카드 ──────────────────────────────────────────── */
  card: {
    width: 132,
    height: 88,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    /* 카드가 원 배경 위에 떠 있어 보이게. 아래쪽에만 그림자를 둡니다 */
    boxShadow: "0 6px 12px -4px rgba(18, 41, 77, 0.18)",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.navy,
  },
  lines: { gap: 7 },
  line: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.line,
  },
});
