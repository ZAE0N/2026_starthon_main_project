# Lightsail 배포

담당: 전정현. 기존에 다른 앱과 nginx 가 돌고 있다는 전제로 씁니다.
**남의 설정 파일은 열지 않고, 우리 것만 추가합니다.**

## 0. 먼저 서버 상태를 봐야 합니다

이 PC 에는 SSH 키가 없습니다. Lightsail 콘솔의 **브라우저 SSH** 를 쓰면 키 없이 바로 들어갑니다.

들어가서 아래를 실행하고 결과를 남겨 주세요. 이 결과에 따라 포트와 절차가 달라집니다.

```bash
cat /etc/os-release            # 배포판
python3 -V                     # 3.10 이상이어야 함
nginx -v                       # nginx 가 있는지
ls -la /etc/nginx/sites-enabled/
sudo nginx -T | grep -nE "server_name|client_max_body_size|listen"
sudo ss -ltnp                  # 쓰고 있는 포트 (8017 이 비었는지)
free -m; swapon --show         # 메모리. 512MB 인데 swap 이 없으면 추가 검토
df -h
ls /etc/letsencrypt/live/ 2>/dev/null   # 이미 받아둔 인증서·도메인
```

콘솔에서 같이 해둘 것:
- **Networking → 고정 IP(Static IP) 연결.** 안 하면 인스턴스를 껐다 켤 때 IP 가 바뀌어서
  도메인과 인증서가 한꺼번에 깨집니다. 무료입니다.
- 방화벽에 **80, 443** 열기. 8017 은 열지 않습니다 (nginx 만 통과).
- **Account → SSH keys → 기본 키 다운로드** (파일 전송에 필요)

윈도우에서 키 권한 (이거 안 하면 ssh 가 키를 거부합니다):
```
icacls C:\Users\lucky\.ssh\lightsail.pem /inheritance:r /grant:r "%USERNAME%":R
ssh -i C:\Users\lucky\.ssh\lightsail.pem ubuntu@<고정IP>
```

## 1. HTTPS — 없으면 앱이 아예 연결을 못 합니다

안드로이드 9+ 와 iOS 는 평문 HTTP 를 막습니다. **IP 주소로는 인증서를 받을 수 없습니다.**

- **도메인이 있으면**: A 레코드를 고정 IP 로 걸고 `certbot --nginx -d <도메인>`
- **도메인이 없으면**: `sslip.io` 를 씁니다. `1-2-3-4.sslip.io` 가 그 IP 로 해석되고
  인증서도 발급됩니다. 비용 0, DNS 대기 0.
  **발표 당일 말고 미리 받아 두세요.** 발급 요청이 몰리면 한도에 걸릴 수 있습니다.
- **비상용**: `cloudflared tunnel --url http://localhost:8017` 을 띄우면 즉시 HTTPS 주소가 나옵니다.
  nginx·DNS·인증서를 전부 건너뜁니다. **한 번은 미리 해 보세요.** 발표 30분 전에도 앱 `.env` 의
  주소만 바꾸면 전환됩니다.

## 2. 코드 올리기

```bash
# PC 에서
scp -i <키> -r server ubuntu@<IP>:/tmp/albacheck-server

# 서버에서
sudo mkdir -p /opt/albacheck
sudo mv /tmp/albacheck-server /opt/albacheck/server
sudo chown -R ubuntu:ubuntu /opt/albacheck

sudo apt update && sudo apt install -y python3-venv python3-dev
python3 -m venv /opt/albacheck/.venv
/opt/albacheck/.venv/bin/pip install -r /opt/albacheck/server/requirements.txt
```

`pillow-heif` 설치가 실패하면 `requirements.txt` 에서 빼고 진행해도 됩니다.
아이폰 원본(HEIC)이 올라오는 예외 경로만 422 가 되고, 일반 경로는 영향이 없습니다.

## 3. 비밀값

저장소 안에 두지 않습니다.

```bash
sudo tee /etc/albacheck.env > /dev/null <<'EOF'
OPENAI_API_KEY=sk-...
OPENAI_MODEL=...
APP_TOKEN=...
MAX_IMAGE_MB=8
OPENAI_TIMEOUT=30
EOF
sudo chmod 600 /etc/albacheck.env
```

## 4. 서비스 등록

```bash
sudo cp /opt/albacheck/server/deploy/albacheck.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now albacheck
systemctl status albacheck
curl http://127.0.0.1:8017/health      # 여기서 200 이 나와야 다음으로
```

## 5. nginx

**먼저 백업합니다.**

```bash
sudo cp -a /etc/nginx /root/nginx-backup-$(date +%F)

sudo cp /opt/albacheck/server/deploy/nginx-albacheck.conf /etc/nginx/sites-available/albacheck
sudo nano /etc/nginx/sites-available/albacheck     # YOUR_DOMAIN_HERE 를 실제 도메인으로
sudo ln -s /etc/nginx/sites-available/albacheck /etc/nginx/sites-enabled/

sudo nginx -t                # 반드시. 실패하면 링크를 지우고 원복
sudo systemctl reload nginx  # restart 아님. reload 여야 다른 앱 연결이 안 끊깁니다
```

기존 앱도 여전히 되는지 바로 확인하세요.

## 6. 인증서

```bash
sudo certbot --nginx -d <도메인>
sudo certbot renew --dry-run
curl https://<도메인>/health
```

## 7. 앱 연결

저장소 루트 `.env`:
```
EXPO_PUBLIC_API_URL=https://<도메인>     # 끝에 / 금지
EXPO_PUBLIC_API_TOKEN=<APP_TOKEN 과 같은 값>
EXPO_PUBLIC_USE_MOCK=false
```
```
npx expo start -c
```

## 8. 반드시 확인할 것 — 큰 사진

작은 사진은 통과하고 진짜 계약서 사진만 실패하는 게 이 프로젝트에서 가장 찾기 어려운 문제입니다.

```
python check.py 진짜계약서.jpg --url https://<도메인> --token <값>
```

**3MB 이상 사진으로 한 번은 해 보세요.** 413 이 뜨면 `client_max_body_size` 를 의심합니다.

와이파이 말고 **셀룰러로도** 한 번 해 보세요. 발표장 와이파이를 못 쓸 수 있습니다.

## 발표 당일 확인용

```bash
curl https://<도메인>/health              # 살아있나
sudo journalctl -u albacheck -f           # 로그 실시간
sudo systemctl restart albacheck          # 재시작
cloudflared tunnel --url http://localhost:8017   # nginx/TLS 가 죽었을 때 비상 우회
```

로그에는 사진도 계약서 내용도 남지 않습니다. 시각·경로·상태코드·소요시간만 남습니다.
