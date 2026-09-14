"""
사용자가 답한 조건으로 전제·안내·판정 보정을 정합니다.  담당: 김종현

설계는 저장소 루트의 FEATURE_hidden-conditions-design.md 를 보세요.

이 파일은 OpenAI 를 호출하지 않고 네트워크도 쓰지 않습니다.
입력만 주면 항상 같은 값이 나오므로, 서버를 띄우지 않고 이것만 돌려서 확인할 수 있습니다.

    cd server
    python -c "
    from conditions import decide, Answers, Facts
    d = decide(Answers(employee_count='under5', is_minor=False), Facts(weekly_hours=60))
    print(d.assumptions); print(d.notes); print(d.overrides)
    "

지금은 껍데기입니다. laws.json 에 conditions 블록이 없으면 빈 Decision 을 돌려주고,
그때 서버는 지금과 똑같이 동작합니다. 그래서 이 파일을 채우기 전에도 배포해도 됩니다.

법을 이 파일에 적지 마세요. 규칙은 laws.json 의 conditions 에서 읽습니다.
조문이 바뀌면 json 만 고치면 되게 둡니다.
"""

from dataclasses import dataclass, field
from typing import Any

import laws


@dataclass
class Answers:
    """앱이 보낸 답. 모르거나 안 골랐으면 None"""

    employee_count: str | None = None  # "under5" | "over5" | None
    is_minor: bool | None = None


@dataclass
class Facts:
    """계약서에서 읽은 사실. 모델이 채웁니다. 못 읽었으면 None"""

    weekly_hours: float | None = None  # 주 소정근로시간
    contract_months: float | None = None  # 계약기간 (개월)


@dataclass
class Decision:
    """결과 화면에 쓸 것들"""

    #: 결과 화면의 전제. **비어 있으면 laws.json 의 assumptions 를 그대로 씁니다.**
    #: 채우면 그것이 전체를 대체합니다. 사진 관련 문구도 같이 넣어야 합니다.
    assumptions: list[str] = field(default_factory=list)

    #: "몰랐을 수도 있는 것" 에 그릴 안내. {"id", "text", "law"} 형태
    notes: list[dict[str, str]] = field(default_factory=list)

    #: 판정을 덮어써야 하는 항목. {"hours": "문제없음"} 형태.
    #: 비어 있으면 판정은 지금과 똑같이 나옵니다.
    overrides: dict[str, str] = field(default_factory=dict)


def _conditions() -> dict[str, Any]:
    """laws.json 의 conditions. 아직 없으면 빈 딕셔너리."""
    block = laws.load().get("conditions")
    return block if isinstance(block, dict) else {}


def _base_assumptions() -> list[str]:
    """
    조건과 무관하게 항상 붙는 전제. laws.json 의 assumptionsBase 다.

    laws.json 의 assumptions 를 쓰지 않는 이유: 거기 첫 줄이
    "만 18세 이상, 5인 이상 사업장 기준으로 봤어요." 인데, 조건별 전제
    ("5명 미만이라고 하셨어요")와 같이 나오면 화면에서 서로 모순된다.
    """
    v = laws.load().get("assumptionsBase")
    return [s for s in v if isinstance(s, str)] if isinstance(v, list) else []


def _matched(answers: Answers, facts: Facts) -> list[str]:
    """
    지금 상황에 해당되는 조건 키들. laws.json 의 conditions 키와 같아야 합니다.

    5인 미만·만 18세 미만은 사용자가 답한 것이고,
    15시간 미만·1년 미만은 계약서에서 읽은 것입니다.
    """
    keys: list[str] = []

    if answers.employee_count == "under5":
        keys.append("under5")
    elif answers.employee_count == "over5":
        keys.append("over5")
    else:
        # 모르겠어요·미선택. 5인 이상 기준으로 보고 그 사실을 전제에 밝힙니다.
        keys.append("unknownCount")

    if answers.is_minor is True:
        keys.append("minor")
    elif answers.is_minor is False:
        keys.append("adult")
    else:
        keys.append("unknownAge")

    if facts.weekly_hours is not None and facts.weekly_hours < 15:
        keys.append("under15h")

    if facts.contract_months is not None and facts.contract_months < 12:
        keys.append("under1y")

    return keys


def _apply_minor_hours(answers: Answers, facts: Facts, out: "Decision") -> None:
    """
    만 18세 미만의 근로시간은 기준이 더 엄격합니다. (근로기준법 제69조)

    appliesTo 로는 표현할 수 없습니다. 그건 "적용되지 않으니 문제없음" 방향인데,
    미성년은 반대로 더 좁은 한도를 적용해야 합니다.

      1일 7시간, 주 35시간까지
      합의하면 1일 1시간, 주 5시간까지 연장 가능 (그래서 최대 주 40시간)

    모델은 성인 기준(주 40시간)으로 판정하므로, 주 35~40시간은 "문제없음" 으로
    나올 수 있습니다. 미성년이면 그건 연장 합의가 있어야 성립합니다.

    그래서 이렇게 나눕니다.
      주 40시간 초과  -> 위법소지. 연장 한도까지 써도 넘습니다
      주 35시간 초과  -> 확인필요. 연장 합의가 있는지 계약서를 봐야 합니다

    이미 위법소지로 판정된 항목은 건드리지 않습니다. 낮추는 방향으로는
    이 규칙을 쓰지 않습니다.
    """
    if answers.is_minor is not True:
        return
    if facts.weekly_hours is None:
        return
    if out.overrides.get("hours") == "위법소지":
        return

    if facts.weekly_hours > 40:
        out.overrides["hours"] = "위법소지"
    elif facts.weekly_hours > 35:
        out.overrides["hours"] = "확인필요"


def decide(answers: Answers, facts: Facts) -> Decision:
    """
    TODO(김종현): laws.json 의 conditions 를 채우면 이 함수는 그대로 동작합니다.
    조건별로 더 따져야 할 게 생기면 _matched() 를 고치세요.

    appliesTo 에 적은 항목 id 는 "그 조건에서 적용되지 않는 우리 항목" 입니다.
    적용되지 않으면 위법이라고 말할 수 없으므로 "문제없음" 으로 덮어씁니다.
    """
    block = _conditions()
    if not block:
        # conditions 가 아직 없다. 지금과 똑같이 동작한다.
        return Decision()

    out = Decision()

    for key in _matched(answers, facts):
        cond = block.get(key)
        if not isinstance(cond, dict):
            continue

        if cond.get("assumption"):
            out.assumptions.append(cond["assumption"])

        if cond.get("note"):
            out.notes.append(
                {
                    "id": key,
                    "text": cond["note"],
                    "law": cond.get("law", ""),
                }
            )

        for check_id in cond.get("appliesTo") or []:
            # 이미 덮어쓴 항목은 그대로 둔다. 조건이 겹쳐도 결과가 흔들리지 않게.
            out.overrides.setdefault(str(check_id), "문제없음")

    _apply_minor_hours(answers, facts, out)

    # 전제를 하나라도 만들었으면 조건과 무관한 문구도 붙여서 전체를 만든다.
    # 여기서 laws.json 의 assumptions 를 쓰지 않는다. _base_assumptions() 주석을 보라.
    if out.assumptions:
        for line in _base_assumptions():
            if line not in out.assumptions:
                out.assumptions.append(line)

    return out
