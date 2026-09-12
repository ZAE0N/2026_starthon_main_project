"""
알바 계약서 검진 서버.

엔드포인트는 두 개뿐입니다.
  POST /inspect  사진 → 판정
  GET  /health   살아있는지 (인증 없음)

경로에 /api 나 /v1 같은 접두사를 붙이면 안 됩니다.
앱이 `${API_URL}/inspect` 로 하드코딩하고 있습니다. (lib/api.ts:155)
"""

import logging
import os
import secrets
import time

from dotenv import load_dotenv
from fastapi import FastAPI, Header, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

import inspector  # noqa: E402  (load_dotenv 뒤에 와야 환경변수를 읽습니다)
import laws  # noqa: E402
from inspector import InspectError, UnauthorizedError  # noqa: E402
from schema import InspectRequest, InspectResponse  # noqa: E402

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("albacheck")

app = FastAPI(title="albacheck", docs_url=None, redoc_url=None)


@app.on_event("startup")
def _startup() -> None:
    # laws.json 이 앱과 어긋나면 여기서 바로 죽습니다. 요청받다 알아채는 것보다 낫습니다.
    laws.load()
    if not os.getenv("OPENAI_API_KEY", "").strip():
        log.warning("OPENAI_API_KEY 가 비어 있습니다. /inspect 가 전부 실패합니다.")
    if not os.getenv("APP_TOKEN", "").strip():
        log.warning("APP_TOKEN 이 비어 있어 토큰 검사를 건너뜁니다. 배포 전에 채우세요.")
    log.info("기준 법령 %s / 모델 %s", laws.based_on(), os.getenv("OPENAI_MODEL", "gpt-4o"))


@app.exception_handler(RequestValidationError)
async def _validation_error(request: Request, exc: RequestValidationError):
    """
    FastAPI 는 요청 검증 실패에 기본으로 422 를 줍니다.
    그런데 앱에서 422 는 "계약서를 읽지 못했어요 → 다시 찍어주세요" 입니다. (lib/api.ts:171)
    필드 이름 오타 같은 개발 실수 때문에 사용자가 사진만 계속 다시 찍게 됩니다.
    그래서 400 으로 내립니다. 400 은 앱에서 "지금은 분석할 수 없어요" 로 보입니다.
    """
    log.warning("요청 형식 오류: %s", exc.errors())
    return JSONResponse(status_code=400, content={"detail": "요청 형식이 올바르지 않습니다"})


@app.middleware("http")
async def _guard_and_log(request: Request, call_next):
    # nginx 가 앞에 없을 때를 대비한 크기 방어. nginx 를 쓸 때도 둘 다 있어야 합니다.
    if request.url.path == "/inspect":
        declared = request.headers.get("content-length")
        limit = int(float(os.getenv("MAX_IMAGE_MB", "8")) * 1024 * 1024 * 1.4)
        if declared and declared.isdigit() and int(declared) > limit:
            log.warning("바디가 큼: %s bytes", declared)
            return JSONResponse(status_code=413, content={"detail": "사진이 너무 큽니다"})

    t0 = time.monotonic()
    res = await call_next(request)
    # 사진은 남기지 않습니다. 시각·경로·상태·소요시간만.
    if request.url.path != "/health":
        log.info(
            "%s %s -> %s (%.1fs)",
            request.method,
            request.url.path,
            res.status_code,
            time.monotonic() - t0,
        )
    return res


def _check_token(sent: str | None) -> None:
    expected = os.getenv("APP_TOKEN", "").strip()
    if not expected:
        # 앱은 토큰이 비어 있으면 X-App-Token 헤더를 아예 보내지 않습니다. (lib/api.ts:159)
        # 양쪽 다 비어 있는 상태에서 서버만 필수로 만들면 첫 연동이 전부 401 이 됩니다.
        return
    if not sent or not secrets.compare_digest(sent, expected):
        raise UnauthorizedError("X-App-Token 이 일치하지 않습니다")


@app.get("/health")
def health() -> dict[str, str]:
    """앱의 ping() 은 헤더를 하나도 안 보냅니다. 인증을 걸면 항상 실패합니다. (lib/api.ts:203)"""
    return {"status": "ok", "basedOn": laws.based_on()}


@app.post("/inspect", response_model=InspectResponse, response_model_exclude_none=True)
def inspect(body: InspectRequest, x_app_token: str | None = Header(default=None)):
    _check_token(x_app_token)
    return inspector.inspect(body.imageBase64)


@app.exception_handler(InspectError)
async def _inspect_error(request: Request, exc: InspectError):
    """
    상태 코드가 곧 사용자 화면입니다. (lib/api.ts:164-173)
      413/401/5xx → "지금은 분석할 수 없어요"
      415         → "근로계약서가 아닌 것 같아요"  (다시 찍기)
      422         → "계약서를 읽지 못했어요"      (다시 찍기)
    """
    log.warning("%s: %s", type(exc).__name__, exc)
    return JSONResponse(status_code=exc.status, content={"detail": str(exc)})


@app.exception_handler(Exception)
async def _unexpected(request: Request, exc: Exception):
    log.exception("예상 못 한 오류")
    return JSONResponse(status_code=500, content={"detail": "서버 오류"})
