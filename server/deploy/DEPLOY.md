# 배포 (실제 적용 내역)

2026-09-13 에 아래 구성으로 배포했습니다. **이 문서는 계획이 아니라 실제로 한 것입니다.**

| | |
|---|---|
| 주소 | `https://smpsws.shop/albacheck` |
| 상태 확인 | `https://smpsws.shop/albacheck/health` |
| 서버 | AWS Lightsail · Ubuntu 24.04.4 · Python 3.12.3 |
| 코드 | `/opt/albacheck/server/` · venv `/opt/albacheck/.venv/` |
| 서비스 | `albacheck.service` → `127.0.0.1:8003` (워커 1개) |
| 비밀값 | `/etc/albacheck.env` (root, 600) |
| nginx | `sites-available/inhatc` 안에 `location ^~ /albacheck/` |

---

## 왜 이 구성인가

**이 서버에는 다른 프로젝트가 같이 돌고 있습니다.** 그래서 아래 원칙으로 했습니다.

- **새 도메인·새 인증서를 만들지 않았습니다.** 기존 `smpsws.shop` 에 경로만 추가했습니다.
  앱이 `${API_URL}/inspect` 로 하드코딩하므로(`lib/api.ts:155`),
  `EXPO_PUBLIC_API_URL=https://smpsws.shop/albacheck` 로 두면 그대로 맞습니다.
- **Lightsail 방화벽을 건드리지 않았습니다.** 80/443 만 씁니다.
- **우리 uvicorn 은 `127.0.0.1` 에만 붙입니다.** `0.0.0.0` 이면 nginx 를 건너뛰어
  HTTPS 도 업로드 크기 제한도 없는 통로가 생깁니다.
- **포트 8003.** 8000·8001·8002·8010·8080 은 이미 쓰이고 있었습니다.
  8000 을 쓰지 않은 이유: `sites-available/board` 가 아직 `/guidance/` → 8000 을
  가리키고 있어 혼선이 생깁니다.

### 같이 돌고 있어 건드리면 안 되는 것

| 서비스 | 포트 | 용도 |
|---|---|---|
| `inhatc-api.service` | 8010 | `smpsws.shop/api/` — 실제 사용 중 |
| `exam-gen.service` | 8002 | Exam Quiz Generator — 실제 사용 중 |
| nginx | 80, 443 | `smpsws.shop` 전체 |
| mysqld | 3306 | |

### 중지한 것 (2026-09-13)

배포 전 메모리 여유가 343MB 뿐이라 쓰이지 않는 것을 정리했습니다.
**코드와 데이터는 지우지 않았고 `disabled` 상태입니다.**

| | 확보 | 되살리기 |
|---|---|---|
| `java -jar demo-0.0.1-SNAPSHOT.jar` | 510MB | `nohup java -jar ... &` (systemd 유닛 없음) |
| `guidance.service` | 90MB | `sudo systemctl enable --now guidance` |
| `eatzy-backend.service` | 132MB | `sudo systemctl enable --now eatzy-backend` |

여유 343MB → 1,009MB. 스왑은 추가하지 않았습니다.

---

## 접속

```bash
ssh -i <키경로> ubuntu@<서버IP>
```

윈도우에서 키 권한을 안 좁히면 ssh 가 거부합니다.

```
icacls "<키경로>" /inheritance:r /grant:r "<계정명>:R"
```

---

## 다시 배포하기 (코드를 고쳤을 때)

```bash
# 1) PC 에서 — develop 에 있는 것을 그대로 꺼내 올립니다
git archive origin/develop server/ | tar -x -C /tmp/deploy
cd /tmp/deploy && tar czf albacheck.tar.gz server
scp -i <키> albacheck.tar.gz ubuntu@<IP>:/tmp/

# 2) 서버에서
sudo tar xzf /tmp/albacheck.tar.gz -C /opt/albacheck
sudo chown -R ubuntu:ubuntu /opt/albacheck
/opt/albacheck/.venv/bin/pip install -q -r /opt/albacheck/server/requirements.txt
sudo systemctl restart albacheck
curl -s http://127.0.0.1:8003/health
```

`git archive` 로 꺼내는 이유: 로컬 작업물이 섞이지 않고, `.env` 나 `.venv` 가
실수로 올라갈 일이 없습니다.

