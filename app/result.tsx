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
  Modal,
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
import { USING_MOCK } from "../lib/api";
import { useCurrent, useCurrentPhoto } from "../lib/session";
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

/**
 * 결과 화면 위에 보여줄 사업장 이름.
 *
 * title 은 모델이 사진에서 읽은 값입니다. 잘못 읽으면 엉뚱한 말이 굵게 뜨는데,
 * 사용자는 그게 확인된 정보라고 믿습니다. 회의에서 "상단 정보가 이상하다" 고
 * 지적된 부분입니다.
 *
 * 그래서 사업장 이름으로 보기 어려운 값은 아예 감춥니다. 이름이 없어도 아래
 * 판정 요약이 있으니 화면은 멀쩡합니다.
 *
 * 기록함에서 사용자가 직접 붙인 이름도 이 필드에 들어옵니다(최대 30자).
 * 그건 감추면 안 되므로 길이 기준을 30자로 맞췄습니다.
 */
function placeName(title?: string): string {
  const t = (title ?? "").replace(/\s+/g, " ").trim();
  if (t === "") return "";
  if (t.length > 30) return "";
  // 문서 이름이나 양식 제목을 사업장 이름으로 읽어오는 경우가 있습니다.
  if (/근로계약서|표준계약서|계약서$|근로자|사용자$/.test(t)) return "";
  // 숫자와 기호만 남은 값은 읽기에 실패한 것입니다.
  if (!/[가-힣A-Za-z]/.test(t)) return "";
  return t;
}

export default function Result() {
  const result = useCurrent();
  const photo = useCurrentPhoto();
  const [showOk, setShowOk] = useState(false);
  /** 사진을 크게 보는 중인지 */
  const [zoom, setZoom] = useState(false);

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
  /** 옛 기록에는 notes 가 없습니다. 그때는 섹션을 숨깁니다 */
  const notes = result.notes ?? [];
  const illegal = countIllegal(result);
  /** 사진에서 읽은 사업장 이름. 읽기에 실패한 값은 빈 문자열입니다 */
  const place = placeName(result.title);

  /**
   * 화면에 보여줄 사진.
   *
   * imagePath 는 폰에 복사된 경로입니다. lib/storage.ts 의 savePhoto 는 복사가
   * 실패하면 빈 문자열을 돌려주는데(판정 결과를 잃지 않으려고 일부러 그렇게 둠),
   * 그러면 방금 찍은 계약서인데도 사진이 안 보였습니다.
   *
   * 웹에서는 FileSystem 복사가 아예 안 돼서 항상 그 상태가 됩니다.
   * 그래서 복사가 실패하면 session 에 들고 있는 원본을 그대로 씁니다.
   * session 은 앱을 껐다 켜면 비므로, 기록함에서 다시 열 때는 imagePath 만 씁니다.
   */
  const shot = result.imagePath || photo?.uri || "";

  return (
    <>
      <ScrollView contentContainerStyle={styles.screen}>
        {/*
        개발 중에만 보이는 표시. 목 모드는 어떤 계약서를 넣어도 같은 결과가 나오는데,
        그걸 모르면 "AI가 오판정한다" 로 오해합니다. 실제로 두 번 그랬습니다.
        __DEV__ 는 릴리즈 빌드에서 false 라 사용자에게는 보이지 않습니다.
      */}
      {__DEV__ && USING_MOCK ? (
        <View style={styles.devNotice}>
          <Text style={styles.devNoticeText}>
            가짜 데이터입니다. 어떤 계약서를 넣어도 같은 결과가 나옵니다.
          </Text>
          <Text style={styles.devNoticeText}>
            .env 의 EXPO_PUBLIC_USE_MOCK 을 false 로 바꾸고
            npx expo start -c 로 다시 켜세요.
          </Text>
        </View>
      ) : null}

      <View style={styles.head}>
          {/* 사진이 있으면 같이 보여줍니다. 어느 계약서의 결과인지 알 수 있게요. */}
          {shot !== "" ? (
            <Pressable
              onPress={() => setZoom(true)}
              accessibilityRole="button"
              accessibilityLabel="계약서 사진 크게 보기"
            >
              <Image
                source={{ uri: shot }}
                style={styles.shot}
                resizeMode="cover"
              />
            </Pressable>
          ) : null}

          <View style={styles.headText}>
            {place !== "" ? (
              <Text style={styles.place} numberOfLines={1}>
                {place}
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

        {/*
          몰랐을 수도 있는 것 — 판정이 아니라 안내입니다.
          배지를 붙이지 마세요. 위법소지처럼 보이면 사용자가 그걸 위반으로 믿습니다.
          해당되는 조건이 없으면 섹션 자체가 안 보입니다. 빈 제목만 남기지 않습니다.
          설계: FEATURE_hidden-conditions-design.md
        */}
        {notes.length > 0 && (
          <View style={styles.notes}>
            <Text style={styles.notesHead}>몰랐을 수도 있는 것</Text>

            {notes.map((n) => (
              <View key={n.id} style={styles.note}>
                <Text style={styles.noteText}>{n.text}</Text>

                {n.law !== "" && (
                  <Text style={styles.noteLaw}>{n.law}</Text>
                )}
              </View>
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

      {/*
        사진 크게 보기. 판정이 이상할 때 원본을 눈으로 확인할 수 있어야 합니다.
        흐리게 찍혀서 잘못 읽은 것인지, 정말 그렇게 적혀 있는 것인지 가려야 하니까요.
      */}
      <Modal
        visible={zoom}
        transparent
        animationType="fade"
        onRequestClose={() => setZoom(false)}
      >
        <Pressable
          style={styles.zoomBack}
          onPress={() => setZoom(false)}
          accessibilityRole="button"
          accessibilityLabel="닫기"
        >
          <Image
            source={{ uri: shot }}
            style={styles.zoomShot}
            resizeMode="contain"
          />

          <Text style={styles.zoomHint}>아무 곳이나 눌러 닫기</Text>
        </Pressable>
      </Modal>
    </>
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

  /* 개발용 표시 (릴리즈에서는 안 보임) */
  devNotice: {
    gap: space.xs,
    backgroundColor: colors.amberBg,
    borderRadius: radius.md,
    padding: space.md,
  },
  devNoticeText: { fontSize: font.small, color: colors.amber, lineHeight: 19 },

  /* 사진 크게 보기 */
  zoomBack: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: space.md,
    gap: space.md,
  },
  zoomShot: { width: "100%", flex: 1 },
  zoomHint: { fontSize: font.small, color: colors.grayLight },

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
  notes: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.md,
  },
  notesHead: {
    fontSize: font.small,
    fontWeight: weight.semibold,
    color: colors.navy,
  },
  note: { gap: space.xs },
  noteText: { fontSize: font.small, color: colors.navySoft, lineHeight: 21 },
  noteLaw: { fontSize: font.tiny, color: colors.gray },

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
