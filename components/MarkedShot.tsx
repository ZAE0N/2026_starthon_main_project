/**
 * 형광펜 그은 계약서. 담당: 전정현
 *
 * 계약서 사진 위에 문제가 있는 글자 줄만 형광펜처럼 칠합니다.
 * 결과 화면과 표시된 계약서 화면이 같은 것을 쓰므로 여기만 고치면 둘 다 바뀝니다.
 *
 * 사진을 고치는 게 아닙니다. 사진은 그대로 두고 그 위에 반투명한 View 를
 * 얹습니다. 그래서 사진 픽셀은 건드리지 않고, 확대해도 원본 그대로입니다.
 *
 * 처음에는 사진 가로 전체에 띠를 그었습니다(모델이 가로를 못 맞힐 거라고 봐서).
 * 실제로 해보니 항목 이름 칸까지 같이 칠해져서 형광펜이 아니라 색 슬래브처럼
 * 보였습니다. 서버에 가로 눈금자를 붙여 글자 끝까지만 잡게 하고, 여기서는
 * 그 네 변만 칠합니다. (server/inspector.py 의 _with_ruler)
 *
 * 번호 동그라미는 일부러 넣지 않았습니다. 폰 너비에서 글자 한 줄이 7px 인데
 * 동그라미는 22px 이라 사진을 덮습니다. 어느 표시가 어느 항목인지는 아래
 * 목록의 색으로 잇습니다.
 *
 * 띠를 어떻게 앉히는가:
 *   mark 는 "사진 전체의 몇 %" 입니다. 그래서 사진이 화면에 그려진 크기를
 *   알아야 합니다. 여기서는 사진의 원래 가로세로비를 읽어서 그 비율로 칸을
 *   만들고, 사진을 그 칸에 꽉 채웁니다. 칸과 사진의 비율이 같으니 잘리는 곳이
 *   없고, 퍼센트를 그대로 쓸 수 있습니다.
 */

import { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import type { Clause } from "../types";
import { colors, markStyle, radius } from "../constants/theme";

/** 사진 비율을 못 읽었을 때 쓸 값. A4 세로 (210 / 297) */
const A4_RATIO = 0.707;

/**
 * 형광펜을 좌우로만 조금 넉넉하게 긋습니다 (사진 너비의 비율).
 *
 * 모델은 글자에 딱 붙는 값을 줍니다. 가로로 딱 맞게 칠하면 글자 끝이 색 밖으로
 * 나와서 자른 것처럼 보입니다. 사람이 형광펜을 그을 때도 좌우로 조금 넘어갑니다.
 *
 * 세로는 여유를 두지 않습니다. 계약서 줄 간격이 좁아서(글자 한 줄이 사진 높이의
 * 0.02) 위아래로 조금만 넓혀도 다음 줄까지 물립니다. 실제로 0.004 를 뒀다가
 * 상여금 줄이 같이 칠해졌습니다.
 */
const PAD_Y = 0;
const PAD_X = 0.005;

type Props = {
  /** 사진 경로 */
  uri: string;
  /**
   * 표시할 조항. 이미 걸러서 위에서 아래 순으로 정렬된 것을 넘깁니다.
   * types 의 getMarked 를 쓰면 됩니다.
   */
  clauses: Clause[];
  style?: StyleProp<ViewStyle>;
};

/** 0~1 로 자릅니다. 여유를 더하다가 사진 밖으로 나가지 않게요 */
function clamp(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export default function MarkedShot({ uri, clauses, style }: Props) {
  /** 사진의 가로 ÷ 세로 */
  const [ratio, setRatio] = useState(A4_RATIO);

  useEffect(() => {
    let alive = true;

    // 실패하면 A4 비율을 그대로 씁니다. 세로 문서라 크게 틀리지 않습니다.
    Image.getSize(
      uri,
      (w, h) => {
        if (alive && w > 0 && h > 0) setRatio(w / h);
      },
      () => {}
    );

    return () => {
      alive = false;
    };
  }, [uri]);

  return (
    <View style={[styles.frame, { aspectRatio: ratio }, style]}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        accessibilityLabel="계약서 사진"
      />

      {clauses.map((c) => {
        const m = c.mark;
        if (!m) return null;

        const top = clamp(m.top - PAD_Y);
        const left = clamp(m.left - PAD_X);
        const height = clamp(m.bottom + PAD_Y) - top;
        const width = clamp(m.right + PAD_X) - left;

        return (
          <View
            key={c.id}
            style={[
              styles.pen,
              {
                top: `${top * 100}%`,
                left: `${left * 100}%`,
                height: `${height * 100}%`,
                width: `${width * 100}%`,
                backgroundColor: markStyle[c.verdict].pen,
              },
            ]}
            /* 사진 위의 표시입니다. 읽어줄 내용은 아래 목록에 있습니다 */
            accessible={false}
            pointerEvents="none"
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    overflow: "hidden",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },

  pen: {
    position: "absolute",
    /* 형광펜 자국처럼 끝을 아주 살짝 둥글게 */
    borderRadius: 2,
  },
});
