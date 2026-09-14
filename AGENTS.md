# 개발 규칙

AI에게 코드를 부탁할 때 이 파일을 먼저 읽히세요.
Claude Code는 자동으로 읽습니다. 다른 도구는 내용을 붙여넣으세요.

---

## 프로젝트

알바 근로계약서를 사진으로 찍으면 위법 조항을 판정하고,
사장님에게 실제로 말할 문장까지 만들어주는 앱.

**핵심은 판정이 아니라 말할 문장입니다.** `app/script.tsx` 가 가장 중요한 화면입니다.

---

## 스택

- Expo **SDK 57** (React Native) + TypeScript
- 라우팅: **expo-router** (파일 기반). 화면은 저장소 루트의 `app/` 에 둡니다
- 사진: expo-image-picker (촬영·갤러리 모두, 폰 기본 카메라 사용)
  \+ expo-image-manipulator (해상도 축소)
- 저장: expo-file-system + AsyncStorage (폰 안에만)
- 서버: FastAPI (AI 호출 중계만, 사진 저장 안 함)

---

## 화면과 담당자

| 파일 | 화면 | 담당 |
|---|---|---|
| `app/_layout.tsx` | 공통 레이아웃 | 전정현 |
| `app/index.tsx` | 랜딩 | 신우철 |
| `app/camera.tsx` | 사진 선택 | 나영웅 |
| `app/analyzing.tsx` | 분석 중 | 나영웅 |
| `app/result.tsx` | 진단 결과 | 전정현 |
| `app/clause/[id].tsx` | 조항 상세 | 정윤지 |
| `app/script.tsx` | 말할 문장 | 정윤지 |
| `app/history.tsx` | 기록함 | 전정현 |
| `app/help.tsx` | 도움받기 | 신우철 |

**자기 담당 파일 외에는 수정하지 않습니다.**

---

## 절대 규칙

1. **새 라이브러리 설치 금지.** 필요하면 팀 채팅에 먼저 올립니다.
   (이미 합의된 예외 1건: `expo-image-manipulator` — 사진 해상도 축소용으로 설치되어 있습니다.
   `lib/photo.ts` 안에서만 씁니다. 화면에서 직접 부르지 마세요.)
2. **색·글자크기·여백 하드코딩 금지.** `constants/theme.ts` 에서 가져옵니다.
3. **`types/index.ts` 형식을 그대로 씁니다.** 필드를 임의로 바꾸지 않습니다.
4. **공통 파일은 전정현만 수정합니다.** (`types/`, `constants/`, `lib/`)
5. **개인정보·면책 문구는 `constants/copy.ts` 에서만 가져옵니다.** 직접 쓰지 마세요.

---

## 화면 사이 데이터 전달

**결과 객체를 라우터 파라미터로 넘기지 마세요.** 문자열로 바뀌면서 깨집니다.
`lib/session.ts` 를 씁니다.

```ts
// 분석이 끝났을 때 (analyzing.tsx)
import { setCurrent } from "../lib/session";
setCurrent(result);
router.replace("/result");     // push 아님. push면 뒤로가기 시 분석이 다시 돕니다.

// 결과를 읽는 화면 (result, clause/[id], script)
import { useCurrent } from "../lib/session";
const result = useCurrent();
if (!result) { router.replace("/"); return null; }  // 앱 재시작 시 비어 있음
```

**조항을 지정할 때만 파라미터를 씁니다.**

```ts
router.push(`/clause/${clause.id}`);        // 조항 상세
router.push(`/script?id=${clause.id}`);     // 말할 문장

// 받는 쪽
const { id } = useLocalSearchParams<{ id: string }>();
const clause = findClause(result, id);
```

### 사진도 session 으로 넘깁니다

base64 는 수십만 자라 라우터 파라미터로 넘기면 잘립니다.

```ts
// 촬영 화면 (camera.tsx)
import { clearCurrent, setCurrentPhoto } from "../lib/session";
const photo = await takePhoto();
if (!photo) return;              // 취소했거나 권한 거부
clearCurrent();                  // 이전 결과·사진 비우기
setCurrentPhoto(photo);
router.replace("/analyzing");

// 분석 화면 (analyzing.tsx)
import { getCurrentPhoto } from "../lib/session";
const photo = getCurrentPhoto();
if (!photo) { router.replace("/camera"); return null; }
```

### 분석이 끝나면 `saveResult` 의 **반환값**을 넣습니다

서버 응답에는 사진 경로가 없습니다. `saveResult` 가 사진을 복사하고
경로를 채워서 돌려주므로, **돌려받은 객체**를 session 에 넣어야 합니다.
그냥 `setCurrent(result)` 하면 결과·기록함 화면에 사진이 영영 안 보입니다.

```ts
const result = await inspectContract(photo.base64);
const saved  = await saveResult(result, photo.uri);   // ← 반환값
setCurrent(saved);
router.replace("/result");
```

### 기록함에서 과거 결과를 열 때

결과 화면은 `useCurrent()` 만 봅니다. 기록함에서는 session 에 실어준 뒤 보냅니다.

```ts
// history.tsx
setCurrent(item);
router.push("/result");
```

---

## 사진 가져오기

**카메라를 직접 다루지 말고 `lib/photo.ts` 를 쓰세요.**
용량을 안 줄이면 실제 계약서 사진에서 서버가 거부합니다.
(작은 테스트 사진으로는 통과하고 진짜 사진에서만 실패합니다.)

