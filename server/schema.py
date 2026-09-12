"""
요청·응답 형태.

앱(types/index.ts)이 기대하는 모양을 그대로 옮긴 것입니다.
여기 필드 이름을 바꾸면 앱이 값을 버립니다. 바꾸기 전에 lib/api.ts 의 normalize() 를 보세요.
"""

from typing import Literal

from pydantic import BaseModel, Field

# types/index.ts 의 CheckId. 순서까지 같아야 합니다. (CHECK_ORDER)
CHECK_ORDER: list[str] = [
    "contractType",
    "wage",
    "probation",
    "hours",
    "break",
    "weeklyPay",
    "penalty",
    "required",
]

# types/index.ts 의 CHECK_LABELS
CHECK_LABELS: dict[str, str] = {
    "contractType": "계약 형태",
    "wage": "시급",
    "probation": "수습 감액",
    "hours": "근로시간",
    "break": "휴게시간",
    "weeklyPay": "주휴수당",
    "penalty": "위약금 조항",
    "required": "명시 항목",
}

# types/index.ts 의 Verdict. 띄어쓰기가 없습니다.
# 화면에 보이는 "위법 소지" 는 앱이 theme.ts 에서 따로 만듭니다.
Verdict = Literal["위법소지", "확인필요", "문제없음"]
VERDICTS: set[str] = {"위법소지", "확인필요", "문제없음"}


class InspectRequest(BaseModel):
    """앱이 보내는 것. 필드는 이거 하나뿐입니다. (lib/api.ts:161)"""

    imageBase64: str = Field(min_length=1)


class Scripts(BaseModel):
    soft: str = ""
    firm: str = ""


class Clause(BaseModel):
    id: str
    label: str
    verdict: Verdict
    original: str = ""
    plain: str
    law: str = ""
    scripts: Scripts


class InspectResponse(BaseModel):
    """
    앱은 이 객체를 래핑 없이 그대로 받습니다. {"data": ...} 같은 걸로 감싸면 안 됩니다.

    imagePath 와 followUp 은 앱이 자기가 채우므로 서버는 보내지 않습니다.
    (lib/api.ts:100 이 imagePath 를 무조건 "" 로 덮어씁니다)
    """

    id: str
    createdAt: str
    basedOn: str
    assumptions: list[str]
    clauses: list[Clause]
    title: str | None = None
