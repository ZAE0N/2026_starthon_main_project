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

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View>
        <Text style={styles.title}>
          문장 추천
        </Text>

        <Text style={styles.sub}>
          원하는 말투를 선택하여, 상황에 맞게 전달해보세요.
        </Text>
      </View>

      <View style={styles.tones}>
        {(["soft", "firm"] as Tone[]).map((t) => (
          <Pressable
            key={t}
            style={[
              styles.tone,
              tone === t && styles.toneOn,
            ]}
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
              {t === "soft" ? "정중하게" : "명확하게"}
            </Text>
          </Pressable>
        ))}
      </View>

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