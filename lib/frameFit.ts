/**
 * 촬영 화면의 실시간 안내 — 폰(네이티브) 쪽. 담당: 전정현
 *
 * 가이드 네모를 초록/회색으로 바꿀 판단을 돌려줍니다.
 * 웹에서는 같은 이름의 lib/frameFit.web.ts 가 쓰입니다. Metro 가 알아서 고릅니다.
 *
 * ── 폰에서 미리보기를 어떻게 읽는가 ────────────────────────────────
 *
 * expo-camera 57.0.5 가 주는 콜백은 onCameraReady · onMountError ·
 * onBarcodeScanned · onPictureSaved 뿐입니다. **프레임 픽셀을 주는 콜백이
 * 없습니다.** 프레임을 주는 react-native-vision-camera 는 개발 빌드(EAS)가
 * 필요해서 QR 로 여는 방식 자체가 바뀝니다.
 *
 * 그래서 이렇게 합니다.
 *
 *   1초에 한 번 takePictureAsync (셔터음·셔터 애니메이션 끔)
 *     → 320px 로 줄여서 (expo-image-manipulator)
 *     → 서버 POST /frame (Pillow 만, OpenAI 안 부름, 실측 5ms)
 *     → 종이의 자리를 0~1 비율로 받아서
 *     → 가이드 네모와 겹치는지 계산
 *
 * 판정을 서버에 맡기지 않고 자리만 받는 이유: 가이드 네모가 화면의 어디인지는
 * 앱만 압니다. 미리보기가 잘려 보이는 정도(cover)도 기기마다 다릅니다.
 * 계산은 여기서 하고, 서버는 사진에서 찾을 수 있는 것만 돌려줍니다.
 *
 * 판정 기준(SLACK · MIN_FILL)은 **lib/frameFit.web.ts 와 같은 값**입니다.
 * 한쪽만 고치면 폰과 웹이 다르게 판정합니다. server/paperbox.py 도 같습니다.
 *
 * ── 서버에 못 물었을 때 ────────────────────────────────────────────
 *
 * 촬영은 모든 흐름의 입구입니다. 서버가 죽었다고 여기서 막으면 앱 전체가
 * 멈춥니다. 그래서 서버에 못 물으면 **가속도계로 좌우 회전만** 봅니다.
 *
 * 기울기로는 그 이상 판단하지 않습니다. 가속도계는 중력 방향만 알려주고
 * 계약서가 어느 면에 있는지는 모릅니다. 그래서 "폰이 계약서와 나란한가" 는
 * 센서만으로는 원리적으로 알 수 없습니다. 계약서를 손에 들고 있으면 계약서도
 * 같이 기울어 있어서, 폰이 45도 기울었다는 사실이 비뚤게 찍힌다는 뜻이
 * 아닙니다.
 *
 * 좌우 회전(roll)만은 계약서가 어디 있든 사진을 망칩니다. 글자 줄이 기울어
 * 찍히면 server/textlines.py 의 행별 잉크 투영이 그대로 어긋납니다.
 *
 * ── 색은 안내일 뿐입니다 ───────────────────────────────────────────
 *
 * 회색이어도 촬영은 됩니다. 찍은 뒤에 서버가 사진을 한 번 더 검사합니다
 * (server/textlines.py 의 check). 여기서 사진을 막으면 안 됩니다.
 */

import { useEffect, useRef, useState } from "react";
import { Accelerometer } from "expo-sensors";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import { findPaper } from "./api";

/** ok = 초록, off = 회색(아직 아님), unknown = 판단 못 함(회색) */
export type FitState = "ok" | "off" | "unknown";

export type FrameFit = {
  state: FitState;
  /** 네모 아래에 보여줄 한 줄. 상태에 따라 바뀝니다 */
  hint: string;
};

/* ------------------------------------------------------------------ */
/* 기준값 — web 쪽과 같아야 합니다                                       */
/* ------------------------------------------------------------------ */

/** 가이드 네모 밖으로 이만큼(네모 크기의 비율)까지는 나가도 봐줍니다 */
const SLACK = 0.06;

/** 종이가 네모의 이 비율만큼은 채워야 합니다. 멀리서 작게 찍으면 글자를 못 읽습니다 */
const MIN_FILL = 0.55;

/**
 * 종이가 사진 가장자리에 이만큼 안쪽까지 닿았으면 잘린 것으로 봅니다.
 *
 * 웹은 분석 이미지 너비의 1픽셀(1/160)을 씁니다. 여기서는 서버가 몇 픽셀로
 * 줄였는지 모르므로 그에 맞춘 고정값을 씁니다. (server/paperbox.py 의 SAMPLE_W)
 */
const EDGE = 1 / 160;

/* ------------------------------------------------------------------ */
/* 기준값 — 폰에서만 쓰는 것                                            */
/* ------------------------------------------------------------------ */

