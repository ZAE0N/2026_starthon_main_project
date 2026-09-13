/**
 * 조항 상세 화면. 담당: 정윤지
 *
 * 할 일 (화면 시안 5번)
 *  - 제목 옆 판정 배지, 섹션 3개(계약서에 적힌 내용 / 쉽게 말하면 / 근거)
 *  - original 이 빈 문자열이면 인용구 박스를 통째로 숨깁니다 (아래 이미 처리됨)
 *  - 문제없음 항목은 "말할 문장" 버튼을 숨기거나 비활성화
 */

import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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

  /*
   * 문제없음 항목은 말할 문장 버튼을 보여주지 않습니다.
   *
   * verdictStyle에서 사용하는 실제 verdict 값과
   * "문제없음"에 해당하는 값이 무엇인지에 따라
   * 아래 조건은 데이터 타입에 맞게 유지해야 합니다.
   */
  const canShowScript =
    hasScript && clause.verdict !== "문제없음";

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      {/* 제목 + 판정 배지 */}
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

      {/* 계약서 원문 */}
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

      {/* 쉽게 설명 */}
      <View style={styles.section}>
        <Text style={styles.sectionHead}>
          내용 설명
        </Text>

        <Text style={styles.plain}>
          {clause.plain}
        </Text>
      </View>

      {/* 법적 근거 */}
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

      {/* 문제가 있는 조항에서만 말할 문장 버튼 표시 */}
      {canShowScript && (
        <Pressable
          style={styles.primary}
          onPress={() =>
            router.push(`/script?id=${clause.id}`)
          }
        >
          <Text style={styles.primaryText}>
            사장님께 말씀 드릴 문장 추천
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
