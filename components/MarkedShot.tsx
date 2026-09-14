/**
 * 채점된 계약서. 담당: 전정현
 *
 * 계약서 사진 위에 문제가 있는 대목마다 형광펜처럼 띠를 긋고 번호를 붙입니다.
 * 결과 화면과 표시된 계약서 화면이 같은 것을 쓰므로 여기만 고치면 둘 다 바뀝니다.
 *
 * 왜 가로 띠인가:
 *   위치는 서버가 모델에게 물어서 받습니다(Clause.mark). 세로 위치는 표의 칸을
 *   거의 맞추는데, 네모 박스로 그리면 몇 픽셀 어긋난 게 그대로 보입니다.
 *   가로로 꽉 찬 띠는 위아래만 맞으면 줄을 그은 것처럼 보여서 같은 오차가
 *   눈에 띄지 않습니다. 시나리오 4장으로 두 방식을 그려보고 정했습니다.
 *
 * 띠를 어떻게 앉히는가:
 *   mark 는 "사진 전체 높이의 몇 %" 입니다. 그래서 사진이 화면에 그려진 높이를
 *   알아야 합니다. 여기서는 사진의 원래 가로세로비를 읽어서 그 비율로 칸을
 *   만들고, 사진을 그 칸에 꽉 채웁니다. 칸과 사진의 비율이 같으니 잘리는 곳이
 *   없고, 퍼센트를 그대로 쓸 수 있습니다.
 */

import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import type { Clause } from "../types";
import { colors, font, markStyle, radius, weight } from "../constants/theme";

/** 사진 비율을 못 읽었을 때 쓸 값. A4 세로 (210 / 297) */
const A4_RATIO = 0.707;

type Props = {
  /** 사진 경로 */
  uri: string;
  /**
   * 표시할 조항. 이미 걸러서 위에서 아래 순으로 정렬된 것을 넘깁니다.
   * types 의 getMarked 를 쓰면 됩니다.
   */
  clauses: Clause[];
  /** 번호 동그라미를 띠 위에 올릴지. 썸네일처럼 작게 쓸 때는 끕니다 */
  showNumbers?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function MarkedShot({
  uri,
  clauses,
  showNumbers = true,
  style,
}: Props) {
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

      {clauses.map((c, i) => {
        const m = c.mark;
        if (!m) return null;

        const s = markStyle[c.verdict];

        return (
          <View
            key={c.id}
            style={[
              styles.band,
              {
                top: `${m.top * 100}%`,
                height: `${(m.bottom - m.top) * 100}%`,
                backgroundColor: s.band,
                borderBottomColor: s.edge,
              },
            ]}
            /* 사진 위의 장식입니다. 읽어줄 내용은 아래 목록에 있습니다 */
            accessible={false}
            pointerEvents="none"
          >
            {showNumbers ? (
              <View style={[styles.num, { backgroundColor: s.edge }]}>
                <Text style={styles.numText}>{i + 1}</Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const NUM_SIZE = 22;

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    overflow: "hidden",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },

  band: {
    position: "absolute",
    left: 0,
    right: 0,
    borderBottomWidth: 2,
  },

  /* 번호 동그라미. 띠의 오른쪽 끝에 세로 가운데로 붙입니다 */
  num: {
    position: "absolute",
    right: 6,
    top: "50%",
    marginTop: -NUM_SIZE / 2,
    width: NUM_SIZE,
    height: NUM_SIZE,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  numText: {
    color: colors.white,
    fontSize: font.tiny,
    fontWeight: weight.bold,
  },
});
