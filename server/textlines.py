# -*- coding: utf-8 -*-
"""
모델이 준 자리를 사진의 실제 글자 줄에 맞춥니다. (담당: 전정현)

모델이 준 좌표는 눈금자를 붙인 뒤에도 ±0.01 쯤 어긋납니다. 계약서 줄 간격이
0.02 라서 그 정도만 어긋나도 옆 줄을 물거나 반쯤 걸칩니다.

그래서 모델 좌표를 **힌트로만** 쓰고, 사진에서 실제 글자 줄을 찾아 거기에
맞춥니다. 사진에 답이 있는데 모델 값을 그대로 쓸 이유가 없습니다.

픽셀을 파이썬 루프로 세지 않습니다. 900x1270 을 두 번 돌면 몇 초 걸립니다.
Pillow 의 resize(BOX) 가 행·열 평균을 C 로 계산해 주므로 그걸 씁니다.
"""

import base64
import io
from typing import Any

from PIL import Image

#: 잉크 분포를 볼 때 줄이는 너비. 정확도에는 거의 영향이 없고 속도만 빨라집니다.
SNAP_WIDTH = 900

#: 한 행을 "글자가 있는 행" 으로 볼 최소 잉크 비율 (그 행 너비 대비)
ROW_INK = 0.004

#: 이 픽셀 이하로 떨어진 줄은 한 줄로 봅니다 (글자 사이의 빈 행)
ROW_GAP = 2

#: 찾은 줄이 모델이 준 높이의 몇 배까지 허용되는지.
#: 벗어나면 줄을 잘못 찾은 것으로 보고 모델 값을 그대로 씁니다.
BAND_MIN = 0.35
BAND_MAX = 3.0


# ── 사진이 쓸 만한지 판단할 때 쓰는 값 ─────────────────────────────────
#
# ⚠ 전부 **보수적으로** 잡았습니다. 쓸 만한 사진을 거부하는 쪽이 못 쓸 사진을
#   통과시키는 쪽보다 나쁩니다. 거부당한 사용자는 왜 안 되는지 모르고, 다시
#   찍어도 또 거부되면 앱을 닫습니다. 애매하면 통과시키고 모델에게 맡깁니다.

#: 글자 줄이 이보다 적으면 계약서로 보지 않습니다.
#: 실제 계약서는 20줄이 넘습니다. 3은 "거의 아무것도 없다" 수준입니다.
MIN_BANDS = 3

#: 잉크 비율이 이 범위를 벗어나면 못 읽습니다.
#: 아래로 벗어나면 빈 종이나 너무 밝게 날아간 사진, 위로 벗어나면 너무 어둡게
#: 찍혀 종이까지 글자로 잡힌 사진입니다.
MIN_INK = 0.003
MAX_INK = 0.5

#: 글자가 있는 영역이 사진의 이 비율보다 작으면 너무 멀리서 찍은 것입니다.
#:
#: 0.10 은 가로·세로로 각각 3분의 1 쯤을 차지한다는 뜻이라 글자를 읽을 수 없습니다.
#: 처음에 0.18 로 뒀다가 8도 기울어진 사진이 반려됐습니다. 기울면 흰 여백이
#: 붙어서 비율이 떨어지는데, 정상 사진의 실측이 0.17~0.58 이라 문턱이 너무
#: 가까웠습니다. 쓸 만한 사진을 거부하는 쪽이 더 나쁘므로 여유를 벌렸습니다.
MIN_TEXT_AREA = 0.10

#: 한 글자 줄 안에서 "글자가 있는 칸" 으로 볼 최소 잉크 비율.
#:
#: ROW_INK(0.004) 를 그대로 쓰면 안 됩니다. 그건 줄을 찾을 때의 값이라
#: 아주 낮은데, 좌우 범위를 잴 때 그 값을 쓰면 JPEG 잡티 하나가 있는 칸까지
#: 글자로 세서 모든 사진이 "가장자리에 닿았다" 가 됩니다. 실제로 그랬습니다.
#: 글자 줄 한 줄은 높이가 10px 쯤이라 획이 지나가면 0.2 는 쉽게 넘습니다.
BAND_COL_INK = 0.2

