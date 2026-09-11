/**
 * 분석 중 화면. 담당: 나영웅
 *
 * 이 화면이 서버 호출과 저장까지 담당합니다. 흐름은 건드리지 말고
 * 보이는 부분(스피너, 문구, 통계 카드, 진행 막대)만 다듬어 주세요.
 *
 * 할 일
 *  - 시안 3번처럼 스피너 + "계약서를 읽고 있어요" + 통계 + 진행 막대
 *  - 20초쯤 지나면 "조금만 더 걸려요" 로 문구 바꾸기 (타임아웃은 45초)
 *  - 에러 화면 다듬기
 *
 * 에러 화면 만드는 법: 서버가 없어도 .env 에서 에러를 만들어낼 수 있습니다.
 *   EXPO_PUBLIC_MOCK_ERROR=timeout   →  npx expo start -c  (캐시 지우기 필수)
 *   timeout / network / server / unreadable / notContract 다섯 가지
 */

import { useEffect, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { ApiError, inspectContract, type ApiErrorKind } from "../lib/api";
import { getCurrentPhoto, setCurrent } from "../lib/session";
import { saveResult } from "../lib/storage";
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

export default function Analyzing() {
  const [errorKind, setErrorKind] = useState<ApiErrorKind | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      const photo = getCurrentPhoto();
      if (!photo) {
        router.replace("/camera");
        return;
      }

      try {
        const result = await inspectContract(photo.base64);

        // 사진을 폰에 복사하고 경로가 채워진 결과를 돌려받습니다.
        // 이 반환값을 setCurrent 에 넣어야 결과·기록함 화면에 사진이 보입니다.
        const saved = await saveResult(result, photo.uri);

        if (!alive) return;
        setCurrent(saved);
        router.replace("/result");
      } catch (e) {
        if (!alive) return;
        setErrorKind(e instanceof ApiError ? e.kind : "server");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (errorKind) {
    const msg = copy.errors[errorKind];
    const retryToCamera =
      errorKind === "unreadable" || errorKind === "notContract";

    return (
      <View style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.title}>{msg.title}</Text>
          <Text style={styles.sub}>{msg.body}</Text>
        </View>
        <Pressable
          style={styles.primary}
          onPress={() =>
            retryToCamera ? router.replace("/camera") : router.replace("/camera")
          }
        >
          <Text style={styles.primaryText}>{msg.action}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.mint} />
        <Text style={styles.title}>계약서를 읽고 있어요</Text>
        <Text style={styles.sub}>잠시만 기다려 주세요</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: screenPadding,
    justifyContent: "space-between",
    backgroundColor: colors.bg,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: {
    marginTop: space.lg,
    fontSize: font.h2,
    fontWeight: weight.semibold,
    color: colors.navy,
    textAlign: "center",
  },
  sub: {
    marginTop: space.sm,
    fontSize: font.body,
    color: colors.gray,
    textAlign: "center",
    lineHeight: 22,
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
});
