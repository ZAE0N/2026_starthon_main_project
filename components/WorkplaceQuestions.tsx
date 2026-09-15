/**
 * 사진 보내기 전에 묻는 조건 질문. 담당: 전정현
 *
 * 촬영 화면(app/camera.tsx)의 제목 아래, 예시 그림 위에 놓입니다.
 * 설계는 FEATURE_hidden-conditions-design.md 의 "화면 1" 입니다.
 *
 * 왜 묻는가:
 *   답에 따라 **적용되는 법이 달라집니다.** 근로기준법 시행령 별표1 에 따라
 *   상시 4명 이하 사업장에는 제50조(주 40시간 한도)가 적용되지 않습니다.
 *   즉 5명 미만인 곳에서 주 60시간을 적어도 그 자체로는 위법이 아닙니다.
 *   이걸 모르고 판정하면 **없는 위법을 알려주게 됩니다.**
 *
 *   반대로 만 18세 미만은 제69조로 1일 7시간·주 35시간이 한도인데, 이 조문은
 *   별표1 에 들어 있어서 **5명 미만인 곳에서도 그대로 적용**됩니다.
 *   성인 기준(주 40시간)으로 보면 위반을 놓칩니다.
 *
 * 답을 강제하지 않습니다:
 *   안 골라도 촬영 버튼은 눌립니다. 미선택은 "모르겠어요" 와 같게 처리하고,
 *   그때는 5인 이상·만 18세 이상 기준으로 봅니다.
 *
 *   왜 그 방향인가: 미성년 기준이 더 엄격합니다. 성인인데 미성년 기준으로 보면
 *   없는 위법을 만들어냅니다. 위반을 놓치는 것보다 그게 더 나쁩니다.
 *   어느 기준으로 봤는지는 결과 화면의 전제에 항상 적힙니다.
 *
 * 답은 lib/session.ts 에 담깁니다. 같은 사업장에서 계약서를 여러 장 찍는
 * 경우가 있어서 촬영을 다시 해도 답은 남습니다. 앱을 껐다 켜면 사라집니다.
 */

import { Pressable, StyleSheet, Text, View } from "react-native";
import { setWorkplace, useWorkplace } from "../lib/session";
import {
  colors,
  font,
  minTouch,
  radius,
  space,
  weight,
} from "../constants/theme";

/** 사업장 규모 선택지. 값이 null 이면 "모르겠어요" 입니다 */
const COUNTS: { value: "under5" | "over5" | null; label: string }[] = [
  { value: "under5", label: "5명 미만" },
  { value: "over5", label: "5명 이상" },
  { value: null, label: "모르겠어요" },
];

const AGES: { value: boolean; label: string }[] = [
  { value: true, label: "예" },
  { value: false, label: "아니오" },
];

type ChipProps = {
  label: string;
  on: boolean;
  onPress: () => void;
  /** 스크린리더용. 어느 질문의 답인지 같이 읽어줍니다 */
  question: string;
};

function Chip({ label, on, onPress, question }: ChipProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        on && styles.chipOn,
        pressed && !on && styles.chipPressed,
      ]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${question} ${label}`}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export default function WorkplaceQuestions() {
  const answers = useWorkplace();

  /*
   * "모르겠어요" 를 고른 것과 아직 안 고른 것을 구분합니다.
   * 둘 다 판정은 같지만, 골랐으면 칩이 켜져 있어야 누른 게 반영됐다는 걸 압니다.
   * employeeCount 는 null 이 두 뜻을 겸하므로 별도 플래그 없이는 구분이 안 되는데,
   * 여기서는 "골랐는지" 를 세션에 따로 담지 않고 화면 안에서만 씁니다.
   */
  const countChosen = answers.employeeCount;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>몇 가지만 먼저 알려주세요</Text>
      <Text style={styles.sub}>답에 따라 적용되는 법이 달라져요.</Text>

      <View style={styles.block}>
        <Text style={styles.question}>일하는 사람이 몇 명인가요?</Text>
        <View style={styles.row} accessibilityRole="radiogroup">
          {COUNTS.map((c) => (
            <Chip
              key={c.label}
              label={c.label}
              on={countChosen === c.value}
              question="일하는 사람 수"
              onPress={() => setWorkplace({ employeeCount: c.value })}
            />
          ))}
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.question}>만 18세 미만인가요?</Text>
        <View style={styles.row} accessibilityRole="radiogroup">
          {AGES.map((a) => (
            <Chip
              key={a.label}
              label={a.label}
              on={answers.isMinor === a.value}
              question="만 18세 미만인지"
              onPress={() => setWorkplace({ isMinor: a.value })}
            />
          ))}
          {/* 두 칸만 두면 칩이 화면 절반씩 차지해서 눈에 너무 큽니다 */}
          <View style={styles.spacer} />
        </View>
      </View>

      <Text style={styles.note}>
        안 고르셔도 괜찮아요. 그때는 5명 이상, 만 18세 이상 기준으로 봐요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
  },

  title: {
    fontSize: font.body,
    fontWeight: weight.semibold,
    color: colors.navy,
  },
  sub: { fontSize: font.small, color: colors.gray },

  block: { marginTop: space.sm, gap: space.sm },
  question: {
    fontSize: font.small,
    fontWeight: weight.medium,
    color: colors.navySoft,
  },

  row: { flexDirection: "row", gap: space.sm },

  /* app/script.tsx 의 말투 전환 칩과 같은 모양입니다 */
  chip: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    minHeight: minTouch,
    paddingHorizontal: space.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  chipPressed: { backgroundColor: colors.line },
  chipOn: { borderColor: colors.mint, backgroundColor: colors.mintBg },
  chipText: { fontSize: font.small, color: colors.gray },
  chipTextOn: { color: colors.mintText, fontWeight: weight.semibold },

  /* 2지선다를 3지선다와 같은 폭으로 맞추기 위한 빈 칸 */
  spacer: { flex: 1 },

  note: {
    marginTop: space.xs,
    fontSize: font.tiny,
    color: colors.gray,
    lineHeight: 17,
  },
});
