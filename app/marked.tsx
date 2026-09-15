/**
 * 형광펜 그은 계약서. 담당: 전정현
 *
 * 분석이 끝나면 결과 목록으로 바로 넘기지 않고 이 화면을 한 번 거칩니다.
 * 방금 찍은 계약서에서 문제가 되는 대목에 형광펜을 그어서 보여줍니다.
 *
 * 왜 이 화면이 있는가:
 *   결과 목록만 보여주면 "앱이 그렇다더라" 로 끝납니다. 자기가 사인한 종이에
 *   줄이 그어진 걸 보면 그 줄이 무슨 뜻인지 알고 싶어집니다. 그 상태로
 *   결과 화면에 들어가는 것과, 아무 맥락 없이 목록을 보는 것은 다릅니다.
 *
 * 왜 몇 초 뒤 자동으로 넘기지 않는가:
 *   1.5~2초는 계약서를 읽기엔 짧고 멈춤으로 느끼기엔 깁니다. 훑는 중에 화면이
 *   사라지면 궁금증이 아니라 짜증이 됩니다. 발표할 때도 자동으로 넘어가면
 *   설명하는 동안 화면이 먼저 지나갑니다. 그래서 사용자가 직접 넘깁니다.
 *
 * 표시할 게 없으면(전부 문제없음, 사진 없음, 자리를 못 받음) 이 화면은
 * 아예 열리지 않습니다. 분석중 화면이 결과로 바로 보냅니다. (app/analyzing.tsx)
 */

import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Maximize2 } from "lucide-react-native";
import MarkedShot from "../components/MarkedShot";
import MarkedShotZoom from "../components/MarkedShotZoom";
import { getMarked } from "../types";
import { useCurrent, useCurrentPhoto } from "../lib/session";
import {
  colors,
  font,
  markStyle,
  minTouch,
  radius,
  screenPadding,
  space,
  verdictStyle,
  weight,
} from "../constants/theme";

export default function Marked() {
  const result = useCurrent();
  const photo = useCurrentPhoto();
  const [zoom, setZoom] = useState(false);

  /*
   * 결과가 없는데 이 화면이 열리는 경우 — 앱을 껐다 켜고 주소로 바로 들어오거나,
   * 새로고침으로 session 이 비었을 때입니다. 빈 화면을 보여주는 대신 처음으로 보냅니다.
   */
  useEffect(() => {
    if (!result) router.replace("/");
  }, [result]);

  if (!result) return null;

  // 결과 화면과 같은 규칙입니다. 사진 저장이 실패하면 session 의 원본을 씁니다.
  const shot = result.imagePath || photo?.uri || "";
  const marked = getMarked(result);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>{marked.length}곳에 표시했어요</Text>
        <Text style={styles.sub}>
          계약서에서 확인해볼 대목이에요. 무슨 뜻인지는 다음 화면에 있어요.
        </Text>

        {shot !== "" ? (
          <Pressable
            style={styles.shotWrap}
            onPress={() => setZoom(true)}
            accessibilityRole="button"
            accessibilityLabel="계약서 크게 보기"
          >
            <MarkedShot uri={shot} clauses={marked} />

            {/*
              폰 너비에서는 계약서 글자가 원래 안 읽힙니다. 눌러서 크게 볼 수
              있다는 것을 알려줘야 표시가 의미를 가집니다.
            */}
            <View style={styles.zoomHint} pointerEvents="none">
              <Maximize2 size={13} color={colors.white} strokeWidth={2.2} />
              <Text style={styles.zoomHintText}>눌러서 크게 보기</Text>
            </View>
          </Pressable>
        ) : null}

        {/*
          사진에 그은 순서(위 -> 아래)와 같습니다.
          왼쪽 색칠은 사진의 형광펜 색과 같아서 어느 표시가 어느 항목인지 잇습니다.
        */}
        <View style={styles.list}>
          {marked.map((c) => {
            const v = verdictStyle[c.verdict];

            return (
              <View key={c.id} style={styles.row}>
                {/* 흰 종이 위의 형광펜과 같게 보이도록 흰 바탕에 올립니다 */}
                <View style={styles.swatch}>
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: markStyle[c.verdict].pen },
                    ]}
                  />
                </View>

                <Text style={styles.rowLabel}>{c.label}</Text>

                {/* 색만으로 구분하지 않습니다. 글자를 항상 같이 보여줍니다 */}
                <View style={[styles.pill, { backgroundColor: v.bg }]}>
                  <Text style={[styles.pillText, { color: v.color }]}>
                    {v.label}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.foot}>
        <Pressable
          style={({ pressed }) => [
            styles.primary,
            pressed && styles.primaryPressed,
          ]}
          /*
           * replace 입니다. push 로 쌓으면 결과 화면에서 뒤로 갈 때 이 화면이
           * 다시 나오는데, 결과를 본 뒤에 되돌아올 자리는 아닙니다.
           * 다시 보고 싶으면 결과 화면 왼쪽 위 사진을 누르면 됩니다.
           */
          onPress={() => router.replace("/result")}
          accessibilityRole="button"
          accessibilityLabel="결과 자세히 보기"
        >
          <Text style={styles.primaryText}>결과 자세히 보기</Text>
        </Pressable>
      </View>

      <MarkedShotZoom
        visible={zoom}
        uri={shot}
        clauses={marked}
        onClose={() => setZoom(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: screenPadding, paddingBottom: space.xl },

  title: {
    fontSize: font.h2,
    fontWeight: weight.semibold,
    color: colors.navy,
  },
  sub: {
    marginTop: space.sm,
    fontSize: font.small,
    color: colors.gray,
    lineHeight: 20,
  },

  shotWrap: { marginTop: space.md },
  zoomHint: {
    position: "absolute",
    right: space.sm,
    bottom: space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.full,
    backgroundColor: "rgba(18, 41, 77, 0.78)",
  },
  zoomHintText: { color: colors.white, fontSize: font.tiny },

  list: { marginTop: space.md, gap: space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  /* 사진의 형광펜과 같은 색. 반투명이라 흰 바탕에 올려야 같은 색이 됩니다 */
  swatch: {
    width: 18,
    height: 10,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: colors.white,
  },
  rowLabel: {
    flex: 1,
    fontSize: font.body,
    fontWeight: weight.medium,
    color: colors.navy,
  },
  pill: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.full,
  },
  pillText: { fontSize: font.tiny, fontWeight: weight.semibold },

  foot: {
    padding: screenPadding,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
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
});
