# CareerOS API

![FastAPI](https://img.shields.io/badge/FastAPI-0.136.1-009688?logo=fastapi&logoColor=white)
![FastAPI Cloud](https://img.shields.io/badge/FastAPI%20Cloud-Deployed-009688?logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.14-3776AB?logo=python&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI_SDK-2.32-412991?logo=openai&logoColor=white)
![Pyrefly](https://img.shields.io/badge/Pyrefly-0.62-0668E1?logo=meta&logoColor=white)
![Google OAuth](https://img.shields.io/badge/Google_OAuth-Authlib-4285F4?logo=google&logoColor=white)
[![codecov](https://codecov.io/github/dongju93/career-os/graph/badge.svg?flag=backend&token=48VXFY8C3M)](https://codecov.io/github/dongju93/career-os)

한국 채용 플랫폼(사람인, 원티드)의 채용 공고를 수집·추출·저장하는 FastAPI 백엔드 서비스입니다.

**프로덕션**

- SwaggerUI: `https://career-os.fastapicloud.dev/v1/docs`
- ReDoc: `https://career-os.fastapicloud.dev/v1/redoc`

## 프로젝트 정보

### 참여자

| 역할                | 링크                                    |
| ------------------- | --------------------------------------- |
| 프로덕트 매니저     | [SoEun99](https://github.com/SoEun99)   |
| 소프트웨어 엔지니어 | [dongju93](https://github.com/dongju93) |

### 프로젝트 관리

| 항목        | 링크                                                                                      |
| ----------- | ----------------------------------------------------------------------------------------- |
| 이슈 트래킹 | [Linear - CAR](https://linear.app/careeros999/team/CAR)                                   |
| 문서        | [Confluence - CareerOS](https://eoth999-1775281441291.atlassian.net/wiki/spaces/CareerOS) |

### 배포 및 인프라

| 항목              | 링크                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| 데이터베이스 관리 | [Neon - career-os](https://console.neon.tech/app/projects/twilight-firefly-07947306)                          |
| 백엔드 배포 관리  | [FastAPI Cloud - career-os](https://dashboard.fastapicloud.com/spdlqj011-77893206/apps/career-os/deployments) |

---

## 시작하기

### 사전 요구사항

- Python `≥ 3.14` + [`uv`](https://docs.astral.sh/uv/)
- PostgreSQL (로컬 또는 Neon 등 외부)
- Google OAuth 클라이언트 ID/Secret
- OpenAI API 키

### 설치

```bash
uv sync
```

### 환경 변수

루트에 `.env` 파일을 생성합니다.

```dotenv
DATABASE_URL=postgresql://user:pass@localhost:5432/career_os
OPENAI_API_KEY=sk-...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SECRET_KEY=<충분히 긴 임의 문자열>

# 로컬 개발 시 오버라이드
REDIRECT_URI=http://localhost:8000/v1/auth/google/callback
```

### 실행

```bash
uv run fastapi dev
```

API 문서: `http://localhost:8000/v1/docs`

---

## 기술 스택

| 라이브러리                          | 용도                    | 선정 이유                                                                                                                                                                                    |
| ----------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FastAPI**                         | ASGI 웹 프레임워크      | `async/await` 네이티브 지원, Pydantic 기반 자동 검증·OpenAPI 문서 생성. 동일 기능을 Flask/Django로 구현할 때 필요한 보일러플레이트 대부분을 제거함                                           |
| **psycopg 3 + psycopg-pool**        | PostgreSQL 드라이버     | psycopg 3는 `async/await`를 네이티브 지원하는 공식 차세대 드라이버. `AsyncConnectionPool`로 연결 재사용 비용을 줄임. SQLAlchemy ORM을 배제하고 raw SQL을 직접 사용해 쿼리 의도를 명확히 유지 |
| **Pydantic v2 + pydantic-settings** | 스키마 검증·설정 관리   | FastAPI 내장 검증 레이어. `pydantic-settings`는 `.env` 파일과 환경 변수를 타입 안전하게 로드하며, 필수 변수 누락 시 import 단계에서 즉시 실패해 런타임 오류를 예방함                         |
| **Authlib**                         | Google OAuth 클라이언트 | Starlette/FastAPI용 OAuth 2.0 / OpenID Connect 통합을 제공. Google OIDC discovery document를 자동으로 처리해 직접 구현 대비 코드량을 크게 줄임                                               |
| **python-jose**                     | JWT 발급·검증           | 경량 JWT 라이브러리. `SECRET_KEY` 기반 `HS256` 서명으로 내부 access token 생성·검증을 담당. Authlib의 OAuth 레이어와 분리해 토큰 수명 주기를 앱이 직접 제어함                                |
| **Beautiful Soup 4**                | HTML 파싱               | 사람인 공고 섹션 추출(불필요한 추천 영역 제거)과 원티드 API JSON → HTML 재구성에 사용. `lxml` 파서 대신 `html.parser`를 채택해 추가 C 의존성 없이 동작                                       |
| **OpenAI Python SDK**               | 구조화 데이터 추출      | `chat.completions.parse()`의 `response_format` 파라미터로 `JobPostingExtracted` Pydantic 모델을 직접 지정. 이미지(base64)를 함께 전달해 한국 채용 공고에 빈번한 이미지 내 텍스트도 추출      |
| **Ruff**                            | 린터·포매터             | Rust 기반. `flake8 + isort + Black` 세 도구를 단일 바이너리로 대체. CI에서 포매팅 검사와 린트를 같은 명령어로 실행                                                                           |
| **Pyrefly**                         | 타입 검사               | Meta가 개발한 Rust 기반 타입 체커. `pyright`·`mypy` 대비 빠른 응답 속도, `pyproject.toml` 내 설정 통합                                                                                       |
| **pytest + pytest-asyncio**         | 테스트                  | `asyncio_mode = "auto"` 설정으로 `@pytest.mark.asyncio` 없이 async 테스트 작성 가능. `pytest-cov`로 커버리지 리포트 통합                                                                     |

---

## 기능

- **Google OAuth 로그인** — 브라우저용 세션 쿠키 인증, 서버 발급 Bearer 토큰 fallback 지원
- **Google Cross-Account Protection** — RISC Security Event Token 검증·기록, 세션/토큰 폐기 이벤트 반영
- **채용 공고 추출** — 사람인·원티드 URL을 입력하면 OpenAI로 구조화된 데이터 반환
- **공고 저장·관리** — 사용자별 PostgreSQL upsert, 목록/상세 조회
- **지원 플랫폼** — `saramin.co.kr`, `wanted.co.kr`

---

## 개인정보 보호

OAuth 로그인으로 저장되는 사용자 계정 정보와 Google Cross-Account Protection(RISC) 보안 이벤트 정보는 Neon 데이터 마스킹 기능을 적용해 관리합니다.

- Google 계정 식별자, 이메일, 표시 이름처럼 사용자를 직접 식별할 수 있는 정보
- RISC 보안 이벤트에 포함되는 이벤트 식별자, 대상 계정 식별자, 원본 이벤트 페이로드

운영 환경에서는 위 정보가 관리자 화면이나 데이터베이스 조회 과정에서 원문 그대로 노출되지 않도록 익명화·대체된 값으로 표시합니다. 인증 또는 보안 이벤트에 새로운 개인정보가 추가되면, 프로덕션 반영 전 Neon 마스킹 규칙도 함께 갱신합니다.

---

## API 엔드포인트

모든 엔드포인트는 `/v1` 접두사를 사용합니다. 보호된 엔드포인트는 브라우저 세션 쿠키와 `X-Career-OS-Client: web` 헤더 또는 `Authorization: Bearer <token>` 헤더가 필요합니다.

| 메서드  | 경로                            | 인증 | 설명                                       |
| ------- | ------------------------------- | :--: | ------------------------------------------ |
| `GET`   | `/`                             |      | 헬스체크                                   |
| `GET`   | `/health/db`                    |      | DB 연결 확인                               |
| `GET`   | `/auth/google`                  |      | Google 로그인 시작 (`?callback_url=` 지원) |
| `GET`   | `/auth/google/callback`         |      | OAuth 콜백, 세션 발급                      |
| `POST`  | `/auth/google/risc`             |      | Google RISC 보안 이벤트 수신               |
| `GET`   | `/auth/me`                      |  ✓   | 현재 사용자 조회                           |
| `PATCH` | `/auth/me`                      |  ✓   | 사용자 이름 수정                           |
| `POST`  | `/auth/logout`                  |  ✓   | 로그아웃                                   |
| `GET`   | `/job-postings`                 |  ✓   | 저장된 공고 목록 (`offset`, `limit`)       |
| `GET`   | `/job-postings/extraction?url=` |  ✓   | URL에서 공고 추출 (저장 안 함)             |
| `POST`  | `/job-postings`                 |  ✓   | 추출된 공고 저장 (201 신규 / 200 갱신)     |
| `GET`   | `/job-postings/{id}`            |  ✓   | 저장된 공고 상세 조회                      |

---

## 개발

### 명령어

```bash
uv run pytest                        # 전체 테스트
uv run pytest --cov=career_os_api    # 커버리지 포함
uvx ruff check --fix .               # 린트
uvx ruff format .                    # 포매팅
uvx pyrefly check                    # 타입 검사
```

### 새 플랫폼 추가

1. `career_os_api/service/job_posting/platform.py` — `Platform` enum, `_DOMAIN_MAP`, `PLATFORM_BASE_URLS`, `extract_posting_id()` 업데이트
2. `career_os_api/service/job_posting/<platform>.py` — 플랫폼 전용 fetch 함수 구현
3. `career_os_api/service/job_posting/fetch.py` — 디스패치 분기 추가
4. `career_os_api/database/ddl.py` — `CHECK (platform IN (...))` 제약 확장
