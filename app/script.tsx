/**
 * 말할 문장 화면. 담당: 정윤지
 *
 * 계약서 문제를 확인한 뒤 사용자가 실제로 상대방에게
 * 전달할 문장을 확인하고 복사할 수 있는 화면입니다.
 */

/**
 * 말할 문장 화면. 담당: 정윤지
 *
 * 계약서 문제를 확인한 뒤 사용자가 실제로 상대방에게
 * 전달할 문장을 확인할 수 있는 화면입니다.
 */

import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { findClause } from "../types";
import { useCurrent } from "../lib/session";
import {
  colors,
  font,
  minTouch,
  radius,
  screenPadding,
  space,
  weight,
} from "../constants/theme";

type Tone = "soft" | "firm";

export default function Script() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const result = useCurrent();

  const clause = result
    ? findClause(result, id ?? "")
    : undefined;

  const [tone, setTone] = useState<Tone>("soft");

  if (!clause) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          문장을 찾지 못했어요.
        </Text>
      </View>
    );
  }

  const text = clause.scripts[tone];

<<<<<<< HEAD
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View>
        <Text style={styles.title}>
          문장 추천
        </Text>

        <Text style={styles.sub}>
          원하는 말투를 선택하여, 상황에 맞게 전달해보세요.
=======
  async function onCopy() {
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setAsked(true);
  }

  async function onAnswer(value: FollowUp) {
    setAnswer(value);
    setFollowUp(value);

    if (result) {
      await updateResult(result.id, {
        followUp: value,
      });
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View>
        <Text style={styles.title}>이렇게 말해보세요</Text>

        <Text style={styles.sub}>
          편한 세기를 골라서 그대로 읽으면 돼요
>>>>>>> develop
        </Text>
      </View>

      <View style={styles.tones}>
        {(["soft", "firm"] as Tone[]).map((t) => (
          <Pressable
            key={t}
<<<<<<< HEAD
            style={[
              styles.tone,
              tone === t && styles.toneOn,
            ]}
=======
            style={[styles.tone, tone === t && styles.toneOn]}
>>>>>>> develop
            accessibilityState={{
              selected: tone === t,
            }}
            onPress={() => {
              setTone(t);
            }}
          >
            <Text
              style={[
                styles.toneText,
                tone === t && styles.toneTextOn,
              ]}
            >
<<<<<<< HEAD
              {t === "soft" ? "정중하게" : "명확하게"}
=======
              {t === "soft" ? "부드럽게" : "단단하게"}
>>>>>>> develop
            </Text>
          </Pressable>
        ))}
      </View>

<<<<<<< HEAD
      <Text style={styles.script}>
        {text}
      </Text>

      <Pressable
        style={styles.secondary}
        onPress={() => router.push("/help")}
      >
        <Text style={styles.secondaryText}>
          노동청에 신고하기 →
        </Text>
      </Pressable>
=======
      <Text style={styles.script}>{text}</Text>

      <Text style={styles.tip}>
        외우지 않아도 괜찮아요. 화면을 보면서 읽어도 됩니다.
      </Text>

      <Pressable
        style={styles.primary}
        onPress={onCopy}
      >
        <Text style={styles.primaryText}>
          {copied ? "복사 완료 ✓" : "문장 복사하기"}
        </Text>
      </Pressable>

      {copied && (
        <View style={styles.copyNotice}>
          <Text style={styles.copyNoticeText}>
            문장이 클립보드에 복사됐어요.
          </Text>
        </View>
      )}

      {asked && (
        <View style={styles.followUp}>
          <Text style={styles.followUpQ}>
            {copy.followUp.question}
          </Text>

          <View style={styles.followUpRow}>
            {copy.followUp.options.map((o) => (
              <Pressable
                key={o.value}
                style={[
                  styles.chip,
                  answer === o.value && styles.chipOn,
                ]}
                onPress={() => onAnswer(o.value)}
              >
                <Text
                  style={[
                    styles.chipText,
                    answer === o.value && styles.chipTextOn,
                  ]}
                >
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <Pressable
        style={styles.secondary}
        onPress={() => router.push("/help")}
      >
        <Text style={styles.secondaryText}>
          말 꺼내기 어려우면 →
        </Text>
      </Pressable>
>>>>>>> develop
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: screenPadding,
    backgroundColor: colors.bg,
    gap: space.md,
  },

  title: {
    fontSize: font.h2,
    fontWeight: weight.bold,
    color: colors.navy,
  },

  sub: {
    marginTop: space.xs,
    fontSize: font.small,
    color: colors.gray,
  },

  tones: {
    flexDirection: "row",
    gap: space.sm,
  },

  tone: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.sm,
    minHeight: minTouch,
    alignItems: "center",
    justifyContent: "center",
  },

  toneOn: {
    borderColor: colors.mint,
    backgroundColor: colors.mintBg,
  },

  toneText: {
    fontSize: font.small,
    color: colors.gray,
  },

  toneTextOn: {
    color: colors.mintText,
    fontWeight: weight.semibold,
  },

  script: {
    borderWidth: 1.5,
    borderColor: colors.navy,
    borderRadius: radius.lg,
    padding: space.lg,
    fontSize: font.h2,
    lineHeight: 30,
    color: colors.navy,
  },

<<<<<<< HEAD
=======
  tip: {
    fontSize: font.small,
    color: colors.gray,
    lineHeight: 20,
  },

  primary: {
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    minHeight: minTouch,
    paddingVertical: space.md,
    alignItems: "center",
    justifyContent: "center",
  },

  primaryText: {
    color: colors.white,
    fontSize: font.body,
    fontWeight: weight.semibold,
  },

  copyNotice: {
    backgroundColor: colors.mintBg,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    alignItems: "center",
  },

  copyNoticeText: {
    color: colors.mintText,
    fontSize: font.small,
    fontWeight: weight.semibold,
  },

  followUp: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
  },

  followUpQ: {
    fontSize: font.body,
    fontWeight: weight.semibold,
    color: colors.navy,
  },

  followUpRow: {
    flexDirection: "row",
    gap: space.sm,
    flexWrap: "wrap",
  },

  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minHeight: minTouch,
    justifyContent: "center",
  },

  chipOn: {
    borderColor: colors.mint,
    backgroundColor: colors.mintBg,
  },

  chipText: {
    fontSize: font.small,
    color: colors.navySoft,
  },

  chipTextOn: {
    color: colors.mintText,
    fontWeight: weight.semibold,
  },

>>>>>>> develop
  secondary: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    minHeight: minTouch,
    paddingVertical: space.md,
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryText: {
    color: colors.navy,
    fontSize: font.small,
    fontWeight: weight.semibold,
  },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },

  emptyText: {
    fontSize: font.body,
    color: colors.gray,
  },
});