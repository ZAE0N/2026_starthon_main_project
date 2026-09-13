/**
 * 사진 선택 화면. 담당: 나영웅
 *
 * ⚠ 이 화면은 카메라 화면이 아닙니다.
 *   폰 기본 카메라를 띄우기 때문에 앱 안에 미리보기나 가이드 네모를 만들 수 없습니다.
 *   화면 시안 2번(네이비 배경 + 네모 + 셔터 버튼)은 expo-camera 가 있어야 하는데
 *   그건 이번 범위가 아닙니다. 시안의 "안내 문구" 부분만 가져다 썼습니다.
 *
 *   대신 네모는 "이렇게 찍어주세요" 를 보여주는 그림으로 넣었습니다.
 *   촬영 미리보기가 아니라 정지된 삽화라서, 사용자가 실제 화면으로 착각하지 않게
 *   회색 문서 모양 안에 글자 자리만 표시해 두었습니다.
 *
 * 갤러리 버튼은 빼지 마세요. 이미 계약서를 쓰고 사진만 남은 사용자가 주 타깃이고,
 * 매장에서 셔터음 때문에 못 찍는 경우도 있습니다.
 */

import { useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getPhotoPermission, pickPhoto, takePhoto } from "../lib/photo";
import { clearCurrent, setCurrentPhoto } from "../lib/session";
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

type Source = "camera" | "library";

/** 시안 2번의 "글자가 잘리지 않게 전체가 보이도록" 을 실제로 지킬 수 있게 풀어 썼습니다. */
const TIPS = [
  "네 귀퉁이가 모두 보이게 맞춰주세요",
  "밝은 곳에서, 그림자가 지지 않게 찍어주세요",
  "뒷장이 있으면 따로 한 번 더 확인해 주세요",
];

