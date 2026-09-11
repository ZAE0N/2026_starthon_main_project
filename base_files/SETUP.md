# 시작하기

## 1. 프로젝트 만들기 (전정현)

```bash
npx create-expo-app@latest albacheck
cd albacheck
```

**주의: `--template blank-typescript` 를 쓰지 마세요.**
그 템플릿에는 expo-router가 없어서 `app/` 폴더 방식이 동작하지 않습니다.
기본 템플릿에는 expo-router와 TypeScript가 모두 들어 있습니다.

## 2. 필요한 패키지

```bash
npx expo install expo-image-picker expo-file-system \
  @react-native-async-storage/async-storage expo-clipboard
```

- `expo-image-picker` — 사진 찍기와 갤러리에서 고르기 (둘 다 이걸로 합니다)
- `expo-clipboard` — 말할 문장 복사

> `expo-camera` 는 설치하지 않습니다. 폰 기본 카메라를 쓰기 때문에 필요 없습니다.
> 안 쓰는 패키지가 있으면 AI가 그걸로 코드를 만들어서 오히려 방해가 됩니다.

## 3. 이 저장소 파일 복사

```
types/        constants/     lib/
AGENTS.md     .env.example   .gitignore
server/       ← FastAPI 쪽에서 쓸 파일
```

`.env.example`을 복사해서 `.env`를 만듭니다.

```bash
cp .env.example .env
```

## 4. 라이트 모드 고정 (app.json)

다크모드에서 흰 글씨가 흰 배경에 깔리는 걸 막습니다.

```json
{
  "expo": {
    "userInterfaceStyle": "light"
  }
}
```

## 5. 실행

```bash
npx expo start
```

폰에 **Expo Go** 앱을 깔고 QR을 찍습니다.

> `.env` 값을 바꾸면 저장만으로는 반영되지 않습니다.
> `npx expo start -c` 로 캐시를 지우고 다시 시작하세요.

---

## 오늘(9/11) 체크리스트

- [ ] 전정현: 프로젝트 생성 → 화면 8개 빈 파일 → 깃허브 push
- [ ] 전정현: `.gitignore`에 `.env` 들어갔는지 확인
- [ ] 나영웅·정윤지·신우철: Expo Go로 화면 뜨는지 확인
- [ ] 김종현: `server/laws.json`의 TODO 채우기 시작

**팀원 4명은 `.env`에 `EXPO_PUBLIC_USE_MOCK=true`가 있으면 서버 없이 바로 화면을 만들 수 있습니다.**

---

## 화면 파일 (전정현이 빈 파일로 먼저 만들어 둘 것)

```
app/
  _layout.tsx          (전정현)
  index.tsx            랜딩         신우철
  camera.tsx           촬영         나영웅
  analyzing.tsx        분석 중      나영웅
  result.tsx           진단 결과    전정현
  clause/[id].tsx      조항 상세    정윤지
  script.tsx           말할 문장    정윤지
  history.tsx          기록함       전정현
  help.tsx             도움받기     신우철
```