**`laws.json` 을 고쳤으면 반드시 재시작해야 합니다.** 기동할 때 한 번만 읽습니다.

---

## 비밀값

`/etc/albacheck.env` (root 소유, 600). 저장소에는 두지 않습니다.

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.4
APP_TOKEN=<32자 hex>
MAX_IMAGE_MB=8
OPENAI_TIMEOUT=30
LOG_LEVEL=INFO
```

`APP_TOKEN` 은 `openssl rand -hex 16` 으로 만들었습니다.
**앱의 `EXPO_PUBLIC_API_TOKEN` 과 같은 값이어야 합니다.**
앱은 토큰이 비어 있으면 `X-App-Token` 헤더를 아예 보내지 않아서(`lib/api.ts:159`),
한쪽만 채우면 모든 요청이 401 이 되고 앱에는 "지금은 분석할 수 없어요" 로만 보입니다.

이 토큰은 앱 번들에 평문으로 들어가므로 진짜 비밀이 아닙니다.
**크레딧 보호의 실제 방어선은 OpenAI 대시보드의 지출 한도입니다.**

키만 바꿀 때는 값이 화면에 남지 않게 이렇게 합니다.

```bash
ssh -t -i <키> ubuntu@<IP> "sudo nano /etc/albacheck.env"   # 진짜 터미널에서만 동작
sudo systemctl restart albacheck
```

---

## nginx

추가한 블록은 `sites-available/inhatc` 의 443 server 블록 안에 있습니다.
`proxy_pass` 끝의 `/` 가 있어야 `/albacheck/inspect` → `/inspect` 로 넘어갑니다.

```nginx
location ^~ /albacheck/ {
    proxy_pass http://127.0.0.1:8003/;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    client_max_body_size 12M;
    proxy_read_timeout 60s;
    proxy_send_timeout 60s;
}
```

**`client_max_body_size` 가 이 블록 안에만 있습니다.** 다른 사이트에는 영향이 없습니다.
기본값 1MB 면 진짜 계약서 사진이 413 으로 막히는데, **작은 테스트 사진은 통과하고
실제 사진에서만 실패**해서 원인을 찾기가 가장 어렵습니다.

앱서버 한도(`MAX_IMAGE_MB=8` × base64 1.4배 ≈ 11MB)보다 높게 12M 로 잡았습니다.
nginx 가 먼저 끊으면 HTML 에러 페이지가 나가고 우리 로그에 아무것도 안 남습니다.
우리 쪽에서 413 을 내야 `journalctl` 로 원인이 보입니다.

nginx 를 고칠 때:

```bash
sudo cp -a /etc/nginx /root/nginx-backup-$(date +%F-%H%M)   # 먼저 백업
sudo nginx -t                                                # 반드시 검증
sudo systemctl reload nginx                                  # restart 아님
```

`reload` 여야 기존 사이트 연결이 끊기지 않습니다.

---

## 점검

```bash
curl https://smpsws.shop/albacheck/health          # 200 이면 살아있음
sudo journalctl -u albacheck -f                    # 로그 실시간
sudo systemctl restart albacheck                   # 재시작
systemctl is-active albacheck exam-gen inhatc-api  # 셋 다 active 여야 함
```

앱 없이 판정까지 확인하려면 PC 에서:

```bash
python server/check.py 계약서.jpg \
  --url https://smpsws.shop/albacheck --token <APP_TOKEN>
```

응답이 앱 계약(8개 항목·판정 3종·`law` 채워짐 등)을 지키는지 항목마다 확인합니다.

**3MB 이상 사진으로 한 번은 해 보세요.** 413 이 뜨면 `client_max_body_size` 를 의심합니다.

로그에는 사진도 계약서 내용도 남지 않습니다. 시각·경로·상태코드·소요시간만 남습니다.

---

## 전부 되돌리기

```bash
sudo systemctl disable --now albacheck
sudo rm /etc/systemd/system/albacheck.service /etc/albacheck.env
sudo systemctl daemon-reload
sudo rm -rf /opt/albacheck

# nginx 원복 (백업 날짜 확인 후)
sudo sh -c 'ls -d /root/nginx-backup-*'
sudo cp -a /root/nginx-backup-<날짜>/. /etc/nginx/
sudo nginx -t && sudo systemctl reload nginx
```