/**
 * 사진을 찍는 간격 (밀리초).
 *
 * 한 바퀴에 촬영 200~600ms + 축소 50~150ms + 왕복 100~300ms 가 듭니다.
 * 그래서 이 값을 더 줄여도 빨라지지 않습니다. 이전 바퀴가 끝나기 전에는
 * 다음 바퀴를 시작하지 않습니다(busy 로 막습니다).
 */
const TICK_MS = 900;

/** 서버로 보낼 사진의 너비. 종이 테두리를 찾는 데는 이 정도면 충분합니다 */
const THUMB_W = 320;

/** 보낼 사진의 JPEG 압축률. 테두리만 보면 되므로 낮게 잡습니다 */
const THUMB_COMPRESS = 0.4;

/**
 * 서버 답을 이 시간(밀리초)까지만 믿습니다.
 *
 * 지났으면 기울기 판단으로 돌아갑니다. 서버가 도중에 죽었을 때 마지막 답이
 * 화면에 계속 붙어 있으면, 초록인 채로 굳어서 더 헷갈립니다.
 */
const STALE_MS = 2600;

/** measureInWindow 콜백이 안 오는 경우가 있습니다. 이만큼 기다리고 포기합니다 */
const MEASURE_TIMEOUT_MS = 300;

/* 기울기 폴백용 ---------------------------------------------------- */

/** 좌우로 이만큼(도) 돌아가면 회색입니다 */
const LEVEL_DEG = 15;

/**
 * 좌우 회전을 믿고 판단할 수 있는 최소 중력 성분.
 *
 * 폰을 책상에 평평하게 두면 중력이 화면에 수직인 축(z)에만 실려서 화면 안에
 * 남는 성분이 0 에 가까워집니다. 그 상태에서 atan2 를 쓰면 센서 잡음이 그대로
 * 각도가 되어 색이 멋대로 깜빡입니다. 0.25 는 평평한 상태에서 약 14도입니다.
 */
const MIN_INPLANE = 0.25;

/** 센서를 읽는 간격 (밀리초) */
const INTERVAL_MS = 220;

/** 색이 경계에서 떨리지 않게 하는 여유 (도) */
const HYSTERESIS_DEG = 4;

/* ------------------------------------------------------------------ */

/**
 * 판단 결과. 회색인 이유에 따라 안내가 달라야 사용자가 무엇을 고칠지 압니다.
 * 화면에 넘기는 FitState 는 그대로 셋입니다.
 */
type Detail = "ok" | "outside" | "roll" | "unknown";

const DETAIL_STATE: Record<Detail, FitState> = {
  ok: "ok",
  outside: "off",
  roll: "off",
  unknown: "unknown",
};

const DETAIL_HINTS: Record<Detail, string> = {
  ok: "좋아요. 그대로 찍어주세요",
  // 서버가 종이를 찾았는데 네모를 벗어났거나 너무 작습니다
  outside: "계약서 네 귀퉁이가 초록 네모 안에 들어오게 맞춰주세요",
  // 서버에 못 물어서 기울기만 보는 중이고, 폰이 옆으로 돌아갔습니다
  roll: "폰이 옆으로 돌아갔어요. 똑바로 들어주세요",
  unknown: "초록 네모 안에 계약서 전체가 들어오게 맞춰주세요",
};

type Rect = { x: number; y: number; w: number; h: number };
type Box = { x0: number; y0: number; x1: number; y1: number };

/** measureInWindow 를 가진 것. RN 의 View ref 가 이 모양입니다 */
type Measurable = {
  measureInWindow?: (
    cb: (x: number, y: number, w: number, h: number) => void
  ) => void;
};

/** takePictureAsync 만 있으면 됩니다. expo-camera 의 CameraView 가 이 모양입니다 */
type Shooter = {
  takePictureAsync?: (options?: {
    quality?: number;
    base64?: boolean;
    exif?: boolean;
    shutterSound?: boolean;
  }) => Promise<{ uri?: string } | undefined>;
};

function current<T>(ref: unknown): T | null {
  const holder = ref as { current?: T | null } | null | undefined;
  return holder?.current ?? null;
}

/** View 의 화면상 자리. 못 재면 null */
function measure(ref: unknown): Promise<Rect | null> {
  const node = current<Measurable>(ref);
  if (!node?.measureInWindow) return Promise.resolve(null);

  return new Promise((resolve) => {
    let done = false;
    const finish = (r: Rect | null) => {
      if (done) return;
      done = true;
      resolve(r);
    };

    // 콜백이 오지 않는 경우가 있습니다(언마운트 직후 등). 걸어두고 넘어갑니다.
    const timer = setTimeout(() => finish(null), MEASURE_TIMEOUT_MS);

    try {
      node.measureInWindow!((x, y, w, h) => {
        clearTimeout(timer);
        finish(w > 0 && h > 0 ? { x, y, w, h } : null);
      });
    } catch {
      clearTimeout(timer);
      finish(null);
    }
  });
}

