/**
 * 기록함 화면. 담당: 전정현
 *
 * 할 일
 *  - 사진 썸네일 (imagePath)
 *  - 이름 붙이기 / 삭제
 */

import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { countIllegal, getIssues, type InspectResult } from "../types";
import { setCurrent } from "../lib/session";
import { loadHistory } from "../lib/storage";
import { copy } from "../constants/copy";
import {
  colors,
  font,
  minTouch,
  radius,
  screenPadding,
  space,
  verdictStyle,
  weight,
} from "../constants/theme";

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

export default function History() {
  const [items, setItems] = useState<InspectResult[]>([]);

  // 결과를 저장하고 돌아왔을 때 목록이 갱신되도록 화면에 들어올 때마다 읽습니다.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadHistory().then((h) => {
        if (alive) setItems(h);
      });
      return () => {
        alive = false;
      };
    }, [])
  );

  /** 과거 결과를 열려면 session 에 실어준 뒤 결과 화면으로 보냅니다. */
  function open(item: InspectResult) {
    setCurrent(item);
    router.push("/result");
  }

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>아직 저장된 계약서가 없어요.</Text>
        <Pressable
          style={styles.primary}
          onPress={() => router.push("/camera")}
        >
          <Text style={styles.primaryText}>계약서 촬영하기</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.note}>{copy.historyNote}</Text>

      <View style={styles.list}>
        {items.map((item) => {
          const issues = getIssues(item).length;
          const illegal = countIllegal(item);
          const s = illegal > 0
            ? verdictStyle.위법소지
            : issues > 0
              ? verdictStyle.확인필요
              : verdictStyle.문제없음;

          return (
            <Pressable
              key={item.id}
              style={styles.card}
              onPress={() => open(item)}
            >
              <View style={styles.thumb} />
              <View style={styles.cardBody}>
                <Text style={styles.cardLabel}>
                  {item.title || "이름 없는 계약서"}
                </Text>
                <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
              </View>
              <View style={[styles.pill, { backgroundColor: s.bg }]}>
                <Text style={[styles.pillText, { color: s.color }]}>
                  {issues > 0 ? `${issues}곳` : "이상 없음"}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={styles.secondary}
        onPress={() => router.push("/camera")}
      >
        <Text style={styles.secondaryText}>새 계약서 촬영</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: screenPadding, backgroundColor: colors.bg, gap: space.md },
  note: { fontSize: font.small, color: colors.gray, lineHeight: 20 },
  list: { gap: space.sm },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.md,
    minHeight: minTouch,
  },
  thumb: {
    width: 44,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardLabel: {
    fontSize: font.body,
    fontWeight: weight.semibold,
    color: colors.navy,
  },
  cardDate: { marginTop: 4, fontSize: font.small, color: colors.gray },
  pill: { borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 4 },
  pillText: { fontSize: font.tiny, fontWeight: weight.semibold },
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
    fontSize: font.body,
    fontWeight: weight.semibold,
  },
  empty: {
    flex: 1,
    padding: screenPadding,
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    backgroundColor: colors.bg,
  },
  emptyText: { fontSize: font.body, color: colors.gray },
  primary: {
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    minHeight: minTouch,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: colors.white,
    fontSize: font.body,
    fontWeight: weight.semibold,
  },
});
