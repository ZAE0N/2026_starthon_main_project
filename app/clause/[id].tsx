/**
 * 조항 상세 화면. 담당: 정윤지
 *
 * 할 일 (화면 시안 5번)
 *  - 제목 옆 판정 배지, 섹션 3개(계약서에 적힌 내용 / 쉽게 말하면 / 근거)
 *  - original 이 빈 문자열이면 인용구 박스를 통째로 숨깁니다
 *  - 문제없음 항목은 "말할 문장" 버튼을 숨깁니다
 */

import { router, useLocalSearchParams } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { findClause } from "../../types";
import { useCurrent } from "../../lib/session";

import {
  colors,
  font,
  minTouch,
  radius,
  screenPadding,
  space,
  verdictStyle,
  weight,
} from "../../constants/theme";

export default function ClauseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const result = useCurrent();

  const clause = result
    ? findClause(result, id ?? "")
    : undefined;

  if (!clause) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          조항을 찾지 못했어요.
        </Text>
      </View>
    );
  }

  const verdict = verdictStyle[clause.verdict];

  const hasScript = Boolean(
    clause.scripts.soft || clause.scripts.firm
  );

  const canShowScript =
    hasScript && clause.verdict !== "문제없음";

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>
          {clause.label}
        </Text>

        <View
          style={[
            styles.pill,
            {
              backgroundColor: verdict.bg,
            },
          ]}
        >
          <Text
            style={[
              styles.pillText,
              {
                color: verdict.color,
              },
            ]}
          >
            {verdict.label}
          </Text>
        </View>
      </View>

      {clause.original !== "" && (
        <View style={styles.section}>
          <Text style={styles.sectionHead}>
            계약서 내용
          </Text>

          <Text style={styles.quote}>
            {clause.original}
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionHead}>
          내용 설명
        </Text>

        <Text style={styles.plain}>
          {clause.plain}
        </Text>
      </View>

      {clause.law !== "" && (
        <View style={styles.section}>
          <Text style={styles.sectionHead}>
            근거
          </Text>

          <Text style={styles.law}>
            {clause.law}
          </Text>
        </View>
      )}

      {canShowScript && (
        <Pressable
          style={styles.primary}
          onPress={() =>
            router.push(`/script?id=${clause.id}`)
          }
        >
          <Text style={styles.primaryText}>
            이렇게 말해보세요.
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: screenPadding,
    backgroundColor: colors.bg,
    gap: space.lg,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    flexWrap: "wrap",
  },

  title: {
    fontSize: font.h2,
    fontWeight: weight.bold,
    color: colors.navy,
    flexShrink: 1,
  },

  pill: {
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },

  pillText: {
    fontSize: font.tiny,
    fontWeight: weight.semibold,
  },

  section: {
    gap: space.sm,
  },

  sectionHead: {
    fontSize: font.tiny,
    color: colors.gray,
  },

  quote: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: space.md,
    fontSize: font.small,
    lineHeight: 23,
    color: colors.navySoft,
  },

  plain: {
    fontSize: font.body,
    lineHeight: 26,
    color: colors.navy,
  },

  law: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    fontSize: font.small,
    color: colors.navySoft,
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
