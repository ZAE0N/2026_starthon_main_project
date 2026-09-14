/**
 * 몇 초마다 바뀌는 안내 카드. 담당: 전정현
 *
 * 메인화면에 카드 두 장이 그냥 떠 있던 자리를 대체합니다. 세로로 쌓아두면
 * 화면이 길어지고 둘 다 대충 읽히는데, 한 장씩 바뀌면 그 한 장은 읽힙니다.
 *
 * 애니메이션 원칙 — 눈에 띄지 않는 것이 목표입니다
 *   - 아래에서 10px 올라오며 서서히 나타나고, 나가는 카드는 10px 위로 빠집니다.
 *     좌우로 밀면 "슬라이드쇼" 가 되어 시선을 끕니다. 세로로 조금만 움직입니다
 *   - 튕김(bounce)이 없는 ease-out 입니다. 튕기면 장식처럼 보입니다
 *   - 420ms. 이보다 빠르면 깜빡임처럼, 느리면 기다리게 됩니다
 *
 * 높이가 흔들리지 않게:
 *   카드마다 글자 길이가 달라서 그대로 바꾸면 아래 버튼이 위아래로 움직입니다.
 *   그래서 보이지 않는 곳에서 모든 카드의 높이를 미리 재고, 가장 높은 값으로
 *   자리를 고정합니다. 재기 전에는 FALLBACK_HEIGHT 를 씁니다.
 *
 * 손을 대면 자동 전환을 멈춥니다. 읽는 중에 넘어가면 다시 기다려야 합니다.
 */

import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, font, radius, space, weight } from "../constants/theme";

/** 한 장이 머무는 시간 (밀리초) */
const HOLD_MS = 4200;

/** 바뀌는 데 걸리는 시간 (밀리초) */
const SWAP_MS = 420;

/** 나타날 때 아래에서 올라오는 거리 (px) */
const RISE = 10;

/** 높이를 재기 전에 쓸 값 (px) */
const FALLBACK_HEIGHT = 96;

export type InfoCard = {
  title: string;
  body: string;
};

type Props = {
  cards: InfoCard[];
};

function Card({ card }: { card: InfoCard }) {
  return (
    <View style={styles.card}>
      <View style={styles.line} />
      <View style={styles.content}>
        <Text style={styles.title}>{card.title}</Text>
        <Text style={styles.body}>{card.body}</Text>
      </View>
    </View>
  );
}

export default function RotatingCards({ cards }: Props) {
  const [index, setIndex] = useState(0);
  /** 나가는 중인 카드. 애니메이션이 끝나면 null 로 돌립니다 */
  const [leaving, setLeaving] = useState<number | null>(null);
  /** 손으로 넘긴 뒤에는 자동 전환을 멈춥니다 */
  const [paused, setPaused] = useState(false);
  /** 카드별 높이. 가장 큰 값으로 자리를 고정합니다 */
  const [heights, setHeights] = useState<number[]>([]);
  /** 시스템 "동작 줄이기" 설정 */
  const [reduceMotion, setReduceMotion] = useState(false);

  /** 0 에서 1 로 움직이는 값. 들어오는 카드와 나가는 카드가 같이 씁니다 */
  const t = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let alive = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (alive) setReduceMotion(on);
      })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion
    );

    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const next = () => {
    setLeaving(index);
    setIndex((i) => (i + 1) % cards.length);
  };

  /* 자동 전환 */
  useEffect(() => {
    if (paused || cards.length < 2) return;

    const timer = setTimeout(next, HOLD_MS);
    return () => clearTimeout(timer);
    // index 가 바뀔 때마다 다시 잡습니다. 그래야 손으로 넘긴 직후부터 다시 셉니다
  }, [index, paused, cards.length]);

  /* 바뀌는 순간의 움직임 */
  useEffect(() => {
    if (leaving === null) return;

    if (reduceMotion) {
      // 동작 줄이기가 켜져 있으면 움직이지 않고 그냥 바꿉니다
      t.setValue(1);
      setLeaving(null);
      return;
    }

    t.setValue(0);
    const anim = Animated.timing(t, {
      toValue: 1,
      duration: SWAP_MS,
      // 튕김 없는 ease-out. 장식처럼 보이지 않게 합니다
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    });

    anim.start(({ finished }) => {
      if (finished) setLeaving(null);
    });

    return () => anim.stop();
  }, [index, leaving, reduceMotion, t]);

  const boxHeight =
    heights.length === cards.length && heights.every((h) => h > 0)
      ? Math.max(...heights)
      : FALLBACK_HEIGHT;

  const enter = {
    opacity: t,
    transform: [
      {
        translateY: t.interpolate({
          inputRange: [0, 1],
          outputRange: [RISE, 0],
        }),
      },
    ],
  };

  const exit = {
    opacity: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [
      {
        translateY: t.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -RISE],
        }),
      },
    ],
  };

  return (
    <View style={styles.wrap}>
      {/*
        높이 재기용. position absolute + opacity 0 이라 화면에도 안 보이고
        자리도 차지하지 않습니다. 스크린리더에서도 숨깁니다.
      */}
      <View
        style={styles.measure}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {cards.map((c, i) => (
          <View
            key={`m-${c.title}`}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              setHeights((prev) => {
                if (prev[i] === h) return prev;
                const out = [...prev];
                out[i] = h;
                return out;
              });
            }}
          >
            <Card card={c} />
          </View>
        ))}
      </View>

      <Pressable
        style={[styles.box, { height: boxHeight }]}
        onPress={() => {
          setPaused(true);
          if (cards.length > 1) next();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${cards[index].title}. ${cards[index].body}`}
        accessibilityHint={
          cards.length > 1 ? "눌러서 다음 안내 보기" : undefined
        }
      >
        {leaving !== null && leaving !== index ? (
          <Animated.View
            style={[styles.layer, exit]}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Card card={cards[leaving]} />
          </Animated.View>
        ) : null}

        <Animated.View
          style={[styles.layer, leaving === null ? null : enter]}
          pointerEvents="none"
        >
          <Card card={cards[index]} />
        </Animated.View>
      </Pressable>

      {cards.length > 1 ? (
        <View style={styles.dots} accessibilityElementsHidden>
          {cards.map((c, i) => (
            <View
              key={`d-${c.title}`}
              style={[styles.dot, i === index && styles.dotOn]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: space.md },

  measure: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    opacity: 0,
  },

  box: { justifyContent: "center" },
  layer: { position: "absolute", left: 0, right: 0 },

  card: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    padding: space.md,
    borderRadius: radius.md,
  },
  line: {
    width: 4,
    alignSelf: "stretch",
    backgroundColor: colors.mint,
    borderRadius: radius.full,
    marginRight: space.md,
  },
  content: { flex: 1 },
  title: {
    fontSize: font.body,
    fontWeight: weight.semibold,
    color: colors.navy,
  },
  body: {
    marginTop: space.xs,
    fontSize: font.small,
    color: colors.gray,
    lineHeight: 19,
  },

  /* 더 있다는 표시. 눈에 띄지 않게 아주 작게 둡니다 */
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: space.xs,
    marginTop: space.sm,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: colors.line,
  },
  dotOn: { backgroundColor: colors.mint },
});
