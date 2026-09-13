/**
 * 기록함 화면. 담당: 전정현
 *
 * 계약서를 돌려줘도 사본이 남는다는 것이 이 화면의 존재 이유입니다.
 * 그래서 사진 썸네일이 중요합니다. 어느 계약서였는지 날짜만으로는 구분이 안 됩니다.
 *
 * 이름 바꾸기와 삭제는 "⋯" 버튼 하나에 모아뒀습니다.
 * 카드를 누르면 결과가 열려야 하므로, 관리 동작은 따로 분리해야 합니다.
 */

import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { countIllegal, getIssues, type InspectResult } from "../types";
import { setCurrent } from "../lib/session";
import { deleteResult, loadHistory, updateResult } from "../lib/storage";
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
  /** 이름을 바꾸는 중인 기록. null 이면 입력창을 닫습니다. */
  const [renaming, setRenaming] = useState<InspectResult | null>(null);
  const [draft, setDraft] = useState("");

  const reload = useCallback(async () => {
    const h = await loadHistory();
    setItems(h);
  }, []);

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

  function openMenu(item: InspectResult) {
    Alert.alert(item.title || "이름 없는 계약서", undefined, [
      {
        text: "이름 바꾸기",
        onPress: () => {
          setDraft(item.title ?? "");
          setRenaming(item);
        },
      },
      {
        text: "삭제",
        style: "destructive",
        onPress: () => confirmDelete(item),
      },
      { text: "취소", style: "cancel" },
    ]);
  }

  function confirmDelete(item: InspectResult) {
    Alert.alert(
      "이 기록을 지울까요?",
      "사진과 판정 결과가 함께 지워지고 되돌릴 수 없어요.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            await deleteResult(item.id);
            await reload();
          },
        },
      ]
    );
  }

  async function saveName() {
    const item = renaming;
    if (!item) return;
    setRenaming(null);
    // 빈 칸으로 저장하면 "이름 없는 계약서" 로 되돌아갑니다.
    await updateResult(item.id, { title: draft.trim() });
    await reload();
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
    <>
      <ScrollView contentContainerStyle={styles.screen}>
        <Text style={styles.note}>{copy.historyNote}</Text>

        <View style={styles.list}>
          {items.map((item) => {
            const issues = getIssues(item).length;
            const illegal = countIllegal(item);
            const s =
              illegal > 0
                ? verdictStyle.위법소지
                : issues > 0
                  ? verdictStyle.확인필요
                  : verdictStyle.문제없음;

            return (
              <Pressable
                key={item.id}
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.cardPressed,
                ]}
                onPress={() => open(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title || "이름 없는 계약서"}, ${formatDate(item.createdAt)}, ${
                  issues > 0 ? `확인할 곳 ${issues}곳` : "이상 없음"
                }`}
              >
                {/* 사진이 있으면 보여줍니다. 복사가 실패했으면 imagePath 가 빈 문자열입니다. */}
                {item.imagePath ? (
                  <Image
                    source={{ uri: item.imagePath }}
                    style={styles.thumb}
                    resizeMode="cover"
                    accessible={false}
                  />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]}>
                    <Text style={styles.thumbMark}>문서</Text>
                  </View>
                )}

                <View style={styles.cardBody}>
                  <Text style={styles.cardLabel} numberOfLines={1}>
                    {item.title || "이름 없는 계약서"}
                  </Text>
                  <Text style={styles.cardDate}>
                    {formatDate(item.createdAt)}
                  </Text>
                </View>

                <View style={[styles.pill, { backgroundColor: s.bg }]}>
                  <Text style={[styles.pillText, { color: s.color }]}>
                    {issues > 0 ? `${issues}곳` : "이상 없음"}
                  </Text>
                </View>

                <Pressable
                  style={styles.more}
                  onPress={() => openMenu(item)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="이름 바꾸기 또는 삭제"
                >
                  <Text style={styles.moreMark}>⋯</Text>
                </Pressable>
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

      {/* 이름 입력. Alert.prompt 는 iOS 전용이라 직접 만듭니다. */}
      <Modal
        visible={renaming !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRenaming(null)}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>이름 바꾸기</Text>
            <Text style={styles.sheetSub}>
              어디서 받은 계약서인지 적어두면 나중에 찾기 쉬워요.
            </Text>

            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="예: ○○편의점"
              placeholderTextColor={colors.grayLight}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveName}
              maxLength={30}
            />

            <View style={styles.sheetRow}>
              <Pressable
                style={[styles.sheetButton, styles.sheetCancel]}
                onPress={() => setRenaming(null)}
              >
                <Text style={styles.sheetCancelText}>취소</Text>
              </Pressable>
              <Pressable
                style={[styles.sheetButton, styles.sheetSave]}
                onPress={saveName}
              >
                <Text style={styles.sheetSaveText}>저장</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
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
  cardPressed: { backgroundColor: colors.surface },

  thumb: {
    width: 44,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  thumbEmpty: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  thumbMark: { fontSize: font.tiny, color: colors.grayLight },

  cardBody: { flex: 1, minWidth: 0 },
  cardLabel: {
    fontSize: font.body,
    fontWeight: weight.semibold,
    color: colors.navy,
  },
  cardDate: { marginTop: 4, fontSize: font.small, color: colors.gray },

  pill: { borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 4 },
  pillText: { fontSize: font.tiny, fontWeight: weight.semibold },

  more: { paddingHorizontal: space.xs, paddingVertical: space.xs },
  moreMark: { fontSize: font.h2, color: colors.grayLight, lineHeight: 22 },

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

  /* 이름 입력 */
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(18, 41, 77, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: screenPadding,
  },
  sheet: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  sheetTitle: {
    fontSize: font.h2,
    fontWeight: weight.bold,
    color: colors.navy,
  },
  sheetSub: { fontSize: font.small, color: colors.gray, lineHeight: 20 },
  input: {
    marginTop: space.xs,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: minTouch,
    fontSize: font.body,
    color: colors.navy,
  },
  sheetRow: { flexDirection: "row", gap: space.sm, marginTop: space.xs },
  sheetButton: {
    flex: 1,
    borderRadius: radius.md,
    minHeight: minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCancel: { borderWidth: 1, borderColor: colors.line },
  sheetCancelText: {
    color: colors.navy,
    fontSize: font.body,
    fontWeight: weight.semibold,
  },
  sheetSave: { backgroundColor: colors.navy },
  sheetSaveText: {
    color: colors.white,
    fontSize: font.body,
    fontWeight: weight.semibold,
  },
});
