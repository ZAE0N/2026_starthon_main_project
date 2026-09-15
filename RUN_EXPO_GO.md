# Expo Go 로 폰에서 띄우기

어느 PC 에서 작업하든 같은 순서로 된다. 데스크톱·노트북·팀원 PC 모두 해당한다.

서버는 이미 배포돼 있으므로 **서버를 로컬에서 켤 필요가 없다.**
`server/` 를 건드릴 때만 `server/run_local.md` 를 본다.

---

## 0. 처음 쓰는 PC 라면 (최초 1회)

이미 해둔 PC 면 건너뛴다.

### Node

**Node 20 이상.** 확인:

```bash
node -v
```

없으면 nodejs.org 에서 LTS 를 설치한다. (데스크톱은 v24.19.0 로 돌고 있다)

### 프로젝트 받기

```bash
git clone https://github.com/ZAE0N/2026_starthon_main_project.git
cd 2026_starthon_main_project
git checkout develop
npm install
```

`develop` 이 최신 브랜치다. `main` 은 뒤처져 있으니 쓰지 않는다.
`npm install` 은 3~5분 걸린다.

### .env — 토큰 한 줄

**`.env` 는 `.gitignore` 라서 git 으로 넘어오지 않는다.** `git clone` 만 하면
이 파일이 없다. 서버 주소는 코드에 기본값이 있어서 괜찮지만, 토큰이 없으면
서버가 401 로 막는다. 앱 화면에는 "지금은 분석할 수 없어요" 만 떠서
원인을 알 수 없다.

저장소 루트에 `.env` 를 만들고 이 한 줄만 넣으면 된다.

```
EXPO_PUBLIC_API_TOKEN=<32자>
```

값은 전정현에게 받는다. 기존 PC 의 `.env` 나 서버 `/etc/albacheck.env` 의
`APP_TOKEN` 에 있다. 저장소에는 적지 않는다.

기존 PC 의 `.env` 파일을 그대로 복사해 와도 된다. USB, 카톡 나와의 채팅,
클라우드 중 아무거나 쓴다.

나머지 값은 안 건드려도 된다. 무엇이 있는지는 `.env.example` 에 적혀 있다.

| 키 | 안 적으면 |
|---|---|
| `EXPO_PUBLIC_API_URL` | 배포된 서버(`https://smpsws.shop/albacheck`)를 쓴다. 로컬 서버에 붙일 때만 적는다 |
| `EXPO_PUBLIC_USE_MOCK` | `false` 로 동작한다. `true` 면 가짜 결과만 나온다 |
| `EXPO_PUBLIC_MOCK_ERROR` | 목 모드에서 에러 화면을 볼 때만 쓴다 |

### 폰

Expo Go 를 앱스토어·플레이스토어에서 설치하고, 이미 있으면 **업데이트한다.**
이 프로젝트는 Expo SDK 57 이라 구버전 Expo Go 는 프로젝트를 아예 못 연다.

---

## 1. 시작 전 확인 2가지

```bash
git checkout develop && git pull
npm install
```

**`npm install` 을 빼지 마라.** `package.json` 이 바뀐 걸 받으면 패키지 실물이
없어서 Metro 가 기동할 때 죽는다. 두 번 겪었다.

```
PluginError: Failed to resolve plugin for module "expo-camera"
```

받을 게 없으면 몇 초에 끝나니 매번 넣어도 부담이 없다.

서버가 살아 있는지:

```bash
curl https://smpsws.shop/albacheck/health
```

`{"status":"ok","basedOn":"2026-09-11"}` 이 나와야 한다.
안 나오면 폰 문제가 아니라 서버 문제다. `server/deploy/DEPLOY.md` 를 본다.

---

## 2. 실행 — 이 PC 와 폰이 같은 와이파이에 붙을 수 있나?

여기서 명령이 갈린다. 둘 다 `-c` 를 붙인다. `-c` 는 Metro 캐시를 지우는 것이고,
`.env` 를 바꿨을 때 이게 없으면 변경이 반영되지 않는다.

### 붙을 수 있다 (노트북 등 와이파이가 있는 PC)

```bash
npx expo start -c
```

터미널 QR 을 찍는다. 안드로이드는 Expo Go 의 "Scan QR code",
아이폰은 기본 카메라로 찍으면 Expo Go 가 열린다.

### 데스크톱도 `-c` 만으로 된다 (2026-09-15 확인)

```bash
npx expo start -c
```

전에는 이 문서가 "데스크톱은 `--tunnel` 이어야 한다" 고 적고 있었다. **틀렸다.**

이 데스크톱은 유선만 있고 사설 LAN 주소가 없지만, **공인 IP(`221.151.161.213`)를
직접 받는다.** 그래서 폰이 같은 와이파이가 아니어도, LTE 여도 그대로 붙는다.
방화벽에 `node.exe` 인바운드 Allow 규칙이 이미 있어서 포트를 따로 열 필요도 없다.

Expo Go 에 넣을 주소는 터미널에 나오는 것을 쓰거나 직접 적어도 된다.

```
exp://221.151.161.213:8081
```

> ⚠ 공인 IP 라서 **Metro 가 인터넷에 그대로 열려 있다.** 소스가 노출되므로
> 작업이 끝나면 서버를 닫는다. 이게 싫으면 아래 터널을 쓴다.

### 터널 (노출이 싫을 때, 또는 공인 IP 가 아닐 때)

```bash
npx expo start -c --tunnel
```

처음 한 번은 `@expo/ngrok` 설치 여부를 묻는다. `y` 로 설치한다. 1~2분 걸린다.
이 셸처럼 프롬프트에 답할 수 없는 환경이면 미리 깔아둔다.