#: 한 줄이 "글자 줄" 로 인정받으려면 필요한 최소 칸 수와 높이(px).
#:
#: 이게 없으면 사진 가장자리의 JPEG 잡티 몇 픽셀이 한 줄로 잡혀서, 여백을
#: 넉넉히 둔 정상 사진까지 "가장자리에 닿았다" 로 반려됐습니다. 실측으로 확인한
#: 오작동입니다. 글자가 한 줄 있으면 칸 8개는 가볍게 넘습니다.
MIN_LINE_COLS = 8
MIN_LINE_PX = 2

#: (더 이상 쓰지 않습니다) 글자가 가장자리에 닿았는지 보던 값.
#: 종이를 꽉 채워 잘 찍은 사진도 가장자리에 닿아서, 잘린 사진과 구분이
#: 되지 않았습니다. 실측에서 오작동이 확인돼 검사를 걷어냈습니다.
EDGE = 0.005

#: 한 행(또는 칸)을 "종이" 로 볼 최소 밝은 픽셀 비율.
#: server/paperbox.py 의 LINE_RATIO 와 같은 값이어야 합니다.
PAPER_RATIO = 0.35

#: 종이가 사진에서 차지하는 비율이 이보다 작으면 너무 멀리서 찍은 것입니다.
#: 글자 영역(MIN_TEXT_AREA)이 아니라 **종이 영역**으로 봅니다. 종이를 먼저
#: 찾으므로 이쪽이 더 곧바른 기준입니다.
MIN_PAPER_AREA = 0.15

#: 사진 전체 평균 밝기가 이보다 낮으면 아무것도 안 찍힌 것으로 봅니다.
#:
#: 종이 검출 **전에** 봅니다. 완전히 검은 사진에서는 밝은 덩어리를 못 찾아
#: 종이 검출이 None 을 돌려주고, 그러면 판단 보류로 통과해 버립니다.
#: 실측에서 그랬습니다.
#:
#: 0.06 은 아주 낮은 값입니다. 어두운 책상 위의 흰 종이가 화면의 4분의 1만
#: 차지해도 평균이 0.3 을 넘으므로, 정상 사진이 걸릴 여지가 없습니다.
DARK_MEAN = 0.06


def _otsu(hist: list[int]) -> int:
    """
    밝기 히스토그램에서 글자와 배경을 가르는 문턱값.

    고정값(예: 128)을 쓰면 그늘진 사진에서 종이 전체가 글자로 잡힙니다.
    Otsu 는 사진마다 문턱을 다시 정하므로 조명이 달라도 견딥니다.
    """
    total = sum(hist)
    if total == 0:
        return 128

    sum_all = sum(i * n for i, n in enumerate(hist))
    best_t, best_var = 128, -1.0
    w_b = 0
    sum_b = 0

    for t in range(256):
        w_b += hist[t]
        if w_b == 0:
            continue
        w_f = total - w_b
        if w_f == 0:
            break
        sum_b += t * hist[t]
        m_b = sum_b / w_b
        m_f = (sum_all - sum_b) / w_f
        var = w_b * w_f * (m_b - m_f) ** 2
        if var > best_var:
            best_var, best_t = var, t

    return best_t


def _profile(mono: Image.Image, axis: str) -> list[float]:
    """
    잉크 비율 분포. axis="rows" 면 행마다, "cols" 면 열마다.

    mono 는 글자가 255, 배경이 0 인 흑백 이미지입니다.
    resize(BOX) 로 한 줄(또는 한 칸)로 눌러서 평균을 냅니다.
    """
    w, h = mono.size
    if axis == "rows":
        line = mono.resize((1, h), Image.BOX)
    else:
        line = mono.resize((w, 1), Image.BOX)
    return [v / 255 for v in line.getdata()]


