/**
 * 진단 결과 화면. 담당: 전정현
 *
 * 할 일
 *  - 문제없음 항목 접기/펼치기
 *  - 사진 썸네일
 *  - 기록함에 이름 붙이기
 */

import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CHECK_ORDER, countIllegal, getIssues, getOk, type Clause } from "../types";
import { useCurrent } from "../lib/session";
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

function ClauseRow({ clause }: { clause: Clause }) {
  const s = verdictStyle[clause.verdict];
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/clause/${clause.id}`)}
    >
      <View style={styles.cardBody}>
        <Text style={styles.cardLabel}>{clause.label}</Text>
        <Text style={styles.cardDesc} numberOfLines={1}>
          {clause.plain}
        </Text>
      </View>
      {/* 색만으로 구분하지 않습니다. 글자를 항상 같이 보여줍니다. */}
      <View style={[styles.pill, { backgroundColor: s.bg }]}>
        <Text style={[styles.pillText, { color: s.color }]}>{s.label}</Text>
      </View>
    </Pressable>
  );
}

export default function Result() {
  const result = useCurrent();

  if (!result) {
    // 앱을 껐다 켜면 비어 있습니다.
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>결과가 없어요.</Text>
        <Pressable style={styles.primary} onPress={() => router.replace("/")}>
          <Text style={styles.primaryText}>처음으로</Text>
        </Pressable>
      </View>
    );
  }

  const issues = getIssues(result);
  const ok = getOk(result);
  const illegal = countIllegal(result);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.head}>
        <Text style={styles.title}>
          {issues.length > 0
            ? `${issues.length}곳을 확인해보세요`
            : "문제를 찾지 못했어요"}
        </Text>
        <Text style={styles.headSub}>
          {CHECK_ORDER.length}개 항목 중 {issues.length}개에 확인할 점이 있어요
          {illegal > 0 ? ` (위법 소지 ${illegal}개)` : ""}
        </Text>
      </View>

      <View style={styles.list}>
        {issues.map((c) => (
          <ClauseRow key={c.id} clause={c} />
        ))}
        {ok.map((c) => (
          <ClauseRow key={c.id} clause={c} />
        ))}
      </View>

      {result.assumptions.length > 0 && (
        <View style={styles.assume}>
          {result.assumptions.map((a) => (
            <Text key={a} style={styles.assumeText}>
              · {a}
            </Text>
          ))}
        </View>
      )}

      <Text style={styles.disclaimer}>{copy.disclaimer}</Text>

      <Pressable
        style={styles.secondary}
        onPress={() => router.replace("/camera")}
      >
        <Text style={styles.secondaryText}>다시 찍기</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: screenPadding, backgroundColor: colors.bg, gap: space.md },
  head: { gap: space.xs },
  title: { fontSize: font.h2, fontWeight: weight.bold, color: colors.navy },
  headSub: { fontSize: font.small, color: colors.gray },
  list: { gap: space.sm },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.md,
    minHeight: minTouch,
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardLabel: {
    fontSize: font.body,
    fontWeight: weight.semibold,
    color: colors.navy,
  },
  cardDesc: { marginTop: 3, fontSize: font.small, color: colors.gray },
  pill: { borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 4 },
  pillText: { fontSize: font.tiny, fontWeight: weight.semibold },
  assume: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.xs,
  },
  assumeText: { fontSize: font.small, color: colors.navySoft, lineHeight: 20 },
  disclaimer: {
    fontSize: font.tiny,
    color: colors.gray,
    textAlign: "center",
    lineHeight: 17,
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
