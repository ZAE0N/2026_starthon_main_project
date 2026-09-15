/**
 * 몇 초마다 바뀌는 안내 카드. 담당: 전정현
 *
 * 메인화면에 카드 두 장이 그냥 떠 있던 자리를 대체합니다. 세로로 쌓아두면
 * 화면이 길어지고 둘 다 대충 읽히는데, 한 장씩 바뀌면 그 한 장은 읽힙니다.
 *
 * 한 장만 보이니까 크게 만들었습니다. 근거 조문을 아래에 같이 적어서
 * "앱이 그렇다더라" 가 아니라 어디에 적힌 이야기인지 알 수 있게 했습니다.
 *
 * 몇 장인지 알려주는 점은 일부러 없습니다. 사용자가 세어야 할 정보가 아니고,
 * 점이 있으면 넘겨야 할 것처럼 보입니다. 가만히 두면 알아서 바뀝니다.
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

/**
 * 높이를 재기 전에 쓸 값 (px).
 * 가장 긴 카드(제목 1줄 + 본문 3줄 + 근거)의 실측에 가깝게 잡았습니다.
 * 이 값이 실제보다 많이 작으면 첫 프레임에 카드가 한 번 튑니다.
 */
const FALLBACK_HEIGHT = 176;

export type InfoCard = {
  title: string;
  body: string;
  /** 근거 조문. 없으면 안 보입니다 */
  law?: string;
};

type Props = {
  cards: InfoCard[];
};

function Card({ card }: { card: InfoCard }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{card.title}</Text>
      <Text style={styles.body}>{card.body}</Text>

      {card.law ? (
        <View style={styles.lawRow}>
          <View style={styles.lawDot} />
          <Text style={styles.law}>{card.law}</Text>
        </View>
      ) : null}
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
        accessibilityLabel={
          `${cards[index].title}. ${cards[index].body}` +
          (cards[index].law ? ` 근거 ${cards[index].law}` : "")
        }
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

  /*
   * 한 장만 보이니까 크게 잡았습니다.
   *
   * 배경은 화면과 같은 흰색이고, 떠 있는 느낌은 그림자와 얇은 테두리로 냅니다.
   * 회색 배경(surface)으로 하면 덩어리가 커 보여서 화면이 무거워집니다.
   *
   * 그림자는 아주 옅습니다(불투명도 0.07). 계약서를 찍는 앱이라 카드가 제일
   * 튀면 안 됩니다. iOS 는 shadow*, 안드로이드는 elevation 이고, 웹은
   * react-native-web 이 shadow* 를 box-shadow 로 바꿔줍니다.
   */
  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    gap: space.sm,

    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
  },

  title: {
    fontSize: font.h2,
    fontWeight: weight.bold,
    color: colors.navy,
    lineHeight: 28,
  },
  body: {
    fontSize: font.body,
    color: colors.navySoft,
    lineHeight: 23,
  },

  /* 근거 조문. 어디에 적힌 이야기인지 알 수 있게 합니다 */
  lawRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    marginTop: space.xs,
  },
  lawDot: {
    width: 4,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.mint,
  },
  law: {
    fontSize: font.tiny,
    color: colors.mintText,
    fontWeight: weight.medium,
  },
});
