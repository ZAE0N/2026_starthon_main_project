/**
 * 공통 레이아웃. 담당: 전정현
 *
 * 화면 제목과 헤더 스타일을 여기서 한 번에 정합니다.
 * 각 화면 파일에서 헤더를 따로 만들지 마세요.
 */

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors, font, weight } from "../constants/theme";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.navy,
          headerTitleStyle: {
            fontSize: font.body,
            fontWeight: weight.semibold,
            color: colors.navy,
          },
          headerShadowVisible: false,
          headerBackTitle: "뒤로",
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="camera" options={{ title: "계약서 사진" }} />
        {/* 분석 중에는 뒤로 못 가게 막습니다. 돌아가면 분석이 다시 돕니다. */}
        <Stack.Screen
          name="analyzing"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen name="result" options={{ title: "진단 결과" }} />
        <Stack.Screen name="clause/[id]" options={{ title: "조항 상세" }} />
        <Stack.Screen name="script" options={{ title: "말할 문장" }} />
        <Stack.Screen name="history" options={{ title: "내 계약서" }} />
        <Stack.Screen name="help" options={{ title: "도움받기" }} />
      </Stack>
    </>
  );
}