def _bands(ratio: list[float]) -> list[tuple[int, int]]:
    """행별 잉크 비율에서 글자 줄의 (위, 아래) 목록을 만듭니다."""
    out: list[tuple[int, int]] = []
    start = -1

    for y, r in enumerate(ratio):
        if r >= ROW_INK:
            if start < 0:
                start = y
        elif start >= 0:
            out.append((start, y - 1))
            start = -1
    if start >= 0:
        out.append((start, len(ratio) - 1))

    # 글자 사이의 빈 행 때문에 한 줄이 여러 개로 쪼개진 것을 다시 붙입니다
    merged: list[tuple[int, int]] = []
    for b in out:
        if merged and b[0] - merged[-1][1] <= ROW_GAP:
            merged[-1] = (merged[-1][0], b[1])
        else:
            merged.append(b)

    return merged


def _mask(image_base64: str) -> tuple[Image.Image, float] | None:
    """
    흑백 잉크 마스크와 잉크 비율. 못 열면 None.

    snap() 과 check() 가 같은 전처리를 씁니다. 한 요청에서 두 번 부르지만
    900px 로 줄인 이미지라 합쳐도 50ms 안쪽입니다.
    """
    try:
        img = Image.open(io.BytesIO(base64.b64decode(image_base64))).convert("L")
        if img.width > SNAP_WIDTH:
            img = img.resize(
                (SNAP_WIDTH, max(1, round(img.height * SNAP_WIDTH / img.width))),
                Image.LANCZOS,
            )
        thr = _otsu(img.histogram())
        mono = img.point(lambda v: 255 if v <= thr else 0, mode="L")

        # 전체 평균이 곧 잉크 비율입니다
        one = mono.resize((1, 1), Image.BOX)
        ink = list(one.getdata())[0] / 255
        return mono, ink
    except Exception:  # noqa: BLE001
        return None


def _paper_box(img: Image.Image) -> tuple[int, int, int, int] | None:
    """
    사진에서 종이(밝은 덩어리)의 자리. 못 찾으면 None.

    server/paperbox.py 의 find() 와 같은 방법입니다. 거기서 import 하지 않는
    이유는 paperbox 가 이 파일의 _otsu·_profile 을 쓰기 때문입니다.
    서로 import 하면 순환이 됩니다.
    """
    w, h = img.size
    if w < 8 or h < 8:
        return None

    thr = _otsu(img.histogram())
    bright = img.point(lambda v: 255 if v > thr else 0, mode="L")

    def span(ratio: list[float]) -> tuple[int, int] | None:
        lit = [i for i, r in enumerate(ratio) if r >= PAPER_RATIO]
        return (lit[0], lit[-1]) if lit else None

    ys = span(_profile(bright, "rows"))
    xs = span(_profile(bright, "cols"))
    if ys is None or xs is None:
        return None
    return xs[0], ys[0], xs[1] + 1, ys[1] + 1


class Prepared:
    """
    사진을 줄이고 종이를 찾아 그 안의 글자 마스크를 만든 결과.

    check() 와 snap() 이 **같은 전처리를 공유해야 합니다.** 한쪽만 종이를
    찾으면 통과한 사진에 엉뚱한 자리가 표시됩니다. 실제로 그랬습니다.
    """

    __slots__ = ("mono", "box", "size", "ink")

    def __init__(
        self,
        mono: Image.Image | None,
        box: tuple[int, int, int, int] | None,
        size: tuple[int, int],
        ink: float,
    ) -> None:
        #: 종이 안쪽만 자른 글자 마스크. 사진이 통째로 어두우면 None
        self.mono = mono
        #: 종이의 자리 (줄인 사진의 좌표계). mono 가 None 이면 None
        self.box = box
        #: 줄인 사진의 (너비, 높이)
        self.size = size
        #: 종이 안의 잉크 비율 (mono 가 None 이면 사진 전체 평균 밝기)
        self.ink = ink

    @property
    def paper_share(self) -> float:
        """종이가 사진에서 차지하는 비율."""
        if self.box is None:
            return 0.0
        x0, y0, x1, y1 = self.box
        w, h = self.size
        return ((x1 - x0) / w) * ((y1 - y0) / h)


