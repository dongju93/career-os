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

| 라이브러리                               | 용도                    | 선정 이유                                                                                                                                                                        |
| ---------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FastAPI**                              | ASGI 웹 프레임워크      | 타입 힌트 기반 검증, async 지원, OpenAPI 자동 문서화가 기본 제공되어 API 서버 개발 생산성과 계약 명확성이 높음. Flask보다 보일러플레이트가 적고 Django보다 경량                  |
| **psycopg 3 + psycopg-pool**             | PostgreSQL 드라이버     | PostgreSQL에 직접 접근하면서 async I/O와 커넥션 풀을 함께 제공. 단순한 데이터 접근 계층에서는 ORM보다 의존성과 추상화 비용이 낮고 SQL 제어권을 유지하기 쉬움                     |
| **Pydantic v2 + pydantic-settings**      | 스키마 검증·설정 관리   | 런타임 검증, 직렬화, JSON Schema 생성을 타입 힌트 중심으로 통합. 설정값도 같은 검증 모델로 관리할 수 있어 환경 변수 누락이나 타입 오류를 초기에 발견하기 좋음                    |
| **Authlib**                              | Google OAuth 클라이언트 | OAuth 2.0·OpenID Connect처럼 보안 민감도가 높은 표준 플로우를 검증된 라이브러리에 맡길 수 있음. 직접 구현 대비 인증 취약점과 유지보수 부담을 줄임                                |
| **python-jose**                          | JWT 발급·검증           | JWT/JWS 처리를 위한 가벼운 JOSE 구현체. 내부 access token 서명·검증 요구사항에는 충분하면서, OAuth 클라이언트 라이브러리와 토큰 책임을 분리하기 쉬움                             |
| **Beautiful Soup 4**                     | HTML 파싱               | 실제 웹 페이지처럼 구조가 일정하지 않은 HTML에서도 탐색·검색 API가 안정적이고 단순함. 브라우저 자동화나 무거운 파서 없이 서버 사이드 텍스트 추출 요구를 충족                     |
| **OpenAI Python SDK**                    | 구조화 데이터 추출      | OpenAI API의 공식 SDK라 모델·파라미터 변화에 대한 호환성이 가장 높음. async client, 멀티모달 입력, 구조화 출력 지원을 직접 HTTP 래퍼로 관리하지 않아도 됨                        |
| **Ruff**                                 | 린터·포매터             | 린트, 포맷, import 정리, pyupgrade 계열 규칙을 단일 Rust 기반 도구로 처리해 빠르고 설정이 단순함. 여러 Python 품질 도구를 조합하는 비용을 줄임                                   |
| **Pyrefly**                              | 타입 검사               | 빠른 정적 타입 검사와 언어 서버 기능을 제공해 피드백 루프가 짧음. Python 타입 적용 범위를 점진적으로 넓히기 좋고, CI와 IDE 양쪽에서 같은 타입 품질 기준을 유지하기 쉬움          |
| **pytest + pytest-asyncio + pytest-cov** | 테스트                  | pytest의 fixture·plugin 생태계가 넓어 API, 서비스, DB 경계 테스트를 확장하기 좋음. async 테스트와 커버리지 측정을 표준 플러그인으로 붙일 수 있어 별도 테스트 프레임워크가 불필요 |

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
