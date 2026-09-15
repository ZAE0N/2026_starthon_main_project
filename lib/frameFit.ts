/**
 * 촬영 화면의 실시간 안내 — 폰(네이티브) 쪽. 담당: 전정현
 *
 * 가이드 네모를 초록/회색으로 바꿀 판단을 돌려줍니다.
 * 웹에서는 같은 이름의 lib/frameFit.web.ts 가 쓰입니다. Metro 가 알아서 고릅니다.
 *
 * ⚠ 폰과 웹이 **보는 것이 다릅니다.**
 *   웹: 미리보기 화면을 실제로 읽어서 계약서가 네모 안에 들어왔는지 봅니다
 *   폰: 폰이 계약서와 나란한지(수평인지)만 봅니다
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
 * 무엇을 재는가 — 화면이 하늘을 보는 각도 하나입니다:
 *   중력 방향과 화면의 수직선 사이 각도를 봅니다. 폰을 책상에 평평하게 두면 0도,
 *   세우면 90도입니다. 이 값 하나로 좌우·앞뒤 기울기를 **같이** 잡습니다.
 *
 *   처음에는 좌우(roll)만 봤습니다. 앞뒤는 계약서가 책상에 있는지 벽에 있는지
 *   몰라서 판단할 수 없다고 봤기 때문입니다. 그런데 앞뒤로 심하게 기울여도
 *   초록이 그대로 떠서, 안내가 틀린 셈이 됐습니다.
 *
 *   그래서 **계약서가 책상 같은 평평한 곳에 있다고 전제**합니다. 종이 계약서를
 *   찍는 경우가 대부분이고, 그 전제에서는 폰이 수평일 때가 정답입니다.
 *   벽에 붙은 계약서를 정면으로 찍으면 계속 회색인데, 색은 안내일 뿐이라
 *   그 상태로도 촬영은 됩니다.
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
 * 이 각도(도) 안쪽이면 반듯한 것으로 봅니다.
 *
 * 15도는 A4 를 눈높이에서 내려다볼 때 자연스럽게 생기는 기울기까지는 봐주고,
 * 그보다 심하면 걸리는 값입니다. 10도는 손이 조금 흔들려도 회색이 되고,
 * 20도는 사다리꼴로 찍혀 글자가 한쪽으로 몰리는 각도까지 통과합니다.
 */
const LEVEL_DEG = 15;

/** 센서를 읽는 간격 (밀리초). 너무 촘촘하면 색이 깜빡입니다 */
const INTERVAL_MS = 220;

/**
 * 색이 경계에서 떨리지 않게 하는 여유 (도).
 * 초록이 된 뒤에는 LEVEL_DEG + 이 값을 넘어야 다시 회색이 됩니다.
 */
const HYSTERESIS_DEG = 4;

const HINTS: Record<FitState, string> = {
  ok: "좋아요. 그대로 찍어주세요",
  off: "폰을 계약서와 나란히, 수평으로 들어주세요",
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
         * 화면의 수직선이 중력에서 얼마나 벗어났는지.
         *
         * z 는 화면에 수직인 축입니다. 폰을 평평하게 두면 중력이 z 에만 실려
         * |z| = norm 이 되고 각도가 0 입니다. 세우면 z 가 0 이 되어 90도입니다.
         * 좌우로 기울든 앞뒤로 기울든 z 가 같이 줄어들어서, 이 값 하나로
         * 두 방향을 다 잡습니다.
         *
         * 부호는 보지 않습니다. 화면이 하늘을 보든 바닥을 보든 "평평한지" 는
         * 같은 판단이고, 천장을 찍는 경우는 실제로 일어나지 않습니다.
         */
        const flat = Math.acos(Math.min(1, Math.abs(z) / norm));
        const deg = (flat * 180) / Math.PI;

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
