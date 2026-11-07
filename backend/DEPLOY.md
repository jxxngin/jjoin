# 백엔드 서버 배포 (Oracle Cloud Always Free)

jjoin 백엔드를 Oracle Cloud 무료 상시 서버(지금은 오사카 리전)에 띄우는 방법이에요. 명령은 모두 Git Bash 기준이에요.

```
GitHub (main에 backend/ 변경 push)
  └─ Actions "백엔드 배포": 테스트 → 이미지(x86·ARM) → ghcr.io/jxxngin/jjoin-backend
                                   └─ SSH로 서버에서 docker compose pull && up
Oracle Cloud VM (오사카)
  └─ docker compose: backend (워커·예약 작업·문의 API) + caddy (HTTPS, <IP>.sslip.io)
        └─ Supabase Postgres (커넥션 풀러, jjoin_worker 계정)
```

## 1. 서버 만들기 (처음 한 번)

1. https://www.oracle.com/cloud/free/ 에서 가입해요. 카드는 본인 확인용이고, Always Free 범위는 과금되지 않아요.
   - **홈 리전**은 가입 뒤에 바꿀 수 없어요. 목록에 `South Korea Central (Seoul)`·`South Korea North (Chuncheon)`이 있으면 그걸, 없으면(무료 가입은 자리가 없는 리전을 숨겨요) `Japan Central (Osaka)`를 골라요. 워커는 화면 응답과 상관없이 뒤에서 도는 일이라 오사카여도 차이가 거의 없어요.
2. 콘솔 → **Compute → Instances → Create instance**
   - Image: **Ubuntu 24.04**
   - Shape: **VM.Standard.A1.Flex** (ARM, 1 OCPU · 6GB, 무료) — 자리가 없다고 나오면 **VM.Standard.E2.1.Micro** (x86, 1GB, 무료)
   - SSH keys: **Generate a key pair**를 고르고 비밀 키(`.key`)를 내려받아요.
3. 만들어지면 **Public IP**를 적어 둬요.
4. 내려받은 키로 접속해 봐요.
   ```bash
   chmod 600 ~/Downloads/ssh-key-*.key
   ssh -i ~/Downloads/ssh-key-*.key ubuntu@<Public IP>
   ```

