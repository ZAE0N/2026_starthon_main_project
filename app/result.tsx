/**
 * 진단 결과 화면. 담당: 전정현
 *
 * 문제없는 항목은 접어둡니다.
 * 8개를 다 펼치면 정작 봐야 할 위법 소지가 아래로 밀립니다.
 * 다만 "숨긴다" 가 아니라 "몇 개가 괜찮았는지" 를 보여줘야 판정이 신뢰됩니다.
 * 그래서 접힌 상태에서도 개수는 항상 보입니다.
 */

import { useState } from "react";
import { router } from "expo-router";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  CHECK_ORDER,
  countIllegal,
  getIssues,
  getOk,
  type Clause,
} from "../types";
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
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push(`/clause/${clause.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${clause.label}, ${s.label}`}
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
  const [showOk, setShowOk] = useState(false);

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
        {/* 사진이 있으면 같이 보여줍니다. 어느 계약서의 결과인지 알 수 있게요. */}
        {result.imagePath ? (
          <Image
            source={{ uri: result.imagePath }}
            style={styles.shot}
            resizeMode="cover"
            accessible={false}
          />
        ) : null}

        <View style={styles.headText}>
          {result.title ? (
            <Text style={styles.place} numberOfLines={1}>
              {result.title}
            </Text>
          ) : null}
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
      </View>

      {issues.length > 0 && (
        <View style={styles.list}>
          {issues.map((c) => (
            <ClauseRow key={c.id} clause={c} />
          ))}
        </View>
      )}

      {ok.length > 0 && (
        <View style={styles.okBlock}>
          <Pressable
            style={({ pressed }) => [styles.toggle, pressed && styles.cardPressed]}
            onPress={() => setShowOk((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showOk }}
            accessibilityLabel={`문제없는 항목 ${ok.length}개 ${showOk ? "접기" : "펼치기"}`}
          >
            <View style={styles.okDot} />
            <Text style={styles.toggleText}>
              문제없는 항목 {ok.length}개
            </Text>
            <Text style={styles.toggleMark}>{showOk ? "접기" : "보기"}</Text>
          </Pressable>

          {showOk && (
            <View style={styles.list}>
              {ok.map((c) => (
                <ClauseRow key={c.id} clause={c} />
              ))}
            </View>
          )}
        </View>
      )}

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

      <View style={styles.foot}>
        <Pressable
          style={styles.secondary}
          onPress={() => router.push("/history")}
        >
          <Text style={styles.secondaryText}>내 기록</Text>
        </Pressable>
        <Pressable
          style={styles.secondary}
          onPress={() => router.replace("/camera")}
        >
          <Text style={styles.secondaryText}>다시 찍기</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: screenPadding, backgroundColor: colors.bg, gap: space.md },

  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  shot: {
    width: 56,
    height: 72,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  headText: { flex: 1, minWidth: 0, gap: space.xs },
  place: { fontSize: font.small, color: colors.mintText, fontWeight: weight.semibold },
  title: { fontSize: font.h2, fontWeight: weight.bold, color: colors.navy },
  headSub: { fontSize: font.small, color: colors.gray, lineHeight: 19 },

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
  cardPressed: { backgroundColor: colors.surface },
  cardBody: { flex: 1, minWidth: 0 },
  cardLabel: {
    fontSize: font.body,
    fontWeight: weight.semibold,
    color: colors.navy,
  },
  cardDesc: { marginTop: 3, fontSize: font.small, color: colors.gray },
  pill: { borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 4 },
  pillText: { fontSize: font.tiny, fontWeight: weight.semibold },

  /* 문제없는 항목 접기 */
  okBlock: { gap: space.sm },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: minTouch,
  },
  okDot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
    backgroundColor: colors.green,
  },
  toggleText: {
    flex: 1,
    fontSize: font.small,
    color: colors.navySoft,
    fontWeight: weight.semibold,
  },
  toggleMark: { fontSize: font.small, color: colors.mintText, fontWeight: weight.semibold },

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

  foot: { flexDirection: "row", gap: space.sm },
  secondary: {
    flex: 1,
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