def _prepare(image_base64: str) -> Prepared | None:
    """
    **종이 안쪽만** 잘라낸 글자 마스크와, 종이 안의 잉크 비율, 종이가 사진에서
    차지하는 비율. 판단할 수 없으면 None.

    왜 종이를 먼저 찾는가 — 이게 이 파일에서 제일 중요한 부분입니다:
      Otsu 는 사진에서 밝은 쪽과 어두운 쪽을 가릅니다. 종이가 화면을 꽉 채운
      사진에서는 그 경계가 **글자와 종이** 사이에 생겨서 글자가 남습니다.

      그런데 폰으로 종이 계약서를 찍으면 종이 주변에 **어두운 책상·바닥**이
      같이 찍힙니다. 그러면 경계가 **종이와 배경** 사이에 생기고, 글자는
      종이와 함께 "밝은 쪽" 으로 넘어가 마스크에서 사라집니다. 글자 줄을
      한 줄도 못 찾게 됩니다.

      실측으로 확인했습니다. 어두운 배경 위에 계약서를 올린 사진은 종이가
      화면의 85% 를 차지해도 전부 반려됐고, 배경 밝기를 18~160 으로 바꿔도
      마찬가지였습니다. 반면 PDF 를 렌더한(배경이 없는) 사진은 잉크 비율이
      0.031~0.039 로 정상이었습니다. 이 차이를 초기 테스트가 못 잡았습니다.

      그래서 종이를 먼저 찾아 그 안에서만 Otsu 를 돌립니다. 그러면 경계가
      다시 글자와 종이 사이에 생깁니다.

    종이를 못 찾으면 None 입니다. **재지 못한 것으로 사진을 거부하지 않습니다.**
    """
    try:
        img = Image.open(io.BytesIO(base64.b64decode(image_base64))).convert("L")
        if img.width > SNAP_WIDTH:
            img = img.resize(
                (SNAP_WIDTH, max(1, round(img.height * SNAP_WIDTH / img.width))),
                Image.LANCZOS,
            )

        fw, fh = img.size

        # 종이를 찾기 전에 본다. 아래 주석(DARK_MEAN)에 이유가 있다.
        mean = list(img.resize((1, 1), Image.BOX).getdata())[0] / 255
        if mean < DARK_MEAN:
            return Prepared(None, None, (fw, fh), mean)

        box = _paper_box(img)
        if box is None:
            return None

        x0, y0, x1, y1 = box
        if x1 - x0 < 8 or y1 - y0 < 8:
            return None

        paper = img.crop(box)

        # 종이 안에서 다시 문턱을 정합니다. 이번에는 글자와 종이를 가릅니다.
        thr = _otsu(paper.histogram())
        mono = paper.point(lambda v: 255 if v <= thr else 0, mode="L")

        ink = list(mono.resize((1, 1), Image.BOX).getdata())[0] / 255
        return Prepared(mono, box, (fw, fh), ink)
    except Exception:  # noqa: BLE001
        return None


