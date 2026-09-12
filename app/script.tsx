/**
 * 말할 문장 화면. 담당: 정윤지
 *
 * ★ 이 앱에서 가장 중요한 화면입니다.
 *   문제를 알려주는 앱은 많은데, 말을 못 꺼내서 넘어가는 게 진짜 문제라서요.
 *
 * 할 일 (화면 시안 6번)
 *  - 톤 선택 버튼 다듬기 (부드럽게 / 단단하게)
 *  - 복사 확인 표시를 더 잘 보이게 (시안엔 없지만 없으면 여러 번 누릅니다)
 *  - "말 꺼내기 어려우면 →" 버튼으로 /help 연결
 *
 * 아래 followUp 질문은 빼지 마세요. 이 프로젝트의 핵심 지표입니다.
 * 시안에는 이 부분이 빠져 있습니다.
 */

import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { findClause, type FollowUp } from "../types";
import { setFollowUp, useCurrent } from "../lib/session";
import { updateResult } from "../lib/storage";
import { copy } from "../constants/copy";
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
  const clause = result ? findClause(result, id ?? "") : undefined;

  const [tone, setTone] = useState<Tone>("soft");
  const [copied, setCopied] = useState(false);
  const [asked, setAsked] = useState(false);
  const [answer, setAnswer] = useState<FollowUp | null>(null);

  if (!clause) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>문장을 찾지 못했어요.</Text>
      </View>
    );
  }

  const text = clause.scripts[tone];

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
        </Text>
      </View>

      <View style={styles.tones}>
        {(["soft", "firm"] as Tone[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.tone, tone === t && styles.toneOn]}
            accessibilityState={{
              selected: tone === t,
            }}
            onPress={() => {
              setTone(t);
              setCopied(false);
            }}
          >
            <Text
              style={[
                styles.toneText,
                tone === t && styles.toneTextOn,
              ]}
            >
              {t === "soft" ? "부드럽게" : "단단하게"}
            </Text>
          </Pressable>
        ))}
      </View>

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