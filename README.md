# CareerOS

> 지원하는 한국 채용 플랫폼에서 채용 공고를 수집, 추출, 저장하고 정규화된 형태로 제공하는 FastAPI 서비스입니다.

---

## 목차

- [개요](#개요)
- [아키텍처](#아키텍처)
- [기술 스택](#기술-스택)
- [프로젝트 구조](#프로젝트-구조)
- [핵심 기능](#핵심-기능)
- [시작하기](#시작하기)
- [API 레퍼런스](#api-레퍼런스)
- [테스트](#테스트)
- [배포](#배포)
- [설계 패턴과 규약](#설계-패턴과-규약)
  - [Firecrawl을 사용하지 않는 이유](#firecrawl을-사용하지-않는-이유)
- [문제 해결](#문제-해결)
- [기여](#기여)

---

## 개요

CareerOS는 단일 패키지로 구성된 Python 백엔드 서비스입니다. 현재 구현은 `saramin.co.kr`와 `wanted.co.kr` 채용 공고 수집, OpenAI 기반 구조화 추출, Google 로그인 기반 사용자별 저장에 초점을 두고 있습니다.

이 서비스는 다음 HTTP 엔드포인트를 제공합니다.

- Google OAuth 로그인 시작, 콜백 처리, 현재 사용자 조회
- 사용자 이름 수정 (PATCH /auth/me)
- 로그아웃 및 세션 종료 (POST /auth/logout)
- 지원하는 채용 공고 URL을 가져와 구조화된 데이터로 추출
- 추출된 채용 공고를 사용자 단위로 PostgreSQL에 upsert
- 로그인한 사용자가 저장한 채용 공고 목록 조회
- 로그인한 사용자가 저장한 채용 공고 상세 조회
- 데이터베이스 연결 상태 확인

이 저장소는 모노레포가 아니며, 하나의 FastAPI 애플리케이션 패키지 `career_os_api`와 테스트 코드, 로컬 배포 메타데이터로 구성됩니다.

현재 코드베이스가 정의하는 런타임 모드는 하나뿐입니다. `main.py`에서 시작되는 HTTP API 서버이며, 별도의 CLI 명령, 워커 프로세스, 배치 스케줄러, 서버리스 핸들러는 구현되어 있지 않습니다.

## 아키텍처

코드베이스는 계층형 서비스 구조를 따릅니다.

- `main.py`는 FastAPI 앱을 조합하고, 앱 lifespan 동안 PostgreSQL connection pool을 만들고, DDL을 적용하며, 세션 미들웨어와 `/v1` 라우터를 연결합니다.
- `career_os_api/router.py`는 시스템, 인증, 채용 공고 관련 HTTP 계약을 한 곳에서 정의합니다.
- `career_os_api/schemas.py`는 인증 응답과 채용 공고 요청/응답 스키마를 중앙에서 관리합니다.
- `career_os_api/auth/`는 JWT 발급과 현재 사용자 복원 의존성을 담당합니다.
- `career_os_api/service/job_posting/`은 플랫폼 판별, 플랫폼별 HTML 수집, 이미지 보강, OpenAI 구조화 추출을 담당합니다.
- `career_os_api/database/`는 connection pool 생성, DDL 적용, 사용자/채용 공고 SQL 접근 계층을 담고 있습니다.

코드에서 확인되는 주요 구현 결정은 다음과 같습니다.

- 데이터베이스 스키마는 `career_os_api/database/ddl.py`의 raw SQL로 앱 시작 시 적용되며, `users`와 `job_postings` 테이블 및 인덱스를 함께 준비합니다.
- Google 로그인은 Authlib OAuth 클라이언트와 `SessionMiddleware`를 사용해 처리되며, 콜백 단계에서 `users` 테이블에 upsert한 뒤 JWT access token을 발급합니다.
- 보호된 라우트는 `get_current_user()`를 통해 JWT를 검증하고, 토큰의 `sub`를 UUID로 해석해 활성 사용자만 허용합니다.
- 사용자 정보는 `PATCH /auth/me`로 수정할 수 있으며, `update_user_name()`으로 이름을 갱신합니다.
- 채용 공고 영속화는 `(user_id, platform, posting_id)` 기준 `INSERT ... ON CONFLICT DO UPDATE`를 사용하므로, 같은 사용자가 같은 원본 공고를 다시 저장해도 기존 레코드를 갱신합니다.
- 목록 조회는 큰 텍스트 필드를 제외한 summary projection만 반환하고, 상세 조회는 전체 저장 레코드를 반환합니다.
- 외부 fetch는 `detect_platform()`으로 지원 도메인을 먼저 검증합니다. 따라서 추출 대상은 현재 지원하는 플랫폼으로 제한됩니다.
- Saramin 추출은 내부 AJAX 엔드포인트와 iframe 인라인 전략을 사용하고, Wanted 추출은 내부 REST API 응답을 HTML로 재구성해 같은 추출 파이프라인으로 넘깁니다.

### 런타임 진입점

- `main.py`
  FastAPI 앱 객체 `career_os`를 만들고, lifespan hook에서 PostgreSQL pool과 스키마를 초기화한 뒤 `SessionMiddleware`와 `v1_router`를 연결합니다.

추가 런타임 진입점은 발견되지 않았습니다.

### 시스템 다이어그램

```mermaid
graph TD
    Client["HTTP 클라이언트"] --> App["main.py / career_os"]
    App --> Lifespan["lifespan()"]
    Lifespan --> Pool["create_postgres_pool()"]
    Lifespan --> DDL["init_schema()"]
    App --> Session["SessionMiddleware"]
    Pool --> Postgres[(PostgreSQL)]
    DDL --> Postgres

    App --> Router["career_os_api/router.py (/v1)"]

    Router --> AuthRoutes["GET /auth/google<br/>GET /auth/google/callback<br/>GET /auth/me<br/>PATCH /auth/me<br/>POST /auth/logout"]
    AuthRoutes --> Google["Google OAuth / OIDC"]
    AuthRoutes --> AuthDeps["career_os_api/auth/*.py"]
    AuthDeps --> UsersRepo["career_os_api/database/users.py"]
    UsersRepo --> Postgres
    AuthDeps --> JWT["JWT access token"]

    Router --> PostingRoutes["GET /job-postings<br/>POST /job-postings<br/>GET /job-postings/{job_id}<br/>GET /health/db"]
    PostingRoutes --> PostingRepo["career_os_api/database/job_postings.py"]
    PostingRepo --> Postgres

    Router --> ExtractionRoute["GET /job-postings/extraction"]
    ExtractionRoute --> Fetch["fetch.py"]
    Fetch --> Platform["platform.py<br/>도메인 allowlist + posting id"]
    Fetch --> Saramin["saramin.py<br/>AJAX + iframe 인라인"]
    Fetch --> Wanted["wanted.py<br/>API JSON -> HTML"]
    Saramin --> Extractor["extractor.py"]
    Wanted --> Extractor
    Extractor --> OpenAI["OpenAI chat.completions.parse"]
```

### 요청 및 데이터 흐름

1. 브라우저 또는 프론트엔드 클라이언트가 `GET /v1/auth/google`을 호출하면 Authlib가 Google 로그인 페이지로 리다이렉트합니다.
2. `GET /v1/auth/google/callback`은 Google 토큰을 교환하고 userinfo를 읽어 `users` 테이블에 upsert한 뒤, 내부 사용자 UUID를 `sub`로 담은 JWT access token을 반환합니다.
3. 클라이언트가 해당 Bearer access token과 함께 보호된 엔드포인트를 호출하면 `get_current_user()`가 JWT를 검증하고 현재 사용자를 조회합니다.
4. `GET /v1/job-postings/extraction?url=...`는 `fetch_url_content()`로 진입하며, 요청 전에 호스트가 지원 플랫폼인지 검증합니다.
5. Saramin URL은 `fetch_saramin_job_posting()`으로 분기되어 `view-ajax` 응답을 가져오고, 필요 시 상세 iframe을 인라인한 뒤 공고 섹션만 추립니다.
6. Wanted URL은 `fetch_wanted_job_posting()`으로 분기되어 `/api/v4/jobs/{id}` 응답을 받아 추출용 HTML로 재구성합니다.
7. `extract_job_posting()`은 HTML 텍스트와 공고 내 이미지들을 함께 OpenAI에 전달하고, `JobPostingExtracted` 스키마에 맞는 구조화 결과를 반환합니다.
8. `POST /v1/job-postings`는 추출 결과를 현재 사용자 ID와 함께 저장하고, insert면 `201`, update면 `200`을 반환합니다.
9. `GET /v1/job-postings`와 `GET /v1/job-postings/{job_id}`는 현재 사용자가 저장한 공고만 반환합니다.
10. `PATCH /v1/auth/me`는 현재 사용자의 이름을 수정하고 갱신된 정보를 반환합니다.
11. `POST /v1/auth/logout`은 세션을 종료하고 클라이언트에 토큰 삭제를 안내합니다.

## 기술 스택

| 계층            | 기술                                                                          | 용도                                                          |
| --------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Runtime         | Python 3.14                                                                   | `pyproject.toml`, `.python-version`에 선언됨                  |
| HTTP 프레임워크 | FastAPI                                                                       | ASGI 앱, 라우팅, 검증, OpenAPI 문서, lifespan                 |
| 인증 및 세션    | Authlib, Google OpenID Connect, Starlette `SessionMiddleware`, `itsdangerous` | Google 로그인 리다이렉트, 콜백 상태 관리, 세션 서명           |
| JWT             | `python-jose`                                                                 | 애플리케이션 access token 발급 및 검증                        |
| 검증 및 설정    | Pydantic, `pydantic-settings`                                                 | 요청/응답 모델과 `.env` 기반 설정 로딩                        |
| HTTP 클라이언트 | `httpx`                                                                       | Saramin/Wanted 상위 요청과 이미지 다운로드                    |
| HTML 파싱       | Beautiful Soup 4                                                              | 공고 HTML 파싱, Saramin 섹션 추출, Wanted HTML 재구성         |
| 영속화          | PostgreSQL, `psycopg`, `psycopg-pool`                                         | connection pool과 사용자/채용 공고 SQL 실행                   |
| AI 추출         | OpenAI Python SDK                                                             | `JobPostingExtracted` 구조화 추출과 이미지 포함 멀티모달 요청 |
| 테스트          | `pytest`, `pytest-asyncio`, `pytest-cov`                                      | API 및 단위 테스트 실행                                       |
| 포매팅 및 린팅  | Ruff                                                                          | 포매팅과 정적 린트 검사                                       |
| 타입 검사       | Pyrefly                                                                       | 프로젝트 타입 분석                                            |
| 의존성 워크플로 | `uv`                                                                          | 의존성 설치, 잠금 파일 관리, 로컬 실행                        |

## 프로젝트 구조

```text
career-os/
├── .fastapicloud/
│   ├── README.md
│   └── cloud.json
├── career_os_api/
│   ├── auth/
│   │   ├── dependencies.py
│   │   └── jwt.py
│   ├── database/
│   │   ├── ddl.py
│   │   ├── job_postings.py
│   │   ├── pool.py
│   │   └── users.py
│   ├── service/
│   │   └── job_posting/
│   │       ├── extractor.py
│   │       ├── fetch.py
│   │       ├── platform.py
│   │       ├── saramin.py
│   │       └── wanted.py
│   ├── config.py
│   ├── constants.py
│   ├── router.py
│   └── schemas.py
├── .python-version
├── CLAUDE.md
├── main.py
├── pyproject.toml
├── tests/
│   ├── api/
│   │   └── test_router.py
│   ├── unit/
│   │   ├── auth/
│   │   ├── database/
│   │   └── service/
│   │       └── job_posting/
│   ├── conftest.py
│   ├── httpx_stubs.py
│   └── README.md
└── uv.lock
```

의미가 바로 드러나지 않는 디렉터리와 파일은 다음과 같습니다.

- `.fastapicloud/`는 FastAPI Cloud 연결 메타데이터를 담습니다. 앱 런타임 코드나 IaC는 아닙니다.
- `career_os_api/router.py`는 모든 `/v1` 라우트를 한 파일에 모아 둔 현재 HTTP 진입점입니다.
- `career_os_api/schemas.py`는 인증 응답과 채용 공고 입출력 모델을 한곳에 모아 둔 중앙 스키마 모듈입니다.
- `career_os_api/database/ddl.py`는 `users`와 `job_postings` 스키마 정의이자 부트스트랩 코드입니다. 별도의 migrations 디렉터리는 없습니다.
- `career_os_api/database/pool.py`는 `AsyncConnectionPool` 생성 책임만 분리한 모듈입니다.
- `tests/httpx_stubs.py`는 실서버 없이 `httpx.AsyncClient` 상호작용을 대체하는 재사용 가능한 test double을 제공합니다.

## 핵심 기능

- Google OAuth 로그인 시작, 콜백 처리, JWT access token 발급
- Bearer 토큰으로 현재 사용자 조회 및 보호된 라우트 접근 제어
- 사용자 이름 수정 (PATCH /auth/me)
- 로그아웃 및 세션 종료 (POST /auth/logout)
- `saramin.co.kr`, `wanted.co.kr` 지원 플랫폼 판별
- 플랫폼별 URL 형식에서 posting ID 추출과 숫자형 검증
- 추천 영역을 제거하고 iframe 상세 콘텐츠를 인라인하는 Saramin 전용 콘텐츠 수집
- Wanted 내부 API 응답을 추출용 HTML로 재구성하는 전용 콘텐츠 수집
- HTML 텍스트와 공고 내 이미지 텍스트를 함께 활용하는 OpenAI 기반 구조화 추출
- `(user_id, platform, posting_id)` 기준 PostgreSQL upsert
- 사용자별 summary row 기반 offset pagination 목록 API
- 사용자 범위로 제한된 상세 조회 API
- `/v1/health/db` 데이터베이스 연결 상태 점검

## 시작하기

### 사전 요구사항

- Python `>=3.14`
- `uv`
- API를 실행하는 머신에서 접근 가능한 PostgreSQL
- Google OAuth client 자격 증명과 등록된 redirect URI
- 설정된 추출 모델에 접근 가능한 OpenAI API 키
- 세션/JWT 서명을 위한 충분히 긴 비밀 키

### 환경 변수

설정은 `pydantic-settings`를 통해 `.env`에서 로드됩니다.

| 변수                   | 필수   | 기본값                                                       | 설명                                                    |
| ---------------------- | ------ | ------------------------------------------------------------ | ------------------------------------------------------- |
| `DATABASE_URL`         | 예     | 없음                                                         | `AsyncConnectionPool`이 사용하는 PostgreSQL DSN         |
| `OPENAI_API_KEY`       | 예     | 없음                                                         | 추출 시 `AsyncOpenAI`가 사용하는 API 키                 |
| `GOOGLE_CLIENT_ID`     | 예     | 없음                                                         | Google OAuth client ID                                  |
| `GOOGLE_CLIENT_SECRET` | 예     | 없음                                                         | Google OAuth client secret                              |
| `REDIRECT_URI`         | 아니오 | `https://career-os.fastapicloud.dev/v1/auth/google/callback` | Google OAuth callback URI                               |
| `SECRET_KEY`           | 예     | 없음                                                         | 세션 서명과 JWT 서명에 사용하는 애플리케이션 비밀 키    |
| `JWT_ALGORITHM`        | 아니오 | `HS256`                                                      | JWT 서명 알고리즘                                       |
| `JWT_EXPIRE_MINUTES`   | 아니오 | `10080`                                                      | access token 만료 시간(분), 현재 기본값은 7일           |
| `HTTP_FETCH_TIMEOUT`   | 아니오 | `30.0`                                                       | Saramin/Wanted 요청 타임아웃(초)                        |
| `HTTP_IMAGE_TIMEOUT`   | 아니오 | `10.0`                                                       | 공고 이미지 다운로드 타임아웃(초)                       |
| `OPENAI_MODEL`         | 아니오 | `gpt-5.4-mini`                                               | `chat.completions.parse()`에 전달되는 모델명            |
| `OPENAI_TEMPERATURE`   | 아니오 | `0`                                                          | 추출 요청에 전달되는 temperature                        |
| `MAX_IMAGES`           | 아니오 | `10`                                                         | 추출 요청에 첨부하기 위해 fetch하는 최대 공고 이미지 수 |

테스트는 `tests/conftest.py`에서 `DATABASE_URL`, `OPENAI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SECRET_KEY`를 테스트용 값으로 덮어쓰므로, 현재 테스트 스위트를 실행할 때 실제 `.env` 파일은 필요하지 않습니다.

### 설치

```bash
uv sync --dev

cat > .env <<'EOF'
DATABASE_URL=postgresql://user:pass@localhost:5432/career_os
OPENAI_API_KEY=sk-...
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
REDIRECT_URI=http://127.0.0.1:8000/v1/auth/google/callback
SECRET_KEY=replace-with-a-long-random-secret
EOF
```

로컬에서 Google 로그인을 테스트하려면 위 `REDIRECT_URI`를 Google Cloud Console에도 동일하게 등록해야 합니다. 기본값은 FastAPI Cloud 배포 URL이므로, 로컬 실행 시에는 보통 override가 필요합니다.

### 실행

개발 서버:

```bash
uv run fastapi dev main.py
```

프로덕션 스타일 로컬 실행:

```bash
uv run fastapi run main.py
```

대화형 API 문서는 다음 경로에서 제공됩니다.

- `http://127.0.0.1:8000/v1/docs`
- `http://127.0.0.1:8000/v1/redoc`

Google 로그인은 브라우저 리다이렉션 기반 흐름입니다. 인증 자체는 `curl`보다 브라우저 또는 프론트엔드 클라이언트로 확인하는 편이 맞습니다.

## API 레퍼런스

앱 실행 시 FastAPI는 `/v1/docs`와 `/v1/redoc`에 OpenAPI 및 대화형 문서를 제공합니다.

| 메서드  | 경로                          | 목적                                 | 비고                                                                                                                              |
| ------- | ----------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `GET`   | `/v1/`                        | 서비스 스모크 엔드포인트             | `{"message": "Hello, World!"}` 반환                                                                                               |
| `GET`   | `/v1/health/db`               | 데이터베이스 연결 확인               | 구성된 pool을 통해 `SELECT 1` 실행                                                                                                |
| `GET`   | `/v1/auth/google`             | Google 로그인 시작                   | 브라우저를 Google 로그인 페이지로 리다이렉트                                                                                      |
| `GET`   | `/v1/auth/google/callback`    | Google 로그인 콜백 처리              | Google userinfo를 저장/갱신하고 `GoogleLoginResponse`를 반환, 실패 시 `400`                                                       |
| `GET`   | `/v1/auth/me`                 | 현재 사용자 조회                     | Bearer 토큰 필요, JWT를 검증하고 `users` 테이블의 활성 사용자 정보를 반환                                                         |
| `PATCH` | `/v1/auth/me`                 | 현재 사용자 이름 수정                | Bearer 토큰 필요, 이름을 수정하고 갱신된 사용자 정보를 반환                                                                       |
| `POST`  | `/v1/auth/logout`             | 로그아웃                             | Bearer 토큰 필요, 세션을 종료하고 클라이언트에 토큰 삭제 안내 메시지를 반환                                                       |
| `GET`   | `/v1/job-postings`            | 페이지네이션된 요약 목록             | Bearer 토큰 필요, 현재 사용자가 저장한 공고만 반환, 쿼리 파라미터: `offset >= 0`, `1 <= limit <= 100`                             |
| `GET`   | `/v1/job-postings/extraction` | `url`에서 채용 공고를 fetch하고 추출 | Bearer 토큰 필요, `JobPostingExtracted` 반환, 라우트는 `400`, `404`, `502`를 문서화하며 `url` 누락 시 `422`는 FastAPI가 자동 생성 |
| `POST`  | `/v1/job-postings`            | 정규화된 채용 공고 upsert            | Bearer 토큰 필요, insert 시 `201`, update 시 `200` 반환                                                                           |
| `GET`   | `/v1/job-postings/{job_id}`   | DB id로 저장된 채용 공고 조회        | Bearer 토큰 필요, 현재 사용자가 저장한 공고만 조회하며 없으면 `404` 반환                                                          |

보호된 엔드포인트에서 사용하는 Bearer 토큰은 `/v1/auth/google/callback` 응답의 `access_token`입니다. OpenAPI 보안 스키마는 `OAuth2PasswordBearer(tokenUrl="token")`를 사용하지만, 실제 토큰 발급 경로는 비밀번호 grant가 아니라 Google 콜백 엔드포인트입니다.

`JobPostingExtracted`와 `JobPostingStored`는 `job_postings`의 채용공고 컬럼을 반영하며, 저장 소유권은 `user_id` 컬럼으로 별도 관리합니다. 스키마 그룹은 다음과 같습니다.

- 식별자: `platform`, `posting_id`, `posting_url`
- 필수 공통 필드: `company_name`, `job_title`
- 선택 설명 필드: `experience_req`, `deadline`, `location`, `employment_type`, `job_description`, `responsibilities`, `qualifications`, `preferred_points`, `benefits`, `hiring_process`
- 선택 플랫폼별 필드: `education_req`, `salary`, `tech_stack`, `tags`, `application_method`, `application_form`, `contact_person`, `homepage`, `job_category`, `industry`
- 저장 전용 필드: `id`, `scraped_at`, `created_at`, `updated_at`

추출 요청 예시:

```bash
curl \
  -H 'Authorization: Bearer <access-token>' \
  'http://127.0.0.1:8000/v1/job-postings/extraction?url=https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=4930'
```

`tests/conftest.py`의 fixture 기준 응답 예시는 다음과 같습니다.

```json
{
  "platform": "saramin",
  "posting_id": "4930",
  "posting_url": "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=4930",
  "company_name": "Career OS",
  "job_title": "Backend Engineer",
  "experience_req": "3 years+",
  "deadline": "2026-05-31",
  "location": "Seoul",
  "employment_type": "Full-time",
  "job_description": "Build and maintain APIs.",
  "responsibilities": "Own backend services.",
  "qualifications": "FastAPI experience",
  "preferred_points": "OpenAI integration experience",
  "benefits": "Remote-friendly",
  "hiring_process": "Resume > Interview",
  "education_req": null,
  "salary": null,
  "tech_stack": ["Python", "FastAPI", "PostgreSQL"],
  "tags": ["#backend", "#python"],
  "application_method": null,
  "application_form": null,
  "contact_person": null,
  "homepage": null,
  "job_category": null,
  "industry": null
}
```

## 테스트

이 저장소는 `pytest`, `pytest-asyncio`, `pytest-cov`를 사용합니다.

현재 테스트 경계는 `tests/README.md`와 실제 테스트 파일 기준 다음과 같습니다.

- `tests/api/test_router.py`
  `TestClient`를 사용한 FastAPI 라우트 계약 테스트입니다. 앱 시작 시 데이터베이스 pool 생성은 fake pool로 대체되며, root, health check, 보호된 채용 공고 라우트의 인증 요구, create/update/detail/list 흐름을 검증합니다.
- `tests/unit/auth`
  JWT 생성/검증과 `get_current_user()` 의존성의 사용자 복원, 잘못된 토큰 처리에 대한 단위 테스트입니다.
- `tests/unit/service/job_posting`
  플랫폼 판별, posting ID 검증, fetch 오케스트레이션, Saramin/Wanted 처리, 추출 메시지 구성, 이미지 수집, refusal 처리에 대한 단위 테스트입니다.
- `tests/unit/database`
  실제 데이터베이스 없이 `job_postings.py`의 SQL 인자 바인딩과 결과 매핑을 검증합니다.
- `tests/httpx_stubs.py`
  서비스 테스트에서 공용으로 사용하는 `httpx` stub 유틸리티를 제공합니다.

현재 스위트가 다루지 않는 범위는 다음과 같습니다.

- 실제 PostgreSQL 연결과 connection pool 동작
- 실제 Google OAuth redirect/callback 왕복과 userinfo 조회
- `users.py` 사용자 upsert 경로에 대한 전용 단위 테스트
- 실제 Saramin 또는 Wanted 네트워크 호출
- 실제 OpenAI API 호출
- HTTP, 인증, 데이터베이스, 상위 HTTP, OpenAI를 한 번에 묶는 end-to-end 통합 검증

유용한 명령:

```bash
uv run pytest
uv run pytest tests/api/test_router.py
uv run pytest tests/unit/auth/test_dependencies.py
uv run pytest tests/unit/service/job_posting/test_extractor.py
uv run pytest --cov=career_os_api
```

포매팅, 린팅, 타입 검사 명령:

```bash
uvx ruff check --fix .
uvx ruff format .
uvx pyrefly check
```

## 배포

배포 자동화는 이 저장소에 부분적으로만 나타납니다.

- `.github/workflows/` 아래 CI/CD 워크플로 파일이 없습니다.
- `Dockerfile`, `docker-compose`, Terraform, Helm, Kubernetes, CloudFormation 정의가 없습니다.
- 스테이징 또는 프로덕션 환경 매니페스트가 별도로 커밋되어 있지 않습니다.

`.fastapicloud/cloud.json`을 보면 현재 작업 디렉터리는 FastAPI Cloud 앱과 팀에 연결되어 있습니다. 다만 실제 배포 파이프라인, 승격 절차, 운영 설정은 저장소에 포함되어 있지 않습니다.

기본 `REDIRECT_URI`도 `https://career-os.fastapicloud.dev/v1/auth/google/callback`으로 설정되어 있어, 현재 기본 인증 콜백 대상은 FastAPI Cloud 배포 URL입니다.

런타임 배포 기준 ASGI 애플리케이션 진입점은 `main.py`의 FastAPI 앱 객체 `career_os`입니다.

## 설계 패턴과 규약

| 패턴                       | 사용 위치                                                                                                                    | 이유                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 계층형 아키텍처            | `main.py`, `career_os_api/router.py`, `career_os_api/auth/`, `career_os_api/service/job_posting/`, `career_os_api/database/` | 앱 조합, HTTP 라우팅, 인증, 추출 로직, 영속화 로직을 분리   |
| 중앙 스키마 모듈           | `career_os_api/schemas.py`                                                                                                   | 라우트, 서비스, DB 경계에서 같은 모델 집합을 재사용         |
| 스키마 우선 경계 검증      | `career_os_api/schemas.py`, FastAPI 라우트 시그니처                                                                          | 요청/응답과 DB 길이 제약을 경계에서 맞춤                    |
| Repository 유사 SQL 모듈   | `career_os_api/database/job_postings.py`, `career_os_api/database/users.py`                                                  | 라우트 바깥에서 SQL과 row projection을 집중 관리            |
| 시작 시 부트스트랩         | `main.py`, `career_os_api/database/ddl.py`, `career_os_api/database/pool.py`                                                 | 요청 처리 전에 pool과 필수 스키마를 준비                    |
| 세션 기반 OAuth 핸드셰이크 | `main.py`, `career_os_api/router.py`                                                                                         | Google 로그인 리다이렉트 상태를 유지하고 콜백 무결성을 보장 |
| 플랫폼 전용 위임 구조      | `career_os_api/service/job_posting/fetch.py`, `platform.py`, `saramin.py`, `wanted.py`                                       | 플랫폼별 수집 규칙을 분리하면서 공통 추출 흐름 유지         |

### Firecrawl을 사용하지 않는 이유

Firecrawl은 범용 웹 렌더링/스크레이핑 도구로는 유용하지만, 현재 이 프로젝트가 다루는 플랫폼 특성에는 맞지 않습니다.

**Saramin**: `saramin.py`는 공개 페이지 전체를 긁지 않고 내부 AJAX 엔드포인트(`/zf_user/jobs/relay/view-ajax`)를 직접 호출합니다. 이어서 상세 iframe을 추가로 가져와 본문에 인라인하므로, 추천 공고와 레이아웃 노이즈를 줄인 상태로 추출에 넘길 수 있습니다.

**Wanted**: `wanted.py`는 `/api/v4/jobs/{id}` REST API를 직접 호출합니다. React 페이지를 렌더링하는 대신 JSON을 받아 필요한 정보를 HTML로 재구성하므로, 불필요한 프론트엔드 마크업을 제거한 상태로 추출할 수 있습니다.

**이미지 임베디드 텍스트**: `extractor.py`는 공고 안의 `<img>` 태그를 직접 수집하고 base64 data URL로 변환해 OpenAI에 함께 전달합니다. 한국 채용 공고에서 이미지 안에 텍스트가 들어 있는 경우를 놓치지 않기 위한 설계입니다.

**보안과 비용**: 현재 구현은 허용된 도메인만 대상으로 하고, `httpx`와 OpenAI 호출만으로 파이프라인을 끝냅니다. Firecrawl을 추가하면 별도 외부 의존성과 비용, 렌더링 지연이 추가됩니다.

새 플랫폼을 지원해야 하는데 내부 API나 AJAX 엔드포인트가 전혀 없다면, 그때 Firecrawl 같은 범용 도구를 검토할 여지는 있습니다. 현재 코드베이스에는 그런 필요가 나타나지 않습니다.

### 코드 규약

- 모듈, 함수, 로컬 변수는 snake_case 사용
- Pydantic 모델과 enum은 PascalCase 사용
- 모듈 수준 상수는 UPPER_CASE 사용
- Ruff line length는 `88`로 설정
- Pyrefly는 `career_os_api`와 `main.py`를 분석 대상으로 설정

## 문제 해결

- `DATABASE_URL`, `OPENAI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SECRET_KEY` 중 하나라도 누락
  `career_os_api/config.py`는 import 시점에 `Settings()`를 초기화하므로, 필수 설정이 없으면 앱이 import 단계에서 실패합니다.
- Google 로그인 후 콜백이 실패하는 경우
  로컬에서는 `REDIRECT_URI`를 `http://127.0.0.1:8000/v1/auth/google/callback` 같은 주소로 바꾸고, 같은 값을 Google Cloud Console에 등록해야 합니다.
- 보호된 엔드포인트에서 `401 Unauthorized`
  `/v1/auth/google/callback`이 반환한 JWT access token이 필요합니다. 토큰이 손상되었거나, `sub`가 UUID가 아니거나, 해당 사용자가 없거나 비활성 상태면 `401`이 반환됩니다.
- 사용자 이름 수정 시 `404 Not Found`
  `PATCH /v1/auth/me`에서 해당 사용자를 찾을 수 없으면 `404`가 반환됩니다. 이름은 공백만으로 구성될 수 없으며 최소 1자 이상의 비공백 문자가 필요합니다.
- 추출 시 `400 Bad Request`
  현재는 `saramin.co.kr`와 `wanted.co.kr` 호스트만 허용됩니다. Saramin URL에는 `rec_idx`가 필요하고, Wanted URL은 `/wd/{id}` 형식을 따라야 합니다.
- 추출 시 `422 Unprocessable Entity`
  `url` 쿼리 파라미터가 없으면 FastAPI가 `422`를 반환합니다. 또한 OpenAI 모델이 콘텐츠 처리를 거부하면 `extract_job_posting()`도 `422`를 반환합니다.
- Saramin 상세 내용이 일부 누락되는 경우
  iframe 상세 콘텐츠 fetch가 실패하면 원래 iframe이 그대로 남을 수 있습니다. 이 경우 본문 이미지나 상세 텍스트 일부가 줄어들 수 있습니다.
- 테스트는 통과하지만 운영에서는 실패하는 경우
  현재 테스트 스위트는 PostgreSQL, Google OAuth, 상위 HTTP, OpenAI를 fake나 stub으로 대체합니다. 테스트 통과는 실제 연결성과 자격 증명을 보장하지 않습니다.

## 기여

이 저장소에는 현재 `CONTRIBUTING.md`나 명시적인 브랜치 전략 문서가 없습니다.

현재 존재하는 기여자용 가이드는 `CLAUDE.md`와 `tests/README.md`입니다. 이를 기준으로 보면 기대되는 로컬 작업 흐름은 다음과 같습니다.

- `uv`로 의존성 설치
- 병합 전에 전체 테스트 스위트 실행
- Ruff 포매팅 및 린트 검사 실행
- Pyrefly 타입 검사 실행
- 동작을 증명하는 가장 낮고 안정적인 경계에 테스트 추가

권장 로컬 검증 명령:

```bash
uv run pytest
uvx ruff check --fix .
uvx ruff format .
uvx pyrefly check
```