def _lines(mono: Image.Image) -> list[tuple[int, int, int, int]]:
    """
    글자 줄 목록 (위, 아래, 왼쪽, 오른쪽).

    좌우를 한 덩어리로 재면 안 됩니다. 글자가 있는 영역 전체를 잘라서 칸별
    비율을 보면, 한 칸에 글자가 몇 줄만 지나가니 비율이 너무 낮게 나옵니다.
    문턱을 낮추면 잡티까지 글자로 세게 됩니다. 줄 하나씩 보면 획이 지나가는
    칸의 비율이 충분히 높습니다.
    """
    w = mono.size[0]
    out: list[tuple[int, int, int, int]] = []

    for b0, b1 in _bands(_profile(mono, "rows")):
        if b1 - b0 + 1 < MIN_LINE_PX:
            continue
        cols = _profile(mono.crop((0, b0, w, b1 + 1)), "cols")
        lit = [i for i, r in enumerate(cols) if r >= BAND_COL_INK]
        if len(lit) >= MIN_LINE_COLS:
            out.append((b0, b1, lit[0], lit[-1]))

    return out


def check(image_base64: str) -> str | None:
    """
    판정을 시작하기 전에 사진이 쓸 만한지 봅니다.

    못 쓸 사진이면 사용자에게 보여줄 이유를 돌려주고, 쓸 만하면 None 입니다.

    왜 여기서 막는가:
      못 쓸 사진을 모델에게 보내면 그럴듯한 오답이 나옵니다. "글자를 못 읽었다"
      고 말해주는 게 아니라, 보이는 일부만 보고 판정을 만들어 버립니다.
      사용자는 그게 틀린 줄 모릅니다.

      부수적으로 **OpenAI 호출을 아낍니다.** 못 쓸 사진에는 돈을 쓰지 않습니다.

    무엇을 보는가 — **종이 안쪽만** 봅니다 (_prepare 의 주석을 먼저 읽으세요)
      1. 글자 줄이 거의 없다   → 계약서가 아니거나 너무 흐리다
      2. 잉크 비율이 이상하다   → 너무 어둡거나 너무 날아갔다
      3. 종이가 너무 작다      → 너무 멀리서 찍었다

    **글자가 가장자리에 닿았는지는 보지 않습니다.** 종이를 꽉 채워 잘 찍은
    사진도 가장자리에 닿아서, 잘린 사진과 구분할 방법이 없었습니다. 실제로
    정상 사진이 "화면 밖으로 잘렸어요" 로 반려됐습니다. 내용이 빠졌으면
    모델이 읽지 못한 항목을 "확인필요" 로 돌려줍니다.

    판단할 수 없으면 None 입니다. 검사가 안 되는 것 때문에 판정을 막지 않습니다.
    """
    got = _prepare(image_base64)
    if got is None:
        return None

    mono, ink, paper_share = got.mono, got.ink, got.paper_share

    # 사진이 통째로 어둡습니다. 종이를 찾을 수조차 없었습니다.
    if mono is None:
        return "글자가 거의 보이지 않아요. 더 밝은 곳에서 다시 찍어주세요."

    # 잉크 비율로 먼저 판단하지 않습니다. 글자 줄을 찾았으면 그게 더 믿을 만한
    # 신호입니다. 줄을 못 찾았을 때만 잉크 비율로 이유를 설명합니다.
    if len(_lines(mono)) < MIN_BANDS:
        if ink < MIN_INK:
            return "글자가 거의 보이지 않아요. 더 밝은 곳에서 다시 찍어주세요."
        if ink > MAX_INK:
            return (
                "사진의 대부분이 어둡게 찍혔어요. "
                "밝은 곳에서 계약서가 화면을 채우도록 다시 찍어주세요."
            )
        return "글자 줄을 찾지 못했어요. 계약서가 화면에 잘 들어오게 다시 찍어주세요."

    if paper_share < MIN_PAPER_AREA:
        return "계약서가 너무 작게 찍혔어요. 조금 더 가까이서 찍어주세요."

    return None

