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

          /*
           * 화면 전환. 지정하지 않으면 플랫폼 기본값을 쓰는데, 화면마다
           * 성격이 달라서 한 번 정해둡니다.
           *
           * 웹에는 적용되지 않습니다. 전환은 react-native-screens 가
           * 네이티브에서 처리하고 웹에는 그 구현이 없습니다.
           * 브라우저에서 화면이 뚝뚝 바뀌는 것은 그래서이고, 정상입니다.
           */
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        {/*
          촬영 전 조건 질문. 헤더를 숨기고 화면 안에서 뒤로 버튼과 단계 막대를
          직접 그립니다. 질문 화면에 제목 헤더가 같이 있으면 제목이 두 개가 됩니다.
        */}
        <Stack.Screen name="ask" options={{ headerShown: false }} />
        <Stack.Screen name="camera" options={{ title: "계약서 사진" }} />
        {/*
          분석 중에는 뒤로 못 가게 막습니다. 돌아가면 분석이 다시 돕니다.

          전환은 fade 입니다. 촬영 화면에서 여기로, 여기서 결과로 모두
          router.replace 로 갈아타는데 슬라이드가 걸리면 뒤로 가는 것처럼
          보입니다.
        */}
        <Stack.Screen
          name="analyzing"
          options={{
            headerShown: false,
            gestureEnabled: false,
            animation: "fade",
          }}
        />
        {/*
          채점된 계약서. 분석중에서 여기로 갈아타므로 fade 입니다.
          뒤로 가면 분석이 다시 도므로 막습니다.
        */}
        <Stack.Screen
          name="marked"
          options={{
            title: "표시된 계약서",
            gestureEnabled: false,
            animation: "fade",
          }}
        />
        {/* 분석중에서 갈아타므로 결과 화면도 fade 입니다 */}
        <Stack.Screen
          name="result"
          options={{ title: "진단 결과", animation: "fade" }}
        />
        <Stack.Screen name="clause/[id]" options={{ title: "조항 상세" }} />
        <Stack.Screen name="script" options={{ title: "말할 문장" }} />
        <Stack.Screen name="history" options={{ title: "내 계약서" }} />
        <Stack.Screen name="help" options={{ title: "도움받기" }} />
      </Stack>
    </>
  );
}