/**
 * 가이드 네모가 **찍힌 사진의** 어디인지 (0~1 비율).
 *
 * 미리보기는 cover 라서 화면에 보이는 것이 사진의 일부입니다. 그래서 화면
 * 좌표를 사진 좌표로 되돌려야 서버가 준 값과 맞습니다.
 * lib/frameFit.web.ts 의 guideBox() 와 같은 계산입니다.
 */
export function guideInShot(
  preview: Rect,
  guide: Rect,
  iw: number,
  ih: number
): Box | null {
  if (iw <= 0 || ih <= 0 || preview.w <= 0 || preview.h <= 0) return null;

  // cover: 짧은 쪽을 채우도록 확대되고 긴 쪽이 잘립니다
  const scale = Math.max(preview.w / iw, preview.h / ih);
  const offX = (iw * scale - preview.w) / 2;
  const offY = (ih * scale - preview.h) / 2;

  const box = {
    x0: (guide.x - preview.x + offX) / scale / iw,
    y0: (guide.y - preview.y + offY) / scale / ih,
    x1: (guide.x + guide.w - preview.x + offX) / scale / iw,
    y1: (guide.y + guide.h - preview.y + offY) / scale / ih,
  };

  if (box.x1 <= box.x0 || box.y1 <= box.y0) return null;
  return box;
}

/**
 * 종이가 네모 안에 제대로 들어왔는지.
 * lib/frameFit.web.ts 의 판정과 같은 식입니다. 확인용으로 export 합니다.
 */
export function fits(paper: Box, guide: Box, wasOk: boolean): boolean {
  const gw = guide.x1 - guide.x0;
  const gh = guide.y1 - guide.y0;
  if (gw <= 0 || gh <= 0) return false;

  // 초록이 된 뒤에는 여유를 조금 더 줍니다. 손이 떨릴 때 색이 깜빡이지 않게요
  const slack = wasOk ? SLACK * 2 : SLACK;

  const inside =
    paper.x0 >= guide.x0 - gw * slack &&
    paper.y0 >= guide.y0 - gh * slack &&
    paper.x1 <= guide.x1 + gw * slack &&
    paper.y1 <= guide.y1 + gh * slack;

  // 사진 가장자리에 닿았으면 계약서가 잘린 것입니다
  const cut =
    paper.x0 <= EDGE ||
    paper.y0 <= EDGE ||
    paper.x1 >= 1 - EDGE ||
    paper.y1 >= 1 - EDGE;

  const fill = ((paper.x1 - paper.x0) / gw) * ((paper.y1 - paper.y0) / gh);

  return inside && !cut && fill >= MIN_FILL;
}

/** 라디안 → 도 */
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * @param active 카메라가 열려 있을 때만 true 를 넘기세요. false 면 전부 멈춥니다.
 *   **셔터를 누르는 동안에는 false 로 내려주세요.** 안 그러면 안내용 촬영과
 *   실제 촬영이 겹칩니다.
 * @param hostRef 카메라를 감싼 View. 미리보기의 자리를 여기서 잽니다
 * @param frameRef 가이드 네모 View
 * @param camRef CameraView. 안내용 사진을 여기로 찍습니다. 없으면 기울기만 봅니다
 */