export default function Camera() {
  /** 어떤 버튼이 진행 중인지. null 이면 대기 상태입니다. */
  const [busy, setBusy] = useState<Source | null>(null);
  /** 권한이 거부된 경로. 안내를 띄울 때만 값이 들어갑니다. */
  const [denied, setDenied] = useState<Source | null>(null);

  async function choose(source: Source) {
    if (busy) return; // 연타 방지. 사진이 올 때까지 두 번째 터치를 무시합니다.
    setBusy(source);
    setDenied(null);

    try {
      const photo = source === "camera" ? await takePhoto() : await pickPhoto();

      if (!photo) {
	// null 은 "취소" 와 "권한 거부" 두 가지입니다.
        // 권한 상태를 한 번 더 읽어 구분합니다.
        // (취소한 사람에게 권한 안내를 띄우면 더 헷갈립니다.)
        if (!(await getPhotoPermission(source))) setDenied(source);
        setBusy(null);
        return;
      }

      clearCurrent(); // 이전 결과·사진 비우기
      setCurrentPhoto(photo);
      router.replace("/analyzing");
      // busy 는 일부러 되돌리지 않습니다. 화면이 넘어가는 동안 버튼이 다시
      // 눌리면 분석이 두 번 돌고 API 비용이 두 배가 됩니다.
    } catch {
      setBusy(null);
    }
  }

  const permission = copy.errors.permission;

  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.guide}>
        <Text style={styles.title}>계약서 전체가 보이게 찍어주세요</Text>
        <Text style={styles.sub}>
          아래 그림처럼 계약서 한 장이 화면에 다 들어오면 돼요.
        </Text>

        {/* 촬영 예시 그림 — 실제 카메라 화면이 아닙니다 */}
        <View style={styles.artWrap} accessible={false}>
          <View style={styles.paper}>
            <View style={[styles.skeleton, styles.skeletonTitle]} />
            <View style={[styles.skeleton, styles.skeletonFull]} />
            <View style={[styles.skeleton, styles.skeletonFull]} />
            <View style={[styles.skeleton, styles.skeletonShort]} />
            <View style={[styles.skeleton, styles.skeletonFull]} />
            <View style={[styles.skeleton, styles.skeletonMid]} />

            {/* 네 귀퉁이 표시 */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
        </View>

        <View style={styles.tips}>
          {TIPS.map((tip) => (
            <View key={tip} style={styles.tipRow}>
              <View style={styles.tipDot} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.foot}>
        {denied !== null && (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>{permission.title}</Text>
            <Text style={styles.noticeBody}>{permission.body}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.noticeButton,
                pressed && styles.noticeButtonPressed,
              ]}
              onPress={() => {
                void Linking.openSettings();
              }}
              accessibilityRole="button"
              accessibilityLabel={permission.action}
            >
              <Text style={styles.noticeButtonText}>{permission.action}</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.primary,
            pressed && styles.primaryPressed,
            busy !== null && styles.dim,
          ]}
          disabled={busy !== null}
          onPress={() => choose("camera")}
          accessibilityRole="button"
          accessibilityLabel="사진 찍기"
          accessibilityState={{ disabled: busy !== null, busy: busy === "camera" }}
        >
          {busy === "camera" ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryText}>사진 찍기</Text>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.secondary,
            pressed && styles.secondaryPressed,
            busy !== null && styles.dim,
          ]}
          disabled={busy !== null}
          onPress={() => choose("library")}
          accessibilityRole="button"
          accessibilityLabel="갤러리에서 고르기"
          accessibilityState={{
            disabled: busy !== null,
            busy: busy === "library",
          }}
        >
          {busy === "library" ? (
            <ActivityIndicator color={colors.navy} />
          ) : (
            <Text style={styles.secondaryText}>갤러리에서 고르기</Text>
          )}
        </Pressable>

        <Text style={styles.footNote}>
          이미 찍어둔 계약서 사진이 있다면 갤러리에서 골라도 돼요.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    padding: screenPadding,
    justifyContent: "space-between",
    backgroundColor: colors.bg,
  },

  guide: { flex: 1, justifyContent: "center", paddingVertical: space.lg },
  title: { fontSize: font.h2, fontWeight: weight.bold, color: colors.navy },
  sub: {
    marginTop: space.sm,
    fontSize: font.body,
    color: colors.navySoft,
    lineHeight: 24,
  },

  /* 촬영 예시 그림 */
  artWrap: { alignItems: "center", marginTop: space.lg },
  paper: {
    width: "68%",
    aspectRatio: 0.74,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    justifyContent: "center",
    gap: space.sm,
  },
  skeleton: { height: 6, borderRadius: radius.sm, backgroundColor: colors.line },
  skeletonTitle: {
    height: 10,
    width: "52%",
    marginBottom: space.xs,
    backgroundColor: colors.grayLight,
  },
  skeletonFull: { width: "100%" },
  skeletonMid: { width: "78%" },
  skeletonShort: { width: "45%" },

  corner: {
    position: "absolute",
    width: 22,
    height: 22,
    borderColor: colors.mint,
    borderWidth: 3,
  },
  cornerTL: {
    top: -3,
    left: -3,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: radius.sm,
  },
  cornerTR: {
    top: -3,
    right: -3,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: radius.sm,
  },
  cornerBL: {
    bottom: -3,
    left: -3,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: radius.sm,
  },
  cornerBR: {
    bottom: -3,
    right: -3,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: radius.sm,
  },

  /* 안내 문구 */
  tips: { marginTop: space.lg, gap: space.sm },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  tipDot: {
    width: 5,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: colors.mint,
    marginTop: 7,
  },
  tipText: {
    flex: 1,
    fontSize: font.small,
    color: colors.gray,
    lineHeight: 20,
  },

  /* 하단 */
  foot: { gap: space.sm },

  notice: {
    backgroundColor: colors.amberBg,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
  },
  noticeTitle: {
    fontSize: font.body,
    fontWeight: weight.semibold,
    color: colors.amber,
  },
  noticeBody: {
    marginTop: space.xs,
    fontSize: font.small,
    color: colors.navySoft,
    lineHeight: 20,
  },
  noticeButton: {
    marginTop: space.sm,
    alignSelf: "flex-start",
    minHeight: minTouch,
    justifyContent: "center",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.amber,
  },
  noticeButtonPressed: { opacity: 0.6 },
  noticeButtonText: {
    fontSize: font.small,
    fontWeight: weight.semibold,
    color: colors.amber,
  },

  primary: {
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    minHeight: minTouch,
    paddingVertical: space.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryPressed: { backgroundColor: colors.navyPressed },
  primaryText: {
    color: colors.white,
    fontSize: font.body,
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
  secondaryPressed: { backgroundColor: colors.surface },
  secondaryText: {
    color: colors.navy,
    fontSize: font.body,
    fontWeight: weight.semibold,
  },

  footNote: {
    marginTop: space.xs,
    textAlign: "center",
    fontSize: font.tiny,
    color: colors.gray,
    lineHeight: 18,
  },

  dim: { opacity: 0.5 },
});
