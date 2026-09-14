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
    """
    앱이 보내는 것. (lib/api.ts)

    employeeCount 와 isMinor 는 사진을 보내기 전에 사용자가 답한 것입니다.
    모르거나 안 골랐으면 None 이고, 그때는 5인 이상·만 18세 이상 기준으로 봅니다.
    설계는 FEATURE_hidden-conditions-design.md 를 보세요.

    ⚠ 두 필드에 기본값이 반드시 있어야 합니다. 필수로 만들면 이 필드를 모르는
      옛 번들이 남아 있는 폰에서 요청이 400 으로 막힙니다.
    """

    imageBase64: str = Field(min_length=1)
    employeeCount: Literal["under5", "over5"] | None = None
    isMinor: bool | None = None


class Scripts(BaseModel):
    soft: str = ""
    firm: str = ""


class Note(BaseModel):
    """
    "몰랐을 수도 있는 것" 한 덩어리. 판정이 아니라 안내입니다.
    앱은 이걸 배지 없이 그립니다. (app/result.tsx)
    """

    id: str
    text: str
    law: str = ""


class Clause(BaseModel):
    id: str
    label: str
    verdict: Verdict
    original: str = ""
    plain: str
    law: str = ""
    #: 조문 전문. laws.json 의 lawText 를 그대로 보냅니다 (AI 가 만든 값이 아닙니다)
    lawText: str = ""
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
    #: 해당되는 조건이 없으면 빈 배열. 앱은 빈 배열이면 섹션을 숨깁니다.
    notes: list[Note] = []
