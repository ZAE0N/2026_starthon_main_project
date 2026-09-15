/**
 * 촬영 화면의 실시간 안내 — 웹 쪽. 담당: 전정현
 *
 * 미리보기 화면을 실제로 읽어서, 계약서가 가이드 네모 안에 들어왔는지 봅니다.
 * 들어오면 초록, 아니면 회색입니다. 폰에서는 lib/frameFit.ts 가 쓰이고
 * 거기서는 기울기만 봅니다 (그 파일의 주석에 이유가 있습니다).
 *
 * 웹에서 화면을 읽을 수 있는 이유:
 *   expo-camera 는 웹에서 <video> 를 그립니다(ExpoCamera.web.js). 그 요소를
 *   canvas 에 그리면 픽셀을 읽을 수 있습니다. 새 의존성이 필요 없습니다.
 *
 * 무엇을 문서로 보는가:
 *   계약서는 **밝은 종이**입니다. 글자가 어둡고 종이가 밝으니, 밝은 덩어리를
 *   찾으면 그게 종이입니다. Otsu 로 밝고 어두운 경계를 정하는데, 고정값을 쓰면
 *   조명에 따라 종이 전체가 어둡게 잡히거나 배경까지 밝게 잡힙니다.
 *
 * 언제 초록인가 — 셋을 다 만족해야 합니다
 *   1. 종이가 가이드 네모 안에 있다 (약간의 여유 허용)
 *   2. 종이가 네모를 충분히 채운다 — 멀리서 작게 찍으면 글자를 못 읽습니다
 *   3. 종이가 화면 가장자리에 닿지 않는다 — 닿으면 잘렸다는 뜻입니다
 *
 * 배경이 흰 책상이면 종이와 대비가 없어서 못 찾습니다. 그때는 unknown 이고
 * 네모는 회색으로 둡니다. 억지로 초록을 켜면 잘린 사진을 그대로 찍게 됩니다.
 */

import { useEffect, useRef, useState } from "react";

/** ok = 초록, off = 회색(아직 아님), unknown = 판단 못 함(회색) */
export type FitState = "ok" | "off" | "unknown";

export type FrameFit = {
  state: FitState;
  /** 네모 아래에 보여줄 한 줄. 상태에 따라 바뀝니다 */
  hint: string;
};

/** 화면을 읽는 간격 (밀리초) */
const TICK_MS = 320;

/** 분석용으로 줄이는 너비. 이 정도면 종이 테두리를 찾는 데 충분합니다 */
const SAMPLE_W = 160;

/** 가이드 네모 밖으로 이만큼(네모 크기의 비율)까지는 나가도 봐줍니다 */
const SLACK = 0.06;

/** 종이가 네모의 이 비율만큼은 채워야 합니다 */
const MIN_FILL = 0.55;

/** 한 줄(또는 한 칸)을 "종이" 로 볼 최소 밝은 픽셀 비율 */
const LINE_RATIO = 0.35;

/** 밝은 픽셀이 화면의 이 범위 밖이면 판단하지 않습니다 */
const MIN_BRIGHT = 0.05;
const MAX_BRIGHT = 0.97;

/**
 * 찾은 덩어리의 가로÷세로가 이 범위를 벗어나면 종이로 보지 않습니다.
 *
 * 계약서는 A4 세로(0.707)입니다. 어두운 방의 조명 반사처럼 밝지만 종이가 아닌
 * 덩어리가 잡혀서 초록이 잘못 켜지는 것을 막습니다. 가로로 눕힌 계약서도
 * 있을 수 있어 위쪽은 넉넉하게 뒀습니다.
 */
const MIN_ASPECT = 0.45;
const MAX_ASPECT = 1.6;

const HINTS: Record<FitState, string> = {
  ok: "좋아요. 그대로 찍어주세요",
  off: "계약서 네 귀퉁이가 초록 네모 안에 들어오게 맞춰주세요",
  unknown: "초록 네모 안에 계약서 전체가 들어오게 맞춰주세요",
};

export type Box = { x0: number; y0: number; x1: number; y1: number };

/**
 * 밝기 히스토그램에서 밝은 쪽과 어두운 쪽을 가르는 값.
 * 확인용으로 export 합니다 (화면 없이 합성 이미지로 재볼 수 있게).
 */
export function otsu(hist: Uint32Array): number {
  let total = 0;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) {
    total += hist[i];
    sumAll += i * hist[i];
  }
  if (total === 0) return 128;

  let best = 128;
  let bestVar = -1;
  let wB = 0;
  let sumB = 0;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > bestVar) {
      bestVar = v;
      best = t;
    }
  }
  return best;
}

/**
 * 가이드 네모가 카메라 화면의 어디인지 (0~1 비율).
 *
 * <video> 는 object-fit: cover 라서 화면에 보이는 것이 원본의 일부입니다.
 * 그래서 화면 좌표를 원본 좌표로 되돌려야 canvas 에서 읽은 것과 맞습니다.
 */
function guideBox(video: HTMLVideoElement, frame: HTMLElement): Box | null {
  const v = video.getBoundingClientRect();
  const g = frame.getBoundingClientRect();
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh || v.width <= 0 || v.height <= 0) return null;

  // cover: 짧은 쪽을 채우도록 확대되고 긴 쪽이 잘립니다
  const scale = Math.max(v.width / vw, v.height / vh);
  const offX = (vw * scale - v.width) / 2;
  const offY = (vh * scale - v.height) / 2;

  return {
    x0: (g.left - v.left + offX) / scale / vw,
    y0: (g.top - v.top + offY) / scale / vh,
    x1: (g.right - v.left + offX) / scale / vw,
    y1: (g.bottom - v.top + offY) / scale / vh,
  };
}

