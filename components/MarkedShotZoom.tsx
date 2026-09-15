/**
 * 형광펜 그은 계약서 크게 보기. 담당: 전정현
 *
 * 폰 너비에서는 계약서 글자가 원래 안 읽힙니다. 1600px 사진을 390px 로 줄여
 * 보여주니까요. 그래서 표시가 어디에 그어졌는지는 작은 사진으로 알 수 있어도
 * 무엇에 그어졌는지는 크게 봐야 알 수 있습니다.
 *
 * 결과 화면과 표시된 계약서 화면이 같은 것을 씁니다.
 */

import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MarkedShot from "./MarkedShot";
import type { Clause } from "../types";
import {
  colors,
  font,
  minTouch,
  radius,
  space,
  verdictStyle,
  weight,
} from "../constants/theme";

type Props = {
  visible: boolean;
  uri: string;
  /** 표시할 조항. types 의 getMarked 결과를 넘깁니다 */
  clauses: Clause[];
  onClose: () => void;
};

export default function MarkedShotZoom({
  visible,
  uri,
  clauses,
  onClose,
}: Props) {
  /* 어떤 색이 무슨 뜻인지. 그은 종류만 보여줍니다 */
  const kinds = [...new Set(clauses.map((c) => c.verdict))];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.back}>
        {kinds.length > 0 ? (
          <View style={styles.legend}>
            {kinds.map((v) => (
              <View key={v} style={styles.legendItem}>
                <View
                  style={[styles.swatch, { backgroundColor: verdictStyle[v].color }]}
                />
                <Text style={styles.legendText}>{verdictStyle[v].label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/*
          긴 계약서는 화면에 다 안 들어와서 세로로 스크롤됩니다.
          사진 자체를 눌러 닫게 하면 스크롤하려고 손을 댈 때마다 닫히므로,
          닫는 버튼을 따로 둡니다.
        */}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
          <MarkedShot uri={uri} clauses={clauses} />
        </ScrollView>

        <Pressable
          style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="닫기"
        >
          <Text style={styles.closeText}>닫기</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  back: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    padding: space.md,
    gap: space.md,
  },

  legend: { flexDirection: "row", gap: space.md, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: space.xs },
  swatch: { width: 14, height: 8, borderRadius: 2 },
  legendText: { color: colors.grayLight, fontSize: font.tiny },

  scroll: { alignSelf: "stretch" },
  body: { paddingBottom: space.md },

  close: {
    alignSelf: "stretch",
    minHeight: minTouch,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grayLight,
    alignItems: "center",
    justifyContent: "center",
  },
  closePressed: { backgroundColor: "rgba(255, 255, 255, 0.12)" },
  closeText: {
    color: colors.white,
    fontSize: font.body,
    fontWeight: weight.semibold,
  },
});