## 2. 서버 준비 (처음 한 번, 서버 안에서)

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit   # 다시 접속해야 docker 권한이 적용돼요
```

다시 접속한 뒤:

```bash
mkdir -p ~/jjoin
```

내 PC(저장소 폴더)에서 설정 파일 두 개를 올려요. `.env`는 `backend/.env.example`을 채운 것과 같아요.

```bash
scp -i ~/Downloads/ssh-key-*.key backend/deploy/docker-compose.yml backend/deploy/Caddyfile ubuntu@<Public IP>:~/jjoin/
scp -i ~/Downloads/ssh-key-*.key backend/.env ubuntu@<Public IP>:~/jjoin/.env
```

## 3. 이미지 받기

이미지는 GitHub Actions가 GHCR에 올려요. 처음 한 번 **GitHub → 프로필 → Packages → jjoin-backend → Package settings → Change visibility → Public**으로 바꾸면 서버에서 로그인 없이 받을 수 있어요. (코드가 아니라 실행 파일만 공개돼요. 비밀값은 이미지에 없고 서버의 `.env`에만 있어요)

```bash
cd ~/jjoin
docker compose pull && docker compose up -d
docker compose logs -f backend     # Started JjoinBackendApplication 이 보이면 성공 (Ctrl+C로 나오기)
curl localhost:8080/actuator/health  # {"status":"UP"...}
```

## 4. 자동 배포 켜기

GitHub 저장소 → **Settings → Secrets and variables → Actions → New repository secret**

| 이름 | 값 |
|---|---|
| `DEPLOY_HOST` | 서버 Public IP |
| `DEPLOY_USER` | `ubuntu` |
| `DEPLOY_SSH_KEY` | 내려받은 `.key` 파일 내용 전체 (`-----BEGIN` 부터 `END-----` 까지) |

이후 `backend/`가 바뀌어 main에 올라가면 테스트 → 이미지 → 서버 반영까지 자동으로 돼요. (Actions의 "백엔드 배포")

## 5. Next에서 넘겨받기

서버 워커가 정상(UP)인 것을 확인한 뒤, Vercel → Settings → Environment Variables에 두 값을 넣고 Redeploy해요.

| 이름 | 값 | 뜻 |
|---|---|---|
| `PUSH_WORKER` | `spring` | 알림 발송을 워커가 맡고 Next는 보내지 않음 (B1) |
| `CRON_WORKER` | `spring` | 하루 전·1시간 전 알림, 문의 요약을 워커가 맡고 Next의 Cron 주소는 쉼 (B2) |

- 서버 `.env`의 `PUSH_ENABLED`, `JOBS_ENABLED`는 `true`(기본값)여야 해요.
- Supabase pg_cron과 Vercel Cron은 그대로 둬도 돼요. Next 주소가 바로 "쉼"으로 답해요. 깔끔하게 끄려면 SQL Editor에서 `select cron.unschedule('<작업 이름>');` (작업 이름은 `select jobname from cron.job;`)

### 되돌리기

Vercel에서 `PUSH_WORKER`·`CRON_WORKER`를 지우고 Redeploy하면 바로 예전처럼 Next가 맡아요. 둘이 같이 돌아도 알림이 두 번 가지 않아요. (대기열 잠금, 예약 함수의 보낸 표시)

## 6. 문의 API 켜기 (B3, HTTPS)

Next(Vercel 서울)가 서버의 문의 API를 HTTPS로 부르도록 Caddy를 켜요. 주소는 가입이 필요 없는 sslip.io를 써요. (`<IP의 점을 -로>.sslip.io`, 예: `152-70-1-2.sslip.io`)

1. **Oracle 콘솔 → Networking → Virtual cloud networks → (VCN) → Security Lists → Default → Add Ingress Rules**
   - Source CIDR `0.0.0.0/0`, IP Protocol TCP, Destination Port Range `80,443`
   - 서버 안 방화벽(iptables)은 배포 워크플로가 열어요.
2. **GitHub Secret** `API_DOMAIN` = `152-70-1-2.sslip.io` (자기 IP로)
3. Actions → **백엔드 배포 → Run workflow**. 워크플로가 compose·Caddyfile을 올리고, 서버 `.env`에 `SUPABASE_URL`·`AUTOFIX_SECRET`·`API_DOMAIN`을 맞추고, Caddy를 켜요. 로그에 `HTTPS 입구 정상 (인증 없이 401)`이 보이면 성공.
4. **Vercel → Environment Variables** (Production) 후 Redeploy

   | 이름 | 값 |
   |---|---|
   | `BACKEND_API_URL` | `https://152-70-1-2.sslip.io` |
   | `INQUIRY_API` | `spring` |

5. **GitHub Secret** `AUTOFIX_API_URL` = `https://152-70-1-2.sslip.io` (자동 수정 워크플로가 Spring으로. 공개 저장소라 로그에 주소가 안 보이게 Secret으로 둬요)

### 되돌리기

Vercel의 `INQUIRY_API`를 지우고 Redeploy, GitHub Secret `AUTOFIX_API_URL`을 지우면 바로 Next가 맡아요. Caddy는 켜 둬도 상관없어요. (`docker compose stop caddy`로 끌 수 있어요)

## 운영

```bash
docker compose ps                    # 상태
docker compose logs --tail 100 backend
docker compose pull && docker compose up -d   # 손으로 최신 이미지 반영
curl -s localhost:8080/actuator/metrics/jjoin.push.notifications   # 결과별 발송 수
```
