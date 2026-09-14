"""
laws.json 을 읽어서 프롬프트에 넣을 형태로 만들어 둡니다.

기동할 때 한 번만 읽습니다. 요청마다 읽으면 45초 예산을 낭비합니다.
laws.json 을 고쳤으면 서버를 다시 띄워야 반영됩니다.
"""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from schema import CHECK_ORDER

LAWS_PATH = Path(__file__).parent / "laws.json"


@lru_cache(maxsize=1)
def load() -> dict[str, Any]:
    data = json.loads(LAWS_PATH.read_text(encoding="utf-8"))

    ids = [c["id"] for c in data["checks"]]
    if ids != CHECK_ORDER:
        # 앱이 8개를 CHECK_ORDER 순서로 기대합니다. 여기가 어긋나면 화면이 깨지므로
        # 요청을 받다가 알아채지 말고 기동할 때 바로 죽는 게 낫습니다.
        raise RuntimeError(
            f"laws.json 의 checks 순서가 앱과 다릅니다.\n"
            f"  laws.json: {ids}\n"
            f"  앱 기대값: {CHECK_ORDER}"
        )
    return data


def law_of(check_id: str) -> str:
    """근거 조문. AI 가 만들어내게 두지 않고 여기서 가져다 씁니다."""
    for c in load()["checks"]:
        if c["id"] == check_id:
            return c.get("law", "")
    return ""


def assumptions() -> list[str]:
    return list(load().get("assumptions", []))


def based_on() -> str:
    return load().get("checkedAt", "")


def rules_block() -> str:
    """
    판정 기준을 프롬프트에 넣을 문단으로 만듭니다.

    조문 전문(lawText)까지 넣는 이유: rule 만 주면 모델이 자기 기억으로 법을 보충합니다.
    출력 토큰이 아니라 입력 토큰이라 45초 예산에는 거의 영향이 없습니다.
    """
    data = load()
    mw = data["minimumWage"]
    ex = mw["probationExcluded"]

    lines: list[str] = []
    lines.append(f"[{mw['year']}년 최저임금]")
    lines.append(f"- 시급 {mw['hourly']:,}원 (출처: {mw['source']})")
    lines.append(
        f"- 수습 감액이 인정될 때의 하한: {mw['probationHourly']:,}원 "
        f"(최저임금의 {int(mw['probationRate'] * 100)}%)"
    )
    lines.append("")
    lines.append("[수습 감액이 아예 불가능한 직종] ← 가장 자주 틀리는 부분입니다")
    lines.append(f"- 근거: {ex['law']}")
    lines.append(f"- 판단: {ex['rule']}")
    lines.append(f"- 해당 직종 예: {', '.join(ex['examples'])}")
    lines.append("")
    lines.append("[항목별 판정 기준]")
    for c in data["checks"]:
        lines.append("")
        lines.append(f"■ {c['id']} ({c['label']}) — 근거 {c['law']}")
        lines.append(f"  조문: {c['lawText']}")
        lines.append(f"  판정: {c['rule']}")
        if c.get("plainHint"):
            lines.append(f"  설명에 쓸 표현: {c['plainHint']}")

    for key in ("minorNote", "smallBusinessNote"):
        if data.get(key):
            lines.append("")
            lines.append(f"[참고] {data[key]}")

    return "\n".join(lines)