export function useFrameFit(
  active: boolean,
  hostRef?: unknown,
  frameRef?: unknown,
  camRef?: unknown
): FrameFit {
  const [detail, setDetail] = useState<Detail>("unknown");

  /** 서버 답. at 이 STALE_MS 보다 오래되면 안 믿습니다 */
  const shot = useRef<{ at: number; detail: Detail } | null>(null);
  /** 기울기 판단. 서버에 못 물었을 때만 씁니다 */
  const tilt = useRef<Detail>("unknown");
  /** 직전에 초록이었는지. 경계에서 색이 떨리지 않게 하는 데 씁니다 */
  const wasOk = useRef(false);

  useEffect(() => {
    if (!active) {
      setDetail("unknown");
      shot.current = null;
      tilt.current = "unknown";
      wasOk.current = false;
      return;
    }

    let alive = true;
    let sub: { remove: () => void } | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    /** 사진 한 바퀴가 도는 중인지. 겹쳐 찍지 않게 막습니다 */
    let busy = false;

    /** 두 판단을 합쳐 화면에 내보냅니다. 서버 답이 신선하면 그게 이깁니다 */
    const publish = () => {
      if (!alive) return;
      const s = shot.current;
      const fresh = s !== null && Date.now() - s.at < STALE_MS;
      const next = fresh ? s!.detail : tilt.current;
      wasOk.current = next === "ok";
      setDetail(next);
    };

    /* ── 1) 기울기 — 서버에 못 물었을 때의 폴백 ────────────────────── */

    (async () => {
      const ok = await Accelerometer.isAvailableAsync().catch(() => false);
      if (!alive || !ok) return; // 센서가 없으면 폴백 없이 unknown 으로 둡니다

      Accelerometer.setUpdateInterval(INTERVAL_MS);

      sub = Accelerometer.addListener(({ x, y, z }) => {
        const norm = Math.hypot(x, y, z);
        if (norm < 0.5) return; // 자유낙하처럼 읽히는 순간은 버립니다

        // iOS 와 안드로이드가 축 부호를 반대로 주는 경우가 있어 절댓값만 씁니다
        const ax = Math.abs(x) / norm;
        const ay = Math.abs(y) / norm;

        if (Math.hypot(ax, ay) < MIN_INPLANE) {
          // 거의 평평합니다. 회전을 알 수 없고, 알 필요도 없습니다.
          tilt.current = "ok";
        } else {
          const rollDeg = toDeg(Math.atan2(ax, ay));
          const limit = wasOk.current ? LEVEL_DEG + HYSTERESIS_DEG : LEVEL_DEG;
          tilt.current = rollDeg <= limit ? "ok" : "roll";
        }

        publish();
      });
    })();

    /* ── 2) 사진을 찍어 서버에 묻기 ──────────────────────────────── */

    const tick = async () => {
      if (!alive || busy) return;

      const cam = current<Shooter>(camRef);
      if (!cam?.takePictureAsync) return; // 카메라 ref 가 없으면 기울기만 봅니다

      busy = true;
      let shotUri = "";
      let thumbUri = "";

      try {
        const taken = await cam.takePictureAsync({
          // 어차피 320px 로 줄이므로 여기서 화질을 아낍니다
          quality: 0.5,
          // base64 는 여기서 받지 않습니다. 원본 크기라 너무 큽니다
          base64: false,
          exif: false,
          // 1초에 한 번 셔터음이 나면 못 씁니다
          shutterSound: false,
        });
        if (!alive) return;
        if (!taken?.uri) return;
        shotUri = taken.uri;

        const context = ImageManipulator.manipulate(shotUri);
        context.resize({ width: THUMB_W });
        const rendered = await context.renderAsync();
        const out = await rendered.saveAsync({
          compress: THUMB_COMPRESS,
          format: SaveFormat.JPEG,
          base64: true,
        });
        if (!alive) return;
        thumbUri = out.uri;
        if (!out.base64) return;

        const [preview, guide, paper] = await Promise.all([
          measure(hostRef),
          measure(frameRef),
          findPaper(out.base64),
        ]);
        if (!alive) return;

        if (!paper.asked) {
          // 서버에 못 물었습니다. 기울기 판단으로 넘어갑니다.
          shot.current = null;
          publish();
          return;
        }

        if (!paper.box || !preview || !guide) {
          // 서버는 답했는데 종이를 못 찾았거나, 자리를 재지 못했습니다.
          // 기울기로 덮지 않습니다 — 종이가 안 보이는데 초록이 되면 안 됩니다.
          shot.current = { at: Date.now(), detail: "unknown" };
          publish();
          return;
        }

        // out.width/height 는 서버가 실제로 본 사진의 크기입니다.
        // 원본 대신 이걸 써야 cover 계산이 맞습니다.
        const inShot = guideInShot(preview, guide, out.width, out.height);
        if (!inShot) {
          shot.current = { at: Date.now(), detail: "unknown" };
          publish();
          return;
        }

        const ok = fits(paper.box, inShot, wasOk.current);
        shot.current = { at: Date.now(), detail: ok ? "ok" : "outside" };
        publish();
      } catch {
        // 촬영·축소가 실패했습니다. 기울기 판단으로 넘어갑니다.
        if (alive) {
          shot.current = null;
          publish();
        }
      } finally {
        busy = false;
        /*
         * 캐시에 쌓인 파일을 지웁니다. 1초에 두 장씩 생기므로 안 지우면
         * 촬영 화면을 몇 분 열어두는 것만으로 수백 장이 남습니다.
         */
        for (const uri of [shotUri, thumbUri]) {
          if (!uri) continue;
          FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {
            // 지우지 못해도 넘어갑니다. 앱 캐시라 OS 가 결국 정리합니다.
          });
        }
      }
    };

    // 카메라가 붙기까지 잠깐 걸립니다. 한 박자 뒤부터 찍습니다.
    timer = setInterval(tick, TICK_MS);

    return () => {
      alive = false;
      sub?.remove();
      if (timer) clearInterval(timer);
    };
  }, [active, hostRef, frameRef, camRef]);

  return { state: DETAIL_STATE[detail], hint: DETAIL_HINTS[detail] };
}
