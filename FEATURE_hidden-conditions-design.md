# 놓치기 쉬운 조건 안내 — 설계

기획: `FEATURE_hidden-conditions.md`
이 문서는 그 기획을 현재 코드에 맞춰 옮긴 것이다. 무엇을 누가 어디에 넣는지만 적는다.

## 지금 어디까지 돼 있나

**전정현 몫은 구현이 끝났다.** `server/conditions.py` 는 껍데기만 있고,
`laws.json` 에 `conditions` 블록이 없으므로 **판정 결과는 지금과 완전히 같다.**
이 상태로 배포해도 아무것도 바뀌지 않는다.

| | 상태 |
|---|---|
| `types/index.ts` `Workplace`·`Note` | 완료 |
| `lib/session.ts` `setWorkplace`·`useWorkplace` | 완료 |
| `lib/api.ts` 요청 필드·`notes` 수용 | 완료 |
| `server/schema.py` | 완료 |
| `server/main.py` 답 전달 | 완료 |
| `server/inspector.py` `decide()` 호출·`overrides` 적용 | 완료 |
| `app/result.tsx` "몰랐을 수도 있는 것" | 완료 |
| `server/conditions.py` | **껍데기.** 김종현이 채운다 |
| `server/laws.json` `conditions` | **없음.** 김종현이 만든다 |
| `app/camera.tsx` 질문 칩 | **없음.** 나영웅이 만든다 |

질문 칩이 없으니 아직 답이 `null` 로만 간다. 서버는 지금과 같이 5인 이상·만 18세 이상
기준으로 보고 전제에 밝힌다. 즉 **순서에 상관없이 각자 붙이면 된다.**

배선은 가짜 모델 응답으로 확인했다. 세 경우 모두 기대대로 동작한다.

- 옛 번들(새 필드 안 보냄) → 200, 지금과 동일
- 새 필드 보냄 + `conditions` 없음 → 200, 지금과 동일
- `conditions` 채움 → `hours` 가 `문제없음` 으로 덮어써지고 전제가 바뀌고 안내가 붙음

---

## 먼저: 이미 만들어져 있는 것

기획의 4단계 중 **3번(전제를 화면에 밝힌다)은 이미 동작한다.**

| 기획 | 현재 상태 |
|---|---|
| 전제를 화면에 밝힌다 | `InspectResult.assumptions: string[]` 이 있고 `app/result.tsx:148` 이 그린다 |
| 5인 미만 안내 문구 | `laws.json` 의 `smallBusinessNote` 에 초안이 있다 |
| 만 18세 미만 안내 문구 | `laws.json` 의 `minorNote` 에 초안이 있다 |
| 15시간 미만 → 주휴수당 | `checks.weeklyPay.rule` 에 이미 들어가 있다 (계약서에서 읽음) |
| 1년 미만 → 수습 감액 불가 | `checks.probation.rule` 에 이미 들어가 있다 (계약서에서 읽음) |

**기획이 말한 조건 4개 중 2개는 이미 계약서에서 읽어 판정한다.** 물어볼 건 2개다.
기획서도 그렇게 적어뒀다. 맞다.

지금 `assumptions` 는 고정값 2줄이다.

```
만 18세 이상, 5인 이상 사업장 기준으로 봤어요.
사진에 보이는 내용만 확인했어요. 뒷장이 있다면 따로 확인해 주세요.
```

이 첫 줄이 `PROGRESS.md` 의 미해결 사항 **R2**(만 18세 이상 전제와 청소년 타깃의 충돌)다.
이 기능이 R2 를 없앤다. 물어보고 답을 그대로 쓰면 전제를 우길 필요가 없다.

---

## 안 맞는 것 3가지 — 착수 전에 정해야 한다

### (1) 야간수당은 판정 항목에 없다

