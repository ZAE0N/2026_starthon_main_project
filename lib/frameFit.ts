/**
 * 촬영 화면의 실시간 안내 — 폰(네이티브) 쪽. 담당: 전정현
 *
 * 가이드 네모를 초록/회색으로 바꿀 판단을 돌려줍니다.
 * 웹에서는 같은 이름의 lib/frameFit.web.ts 가 쓰입니다. Metro 가 알아서 고릅니다.
 *
 * ⚠ 폰과 웹이 **보는 것이 다릅니다.**
 *   웹: 미리보기 화면을 실제로 읽어서 계약서가 네모 안에 들어왔는지 봅니다
 *   폰: 폰을 어떻게 들고 있는지(기울기)만 봅니다
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
 * ── 센서로 알 수 있는 것과 알 수 없는 것 ──────────────────────────
 *
 *   가속도계는 **중력 방향 하나만** 알려줍니다. 폰이 어떻게 놓였는지는 알지만
 *   계약서가 어느 면에 있는지는 모릅니다. 그래서 "폰이 계약서와 나란한가" 는
 *   센서만으로는 원리적으로 알 수 없습니다.
 *
 *   대신 계약서가 놓이는 면은 실제로 두 가지뿐입니다. 둘 다 중력만으로 판정이
 *   되므로 **둘 다 초록으로 봅니다.**
 *
 *     책상 모드 — 계약서가 수평면(책상·바닥)에 있다. 폰을 그 위에 평평하게
 *                 들면 나란하다. 화면의 수직축이 중력과 같은 방향이 된다
 *     벽 모드   — 계약서가 수직면(벽·손·모니터)에 있다. 폰을 세워서 정면으로
 *                 들면 나란하다. 화면의 수직축이 수평이 된다
 *
 *   전에는 책상 모드만 봤습니다. 그래서 계약서를 손에 들거나 벽에 붙여놓고
 *   폰을 세워서 찍으면 그 각도가 90도가 되어 **절대 초록이 되지 않았습니다.**
 *
 *   벽 모드에서는 좌우 회전(roll)까지 같이 봅니다. 폰을 세우면 중력이 화면
 *   안에서 아래를 가리키는데, 그 방향이 화면 아래가 아니라 옆을 가리키면
 *   사진이 돌아간 채로 찍힙니다. 글자 줄이 기울면 서버의 줄 찾기가 그대로
 *   망가지기 때문에, 이건 막아야 합니다. 책상 모드에서는 중력이 화면 안에
 *   거의 남지 않아서 이 값을 믿을 수 없고, 볼 필요도 없습니다.
 *
 *   가운데(폰을 45도쯤 기울인 상태)는 회색입니다. 그 각도에서는 계약서가
 *   사다리꼴로 찍혀서 글자가 한쪽으로 몰립니다. 계약서도 같이 45도로 기울어
 *   있다면 나란한 게 맞지만, 그건 센서로 구분할 수 없고 드문 경우입니다.
 *
 *   색은 안내일 뿐입니다. 회색이어도 촬영은 됩니다. 찍은 뒤에 서버가 사진을
 *   한 번 더 검사합니다(server/textlines.py 의 check).
 *
 * 부호를 쓰지 않는 이유:
 *   같은 자세에서 iOS 와 안드로이드가 축의 부호를 반대로 주는 경우가 있습니다.
 *   그래서 아래 계산은 **절댓값만** 씁니다. 화면이 하늘을 보든 바닥을 보든
 *   "평평한지" 는 같은 판단이고, 천장을 찍는 경우는 실제로 일어나지 않습니다.
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
 * 책상 모드에서 봐주는 각도 (도).
 *
 * 15도는 A4 를 눈높이에서 내려다볼 때 자연스럽게 생기는 기울기까지는 봐주고,
 * 그보다 심하면 걸리는 값입니다. 10도는 손이 조금 흔들려도 회색이 되고,
 * 20도는 사다리꼴로 찍혀 글자가 한쪽으로 몰리는 각도까지 통과합니다.
 */
const LEVEL_DEG = 15;

/**
 * 벽 모드에서 봐주는 각도 (도). 완전한 수직에서 이만큼까지 봅니다.
 *
 * 책상 모드보다 넉넉합니다. 벽이나 손에 든 계약서는 딱 수직인 경우가 드물어서
 * 15도로 잡으면 실제로 나란히 들었는데도 회색이 됩니다. 20도면 45도짜리
 * 어정쩡한 자세는 그대로 걸립니다.
 */
const UPRIGHT_DEG = 20;

/** 센서를 읽는 간격 (밀리초). 너무 촘촘하면 색이 깜빡입니다 */
const INTERVAL_MS = 220;

/**
 * 색이 경계에서 떨리지 않게 하는 여유 (도).
 * 초록이 된 뒤에는 허용 각도 + 이 값을 넘어야 다시 회색이 됩니다.
 */
const HYSTERESIS_DEG = 4;

/**
 * 판단 결과를 조금 더 잘게 나눈 것. 회색인 **이유**에 따라 안내가 달라야
 * 사용자가 무엇을 고쳐야 할지 압니다. 화면에 넘기는 FitState 는 그대로 셋입니다.
 */
type Detail = "ok" | "roll" | "angle" | "unknown";

const DETAIL_STATE: Record<Detail, FitState> = {
  ok: "ok",
  roll: "off",
  angle: "off",
  unknown: "unknown",
};

const DETAIL_HINTS: Record<Detail, string> = {
  ok: "좋아요. 그대로 찍어주세요",
  // 폰을 세우긴 했는데 옆으로 돌아간 상태. 사진이 기울어 찍힙니다
  roll: "폰을 좌우로 기울이지 말고 똑바로 들어주세요",
  // 책상도 벽도 아닌 어정쩡한 각도
  angle: "폰을 계약서와 나란히 들어주세요",
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
         *   z 는 화면에 수직인 축, x 는 화면의 좌우, y 는 화면의 위아래입니다.
         */
        const ax = Math.abs(x) / norm;
        const ay = Math.abs(y) / norm;
        const az = Math.abs(z) / norm;

        const slack = wasOk.current ? HYSTERESIS_DEG : 0;

        /*
         * 책상 모드 — 폰이 얼마나 평평한지.
         * 평평하게 두면 중력이 z 에만 실려 az = 1 이 되고 각도가 0 입니다.
         */
        const flatDeg = toDeg(Math.acos(Math.min(1, az)));

        /*
         * 벽 모드 — 폰이 얼마나 똑바로 서 있는지.
         * 세우면 z 가 0 이 되어 각도가 0 입니다. flatDeg 와 서로 여각입니다.
         */
        const uprightDeg = toDeg(Math.asin(Math.min(1, az)));

        /*
         * 좌우 회전 — 화면 안에 남은 중력이 아래(y)가 아니라 옆(x)을 가리키는 정도.
         * 똑바로 들면 0 도, 가로로 눕히면 90 도입니다.
         * 폰이 평평할 때는 ax·ay 가 둘 다 0 에 가까워 의미가 없으므로,
         * 벽 모드일 때만 씁니다.
         */
        const rollDeg = toDeg(Math.atan2(ax, ay));

        let next: Detail;
        if (flatDeg <= LEVEL_DEG + slack) {
          // 계약서가 책상에 있고 폰을 그 위에 평평하게 들었다
          next = "ok";
        } else if (uprightDeg <= UPRIGHT_DEG + slack) {
          // 폰을 세웠다. 이제 돌아가지 않았는지만 보면 된다
          next = rollDeg <= LEVEL_DEG + slack ? "ok" : "roll";
        } else {
          next = "angle";
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
