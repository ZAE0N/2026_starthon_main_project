/**
 * 도움받기 화면. 담당: 신우철
 *
 * 할 일 (화면 시안 8번)
 *  - 카드 디자인 다듬기
 *  - 전화번호를 크게, 누르면 바로 전화 걸리게 (Linking.openURL(`tel:...`))
 *
 * 전화번호와 운영시간은 반드시 copy.help 에서 가져옵니다. 직접 쓰지 마세요.
 */

import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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

export default function Help() {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View>
        <Text style={styles.title}>혼자 해결이{"\n"}어려울 때</Text>
        <Text style={styles.sub}>
          전화하면 노무사가 무료로 상담해줘요.{"\n"}
          기록해둔 계약서를 보여주면 더 빨라요.
        </Text>
      </View>

      <View style={styles.list}>
        {copy.help.map((h) => (
          <Pressable
            key={h.tel}
            style={styles.card}
            onPress={() => Linking.openURL(`tel:${h.tel}`)}
          >
            <Text style={styles.name}>{h.name}</Text>
            <Text style={styles.desc}>{h.desc}</Text>
            <Text style={styles.tel}>{h.tel}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: screenPadding, backgroundColor: colors.bg, gap: space.lg },
  title: {
    fontSize: font.h2,
    fontWeight: weight.bold,
    color: colors.navy,
    lineHeight: 30,
  },
  sub: {
    marginTop: space.sm,
    fontSize: font.small,
    color: colors.gray,
    lineHeight: 21,
  },
  list: { gap: space.sm },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: space.md,
    minHeight: minTouch,
  },
  name: {
    fontSize: font.body,
    fontWeight: weight.semibold,
    color: colors.navy,
  },
  desc: {
    marginTop: 5,
    fontSize: font.small,
    color: colors.gray,
    lineHeight: 20,
  },
  tel: {
    marginTop: space.sm,
    fontSize: font.h2,
    fontWeight: weight.bold,
    color: colors.mintText,
  },
});