def snap(image_base64: str, marks: dict[str, Any]) -> dict[str, Any]:
    """
    모델이 준 자리를 사진의 실제 글자 줄에 맞춥니다.

    세로는 찾은 줄에 맞추고, 가로는 **줄이기만** 합니다. 늘리면 표의 항목 이름
    칸이나 세로 칸선까지 물 수 있어서 안전한 방향으로만 움직입니다.

    **종이 안쪽에서 줄을 찾습니다** (_prepare). 전에는 사진 전체에서 찾았는데,
    종이 주변에 어두운 책상이 같이 찍히면 Otsu 문턱이 종이와 배경 사이에 생겨서
    밴드가 글자 줄이 아니라 배경 덩어리가 됐습니다. 대개는 크기가 안 맞아
    아래 안전장치에 걸려 모델 좌표로 되돌아갔지만, 어쩌다 크기가 맞으면
    **엉뚱한 자리에 형광펜이 붙었습니다.** 그래서 어떤 조항은 맞고 어떤 조항은
    틀리게 보였습니다.

    좌표는 **사진 전체 기준**으로 돌려줍니다. 앱이 원본 사진 위에 그리기
    때문입니다. 종이 안에서 찾은 자리에 종이의 위치를 다시 더합니다.

    줄을 못 찾거나 찾은 줄이 모델 값과 너무 다르면 손대지 않습니다.
    사진이 기울었거나 그늘이 심하면 줄 찾기가 어긋나는데, 그때 억지로 맞추면
    지금보다 더 엉뚱한 자리에 칠하게 됩니다.
    """
    if not marks:
        return marks

    got = _prepare(image_base64)
    if got is None or got.mono is None or got.box is None:
        return marks

    mono = got.mono
    w, h = got.size
    px0, py0, px1, py1 = got.box
    pw, ph = px1 - px0, py1 - py0

    bands = _bands(_profile(mono, "rows"))
    if not bands:
        return marks

    out: dict[str, Any] = {}

    for cid, m in marks.items():
        try:
            # 사진 전체 기준 픽셀 → 종이 안쪽 기준 픽셀
            top = float(m["top"]) * h - py0
            bottom = float(m["bottom"]) * h - py0
            left = float(m["left"]) * w - px0
            right = float(m["right"]) * w - px0
        except (KeyError, TypeError, ValueError):
            out[cid] = m
            continue

        # 종이 밖을 가리키는 자리는 손대지 않습니다. 모델이 배경을 짚었거나
        # 종이 검출이 어긋난 경우인데, 어느 쪽이든 맞출 근거가 없습니다.
        if bottom <= 0 or top >= ph or right <= 0 or left >= pw:
            out[cid] = m
            continue

        want = max(1.0, bottom - top)

        # 가장 많이 겹치는 줄을 고릅니다
        best, score = None, 0.0
        for b0, b1 in bands:
            overlap = min(bottom, b1 + 1) - max(top, b0)
            if overlap > score:
                score, best = overlap, (b0, b1)

        if best is None:
            out[cid] = m
            continue

        b0, b1 = best
        got_h = b1 - b0 + 1

        # 찾은 줄이 모델 값과 너무 다르면 줄을 잘못 찾은 것입니다
        if not (BAND_MIN * want <= got_h <= BAND_MAX * want):
            out[cid] = m
            continue

        # 가로는 그 줄 안의 잉크로 줄이기만 합니다
        new_left, new_right = left, right
        x0, x1 = int(max(0, left)), int(min(pw, right))
        if x1 - x0 >= 2:
            cols = _profile(mono.crop((x0, b0, x1, b1 + 1)), "cols")
            ink = [i for i, r in enumerate(cols) if r > 0]
            if ink:
                new_left = x0 + ink[0]
                new_right = x0 + ink[-1] + 1

        # 종이 안쪽 기준 → 사진 전체 기준
        out[cid] = {
            **m,
            "top": round((py0 + b0) / h, 4),
            "bottom": round((py0 + b1 + 1) / h, 4),
            "left": round((px0 + new_left) / w, 4),
            "right": round((px0 + new_right) / w, 4),
        }

    return out
