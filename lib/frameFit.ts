/**
 * 촬영 화면의 실시간 안내 — 폰(네이티브) 쪽. 담당: 전정현
 *
 * 가이드 네모를 초록/회색으로 바꿀 판단을 돌려줍니다.
 * 웹에서는 같은 이름의 lib/frameFit.web.ts 가 쓰입니다. Metro 가 알아서 고릅니다.
 *
 * ⚠ 폰과 웹이 **보는 것이 다릅니다.**
 *   웹: 미리보기 화면을 실제로 읽어서 계약서가 네모 안에 들어왔는지 봅니다
 *   폰: 폰이 돌아가 있지 않은지만 봅니다
 *
 * 왜 폰에서는 화면을 못 읽는가:
 *   expo-camera 57.0.5 가 주는 콜백은 onCameraReady · onMountError ·
 *   onBarcodeScanned · onPictureSaved 뿐입니다. **프레임 픽셀을 주는 콜백이
 *   없습니다.** onBarcodeScanned 는 프레임을 돌리지만 바코드 문자열만 줍니다.
 *   프레임을 받는 react-native-vision-camera 는 개발 빌드(EAS)가 필요해서
 *   QR 로 여는 방식 자체가 바뀝니다.
 *
 *   takePictureAsync 를 반복해서(shutterSound: false, animateShutter={false})
 *   작은 사진을 찍는 건 됩니다. 다만 JPEG 을 폰에서 픽셀로 풀 방법이 없어서
 *   서버로 보내 Pillow 로 봐야 합니다. 그건 별도 작업입니다.
 *
 * ── 무엇을 재는가: 좌우 회전 하나입니다 ────────────────────────────
 *
 *   가속도계는 **중력 방향 하나만** 알려줍니다. 폰이 어떻게 놓였는지는 알지만
 *   계약서가 어느 면에 있는지는 모릅니다. 그래서 "폰이 계약서와 나란한가" 는
 *   센서만으로는 원리적으로 알 수 없습니다.
 *
 *   앞뒤 기울기(pitch)는 그래서 판단하지 않습니다. 계약서를 손에 들고 있으면
 *   계약서도 같이 기울어 있어서, 폰이 기울었다는 사실만으로는 비뚤게 찍힌다고
 *   말할 수 없습니다.
 *
 *   전에는 계약서가 책상에 평평하게 있다고 전제하고 앞뒤 기울기를 봤습니다.
 *   그래서 계약서를 손에 들거나 벽에 붙여놓고 찍으면 **절대 초록이 되지
 *   않았습니다.** 전제가 틀린 경우를 막고 있던 셈입니다.
 *
 *   대신 **좌우 회전(roll)** 은 봅니다. 이건 계약서가 어디 있든 상관없이
 *   사진을 망칩니다. 폰이 옆으로 돌아가면 글자 줄이 기울어 찍히고, 서버의
 *   줄 찾기(server/textlines.py)는 행별 잉크 투영이라 글자 줄이 기울면
 *   그대로 어긋납니다. 모델도 표를 잘못 읽습니다.
 *
 *   폰이 책상에 거의 평평하게 놓이면 중력이 화면 안에 거의 남지 않아서
 *   좌우 회전을 **알아낼 수 없습니다.** 그때는 판단하지 않고 통과시킵니다.
 *   평평하게 놓은 상태는 애초에 비뚤게 찍히지 않습니다.
 *
 *   색은 안내일 뿐입니다. 회색이어도 촬영은 됩니다. 찍은 뒤에 서버가 사진을
 *   한 번 더 검사합니다(server/textlines.py 의 check).
 *
 * 부호를 쓰지 않는 이유:
 *   같은 자세에서 iOS 와 안드로이드가 축의 부호를 반대로 주는 경우가 있습니다.
 *   그래서 아래 계산은 **절댓값만** 씁니다.
 */

import { useEffect, useRef, useState } from "react";
import { Accelerometer } from "expo-sensors";

/** ok = 초록, off = 회색(아직 아님), unknown = 판단 못 함(회색) */
export type FitState = "ok" | "off" | "unknown";

export type FrameFit = {
  state: FitState;
  /** 네모 아래에 보여줄 한 줄. 상태에 따라 바뀝니다 */
  hint: string;
};

/**
 * 좌우로 이만큼(도) 돌아가면 회색입니다.
 *
 * 15도는 손이 조금 흔들리는 정도는 봐주고, 눈에 보이게 기운 사진은 걸리는
 * 값입니다. 8도짜리 사진으로 서버 줄 찾기를 돌려봤을 때 글자 영역 비율이
 * 0.17 까지 떨어졌습니다. 그보다 더 기울면 판독이 어긋나기 시작합니다.
 */