기획의 대표 예시가 야간수당인데, `laws.json` 의 `checks` 8개에 **근로기준법 제56조가 없다.**
`scenario/README.md` 에도 적혀 있다. 시나리오3 계약서의 진짜 문제가 제56조 위반인데
앱은 휴게시간만 짚는다.

그래서 야간수당은 **안내는 되지만 판정은 안 된다.**

발표에서 야간수당을 앞세우면 "그럼 야간수당 위반은 잡아주나요?" 에 답이 없다.
둘 중 하나를 골라야 한다.

- **안내 전용으로 둔다** — 3일 일정에서는 이걸 권한다. "몰랐을 수도 있는 것" 에만
  넣고, 판정 항목이 아니라는 걸 문구로 분명히 한다
- **제56조를 9번째 항목으로 추가한다** — `CheckId`, `CHECK_ORDER`, `CHECK_LABELS`,
  `server/schema.py`, `laws.json`, 결과 화면 문구가 같이 바뀐다. 범위가 크다

### (2) 5인 미만이 판정을 어디까지 바꾸는지 확인이 안 됐다 — 김종현 1순위

기획은 "같은 계약서라도 5인 미만이면 다른 결과가 나온다" 고 적었다. **맞는데,
어느 항목이 바뀌는지가 확정돼 있지 않다.**

근로기준법 제11조는 5인 미만 사업장에 법 일부만 적용한다. 적용되는 조항 목록은
근로기준법 시행령 별표1 에 있다. 우리 8개 항목 중 어디가 걸리는지 확인이 필요하다.

| 항목 | 근거 | 5인 미만에도 적용되나 |
|---|---|---|
| `hours` 근로시간 | 근로기준법 제50조 | **확인 필요** |
| `break` 휴게시간 | 근로기준법 제54조 | **확인 필요** |
| `weeklyPay` 주휴수당 | 근로기준법 제55조 | **확인 필요** |
| `required` 명시 항목 | 근로기준법 제17조 | **확인 필요** |
| `penalty` 위약금 조항 | 근로기준법 제20조 | **확인 필요** |
| `contractType` 계약 형태 | 근로기준법 제2조 | **확인 필요** |
| `wage` 시급 | 최저임금법 제6조 | 적용 (최저임금법은 사업장 규모와 무관) |
| `probation` 수습 감액 | 최저임금법 제5조 제2항 | 적용 (같은 이유) |

**이게 제일 중요하다.** 만약 `hours` 가 5인 미만에 적용되지 않는다면,
시나리오2(주 60시간)를 5인 미만 사업장에서는 위법이라고 말할 수 없다.
지금 앱은 5인 이상 기준으로 판정하므로, **5인 미만 사용자에게는 없는 위법을
알려주고 있는 셈이다.**

없는 위법을 만들어내면 사용자가 그걸 믿고 사장님에게 따진다.
`scenario/README.md` 에 적어둔 대로 이 앱에서 가장 나쁜 오류다.

**다만 이 확인이 착수를 막지는 않는다.** 아래 `conditions.py` 의 `overrides` 가
빈 딕셔너리면 판정은 지금과 똑같이 나온다. 안내 문구부터 붙이고, 확인이 끝나는 대로
`laws.json` 의 `appliesTo` 를 채우면 판정이 따라 바뀐다.
김종현이 조사와 구현을 같이 맡으므로 중간에 인수인계도 없다.

### (3) "판정에 반영한다" 는 말은 확인 뒤에 쓴다

(2)의 결과가 "우리 8개 항목은 전부 5인 미만에도 적용된다" 로 나오면,
5인 미만 답변은 판정을 하나도 바꾸지 않는다. 안내 문구만 바뀐다.

그래도 기능의 가치는 남는다. 야간수당·연차·부당해고가 적용되지 않는다는 건
사용자가 꼭 알아야 하고 그게 기획의 핵심이다. 다만 그때는 **"판정에 반영한다" 는
말을 쓰지 말아야 한다.** 발표에서 그렇게 말하면 확인당한다.

---

## 화면 설계

