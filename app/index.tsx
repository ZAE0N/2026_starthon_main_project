/**
 * 랜딩 화면. 담당: 신우철
 *
 * 지금은 흐름이 이어지는지 확인하려고 최소한만 만들어 둔 상태입니다.
 * 화면 시안 1번을 보고 다듬어 주세요.
 *
 * 할 일
 *  - 시안대로 문구·여백 다듬기 ("서명하기 전 3분이면 됩니다")
 *  - 통계 숫자 영역 (민트 세로선 + 큰 숫자)
 *  - 아래 privacy 문구는 copy.privacyShort 를 그대로 씁니다. 직접 쓰지 마세요.
 *
 * 주의: 시안에는 "서버로 보내지 않아요" 라고 적혀 있는데 사실과 다릅니다.
 *      판정하려면 서버로 보내야 합니다. copy.privacyShort 가 맞는 문구입니다.
 */

import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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

export default function Landing() {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.title}>서명하기 전{"\n"}3분이면 됩니다</Text>
        <Text style={styles.sub}>
          계약서를 사진으로 찍으면 무엇이 잘못됐는지, 그리고 사장님께 뭐라고
          말할지 알려드려요.
        </Text>
      </View>

      <View style={styles.foot}>
        <Pressable
          style={styles.primary}
          onPress={() => router.push("/camera")}
        >
          <Text style={styles.primaryText}>계약서 촬영하기</Text>
        </Pressable>

        <View style={styles.row}>
          <Pressable
            style={styles.secondary}
            onPress={() => router.push("/history")}
          >
            <Text style={styles.secondaryText}>내 기록</Text>
          </Pressable>
          <Pressable
            style={styles.secondary}
            onPress={() => router.push("/help")}
          >
            <Text style={styles.secondaryText}>도움받기</Text>
          </Pressable>
        </View>

        <Text style={styles.note}>{copy.privacyShort}</Text>
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
  hero: { flex: 1, justifyContent: "center", paddingVertical: space.xl },
  title: { fontSize: font.h1, fontWeight: weight.bold, color: colors.navy, lineHeight: 38 },
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
  row: { flexDirection: "row", gap: space.sm },
  secondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    minHeight: minTouch,
    paddingVertical: space.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: colors.navy,
    fontSize: font.small,
    fontWeight: weight.semibold,
  },
  note: {
    marginTop: space.sm,
    fontSize: font.tiny,
    color: colors.gray,
    textAlign: "center",
    lineHeight: 17,
  },
});
