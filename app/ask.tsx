/**
 * 촬영 전 조건 질문. 담당: 전정현
 *
 * **한 화면에 질문 하나**입니다. 전에는 촬영 안내 화면 안에 카드로 얹어
 * 두 질문을 같이 보여줬는데, 안내와 질문이 섞여서 어수선했습니다.
 *
 * 흐름
 *   메인 → [계약서 촬영하기] → **여기(2단계)** → 촬영 안내 → 앱 안 카메라
 *
 * 결과·기록함·에러 화면의 "다시 찍기" 는 `/camera` 로 바로 갑니다. 답은
 * 세션에 남아 있어서 다시 물을 이유가 없습니다.
 *
 * 왜 화면을 나눴는가:
 *   질문 하나에 화면 하나면 무엇을 묻는지 오해할 여지가 없고, 선택지를 가로로
 *   세 칸 쪼개지 않고 세로로 크게 놓을 수 있습니다. 답하면 바로 다음으로
 *   넘어가니 "다음" 버튼도 필요 없습니다.
 *
 * 왜 라우트 하나에 단계 둘인가:
 *   화면을 둘로 나누면 전환은 네이티브 스택이 맡는데, 그건 웹에서 동작하지
 *   않습니다(react-native-screens 에 웹 구현이 없습니다). 시연을 웹에서 하므로
 *   전환을 직접 그립니다. 사용자에게는 화면이 두 개로 보입니다.
 *
 * 나이는 한 번만 묻습니다:
 *   만 18세 미만인지는 폰에 저장되고(lib/session.ts 의 AGE_KEY), 다음부터는
 *   그 질문 화면이 아예 뜨지 않습니다. 나이는 바뀌지 않으니 매번 묻는 건
 *   번거롭기만 합니다.
 *
 *   바꾸려면 결과 화면의 판정 전제 아래 "바꾸기" 를 누릅니다. 그러면
 *   `/ask?only=age` 로 들어와 나이 질문만 뜹니다.
 *   사업장 규모는 저장하지 않습니다 — 다른 알바를 시작하면 달라지는 값입니다.
 *
 *   답을 **바꿨고** 사진이 아직 세션에 있으면 곧바로 다시 판정합니다.
 *   그때 결과 화면이 `replace` 로 옛 결과의 id 를 넘겨주고, 분석중 화면이
 *   새 결과를 저장한 **뒤에** 그 id 를 지웁니다. 순서가 중요합니다 — 먼저
 *   지우면 새 판정이 실패했을 때 아무것도 남지 않습니다.
 *
 *   답이 그대로면 다시 판정하지 않습니다. 같은 사진에 같은 조건이라 결과가
 *   같은데 호출만 한 번 더 나갑니다.
 *
 * 답을 강제하지 않습니다:
 *   아래 "건너뛰기" 로 넘길 수 있습니다. 안 고르면 5인 이상·만 18세 이상
 *   기준으로 보고, 어느 기준으로 봤는지는 결과 화면의 전제에 항상 적힙니다.
 *
 *   왜 그 방향인가: 미성년 기준이 더 엄격합니다(주 35시간). 성인인데 미성년
 *   기준으로 보면 없는 위법을 만들어냅니다. 위반을 놓치는 것보다 그게 더 나쁩니다.
 *
 * 답이 판정을 어떻게 바꾸는지는 server/laws.json 의 conditions 와
 * PROGRESS.md 의 "법령 검증" 절에 있습니다.
 */

import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ChevronLeft } from "lucide-react-native";
import AskArt from "../components/AskArt";
import {
  getCurrentPhoto,
  setWorkplace,
  useSavedAge,
  useWorkplace,
} from "../lib/session";
import {
  colors,
  font,
  minTouch,
  radius,
  screenPadding,
  space,
  weight,
} from "../constants/theme";

/** 단계가 바뀔 때의 전환 시간 (밀리초) */
const SWAP_MS = 320;

/** 옆으로 미끄러지는 거리 (px). 크면 슬라이드쇼처럼 보입니다 */
const SLIDE_PX = 24;