```ts
import { takePhoto, pickPhoto } from "../lib/photo";

const photo = await takePhoto();   // 촬영
const photo = await pickPhoto();   // 갤러리에서 고르기
if (!photo) { /* 취소했거나 권한 거부 */ }
// photo.base64 → 서버로, photo.uri → 저장용
```

**갤러리 선택은 필수 기능입니다.** 이미 계약서를 쓰고 사진만 남은 사용자가
주요 타깃이고, 촬영 셔터음 때문에 현장에서 못 찍는 경우도 있습니다.

### `app/camera.tsx` 는 카메라 화면이 아닙니다

폰 기본 카메라를 띄우므로, 앱 안에 촬영 미리보기나 가이드 네모를 만들 수 없습니다.
이 화면은 **사진을 어떻게 가져올지 고르는 화면**입니다.

- 계약서를 어떻게 찍어야 하는지 안내 그림 또는 문구
- 버튼 2개: "사진 찍기" / "갤러리에서 고르기"
- 사진을 얻으면 `setCurrentPhoto` 없이 바로 `/analyzing` 으로 이동하면서
  `lib/session.ts` 에 담아 넘깁니다

> 앱 안에서 미리보기를 띄우는 커스텀 카메라(`CameraView`)는 이번 범위가 아닙니다.
> 발표의 "개선 방향"에 넣습니다.

---

## 서버 호출

```ts
import { inspectContract, ApiError } from "../lib/api";
import { copy } from "../constants/copy";

try {
  const result = await inspectContract(photo.base64);
} catch (e) {
  const kind = e instanceof ApiError ? e.kind : "server";
  const msg = copy.errors[kind];   // title / body / action
}
```

**에러 종류마다 사용자가 할 일이 다릅니다.** 하나로 뭉뚱그리지 마세요.
`network` `timeout` `server` `unreadable` `notContract` `permission`

**중복 호출을 막으세요.** 버튼 연타하면 그만큼 API 비용이 나갑니다.
요청 중에는 버튼을 비활성화합니다.

---

## 저장

```ts
import { saveResult, loadHistory, getResult, deleteResult, updateResult } from "../lib/storage";

await saveResult(result, photo.uri);   // 사진 복사까지 한 번에
```

`id` 는 서버가 준 값을 그대로 씁니다. 앱에서 새로 만들지 않습니다.
사진 파일명이 이 id로 정해져서, 새로 만들면 사진과 결과가 어긋납니다.

---

## 화면 만들 때 지킬 것

**결과 화면**
- 문제 있는 항목을 위로 (`getIssues()` 사용). 문제없음은 접어둡니다 (`getOk()`)
- `result.assumptions` 를 화면 아래에 그대로 표시 (5인 이상·18세 이상 전제)
- `copy.disclaimer` 상시 노출
- "다시 찍기" 버튼 필수. 사진이 흐려 판정이 이상할 때 돌아갈 길이 있어야 합니다

**말할 문장 화면**
- 톤 전환(정중한 말투 / 명확한 말투)으로 `clause.scripts.soft` `firm` 을 바꿔 보여줍니다
- 판정이 `문제없음` 인 항목은 `scripts` 가 빈 문자열입니다. 들어올 일이 없게
  조항 상세에서 버튼을 숨기지만, 빈 값이 와도 화면이 깨지지 않게 둡니다

> 2026-09-14: **복사 버튼과 `followUp` 질문("사장님께 말해보셨나요?")을 빼기로 했습니다.**
> 전정현이 정한 것이고 되살리지 않습니다. `copy.followUp`, `setFollowUp()`,
> `FollowUp` 타입도 같이 지웠습니다. 옛 커밋이나 문서에서 보셨더라도 다시 넣지 마세요.

**판정 색**
- 직접 쓰지 말고 `verdictStyle[clause.verdict]` 사용
- **색만으로 구분하지 말고 반드시 글자를 같이 씁니다** (색각이상 대응)

**빈 값 처리**
- `original` 이 빈 문자열이면 인용구 박스를 통째로 숨깁니다

---

## 자주 틀리는 것

- **`expo-camera` 를 쓰지 않습니다.** `lib/photo.ts` 만 씁니다.
- **`mediaTypes` 값**: 최신 버전은 `["images"]`, 예전 버전은
  `ImagePicker.MediaTypeOptions.Images` 입니다. 에러가 나면 바꿔보세요.
- **텍스트는 반드시 `<Text>` 로 감쌉니다.** 맨 문자열을 두면 앱이 죽습니다.
- **웹 태그 금지**: `div`/`span`/`img`/`button` → `View`/`Text`/`Image`/`Pressable`
- **CSS 문자열 금지**: `"16px"` 가 아니라 숫자 `16`
- **스타일은 `StyleSheet.create`** 로 만듭니다
- **고정 높이 금지**: 사용자가 시스템 글씨를 키우면 잘립니다. `minHeight` 를 쓰세요
- **터치 영역은 44 이상** (`minTouch`)
- **`router.push` vs `replace`**: 되돌아가면 안 되는 곳은 `replace`

---

## 글쓰기 톤

- 존댓말, 문장 끝은 "~해요"
- 겁주지 않습니다. "위반입니다"가 아니라 "위법 소지가 있어요"
- 한 문장에 하나만 말합니다
- 버튼은 무슨 일이 일어나는지 그대로: "확인" 대신 "계약서 촬영하기"
- 증거라고 단정하지 않습니다. "증거" 대신 "내 기록"

---

## Git

- 브랜치: `feat/화면이름` (예: `feat/camera`)
- main 직접 push 금지, PR만
- 머지는 전정현만
- 매일 저녁 PR 올리기. 미완성이어도 올립니다
