# -*- coding: utf-8 -*-
"""
사진에서 종이(밝은 덩어리)의 테두리를 찾습니다. (담당: 전정현)

촬영 화면의 가이드 네모를 초록으로 바꿀지 판단하는 데 씁니다.
계약서가 네모 안에 들어왔는지는 **사진을 봐야** 알 수 있습니다.

웹에서는 이걸 브라우저가 직접 합니다(lib/frameFit.web.ts 의 paperBox).
폰에서는 미리보기 프레임을 받을 방법이 없어서, 작은 사진을 찍어 여기로
보냅니다. **그래서 이 파일은 lib/frameFit.web.ts 와 같은 알고리즘·같은
상수를 씁니다.** 한쪽만 고치면 폰과 웹의 판정이 달라집니다.

판정(inspect)과 달리 OpenAI 를 부르지 않습니다. Pillow 만 씁니다.
1초에 한 번씩 들어오는 요청이라 비용이 들면 안 됩니다.

픽셀을 파이썬 루프로 세지 않습니다. textlines 와 같은 이유입니다 —
Pillow 의 resize(BOX) 가 행·열 평균을 C 로 계산해 줍니다.
"""

import base64
import io

from PIL import Image

from textlines import _otsu, _profile

#: 분석용으로 줄이는 너비. 종이 테두리를 찾는 데는 이 정도면 충분합니다.
#: lib/frameFit.web.ts 의 SAMPLE_W 와 같은 값이어야 합니다.
SAMPLE_W = 160

#: 한 행(또는 한 열)을 "종이" 로 볼 최소 밝은 픽셀 비율
LINE_RATIO = 0.35

#: 밝은 픽셀이 사진의 이 범위 밖이면 판단하지 않습니다.
#: 너무 어두우면(0.05 미만) 종이가 안 보이는 것이고,
#: 너무 밝으면(0.97 초과) 화면 전체가 흰 것이라 테두리를 잡을 수 없습니다.
MIN_BRIGHT = 0.05
MAX_BRIGHT = 0.97

#: 찾은 덩어리의 가로÷세로가 이 범위를 벗어나면 종이로 보지 않습니다.
#: 계약서는 A4 세로(0.707)입니다. 조명 반사처럼 밝지만 종이가 아닌 덩어리가
#: 잡혀서 초록이 잘못 켜지는 것을 막습니다. 가로로 눕힌 계약서도 있을 수
#: 있어 위쪽은 넉넉하게 뒀습니다.
MIN_ASPECT = 0.45
MAX_ASPECT = 1.6


def _span(ratio: list[float]) -> tuple[int, int] | None:
    """밝은 비율이 LINE_RATIO 이상인 구간의 처음과 끝. 없으면 None."""
    lo = -1
    hi = -1
    for i, r in enumerate(ratio):
        if r >= LINE_RATIO:
            if lo < 0:
                lo = i
            hi = i
    return None if lo < 0 else (lo, hi)


def find(image_base64: str) -> dict[str, float] | None:
    """
    종이의 테두리를 0~1 비율로 돌려줍니다. 못 찾으면 None.

    None 은 "종이가 없다" 가 아니라 **"판단 못 했다"** 입니다.
    앱은 이때 네모를 회색으로 두고 촬영은 막지 않습니다.
    """
    try:
        img = Image.open(io.BytesIO(base64.b64decode(image_base64))).convert("L")
    except Exception:  # noqa: BLE001
        return None

    if img.width <= 0 or img.height <= 0:
        return None

    if img.width > SAMPLE_W:
        img = img.resize(
            (SAMPLE_W, max(1, round(img.height * SAMPLE_W / img.width))),
            Image.BOX,
        )

    w, h = img.size
    if w < 8 or h < 8:
        return None

    thr = _otsu(img.histogram())

    # 종이는 밝은 쪽입니다. textlines 는 반대로 어두운 글자를 찾습니다.
    bright = img.point(lambda v: 255 if v > thr else 0, mode="L")

    ratio = list(bright.resize((1, 1), Image.BOX).getdata())[0] / 255
    if ratio < MIN_BRIGHT or ratio > MAX_BRIGHT:
        return None

    ys = _span(_profile(bright, "rows"))
    xs = _span(_profile(bright, "cols"))
    if ys is None or xs is None:
        return None

    bw = xs[1] - xs[0] + 1
    bh = ys[1] - ys[0] + 1
    aspect = (bw / w) / (bh / h)
    if aspect < MIN_ASPECT or aspect > MAX_ASPECT:
        return None

    return {
        "x0": xs[0] / w,
        "y0": ys[0] / h,
        "x1": (xs[1] + 1) / w,
        "y1": (ys[1] + 1) / h,
    }