새 화면을 만들지 않는다. 기존 화면 2개에 얹는다. 기획서 권고와 같다.

### 화면 1 — `/camera` 에 질문 2개 추가 (담당: 나영웅)

지금 구조는 이렇다.

```
제목      "계약서 전체가 보이게 찍어주세요"
부제
촬영 예시 그림
팁 3개
─── foot ───
[사진 찍기]  [앨범에서 고르기]
```

질문을 **제목 바로 아래, 예시 그림 위**에 넣는다.

```
제목      "계약서 전체가 보이게 찍어주세요"
부제

┌─ 질문 카드 ─────────────────────────────┐
│ 몇 가지만 먼저 알려주세요                 │
│ 답에 따라 적용되는 법이 달라져요           │
│                                         │
│ 일하는 사람이 몇 명인가요?                │
│ [ 5명 미만 ] [ 5명 이상 ] [ 모르겠어요 ]   │
│                                         │
│ 만 18세 미만인가요?                       │
│ [ 예 ] [ 아니오 ]                         │
└─────────────────────────────────────────┘

촬영 예시 그림
팁 3개
─── foot ───
[사진 찍기]  [앨범에서 고르기]
```

**규칙**

- 칩(chip) 형태로 만든다. `app/script.tsx` 의 톤 전환 버튼과 같은 모양을 쓴다.
  이미 있는 스타일이라 새로 만들 게 없다
- 최소 터치 크기 `minTouch` 를 지킨다 (`constants/theme.ts`)
- **답을 강제하지 않는다.** 미선택이어도 촬영 버튼은 눌린다
- 미선택으로 촬영하면 "모르겠어요" 와 같게 처리한다
- 답은 `lib/session.ts` 에 담는다. 사진을 넘기는 방식과 같다

**미선택·모르겠어요 일 때 어느 기준으로 판정하나**

**5인 이상 · 만 18세 이상** 기준으로 본다. 지금과 같다. 그리고 전제에 명시한다.

이유: 미성년 기준이 더 엄격하다(주 35시간). 성인인데 미성년 기준으로 보면
**없는 위법을 만들어낸다.** 반대 방향(위반을 놓침)보다 이게 더 나쁘다.
`laws.json` 의 `minorNote`·`smallBusinessNote` 도 같은 판단으로 쓰여 있다.

### 화면 2 — `/result` 에 섹션 1개 추가 (담당: 전정현)

`app/result.tsx:148` 의 `assumptions` 블록은 그대로 쓴다. **값만 답에 따라 바뀐다.**
그 아래에 "몰랐을 수도 있는 것" 을 새로 붙인다.

```
… 조항 목록 …
문제없는 항목 6개                    [보기]

┌─ 전제 (기존 assumptions 블록) ──────────┐
│ · 일하는 사람이 5명 미만이라고 하셨어요.  │
│   그 기준으로 봤어요.                    │
│ · 사진에 보이는 내용만 확인했어요.        │
└─────────────────────────────────────────┘

┌─ 몰랐을 수도 있는 것 (신규) ─────────────┐
│ 야간수당은 밤 10시 이후라고 무조건        │
│ 나오는 게 아니에요. 일하는 사람이         │
│ 5명 이상인 곳에서만 적용돼요.             │
│ 지금 일하는 곳은 5명 미만이라,            │
│ 야간에 일해도 가산수당은 없어요.          │
│                                         │
│ 근로기준법 제11조                        │
└─────────────────────────────────────────┘

면책 문구 (기존)
[내 기록]  [다시 찍기]
```

**규칙**

- 해당되는 조건만 보여준다. 4개를 전부 나열하지 않는다
- 하나도 해당 안 되면 **섹션 자체를 숨긴다.** 빈 제목만 남기지 않는다
- 한 조건당 3줄 이내. 기획서의 표현 규칙을 그대로 따른다
- 근거 조문을 각 문단 아래에 작게 붙인다. 조항 상세 화면과 같은 방식이다
- 판정 항목과 시각적으로 구분한다. **배지를 쓰지 않는다.**
  이건 판정이 아니라 안내다. 위법소지처럼 보이면 안 된다

