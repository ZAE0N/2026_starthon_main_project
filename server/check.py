"""
앱 없이 서버를 시험하는 스크립트.

사진 한 장을 /inspect 에 보내고, 돌아온 JSON 이 앱 계약(lib/api.ts, types/index.ts)을
지키는지 하나씩 확인합니다. 앱을 켜서 확인하면 한 번에 1분씩 걸리는 것들입니다.

    python check.py 계약서.jpg
    python check.py 계약서.jpg --url http://127.0.0.1:8000 --token 값
"""

import argparse
import base64
import json
import sys
import time
import urllib.error
import urllib.request

CHECK_ORDER = [
    "contractType",
    "wage",
    "probation",
    "hours",
    "break",
    "weeklyPay",
    "penalty",
    "required",
]
VERDICTS = {"위법소지", "확인필요", "문제없음"}

OK = "  OK   "
NG = " 실패  "


def post(url: str, token: str, image_path: str) -> tuple[int, bytes]:
    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")

    body = json.dumps({"imageBase64": b64}).encode("utf-8")
    print(f"보내는 크기: {len(body) / 1024 / 1024:.2f}MB")

    req = urllib.request.Request(
        f"{url}/inspect",
        data=body,
        headers={"Content-Type": "application/json", **({"X-App-Token": token} if token else {})},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return res.status, res.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def verify(data: dict) -> list[str]:
    """앱이 이 응답을 그대로 쓸 수 있는지. 반환값이 비어 있으면 통과."""
    bad: list[str] = []

    def need(cond: bool, msg: str) -> None:
        print(f"[{OK if cond else NG}] {msg}")
        if not cond:
            bad.append(msg)

    need(isinstance(data.get("id"), str) and data["id"] != "", "id 가 비어있지 않은 문자열")
    if isinstance(data.get("id"), str):
        need(
            not any(c in data["id"] for c in '/\\:*?"<>|'),
            "id 를 파일명으로 쓸 수 있음 (사진 저장에 쓰입니다)",
        )
    need(isinstance(data.get("createdAt"), str), "createdAt 이 문자열")
    need(isinstance(data.get("basedOn"), str), "basedOn 이 문자열")
    need(isinstance(data.get("assumptions"), list), "assumptions 가 배열")

    clauses = data.get("clauses")
    need(isinstance(clauses, list), "clauses 가 배열")
    if not isinstance(clauses, list):
        return bad

    need(len(clauses) == 8, f"clauses 가 8개 (지금 {len(clauses)}개)")
    need([c.get("id") for c in clauses] == CHECK_ORDER, "clauses 순서가 앱과 같음")

    for c in clauses:
        cid = c.get("id", "?")
        need(c.get("verdict") in VERDICTS, f"{cid}: verdict 가 3종 중 하나 ({c.get('verdict')!r})")
        need(isinstance(c.get("label"), str) and c["label"] != "", f"{cid}: label 있음")
        need(isinstance(c.get("plain"), str) and c["plain"] != "", f"{cid}: plain 있음")
        need(isinstance(c.get("law"), str) and c["law"] != "", f"{cid}: law 있음 (비면 근거 없는 판정처럼 보임)")
        s = c.get("scripts")
        need(isinstance(s, dict) and "soft" in s and "firm" in s, f"{cid}: scripts.soft/firm 있음")

    # lib/api.ts:191-194 — 이 조건이면 앱이 200 을 받아도 버리고 에러를 띄웁니다.
    all_unknown = all(c.get("verdict") == "확인필요" for c in clauses)
    no_original = all(not c.get("original") for c in clauses)
    need(
        not (all_unknown and no_original),
        "앱의 allUnknown 함정에 걸리지 않음 (전부 확인필요 + 원문 전부 빈값)",
    )
    return bad


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("image")
    p.add_argument("--url", default="http://127.0.0.1:8000")
    p.add_argument("--token", default="")
    a = p.parse_args()

    print(f"→ {a.url}/inspect")
    t0 = time.monotonic()
    status, raw = post(a.url, a.token, a.image)
    took = time.monotonic() - t0

    print(f"상태 {status} / {took:.1f}초")
    if took > 45:
        print(f"[{NG}] 45초를 넘었습니다. 앱이라면 타임아웃입니다.")

    meaning = {
        200: "정상",
        400: "요청 형식 오류 → 앱: 지금은 분석할 수 없어요",
        401: "토큰 불일치 → 앱: 지금은 분석할 수 없어요",
        413: "사진이 너무 큼 → 앱: 지금은 분석할 수 없어요",
        415: "근로계약서가 아님 → 앱: 근로계약서가 아닌 것 같아요",
        422: "글자를 못 읽음 → 앱: 계약서를 읽지 못했어요",
    }
    print(meaning.get(status, "서버 오류 → 앱: 지금은 분석할 수 없어요"))

    if status != 200:
        print(raw.decode("utf-8", "replace")[:500])
        return 1

    data = json.loads(raw)
    print()
    bad = verify(data)
    print()
    print(json.dumps(data, ensure_ascii=False, indent=2))

    if bad:
        print(f"\n계약 위반 {len(bad)}건")
        return 1
    print("\n앱 계약 통과")
    return 0


if __name__ == "__main__":
    sys.exit(main())