/**
 * 밝은 덩어리(= 종이)의 테두리. 못 찾으면 null.
 * 확인용으로 export 합니다 (화면 없이 합성 이미지로 재볼 수 있게).
 */
export function paperBox(data: Uint8ClampedArray, w: number, h: number): Box | null {
  const hist = new Uint32Array(256);
  const lum = new Uint8Array(w * h);

  for (let i = 0, p = 0; i < lum.length; i++, p += 4) {
    // 사람 눈에 맞춘 밝기. 초록에 가중치가 큽니다
    const v = (data[p] * 299 + data[p + 1] * 587 + data[p + 2] * 114) / 1000;
    lum[i] = v;
    hist[v | 0]++;
  }

  const thr = otsu(hist);

  let bright = 0;
  for (let i = 0; i < lum.length; i++) if (lum[i] > thr) bright++;
  const ratio = bright / lum.length;
  if (ratio < MIN_BRIGHT || ratio > MAX_BRIGHT) return null;

  const rows = new Float32Array(h);
  const cols = new Float32Array(w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (lum[y * w + x] > thr) {
        rows[y]++;
        cols[x]++;
      }
    }
  }

  const span = (arr: Float32Array, len: number) => {
    const need = len * LINE_RATIO;
    let lo = -1;
    let hi = -1;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] >= need) {
        if (lo < 0) lo = i;
        hi = i;
      }
    }
    return lo < 0 ? null : ([lo, hi] as const);
  };

  const ys = span(rows, w);
  const xs = span(cols, h);
  if (!ys || !xs) return null;

  const bw = xs[1] - xs[0] + 1;
  const bh = ys[1] - ys[0] + 1;
  const aspect = bw / w / (bh / h);
  if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) return null;

  return {
    x0: xs[0] / w,
    y0: ys[0] / h,
    x1: (xs[1] + 1) / w,
    y1: (ys[1] + 1) / h,
  };
}

/**
 * @param active 카메라가 열려 있을 때만 true 를 넘기세요
 * @param hostRef 카메라를 감싼 View. 여기서 <video> 를 찾습니다
 * @param frameRef 가이드 네모 View
 * @param _camRef 폰 쪽과 인자 모양을 맞추기 위한 자리입니다. 웹에서는 쓰지
 *   않습니다 — 브라우저가 미리보기를 직접 읽으므로 사진을 찍을 필요가 없습니다.
 */
export function useFrameFit(
  active: boolean,
  hostRef?: unknown,
  frameRef?: unknown,
  _camRef?: unknown
): FrameFit {
  const [state, setState] = useState<FitState>("unknown");
  const canvas = useRef<HTMLCanvasElement | null>(null);
  /** 직전 상태. 경계에서 색이 떨리지 않게 하는 데 씁니다 */
  const wasOk = useRef(false);

  useEffect(() => {
    if (!active) {
      setState("unknown");
      wasOk.current = false;
      return;
    }

    let timer: ReturnType<typeof setInterval> | undefined;

    const tick = () => {
      try {
        // react-native-web 에서 View 의 ref 는 DOM 요소입니다
        const host = (hostRef as { current?: unknown } | undefined)
          ?.current as HTMLElement | null;
        const frameEl = (frameRef as { current?: unknown } | undefined)
          ?.current as HTMLElement | null;
        const video = host?.querySelector?.("video") as HTMLVideoElement | null;

        if (!video || !frameEl || video.readyState < 2) {
          setState("unknown");
          return;
        }

        const guide = guideBox(video, frameEl);
        if (!guide) {
          setState("unknown");
          return;
        }

        const w = SAMPLE_W;
        const h = Math.max(
          1,
          Math.round((SAMPLE_W * video.videoHeight) / video.videoWidth)
        );

        if (!canvas.current) canvas.current = document.createElement("canvas");
        const cv = canvas.current;
        if (cv.width !== w || cv.height !== h) {
          cv.width = w;
          cv.height = h;
        }

        const ctx = cv.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          setState("unknown");
          return;
        }

        ctx.drawImage(video, 0, 0, w, h);
        const paper = paperBox(ctx.getImageData(0, 0, w, h).data, w, h);
        if (!paper) {
          setState("unknown");
          return;
        }

        const gw = guide.x1 - guide.x0;
        const gh = guide.y1 - guide.y0;
        // 초록이 된 뒤에는 여유를 조금 더 줍니다. 손이 떨릴 때 색이 깜빡이지 않게요
        const slack = wasOk.current ? SLACK * 2 : SLACK;

        const inside =
          paper.x0 >= guide.x0 - gw * slack &&
          paper.y0 >= guide.y0 - gh * slack &&
          paper.x1 <= guide.x1 + gw * slack &&
          paper.y1 <= guide.y1 + gh * slack;

        // 멀리서 작게 찍으면 글자를 못 읽습니다
        const fill =
          ((paper.x1 - paper.x0) / gw) * ((paper.y1 - paper.y0) / gh);

        // 화면 가장자리에 닿았으면 잘린 것입니다
        const edge = 1 / w;
        const cut =
          paper.x0 <= edge ||
          paper.y0 <= edge ||
          paper.x1 >= 1 - edge ||
          paper.y1 >= 1 - edge;

        const ok = inside && !cut && fill >= MIN_FILL;
        wasOk.current = ok;
        setState(ok ? "ok" : "off");
      } catch {
        // 브라우저가 픽셀 읽기를 막는 경우가 있습니다. 조용히 회색으로 둡니다.
        setState("unknown");
      }
    };

    // 카메라가 붙기까지 잠깐 걸립니다. 한 박자 뒤부터 읽습니다.
    timer = setInterval(tick, TICK_MS);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [active, hostRef, frameRef]);

  return { state, hint: HINTS[state] };
}
