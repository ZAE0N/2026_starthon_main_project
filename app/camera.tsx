/**
 * 사진 선택 화면. 담당: 나영웅
 *
 * ⚠ 이 화면은 카메라 화면이 아닙니다.
 *   폰 기본 카메라를 띄우기 때문에 앱 안에 미리보기나 가이드 네모를 만들 수 없습니다.
 *   화면 시안 2번(네이비 배경 + 네모 + 셔터 버튼)은 expo-camera 가 있어야 하는데
 *   그건 이번 범위가 아닙니다. 시안의 "안내 문구" 부분만 가져다 쓰세요.
 *
 * 할 일
 *  - 계약서를 어떻게 찍어야 하는지 안내 (그림 또는 문구)
 *  - 권한 거부 시 copy.errors.permission 안내 띄우기 (지금은 조용히 무시됨)
 *  - 버튼 누른 뒤 사진이 올 때까지 중복 터치 막기
 *
 * 갤러리 버튼은 빼지 마세요. 이미 계약서를 쓰고 사진만 남은 사용자가 주 타깃이고,
 * 매장에서 셔터음 때문에 못 찍는 경우도 있습니다.
 */

import { useState } from "react";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { pickPhoto, takePhoto } from "../lib/photo";
import { clearCurrent, setCurrentPhoto } from "../lib/session";
import {
  colors,
  font,
  minTouch,
  radius,
  screenPadding,
  space,
  weight,
} from "../constants/theme";

export default function Camera() {
  const [busy, setBusy] = useState(false);

  async function choose(source: "camera" | "library") {
    if (busy) return;
    setBusy(true);
    try {
      const photo = source === "camera" ? await takePhoto() : await pickPhoto();
      if (!photo) return; // 취소했거나 권한 거부

      clearCurrent(); // 이전 결과·사진 비우기
      setCurrentPhoto(photo);
      router.replace("/analyzing");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.guide}>
        <Text style={styles.title}>계약서 전체가 보이게 찍어주세요</Text>
        <Text style={styles.sub}>
          글자가 잘리지 않게, 밝은 곳에서 찍으면 더 잘 읽어요.{"\n"}
          뒷장이 있다면 따로 한 번 더 확인해 주세요.
        </Text>
      </View>

      <View style={styles.foot}>
        <Pressable
          style={[styles.primary, busy && styles.disabled]}
          disabled={busy}
          onPress={() => choose("camera")}
        >
          <Text style={styles.primaryText}>사진 찍기</Text>
        </Pressable>
        <Pressable
          style={[styles.secondary, busy && styles.disabled]}
          disabled={busy}
          onPress={() => choose("library")}
        >
          <Text style={styles.secondaryText}>갤러리에서 고르기</Text>
        </Pressable>
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
  guide: { flex: 1, justifyContent: "center" },
  title: { fontSize: font.h2, fontWeight: weight.bold, color: colors.navy },
  sub: {
    marginTop: space.md,
    fontSize: font.body,
    color: colors.navySoft,
    lineHeight: 24,
  },
  foot: { gap: space.sm },
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
  disabled: { opacity: 0.5 },
});