---

## 데이터 흐름

### `types/index.ts` (전정현만 수정)

```ts
/** 사진 보내기 전에 사용자가 답한 것. 모르거나 안 고르면 null */
export type Workplace = {
  /** 상시근로자 수 */
  employeeCount: "under5" | "over5" | null;
  /** 만 18세 미만인지 */
  isMinor: boolean | null;
};

/** "몰랐을 수도 있는 것" 한 덩어리 */
export type Note = {
  /** 어떤 조건 때문에 나온 안내인지 */
  id: "under5" | "minor" | "under15h" | "under1y";
  /** 본문. 3줄 이내 */
  text: string;
  /** 근거 조문 */
  law: string;
};
```

`InspectResult` 에 두 개를 더한다.

```ts
  /** 사용자가 답한 조건. 기록함에서 다시 볼 때 필요하다 */
  workplace?: Workplace;
  /** "몰랐을 수도 있는 것" 에 그릴 안내. 해당 없으면 빈 배열 */
  notes?: Note[];
```

### `lib/api.ts` (전정현)

요청에 두 필드를 더한다.

```ts
body: JSON.stringify({
  imageBase64,
  employeeCount: workplace.employeeCount,  // null 이면 그대로 null
  isMinor: workplace.isMinor,
}),
```

`normalize()` 에 `notes` 를 더한다. **서버가 안 보내도 앱이 안 깨져야 한다.**
배열이 아니면 빈 배열로 둔다. 지금 `assumptions` 를 처리하는 방식과 같게 한다.

### `server/schema.py` (전정현)

```py
class InspectRequest(BaseModel):
    imageBase64: str = Field(min_length=1)
    employeeCount: Literal["under5", "over5"] | None = None
    isMinor: bool | None = None


class Note(BaseModel):
    id: str
    text: str
    law: str = ""


class InspectResponse(BaseModel):
    ...
    notes: list[Note] = []
```

두 요청 필드 모두 **기본값이 있어야 한다.** 없으면 옛 버전 앱이 보내는 요청이
400 으로 막힌다. 팀원 폰에 옛 번들이 남아 있을 수 있다.

### `server/inspector.py` (전정현)

1. 답을 프롬프트에 넣는다. 모델이 사실을 읽을 때 쓴다
2. `assumptions` 를 답에 따라 고른다. 지금은 `laws.assumptions()` 고정값이다
3. `notes` 를 `laws.json` 에서 골라 채운다
4. **판정 변경은 `recompute` 에서 한다.** 프롬프트에만 맡기지 않는다.
   `wage`·`probation` 을 서버가 다시 계산하는 것과 같은 이유다 (M1 대응)

### `server/laws.json` (김종현)

`conditions` 를 새로 만든다. 형태는 기존 `checks` 와 같게 맞춘다.

```json
"conditions": {
  "under5": {
    "law": "근로기준법 제11조",
    "lawText": "(조문 원문)",
    "_verify": "law.go.kr 에서 제11조와 시행령 별표1 확인. 우리 8개 항목 중 어디가 적용 제외인지 적을 것",
    "appliesTo": ["(적용 제외되는 우리 항목 id)"],
    "assumption": "일하는 사람이 5명 미만이라고 하셨어요. 그 기준으로 봤어요.",
    "note": "(3줄 이내 안내 문구)"
  },
  "unknownCount": {
    "assumption": "사업장 규모를 몰라서 5인 이상 기준으로 봤어요. 5명 미만이면 결과가 달라질 수 있으니 확인해 주세요."
  },
  "minor": {
    "law": "근로기준법 제69조·제70조",
    "lawText": "",
    "_verify": "",
    "appliesTo": ["hours"],
    "assumption": "만 18세 미만이라고 하셨어요. 주 35시간 기준으로 봤어요.",
    "note": ""
  },
  "under15h": { "law": "근로기준법 제18조", "note": "" },
  "under1y": { "law": "최저임금법 제5조 제2항", "note": "" }
}
```

