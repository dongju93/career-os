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
- [문제 해결](#문제-해결)
- [기여](#기여)

---

## 개요

CareerOS는 단일 패키지로 구성된 Python 백엔드 서비스입니다. 현재 구현은 `saramin.co.kr` 및 `wanted.co.kr` 채용 공고 수집에 초점을 두고 있습니다.

이 서비스는 다음 HTTP 엔드포인트를 제공합니다.

- 지원하는 채용 공고 URL을 가져와 구조화된 데이터로 추출
- 추출 결과를 PostgreSQL에 upsert
- 저장된 채용 공고를 offset pagination으로 조회
- 숫자 id 기준으로 저장된 채용 공고 상세 조회
- 데이터베이스 연결 상태 확인

이 저장소는 모노레포가 아닙니다. 하나의 FastAPI 애플리케이션 패키지 `career_os_api`와 테스트, 로컬 도구 메타데이터로 구성됩니다.

라우트 표면과 저장 스키마를 기준으로 추론하면, 주요 소비자는 원시 HTML 페이지가 아니라 구조화된 채용 데이터를 필요로 하는 내부 서비스나 UI입니다.

이 저장소가 정의하는 런타임 모드는 하나뿐입니다. `main.py`에서 시작되는 HTTP API 서버이며, CLI 명령, 백그라운드 워커, 스케줄 작업, 서버리스 핸들러는 코드베이스에 구현되어 있지 않습니다.

## 아키텍처

코드베이스는 계층형 서비스 구조를 따릅니다.

- `main.py`는 FastAPI 애플리케이션을 조합하고, 앱 lifespan 동안 공용 PostgreSQL connection pool을 만들고, 스키마 초기화를 수행한 뒤 버전 라우터를 마운트합니다.
- `career_os_api/api.py`는 `/v1` HTTP 계약과 요청 오케스트레이션을 담당합니다.
- `career_os_api/service/job_posting/`은 URL 분류, 원격 HTML 조회, Saramin 전용 콘텐츠 추출, OpenAI 기반 구조화를 담당합니다.
- `career_os_api/database/`는 스키마 DDL과 채용 공고 영속화를 위한 SQL 접근 계층을 담고 있습니다.

코드에서 확인되는 주요 구현 결정은 다음과 같습니다.

- 데이터베이스 스키마 생성은 `career_os_api/database/schemas.py`의 raw SQL로 앱 시작 시 수행되며, 별도의 마이그레이션 프레임워크는 저장소에 없습니다.
- 외부 fetch는 `career_os_api/service/job_posting/platform.py`의 `detect_platform()`으로 네트워크 I/O 이전에 allowlist 검사됩니다. 따라서 추출 대상은 지원하는 채용 플랫폼 도메인으로 제한됩니다.
- 영속화는 `(platform, posting_id)` 기준 `INSERT ... ON CONFLICT DO UPDATE`를 사용하므로, 동일한 원본 공고를 다시 처리해도 중복 행을 만들지 않고 기존 레코드를 갱신합니다.
- 목록 엔드포인트는 의도적으로 큰 텍스트 필드를 제외하고, 상세 엔드포인트는 전체 저장 레코드를 반환합니다.
- Saramin 추출은 전용 fetch 경로를 사용하며, 플랫폼의 AJAX 상세 엔드포인트를 호출하고 iframe 콘텐츠를 인라인한 뒤 OpenAI 추출 단계로 넘깁니다.

### 런타임 진입점

- `main.py`
  FastAPI 앱 객체 `career_os`를 시작하고, 앱 lifespan hook을 등록하며, `app.state.pool`을 생성하고, `job_postings` 테이블과 인덱스를 초기화한 뒤 `/v1` 라우터를 마운트합니다.

추가 런타임 진입점은 발견되지 않았습니다.

### 시스템 다이어그램

```mermaid
graph TD
    Client["HTTP 클라이언트"] --> App["main.py / career_os"]
    App --> Lifespan["lifespan()"]
    Lifespan --> Pool["create_postgres_pool()"]
    Lifespan --> Schema["init_schema()"]
    Pool --> Postgres[(PostgreSQL)]
    Schema --> Postgres

    App --> Router["career_os_api/api.py (/v1)"]

    Router --> QueryRoutes["GET /job-postings<br/>GET /job-postings/{job_id}<br/>POST /job-postings<br/>GET /health/db"]
    QueryRoutes --> Repo["career_os_api/database/job_postings.py"]
    Repo --> Postgres

    Router --> ExtractionRoute["GET /job-postings/extraction"]
    ExtractionRoute --> Fetch["fetch.py"]
    Fetch --> Platform["platform.py<br/>도메인 allowlist + posting id"]
    Fetch --> Saramin["saramin.py<br/>AJAX + iframe 인라인"]
    Fetch --> Upstream["지원하는 채용 공고 페이지"]
    Saramin --> Extractor["extractor.py"]
    Upstream --> Extractor
    Extractor --> OpenAI["OpenAI chat.completions.parse"]
```

### 요청 및 데이터 흐름

1. 클라이언트가 `GET /v1/job-postings/extraction?url=...`를 호출합니다.
2. `fetch_url_content()`가 외부 HTTP 요청을 보내기 전에 지원 도메인 맵 기준으로 호스트를 검증합니다.
3. Saramin URL은 `fetch_saramin_job_posting()`으로 분기되며, Saramin의 `view-ajax` 엔드포인트를 호출하고 필요 시 iframe 상세 콘텐츠를 가져온 뒤, 허용된 채용 공고 섹션만 추출합니다. 그 외 지원 URL은 `httpx`로 직접 조회합니다.
4. `extract_job_posting()`은 HTML을 텍스트로 변환하고, 참조된 이미지를 최대 `MAX_IMAGES`개까지 내려받은 뒤, `response_format=JobPostingExtracted`로 `AsyncOpenAI().chat.completions.parse()`를 호출합니다.
5. 클라이언트는 `POST /v1/job-postings`로 구조화된 payload를 저장할 수 있으며, `upsert_job_posting()`이 PostgreSQL에 레코드를 기록하고 insert인지 update인지 보고합니다.
6. `GET /v1/job-postings`는 요약 projection을 반환하고, `GET /v1/job-postings/{job_id}`는 동일 테이블의 전체 행을 반환합니다.

## 기술 스택

| 계층            | 기술                                     | 용도                                                      |
| --------------- | ---------------------------------------- | --------------------------------------------------------- |
| Runtime         | Python 3.14                              | `pyproject.toml`, `.python-version`에 선언됨              |
| HTTP 프레임워크 | FastAPI                                  | ASGI 앱, 라우팅, 검증, OpenAPI 문서, lifespan             |
| 검증 및 설정    | Pydantic, `pydantic-settings`            | 요청/응답 모델 및 `.env` 로딩                             |
| HTTP 클라이언트 | `httpx`                                  | 채용 공고 페이지와 참조 이미지 fetch                      |
| HTML 파싱       | Beautiful Soup 4                         | 상위 HTML 파싱 및 Saramin 전용 섹션 추출                  |
| 영속화          | PostgreSQL, `psycopg`, `psycopg-pool`    | connection pool 및 SQL 실행                               |
| AI 추출         | OpenAI Python SDK                        | `JobPostingExtracted` 형태의 구조화 추출                  |
| 테스트          | `pytest`, `pytest-asyncio`, `pytest-cov` | API 및 단위 테스트 실행                                   |
| 포매팅 및 린팅  | Ruff                                     | 포매팅 및 정적 린트 검사                                  |
| 타입 검사       | Pyrefly                                  | 프로젝트 타입 분석                                        |
| 의존성 워크플로 | `uv`                                     | 커밋된 `uv.lock`과 `CLAUDE.md`의 로컬 명령 문서 기준 추론 |

## 프로젝트 구조

```text
career-os/
├── .fastapicloud/
│   ├── README.md
│   └── cloud.json
├── career_os_api/
│   ├── api.py
│   ├── config.py
│   ├── constants.py
│   ├── database/
│   │   ├── connection.py
│   │   ├── job_postings.py
│   │   └── schemas.py
│   └── service/
│       └── job_posting/
├── main.py
├── pyproject.toml
├── tests/
│   ├── api/
│   │   └── test_main.py
│   ├── unit/
│   │   ├── database/
│   │   └── service/
│   ├── conftest.py
│   ├── support.py
│   └── README.md
└── uv.lock
```

의미가 바로 드러나지 않는 디렉터리와 파일은 다음과 같습니다.

- `.fastapicloud/`는 로컬 FastAPI Cloud 연결 메타데이터(`cloud.json`)와 설명 문서를 담고 있습니다. 애플리케이션 런타임 코드나 infrastructure-as-code는 아닙니다.
- `career_os_api/service/job_posting/`은 핵심 수집 파이프라인입니다. 플랫폼 판별, fetch 로직, Saramin 전용 처리, 추출 프롬프트 구성, Pydantic 스키마를 포함합니다.
- `career_os_api/database/schemas.py`는 스키마 정의이자 스키마 부트스트랩 코드입니다. 별도의 migrations 디렉터리는 없습니다.
- `tests/support.py`는 실서비스 없이 테스트를 실행할 수 있도록 재사용 가능한 HTTP 클라이언트 test double을 제공합니다.

## 핵심 기능

- `saramin.co.kr`, `wanted.co.kr` 지원 플랫폼 판별
- 플랫폼별 URL 형식에서 posting id 추출
- 추천 영역을 제거하고 iframe 상세 콘텐츠를 인라인하는 Saramin 전용 콘텐츠 수집
- HTML 텍스트와 공고 내 임베디드 이미지 텍스트를 함께 활용하는 OpenAI 기반 구조화 추출
- `(platform, posting_id)` 기준 PostgreSQL upsert
- 가벼운 summary row 기반 offset pagination 목록 API
- 데이터베이스 id 기준 전체 저장 레코드 조회
- `/v1/health/db` 데이터베이스 연결 상태 점검

## 시작하기

### 사전 요구사항

- Python `>=3.14`
- `uv`
  커밋된 `uv.lock` 파일과 `CLAUDE.md`의 명령 문서를 기준으로 추론
- API를 실행하는 머신에서 접근 가능한 PostgreSQL
- 설정된 추출 모델에 접근 가능한 OpenAI API 키

### 환경 변수

설정은 `pydantic-settings`를 통해 `.env`에서 로드됩니다.

| 변수                 | 필수   | 기본값         | 설명                                                          |
| -------------------- | ------ | -------------- | ------------------------------------------------------------- |
| `DATABASE_URL`       | 예     | 없음           | `AsyncConnectionPool`이 사용하는 PostgreSQL DSN               |
| `OPENAI_API_KEY`     | 예     | 없음           | 추출 시 `AsyncOpenAI`가 사용하는 API 키                       |
| `HTTP_FETCH_TIMEOUT` | 아니오 | `30.0`         | 채용 공고 페이지 fetch 및 Saramin AJAX/상세 요청 타임아웃(초) |
| `HTTP_IMAGE_TIMEOUT` | 아니오 | `10.0`         | 공고에서 참조한 이미지 자산 다운로드 타임아웃(초)             |
| `OPENAI_MODEL`       | 아니오 | `gpt-5.4-mini` | `chat.completions.parse()`에 전달되는 모델명                  |
| `OPENAI_TEMPERATURE` | 아니오 | `0`            | 추출 요청에 전달되는 temperature                              |
| `MAX_IMAGES`         | 아니오 | `10`           | 추출 요청에 첨부하기 위해 fetch하는 최대 공고 이미지 수       |

테스트는 `tests/conftest.py`에서 `DATABASE_URL`과 `OPENAI_API_KEY`를 덮어쓰므로, 현재 테스트 스위트를 실행할 때 실제 `.env` 파일은 필요하지 않습니다.

### 설치

```bash
uv sync --dev

cat > .env <<'EOF'
DATABASE_URL=postgresql://user:pass@localhost:5432/career_os
OPENAI_API_KEY=sk-...
EOF
```

`career_os_api/config.py`의 기본값을 바꿔야 할 때만 `.env`에 선택적 override를 추가하면 됩니다.

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

이 저장소에는 Docker 지원이 정의되어 있지 않습니다. `Dockerfile`이나 `docker-compose` 파일이 없습니다.

개발, 스테이징, 프로덕션용 별도 설정 파일도 저장소에 정의되어 있지 않습니다. 환경별 동작 차이는 환경 변수로만 제어됩니다.

## API 레퍼런스

앱 실행 시 FastAPI는 `/v1/docs`와 `/v1/redoc`에 OpenAPI 및 대화형 문서도 제공합니다.

| 메서드 | 경로                          | 목적                                 | 비고                                                                                                            |
| ------ | ----------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/v1/`                        | 서비스 스모크 엔드포인트             | `{"message": "Hello, World!"}` 반환                                                                             |
| `GET`  | `/v1/job-postings`            | 페이지네이션된 요약 목록             | 쿼리 파라미터: `offset >= 0`, `1 <= limit <= 100`                                                               |
| `GET`  | `/v1/job-postings/extraction` | `url`에서 채용 공고를 fetch하고 추출 | `JobPostingExtracted` 반환, 라우트는 `400`, `404`, `502`를 문서화하며 `url` 누락 시 `422`는 FastAPI가 자동 생성 |
| `POST` | `/v1/job-postings`            | 정규화된 채용 공고 upsert            | insert 시 `201`, update 시 `200` 반환                                                                           |
| `GET`  | `/v1/job-postings/{job_id}`   | DB id로 저장된 채용 공고 조회        | 행이 없으면 `404` 반환                                                                                          |
| `GET`  | `/v1/health/db`               | 데이터베이스 연결 확인               | 구성된 pool을 통해 `SELECT 1` 실행                                                                              |

`JobPostingExtracted`와 `JobPostingStored`는 `job_postings` 테이블을 반영합니다. 스키마 그룹은 다음과 같습니다.

- 식별자: `platform`, `posting_id`, `posting_url`
- 필수 공통 필드: `company_name`, `job_title`
- 선택 설명 필드: `experience_req`, `deadline`, `location`, `employment_type`, `job_description`, `responsibilities`, `qualifications`, `preferred_points`, `benefits`, `hiring_process`
- 선택 플랫폼별 필드: `education_req`, `salary`, `tech_stack`, `tags`, `application_method`, `application_form`, `contact_person`, `homepage`, `job_category`, `industry`
- 저장 전용 필드: `id`, `scraped_at`, `created_at`, `updated_at`

추출 요청 예시:

```bash
curl 'http://127.0.0.1:8000/v1/job-postings/extraction?url=https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=4930'
```

`tests/conftest.py`의 테스트 fixture 기준 응답 예시는 다음과 같습니다.

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

현재 테스트 경계는 `tests/README.md` 기준 다음과 같습니다.

- `tests/api`
  `TestClient`를 사용한 FastAPI 라우트 계약 테스트입니다. 시작 시 데이터베이스 pool 생성은 fake pool로 대체됩니다.
- `tests/unit/service/job_posting`
  플랫폼 판별, fetch 오케스트레이션, Saramin HTML 처리, 추출 메시지 구성, 이미지 수집, refusal 처리에 대한 단위 테스트입니다.
- `tests/unit/database`
  실제 데이터베이스 없이 SQL 인자 연결과 결과 처리에 대한 단위 테스트입니다.

현재 스위트가 다루지 않는 범위는 다음과 같습니다.

- 실제 PostgreSQL 연결
- 실제 Saramin 또는 Wanted 네트워크 호출
- 실제 OpenAI API 호출
- HTTP, 데이터베이스, 추출 서비스를 하나의 실행에서 아우르는 end-to-end 통합 검증

유용한 명령:

```bash
uv run pytest
uv run pytest tests/api/test_main.py
uv run pytest tests/unit/service/job_posting/test_extractor.py
uv run pytest --cov=career_os_api
```

`CLAUDE.md`에 기록된 포매팅, 린팅, 타입 검사 명령:

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

로컬 cloud 연결 메타데이터를 기준으로 추론하면 `.fastapicloud/cloud.json`은 현재 작업 디렉터리가 FastAPI Cloud 앱과 팀에 연결되어 있음을 보여줍니다. 다만 해당 대상에 대한 배포 파이프라인이나 승격 절차는 저장소에 포함되어 있지 않습니다.

런타임 배포 기준 ASGI 애플리케이션 진입점은 `main.py`의 FastAPI 앱 객체 `career_os`입니다.

## 설계 패턴과 규약

| 패턴                                       | 사용 위치                                                                                          | 이유                                                                |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 계층형 아키텍처                            | `main.py`, `career_os_api/api.py`, `career_os_api/service/job_posting/`, `career_os_api/database/` | 앱 조합, HTTP 라우팅, 추출 로직, 영속화 로직을 분리                 |
| 스키마 우선 경계 검증                      | `career_os_api/service/job_posting/schema.py`, FastAPI 라우트 시그니처                             | 요청, 응답, DB 필드 길이 제약을 일치시킴                            |
| Repository 유사 SQL 모듈                   | `career_os_api/database/job_postings.py`                                                           | 라우트 핸들러 밖에서 SQL, conflict 처리, row projection을 집중 관리 |
| 시작 시 부트스트랩                         | `main.py`, `career_os_api/database/schemas.py`                                                     | 요청 처리 전에 pool과 필수 스키마가 준비되도록 보장                 |
| 플랫폼 전용 위임 구조(코드 구조 기준 추론) | `career_os_api/service/job_posting/fetch.py`, `platform.py`, `saramin.py`                          | 플랫폼별 fetch 규칙을 라우트 계층과 분리하면서 공통 추출 흐름 유지  |

### 코드 규약

- 모듈, 함수, 로컬 변수는 snake_case 사용
- Pydantic 모델과 enum은 PascalCase 사용
- 모듈 수준 상수는 UPPER_CASE 사용
- Ruff line length는 `88`로 설정
- Pyrefly는 `career_os_api`와 `main.py`를 분석 대상으로 설정

## 문제 해결

- `DATABASE_URL` 또는 `OPENAI_API_KEY` 누락
  `career_os_api/config.py`는 import 시점에 `Settings()`를 초기화하므로, 필수 설정이 없으면 앱이 import 단계에서 실패합니다.
- 추출 시 `400 Bad Request`
  `saramin.co.kr`와 `wanted.co.kr` 호스트만 허용됩니다. Saramin URL에는 `rec_idx`가 필요하고, Wanted URL은 `/wd/{id}` 형식을 따라야 합니다.
- 추출 시 `422 Unprocessable Entity`
  FastAPI는 필수 `url` 쿼리 파라미터가 없으면 `422`를 반환하며, `extract_job_posting()`도 OpenAI 모델이 콘텐츠 처리를 거부하면 `422`를 반환합니다.
- Saramin 상세 내용이 일부 누락되는 경우
  `saramin.py`는 iframe 상세 콘텐츠를 인라인하려고 시도하지만, 보조 fetch가 실패하면 원래 iframe을 그대로 둡니다.
- 테스트는 통과하지만 운영에서는 실패하는 경우
  현재 테스트 스위트는 PostgreSQL, 상위 HTTP, OpenAI를 fake로 대체합니다. 테스트 통과는 실제 연결성이나 자격 증명을 보장하지 않습니다.

## 기여

이 저장소에는 현재 `CONTRIBUTING.md`나 명시적인 브랜치 전략 문서가 없습니다.

현재 존재하는 기여자용 가이드는 `CLAUDE.md`입니다. 해당 파일과 `tests/README.md`를 기준으로 보면, 기대되는 로컬 작업 흐름은 다음과 같습니다.

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