const LEVEL_DEG = 15;

/**
 * 좌우 회전을 믿고 판단할 수 있는 최소 중력 성분.
 *
 * 폰을 책상에 평평하게 두면 중력이 화면에 수직인 축(z)에만 실려서 화면 안에
 * 남는 성분이 0 에 가까워집니다. 그 상태에서 atan2 를 쓰면 센서 잡음이 그대로
 * 각도가 되어 색이 멋대로 깜빡입니다.
 *
 * 0.25 는 평평한 상태에서 약 14도 기울인 지점입니다. 그 안쪽은 판단하지 않고
 * 통과시킵니다 — 평평하게 놓고 찍는 건 원래 문제가 없습니다.
 */
const MIN_INPLANE = 0.25;

/** 센서를 읽는 간격 (밀리초). 너무 촘촘하면 색이 깜빡입니다 */
const INTERVAL_MS = 220;

/**
 * 색이 경계에서 떨리지 않게 하는 여유 (도).
 * 초록이 된 뒤에는 LEVEL_DEG + 이 값을 넘어야 다시 회색이 됩니다.
 */
const HYSTERESIS_DEG = 4;

/**
 * 판단 결과. 회색인 이유가 하나뿐이라 문구도 하나입니다.
 * 화면에 넘기는 FitState 는 그대로 셋입니다.
 */
type Detail = "ok" | "roll" | "unknown";

const DETAIL_STATE: Record<Detail, FitState> = {
  ok: "ok",
  roll: "off",
  unknown: "unknown",
};

const DETAIL_HINTS: Record<Detail, string> = {
  ok: "좋아요. 그대로 찍어주세요",
  roll: "폰이 옆으로 돌아갔어요. 똑바로 들어주세요",
  unknown: "초록 네모 안에 계약서 전체가 들어오게 맞춰주세요",
};

/** 라디안 → 도 */
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * @param active 카메라가 열려 있을 때만 true 를 넘기세요. false 면 센서를 끕니다.
 * @param _hostRef 웹 쪽과 같은 모양을 유지하기 위한 자리입니다. 폰에서는 쓰지 않습니다.
 * @param _frameRef 같은 이유입니다.
 */
export function useFrameFit(
  active: boolean,
  _hostRef?: unknown,
  _frameRef?: unknown
): FrameFit {
  const [detail, setDetail] = useState<Detail>("unknown");
  /** 직전에 초록이었는지. 경계에서 색이 떨리지 않게 하는 데 씁니다 */
  const wasOk = useRef(false);

  useEffect(() => {
    if (!active) {
      setDetail("unknown");
      wasOk.current = false;
      return;
    }

    let alive = true;
    let sub: { remove: () => void } | null = null;

    (async () => {
      const ok = await Accelerometer.isAvailableAsync().catch(() => false);
      if (!alive || !ok) {
        // 센서가 없는 기기에서는 판단하지 않습니다. 네모는 회색으로 둡니다.
        setDetail("unknown");
        return;
      }

      Accelerometer.setUpdateInterval(INTERVAL_MS);

      sub = Accelerometer.addListener(({ x, y, z }) => {
        const norm = Math.hypot(x, y, z);
        if (norm < 0.5) return; // 자유낙하처럼 읽히는 순간은 버립니다

        /*
         * 중력을 길이 1 로 맞춘 뒤 절댓값만 씁니다.
         *   x 는 화면의 좌우, y 는 화면의 위아래, z 는 화면에 수직인 축입니다.
         */
        const ax = Math.abs(x) / norm;
        const ay = Math.abs(y) / norm;

        /* 화면 안에 남은 중력의 크기. 평평하게 두면 0 에 가깝습니다 */
        const inPlane = Math.hypot(ax, ay);

        let next: Detail;
        if (inPlane < MIN_INPLANE) {
          // 거의 평평합니다. 회전을 알 수 없고, 알 필요도 없습니다.
          next = "ok";
        } else {
          /*
           * 화면 안의 중력이 아래(y)가 아니라 옆(x)을 가리키는 정도.
           * 똑바로 들면 0 도, 가로로 눕히면 90 도입니다.
           * 앞뒤로 얼마나 기울었는지는 이 값에 섞이지 않습니다.
           */
          const rollDeg = toDeg(Math.atan2(ax, ay));
          const limit = wasOk.current ? LEVEL_DEG + HYSTERESIS_DEG : LEVEL_DEG;
          next = rollDeg <= limit ? "ok" : "roll";
        }

        wasOk.current = next === "ok";
        setDetail(next);
      });
    })();

    return () => {
      alive = false;
      sub?.remove();
    };
  }, [active]);

  return { state: DETAIL_STATE[detail], hint: DETAIL_HINTS[detail] };
}