`minorNote` 와 `smallBusinessNote` 는 `conditions` 로 옮기고 지운다.
같은 내용이 두 곳에 있으면 하나만 고치게 된다.

### `assumptions` 에서 지워야 하는 줄이 있다

`assumptionsBase` 키를 미리 넣어뒀다. 조건과 무관하게 항상 붙는 전제다.
지금은 사진 관련 한 줄만 들어 있다.

```json
"assumptionsBase": [
  "사진에 보이는 내용만 확인했어요. 뒷장이 있다면 따로 확인해 주세요."
]
```

`conditions` 를 채우면 `conditions.py` 가 `조건별 전제 + assumptionsBase` 로
전제 목록을 만든다. 그때 **기존 `assumptions` 의 첫 줄을 지워야 한다.**

```
"만 18세 이상, 5인 이상 사업장 기준으로 봤어요."   ← 지운다
```

안 지우면 화면에 이렇게 같이 나온다.

```
· 일하는 사람이 5명 미만이라고 하셨어요. 그 기준으로 봤어요.
· 만 18세 이상, 5인 이상 사업장 기준으로 봤어요.      ← 모순
```

`laws.json` 의 `_assumptionsBaseNote` 에도 같은 내용을 적어뒀다.

---

## 작업 분담

김종현이 이번 기능의 서버 쪽 법 로직을 맡는다. 법 조문을 아는 사람이 그 부분을
직접 쓰는 게 맞다. 대신 **`inspector.py` 는 건드리지 않는다.** OpenAI 호출,
45초 예산, `recompute` 가 얽혀 있어서 같이 고치면 원인 찾기가 어려워진다.

그래서 경계를 하나 만든다. `server/conditions.py` 를 새로 두고
김종현이 그 안만 맡는다. `inspector.py` 는 그 함수를 부르기만 한다.

### 김종현

| 작업 | 파일 |
|---|---|
| 제11조·시행령 별표1 확인 → (2)번 표 채우기 | (조사) |
| 조건 4개 근거 조문 확인 | (조사) |
| `conditions` 블록 신규 | `server/laws.json` |
| `conditions` 읽는 함수, 기동 시 형식 검증, 프롬프트 주입 | `server/laws.py` |
| **전제·안내·판정 보정을 정하는 함수** | `server/conditions.py` (신규) |
| 새 필드 2개를 보내고 `notes` 를 확인하도록 확장 | `server/check.py` |
| 5인 미만 시나리오 계약서 1종 제작 | `scenario/` |

기존 `_verify` 8건 검증도 아직 남아 있다. 그것과 같은 방식이다.

### 전정현

| 작업 | 파일 |
|---|---|
| 타입 추가 | `types/index.ts` |
| 답 담아두기 | `lib/session.ts` |
| 요청 필드·`notes` 수용 | `lib/api.ts` |
| 스키마 | `server/schema.py` |
| `conditions.decide()` 호출부, 결과를 응답에 싣기 | `server/inspector.py` |
| "몰랐을 수도 있는 것" 섹션 | `app/result.tsx` |

### 나영웅

| 작업 | 파일 |
|---|---|
| 질문 칩 2개 | `app/camera.tsx` |

### 충돌하지 않는다

각자 파일이 갈려 있다. `server/laws.py` 와 `server/inspector.py` 가 붙어 있지만
김종현은 `laws.py`, 전정현은 `inspector.py` 로 나눠 잡았다.
`laws.json` 은 김종현만 고친다. 지금까지와 같다.

---

## `server/conditions.py` — 인터페이스 먼저 정한다

이걸 먼저 합의하면 **김종현의 법 조사가 끝나기 전에도 양쪽이 동시에 작업할 수 있다.**
전정현은 빈 껍데기를 호출해 두고, 김종현이 안을 채운다.