type Step = 0 | 1;

export default function Ask() {
  // 저장된 나이를 불러옵니다. 값이 오면 아래 skipAge 가 true 가 됩니다.
  useSavedAge();

  const answers = useWorkplace();
  const { only, replace } = useLocalSearchParams<{
    only?: string;
    replace?: string;
  }>();

  /** 나이만 다시 묻는 모드. 결과 화면의 "바꾸기" 로 들어옵니다 */
  const ageOnly = only === "age";

  /**
   * 다시 판정한 뒤 갈아치울 옛 결과의 id.
   * 결과 화면이 사진을 들고 있을 때만 넘겨줍니다.
   */
  const replaceId = typeof replace === "string" ? replace : "";

  const [step, setStep] = useState<Step>(ageOnly ? 1 : 0);

  /**
   * 나이 질문을 건너뛸지.
   *
   * 1단계(인원)에 있는 동안 isMinor 에 값이 있다면 그건 **저장소에서 온 것**
   * 뿐입니다. 이 흐름에서 나이를 물은 적이 없으니까요. 그래서 그냥 읽으면 됩니다.
   * 렌더 중에 ref 를 고치던 것을 이렇게 바꿨습니다.
   */
  const skipAge = answers.isMinor !== null;

  /** 0 → 1 로 움직이며 새 단계를 밀어 넣습니다 */
  const t = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (alive) setReduceMotion(on);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /**
   * 다음 단계로. 마지막이면 다음 화면으로 넘깁니다.
   *
   * @param changed 나이 답이 실제로 바뀌었는지. 안 바뀌면 다시 판정하지 않습니다.
   */
  const go = (next: Step | "done", changed = false) => {
    if (next === "done") {
      if (!ageOnly) {
        router.replace("/camera");
        return;
      }

      // 답을 바꿨고 사진이 남아 있으면 바로 다시 판정합니다.
      if (changed && replaceId !== "" && getCurrentPhoto()) {
        router.replace(`/analyzing?replace=${encodeURIComponent(replaceId)}`);
        return;
      }

      // 그 외에는 왔던 화면으로 돌아갑니다.
      router.back();
      return;
    }

    setStep(next);

    if (reduceMotion) {
      t.setValue(1);
      return;
    }
    t.setValue(0);
    Animated.timing(t, {
      toValue: 1,
      duration: SWAP_MS,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
  };

  const back = () => {
    // 나이만 묻는 모드이거나 1단계면 왔던 화면으로 돌아갑니다
    if (step === 0 || ageOnly) {
      router.back();
      return;
    }
    go(0);
  };

  const slide = {
    opacity: t,
    transform: [
      {
        translateX: t.interpolate({
          inputRange: [0, 1],
          outputRange: [SLIDE_PX, 0],
        }),
      },
    ],
  };

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <Pressable
          style={styles.back}
          onPress={back}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
        >
          <ChevronLeft size={26} color={colors.navy} />
        </Pressable>

        {/*
          몇 단계 중 어디인지. 토스처럼 얇은 막대입니다.
          나이만 묻는 모드는 한 단계뿐이라 막대를 그리지 않습니다.
          나이를 이미 아는 경우도 1단계뿐이라 마찬가지입니다.
        */}
        {ageOnly || skipAge ? (
          <View style={styles.steps} />
        ) : (
          <View style={styles.steps} accessibilityElementsHidden>
            {[0, 1].map((i) => (
              <View
                key={i}
                style={[styles.stepBar, i <= step && styles.stepBarOn]}
              />
            ))}
          </View>
        )}
      </View>

      <Animated.View style={[styles.body, slide]} key={step}>
        {step === 0 ? (
          <Question
            title={"일하는 곳에\n몇 명이 함께 일하나요?"}
            sub="사람 수에 따라 적용되는 법이 달라져요."
            art="people"
            options={[
              { label: "5명 미만", on: answers.employeeCount === "under5" },
              { label: "5명 이상", on: answers.employeeCount === "over5" },
              { label: "잘 모르겠어요", on: false },
            ]}
            onPick={(i) => {
              setWorkplace({
                employeeCount: i === 0 ? "under5" : i === 1 ? "over5" : null,
              });
              // 나이를 이미 알면 그 질문은 건너뜁니다
              go(skipAge ? "done" : 1);
            }}
            onSkip={() => go(skipAge ? "done" : 1)}
          />
        ) : (
          <Question
            title={"만 18세 미만인가요?"}
            sub="만 18세 미만은 일할 수 있는 시간이 더 짧아요."
            art="age"
            options={[
              { label: "네, 만 18세 미만이에요", on: answers.isMinor === true },
              { label: "아니요", on: answers.isMinor === false },
            ]}
            onPick={(i) => {
              const next = i === 0;
              const changed = answers.isMinor !== next;
              setWorkplace({ isMinor: next });
              go("done", changed);
            }}
            onSkip={() => go("done")}
          />
        )}
      </Animated.View>
    </View>
  );
}

type QuestionProps = {
  title: string;
  sub: string;
  art: "people" | "age";
  options: { label: string; on: boolean }[];
  onPick: (index: number) => void;
  onSkip: () => void;
};

function Question({
  title,
  sub,
  art,
  options,
  onPick,
  onSkip,
}: QuestionProps) {
  return (
    <>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>

      <View style={styles.artArea}>
        <AskArt kind={art} />
      </View>

      <View style={styles.options} accessibilityRole="radiogroup">
        {options.map((o, i) => (
          <Pressable
            key={o.label}
            style={({ pressed }) => [
              styles.option,
              o.on && styles.optionOn,
              pressed && !o.on && styles.optionPressed,
            ]}
            onPress={() => onPick(i)}
            accessibilityRole="radio"
            accessibilityState={{ selected: o.on }}
            accessibilityLabel={o.label}
          >
            <Text style={[styles.optionText, o.on && styles.optionTextOn]}>
              {o.label}
            </Text>
          </Pressable>
        ))}

        <Pressable
          style={styles.skip}
          onPress={onSkip}
          accessibilityRole="button"
          accessibilityLabel="건너뛰기"
          accessibilityHint="안 고르면 5명 이상, 만 18세 이상 기준으로 봐요"
        >
          <Text style={styles.skipText}>건너뛰기</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  back: {
    width: minTouch,
    height: minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  steps: { flexDirection: "row", gap: space.xs, flex: 1 },
  stepBar: {
    flex: 1,
    height: 3,
    borderRadius: radius.full,
    backgroundColor: colors.line,
  },
  stepBarOn: { backgroundColor: colors.navy },

  body: {
    flex: 1,
    paddingHorizontal: screenPadding,
    paddingBottom: space.xl,
  },

  head: { marginTop: space.lg },
  title: {
    fontSize: font.h1,
    fontWeight: weight.bold,
    color: colors.navy,
    lineHeight: 36,
  },
  sub: {
    marginTop: space.sm,
    fontSize: font.body,
    color: colors.gray,
    lineHeight: 22,
  },

  /* 그림은 남는 공간을 다 받아서 가운데에 놓입니다 */
  artArea: { flex: 1, alignItems: "center", justifyContent: "center" },

  /*
   * 선택지는 세로로 꽉 찬 버튼입니다. 가로로 쪼개면 글자가 줄바꿈되고
   * 누를 곳이 작아집니다. 답하면 바로 넘어가므로 "다음" 버튼이 없습니다.
   */
  options: { gap: space.sm },
  option: {
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.md,
  },
  optionPressed: { backgroundColor: colors.surface },
  optionOn: { borderColor: colors.mint, backgroundColor: colors.mintBg },
  optionText: {
    fontSize: font.body,
    fontWeight: weight.medium,
    color: colors.navy,
  },
  optionTextOn: { color: colors.mintText, fontWeight: weight.semibold },

  skip: {
    alignSelf: "center",
    minHeight: minTouch,
    paddingHorizontal: space.md,
    justifyContent: "center",
  },
  skipText: {
    fontSize: font.small,
    color: colors.gray,
    textDecorationLine: "underline",
  },
});
