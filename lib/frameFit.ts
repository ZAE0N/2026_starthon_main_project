/**
 * 촬영 화면의 실시간 안내 — 폰(네이티브) 쪽. 담당: 전정현
 *
 * 가이드 네모를 초록/회색으로 바꿀 판단을 돌려줍니다.
 * 웹에서는 같은 이름의 lib/frameFit.web.ts 가 쓰입니다. Metro 가 알아서 고릅니다.
 *
 * ⚠ 폰과 웹이 **보는 것이 다릅니다.**
 *   웹: 미리보기 화면을 실제로 읽어서 계약서가 네모 안에 들어왔는지 봅니다
 *   폰: 폰이 좌우로 기울었는지만 봅니다
 *
 * 왜 폰에서는 화면을 못 읽는가:
 *   Expo Go 에서 카메라 미리보기의 프레임을 받아올 방법이 없습니다. expo-camera 에
 *   그 기능이 없고, 있는 react-native-vision-camera 는 개발 빌드(EAS)가 필요해서
 *   QR 로 여는 방식 자체가 바뀝니다. takePictureAsync 를 반복해도 JPEG 을 픽셀로
 *   풀 방법이 없습니다.
 *
 * 왜 기울기라도 보는가:
 *   비뚤게 찍힌 사진이 판독을 가장 많이 망칩니다. 글자가 기울면 모델이 표를
 *   잘못 읽고, 서버의 줄 찾기(server/textlines.py)도 어긋납니다.
 *   그래서 폰에서는 "반듯하게 들었는지" 를 대신 봅니다.
 *
 * 좌우 기울기(roll)만 봅니다. 앞뒤 기울기는 판단할 수 없습니다. 책상에 놓인
 * 계약서를 내려다보는지, 벽에 붙은 걸 정면으로 찍는지 알 수 없어서, 앞뒤를
 * 보려면 계약서가 어디 놓였는지를 알아야 합니다.
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

/** 이 각도(도) 안쪽이면 반듯한 것으로 봅니다 */
const LEVEL_DEG = 8;

/** 센서를 읽는 간격 (밀리초). 너무 촘촘하면 색이 깜빡입니다 */
const INTERVAL_MS = 220;

/**
 * 색이 경계에서 떨리지 않게 하는 여유 (도).
 * 초록이 된 뒤에는 LEVEL_DEG + 이 값을 넘어야 다시 회색이 됩니다.
 */
const HYSTERESIS_DEG = 4;

const HINTS: Record<FitState, string> = {
  ok: "좋아요. 그대로 찍어주세요",
  off: "폰을 좌우로 기울이지 말고 반듯하게 들어주세요",
  unknown: "초록 네모 안에 계약서 전체가 들어오게 맞춰주세요",
};

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
  const [state, setState] = useState<FitState>("unknown");
  /** 직전 상태. 경계에서 색이 떨리지 않게 하는 데 씁니다 */
  const wasOk = useRef(false);

  useEffect(() => {
    if (!active) {
      setState("unknown");
      wasOk.current = false;
      return;
    }

    let alive = true;
    let sub: { remove: () => void } | null = null;

    (async () => {
      const ok = await Accelerometer.isAvailableAsync().catch(() => false);
      if (!alive || !ok) {
        // 센서가 없는 기기에서는 판단하지 않습니다. 네모는 회색으로 둡니다.
        setState("unknown");
        return;
      }

      Accelerometer.setUpdateInterval(INTERVAL_MS);

      sub = Accelerometer.addListener(({ x, y, z }) => {
        const norm = Math.hypot(x, y, z);
        if (norm < 0.5) return; // 자유낙하처럼 읽히는 순간은 버립니다

        /*
         * 좌우 기울기. 폰을 세로로 들었을 때 x 가 좌우 축입니다.
         * 중력 대비 x 성분의 각도라, 책상을 내려다볼 때든 정면을 찍을 때든
         * "좌우로 기울었는지" 를 같은 방식으로 알 수 있습니다.
         */
        const roll = Math.abs(Math.asin(Math.min(1, Math.abs(x) / norm)));
        const deg = (roll * 180) / Math.PI;

        const limit = wasOk.current ? LEVEL_DEG + HYSTERESIS_DEG : LEVEL_DEG;
        const next = deg <= limit;

        wasOk.current = next;
        setState(next ? "ok" : "off");
      });
    })();

    return () => {
      alive = false;
      sub?.remove();
    };
  }, [active]);

  return { state, hint: HINTS[state] };
}