```py
"""
사용자가 답한 조건으로 전제·안내·판정 보정을 정합니다.

OpenAI 를 호출하지 않고 네트워크도 쓰지 않습니다. 입력만 주면 항상 같은 값이
나오므로 서버를 띄우지 않고 이 파일만 돌려서 확인할 수 있습니다.
"""

from dataclasses import dataclass, field


@dataclass
class Answers:
    """앱이 보낸 답. 모르거나 안 골랐으면 None"""
    employee_count: str | None = None   # "under5" | "over5" | None
    is_minor: bool | None = None


@dataclass
class Facts:
    """계약서에서 읽은 사실. 모델이 채운다"""
    weekly_hours: float | None = None    # 주 소정근로시간
    contract_months: int | None = None   # 계약기간 (개월)


@dataclass
class Decision:
    """결과 화면에 쓸 것들"""
    assumptions: list[str] = field(default_factory=list)
    notes: list[dict] = field(default_factory=list)   # {id, text, law}
    # 판정을 덮어써야 하는 항목. {"hours": "문제없음"} 형태
    overrides: dict[str, str] = field(default_factory=dict)


def decide(answers: Answers, facts: Facts) -> Decision:
    """
    규칙은 laws.json 의 conditions 에서 읽는다. 이 함수에 법을 적어넣지 않는다.
    조문이 바뀌면 json 만 고치면 되게 한다.
    """
```

**`overrides` 가 이 설계의 핵심이다.** 5인 미만이라 `hours` 를 위법으로 볼 수 없다면
여기에 담아서 돌려주고, `inspector.py` 가 그대로 덮어쓴다.
프롬프트에만 맡기지 않는 이유는 `wage`·`probation` 을 서버가 다시 계산하는 것과 같다
(M1 대응). 모델은 사실을 읽고, 판정은 코드가 한다.

`overrides` 가 빈 딕셔너리면 판정은 지금과 똑같이 나온다.
그래서 **(2)번 확인이 끝나기 전에도 기능을 붙여볼 수 있다.** 안내만 먼저 나온다.

### 김종현이 혼자 확인하는 방법

서버도 앱도 안 켜고, OpenAI 크레딧도 안 쓰고 확인할 수 있다.

```bash
cd server
python -c "
from conditions import decide, Answers, Facts
d = decide(Answers(employee_count='under5', is_minor=False), Facts(weekly_hours=60))
print(d.assumptions)
print(d.notes)
print(d.overrides)
"
```

기대한 문구와 `overrides` 가 나오는지만 보면 된다.
`laws.json` 을 고친 뒤에는 이것만 다시 돌려본다.

---

## 정해야 하는 것

착수 전에 답이 필요하다.

1. **야간수당을 안내 전용으로 둘지, 제56조를 9번째 항목으로 추가할지.**
   3일 일정이면 안내 전용을 권한다
2. **`conditions.py` 의 인터페이스를 위 형태로 확정할지.**
   이것만 합의되면 김종현과 전정현이 동시에 착수할 수 있다. 제일 먼저 정할 것
3. 질문을 `/camera` 에 얹을지 새 화면으로 뺄지. 얹는 쪽을 권한다.
   화면을 늘리면 "3분 안에 사진 한 장" 이 깨진다
4. 기록함에 남은 옛 결과에는 `workplace` 가 없다. 그때 전제를 어떻게 보여줄지.
   없으면 지금 문구(5인 이상·만 18세 이상 기준)를 그대로 쓰면 된다

`Facts` 의 `weekly_hours`·`contract_months` 는 모델이 채워야 한다.
지금 프롬프트는 이 두 값을 따로 돌려주지 않는다. `inspector.py` 의 출력 형식에
필드를 더하는 일이라 전정현 몫이다. 김종현은 `None` 이 와도 동작하게 만들면 된다.
