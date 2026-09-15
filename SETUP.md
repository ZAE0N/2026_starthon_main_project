# 시작하기

> **프로젝트 생성은 이미 끝났습니다.** 팀원은 `TEAM_GUIDE.md` 를 보세요.
> 이 문서는 무엇이 어떻게 세팅돼 있는지를 기록해 둔 것입니다.

---

## 구조

```
app/                  화면 (파일 이름이 곧 주소)
  _layout.tsx         공통 레이아웃          전정현
  index.tsx           랜딩         /         신우철
  camera.tsx          사진 선택    /camera   나영웅
  analyzing.tsx       분석 중      /analyzing 나영웅
  result.tsx          진단 결과    /result   전정현
  clause/[id].tsx     조항 상세    /clause/wage  정윤지
  script.tsx          말할 문장    /script?id=wage 정윤지
  history.tsx         기록함       /history  전정현
  help.tsx            도움받기     /help     신우철

types/index.ts        화면 간 데이터 형식          ┐
constants/theme.ts    색·간격·글자크기             │ 전정현만 수정
constants/copy.ts     공통 문구 (개인정보·면책)     │
constants/mock.ts     가짜 데이터                  │
lib/api.ts            서버 호출                    │
lib/session.ts        화면 간 결과·사진 전달        │
lib/storage.ts        폰 저장                      │
lib/photo.ts          사진 가져오기·축소            ┘

server/laws.json      판정 기준 (김종현)
server/README.md      서버 명세
assets/               앱 아이콘·스플래시  ← 계약서 사진을 여기 두지 마세요
```

`types` `constants` `lib` 는 서로 상대경로로 참조합니다. 폴더를 옮기면 전부 깨집니다.

---

## 설치된 패키지

```
expo-image-picker                          사진 찍기·갤러리에서 고르기
expo-image-manipulator                     해상도 축소 (합의된 예외 1건)
expo-file-system                           사진 저장
@react-native-async-storage/async-storage  판정 결과 저장
expo-clipboard                             (2026-09-14 현재 쓰지 않음 — 아래 참고)
expo-camera                                앱 안 촬영 + 초록 가이드 네모
lucide-react-native / react-native-svg     아이콘
```

`expo-camera` 는 2026-09-15 에 추가했습니다. 앱 안에서 미리보기를 띄우고
그 위에 초록 가이드 네모를 겹치려면 필요합니다. 폰 기본 카메라 화면에는
우리가 아무것도 그릴 수 없습니다.

앱 안 카메라가 안 되면 기존 `takePhoto()`(폰 기본 카메라)로 되돌아갑니다.
촬영이 막히면 앱 전체가 멈추므로 되돌아갈 길을 남겨뒀습니다.
안 쓰는 패키지가 있으면 AI가 그걸로 코드를 만들어서 오히려 방해가 됩니다.

> **`expo-clipboard`** — 말할 문장을 복사하는 데 썼지만 2026-09-14 에 복사 버튼을
> 빼면서 쓰는 곳이 없어졌습니다. `package.json` 에는 아직 남아 있습니다.
> 복사를 다시 넣을 계획이 없으면 지우는 게 맞습니다. 위 문장이 그 이유입니다.

**Expo SDK 57 / React Native 0.86 / React 19** 를 씁니다.

---

## 실행

```bash
npm install
cp .env.example .env      # 윈도우: copy .env.example .env
npx expo start
```

폰에 **Expo Go** 를 깔고 QR을 찍습니다.

`.env` 에서 채우는 건 `EXPO_PUBLIC_API_TOKEN` 한 줄뿐입니다.
서버 주소는 `lib/api.ts` 의 `DEFAULT_API_URL` 에 기본값이 있어서, 로컬에서 띄운
서버에 붙일 때만 `.env` 에 적습니다.

> `.env` 값을 바꾸면 저장만으로는 반영되지 않습니다.
> `npx expo start -c` 로 캐시를 지우고 다시 시작하세요.

폰과 같은 와이파이에 붙을 수 없는 PC 라면 `--tunnel` 이 필요합니다.
실행 방법과 증상별 조치는 `RUN_EXPO_GO.md` 에 있습니다.

---

## 세팅하면서 정한 것

| 항목 | 값 | 이유 |
|---|---|---|
| 화면 폴더 | 루트 `app/` | SDK 57 기본값은 `src/app/` 이지만, 문서 전체가 `app/` 기준이라 맞췄습니다 |
| `userInterfaceStyle` | `light` | 다크모드에서 흰 글씨가 흰 배경에 깔리는 걸 막습니다 |
| `typedRoutes` | `false` | 켜두면 <code>router.push(\`/clause/${'$'}{id}\`)</code> 에서 타입 에러가 납니다 |
| 타임아웃 | 45초 | 25초는 짧아 시연 중 타임아웃 위험이 있었습니다 |
| 사진 | 긴 변 1600px | `quality` 는 압축률만 바꾸고 해상도는 그대로라 용량이 안 줄었습니다 |

---

## 서버 없이 개발하기

`.env` 의 `EXPO_PUBLIC_USE_MOCK=true` 면 가짜 결과가 돌아옵니다.
기본값은 `false` 이고, 그때는 배포된 서버가 실제로 판정합니다.

**분석이 2초에 끝나면 목 모드입니다.** 실제 판정은 6~7초 걸립니다.
어떤 계약서를 넣어도 결과가 같으면 이 값을 먼저 확인하세요.

에러 화면을 만들 때는 `EXPO_PUBLIC_MOCK_ERROR` 에
`timeout` `network` `server` `unreadable` `notContract` 중 하나를 넣고
`npx expo start -c` 로 다시 켭니다.