```bash
npm install --no-save @expo/ngrok
```

터널은 바깥 서버를 거치므로 첫 로딩이 10~30초 더 걸린다. 정상이다.
주소는 `exp://<무작위>-anonymous-8081.exp.direct` 형태로 나온다.

### Metro 를 두 개 띄우지 마라

하나가 1GB 를 쓴다. 이 PC 는 16GB 인데 두 개를 띄웠다가 하나가 메모리 부족으로
정리됐다. 다른 폴더에서 이미 돌고 있으면 그 터미널에서 `Ctrl+C` 로 닫는다.
포트를 바꿔 같이 띄우려면 `--port 8082` 이고, 주소에 포트를 붙여야 한다.

---

## 3. 폰에서 확인할 순서

화면이 뜨면 이 순서로 눌러본다. 중간에서 막히면 어디까지 됐는지가 곧 원인이다.

| | 화면 | 볼 것 |
|---|---|---|
| 1 | 랜딩 | 통계 카드와 시작 버튼 |
| 2 | 촬영 | 사진 선택. `scenario/` PDF 를 띄워 찍거나 갤러리에서 고른다 |
| 3 | 분석중 | 진행 막대. **7초 안에 넘어가야 한다** |
| 4 | 결과 | 8개 항목. 위법소지가 위로 오고 문제없음은 접혀 있다 |
| 5 | 조항 상세 | 판정 배지와 3섹션 |
| 6 | 말할 문장 | 톤 전환(정중한/명확한 말투) |
| 7 | 기록함 | 썸네일, 이름 바꾸기, 삭제 |

판정이 맞는지까지 보려면 `scenario/README.md` 의 기대 판정과 맞춰본다.
**시나리오 4(정상 계약서)에서 위법소지 0건**이 가장 중요하다.

---

## 4. 안 될 때

| 증상 | 원인과 조치 |
|---|---|
| QR 찍어도 계속 로딩, 끝내 실패 | 폰이 Metro 에 못 닿는 것. `--tunnel` 을 붙인다 |
| Expo Go 가 "프로젝트를 열 수 없다" | Expo Go 가 구버전. 스토어에서 업데이트 |
| 결과가 매번 똑같다 | `.env` 의 `USE_MOCK` 이 `true`. `false` 로 바꾸고 `-c` 로 재시작 |
| 항상 "지금은 분석할 수 없어요" | 토큰 문제일 가능성이 가장 높다. 아래 "토큰이 맞는지 확인하기" 를 먼저 해본다 |
| "인터넷 연결을 확인해 주세요" | 폰의 인터넷. 서버 주소 오타(끝에 `/`)도 같은 증상 |
| "분석이 오래 걸리고 있어요" | 45초 초과. `health` 로 서버 상태를 먼저 본다 |
| "계약서를 읽지 못했어요" | 사진이 흐리거나 잘렸다. 다시 찍는다 |
| `.env` 를 고쳤는데 그대로다 | `-c` 를 빼먹었다. `Ctrl+C` 후 `npx expo start -c` |
| 화면이 아무 반응 없음 | `Ctrl+C` 후 `-c` 로 재시작 |

### 토큰이 맞는지 확인하기

앱을 거치지 않고 서버에 직접 물어보면 토큰 문제인지 바로 갈린다.
가짜 이미지(`"x"`)가 base64 디코딩에서 먼저 막히므로 **OpenAI 호출까지 가지 않는다.
크레딧이 들지 않는다.**

Git Bash 에서:

```bash
TOKEN=$(grep '^EXPO_PUBLIC_API_TOKEN=' .env | sed 's/^[^=]*=//' | tr -d '\r')
curl -s -w "\nHTTP %{http_code}\n" -X POST https://smpsws.shop/albacheck/inspect \
  -H "Content-Type: application/json" -H "X-App-Token: $TOKEN" \
  -d '{"imageBase64":"x"}'
```

응답 코드로 판단한다.

| 코드 | 뜻 |
|---|---|
| `422` `base64 를 디코딩하지 못했습니다` | **토큰 정상.** 원인은 다른 데 있다 |
| `401` `X-App-Token 이 일치하지 않습니다` | 토큰이 비었거나 서버의 `APP_TOKEN` 과 다르다. 32자다 |
| `400` `요청 형식이 올바르지 않습니다` | 명령을 잘못 옮겼다. `-d` 본문이 빠지면 토큰 검사 전에 400 이 난다 |

`422` 가 나왔는데도 앱에서 계속 실패하면 `-c` 없이 켰을 가능성이 가장 높다.
`.env` 값은 Metro 캐시에 박히므로 `Ctrl+C` 후 `npx expo start -c` 로 다시 켠다.

PowerShell 에서는 위 `TOKEN=` 문법이 안 된다. Git Bash 를 쓰거나,
`.env` 를 열어 토큰을 직접 붙여넣어 실행한다.

---

## 5. 알아둘 것

- **`.env` 를 커밋하지 않는다.** 토큰이 저장소에 들어간다
- 계약서 사진은 `samples/` 나 `private/` 에 둔다. 둘 다 `.gitignore` 다.
  `assets/` 는 깃에 올라가므로 두지 않는다
- `scenario/` 의 PDF 4종은 가상 인물·업체라 올려도 되는 테스트용이다
- 폰 화면을 고칠 때 담당 파일은 `SETUP.md` 의 구조표를 본다.
  공통 파일(`types/` `constants/` `lib/`)은 전정현만 고친다
