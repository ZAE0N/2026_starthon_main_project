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


def snap(image_base64: str, marks: dict[str, Any]) -> dict[str, Any]:
    """
    모델이 준 자리를 사진의 실제 글자 줄에 맞춥니다.

    세로는 찾은 줄에 맞추고, 가로는 **줄이기만** 합니다. 늘리면 표의 항목 이름
    칸이나 세로 칸선까지 물 수 있어서 안전한 방향으로만 움직입니다.

    줄을 못 찾거나 찾은 줄이 모델 값과 너무 다르면 손대지 않습니다.
    사진이 기울었거나 그늘이 심하면 줄 찾기가 어긋나는데, 그때 억지로 맞추면
    지금보다 더 엉뚱한 자리에 칠하게 됩니다.
    """
    if not marks:
        return marks

    try:
        img = Image.open(io.BytesIO(base64.b64decode(image_base64))).convert("L")
        if img.width > SNAP_WIDTH:
            img = img.resize(
                (SNAP_WIDTH, max(1, round(img.height * SNAP_WIDTH / img.width))),
                Image.LANCZOS,
            )
        w, h = img.size

        thr = _otsu(img.histogram())
        # 글자를 255, 배경을 0 으로. 아래 평균 계산이 곧 잉크 비율이 됩니다.
        mono = img.point(lambda v: 255 if v <= thr else 0, mode="L")

        bands = _bands(_profile(mono, "rows"))
        if not bands:
            return marks
    except Exception:  # noqa: BLE001 — 표시는 없어도 되는 기능입니다
        return marks

    out: dict[str, Any] = {}

    for cid, m in marks.items():
        try:
            top = float(m["top"]) * h
            bottom = float(m["bottom"]) * h
            left = float(m["left"]) * w
            right = float(m["right"]) * w
        except (KeyError, TypeError, ValueError):
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
        got = b1 - b0 + 1

        # 찾은 줄이 모델 값과 너무 다르면 줄을 잘못 찾은 것입니다
        if not (BAND_MIN * want <= got <= BAND_MAX * want):
            out[cid] = m
            continue

        # 가로는 그 줄 안의 잉크로 줄이기만 합니다
        new_left, new_right = left, right
        x0, x1 = int(max(0, left)), int(min(w, right))
        if x1 - x0 >= 2:
            cols = _profile(mono.crop((x0, b0, x1, b1 + 1)), "cols")
            ink = [i for i, r in enumerate(cols) if r > 0]
            if ink:
                new_left = x0 + ink[0]
                new_right = x0 + ink[-1] + 1

        out[cid] = {
            **m,
            "top": round(b0 / h, 4),
            "bottom": round((b1 + 1) / h, 4),
            "left": round(new_left / w, 4),
            "right": round(new_right / w, 4),
        }

    return out
