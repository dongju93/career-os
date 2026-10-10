# 테스트 범위

이 테스트 스위트는 경계 기준으로 의도적으로 분리되어 있습니다. 현재 스위트는 실제 데이터베이스, 실제 상위 HTTP, 실제 OpenAI API 접근 없이도 애플리케이션 동작을 검증합니다.

## 현재 커버리지

- `tests/api`
  - FastAPI 라우트 계약만 검증합니다.
  - 앱을 `TestClient`로 구동하지만, 앱 시작 시 데이터베이스 pool 생성은 fake pool로 대체합니다.
  - 콘텐츠 fetch, 채용 공고 추출 같은 라우트 협력 객체는 mock 처리합니다.
  - 요청 검증, 응답 형태, 라우트-서비스 연결을 다룹니다.
  - 실제 Postgres 연결을 열거나 외부 서비스를 호출하지 않습니다.
- `tests/unit/service/job_posting`
  - 서비스 계층의 파싱 규칙, 스키마 정규화, 요청 오케스트레이션, 에러 매핑을 검증합니다.
  - `httpx`와 OpenAI 클라이언트 상호작용은 stub과 fake를 사용합니다.
  - 플랫폼 판별, posting ID 추출, Saramin HTML 섹션 추출, fetch 에러 처리, 프롬프트/메시지 구성, 이미지 source 정규화, 모델 거부 처리까지 다룹니다.
  - 실제 HTTP 요청이나 실제 OpenAI completion은 수행하지 않습니다.
- `tests/unit/database`
  - 데이터베이스 접근 계층의 SQL 호출과 결과 매핑을 검증합니다.
  - fake connection, fake cursor, `dict_row` 설정 검증을 사용하며 실제 Postgres에 연결하지 않습니다.
  - upsert 파라미터 바인딩, 목록 조회 쿼리와 count 조회, 상세 조회 쿼리 사용 여부를 다룹니다.
- `tests/conftest.py`
  - 테스트 중 설정 로딩이 가능하도록 placeholder `DATABASE_URL`과 `OPENAI_API_KEY` 값을 설정합니다.
  - 이 값들은 테스트 전용 기본값이며, 실제 서비스로 해석될 것을 기대하지 않습니다.

## 선택적 PostgreSQL 통합 테스트

`tests/integration/test_risc_purge.py`는 `CAREER_OS_TEST_POSTGRES_DSN`을 설정했을 때만 실행됩니다. 반드시 폐기 가능한 테스트 데이터베이스를 지정하세요. 각 테스트는 독립 스키마를 생성하고 종료 시 삭제합니다.

이 테스트는 실제 PostgreSQL 연결 두 개로 purge와 OAuth upsert의 두 실행 순서, 사용자 없는 subject의 purge, 감사 이력 보존 기간 이후 차단 유지, 중복 이벤트, 트랜잭션 롤백을 검증합니다.

```bash
CAREER_OS_TEST_POSTGRES_DSN=postgresql://localhost/career_os_test uv run pytest tests/integration/test_risc_purge.py
```

## 범위 밖

- 운영 Postgres 연결성, connection pool 동작, 기존 데이터베이스 마이그레이션
- Saramin 또는 기타 상위 채용 사이트에 대한 end-to-end 네트워크 호출
- 실제 OpenAI API 응답, 지연 시간, quota, 모델 호환성
- FastAPI, 데이터베이스, 상위 HTTP, OpenAI를 한 번의 실행으로 묶는 전체 통합 커버리지

## 배치 규칙

- 동작을 증명하는 가장 낮고 안정적인 경계에 테스트를 추가합니다.
- 공개 라우트 동작에 대한 커버리지가 필요할 때만 API 수준 계약 테스트를 하나 추가합니다.
- 공용 fixture는 `tests/conftest.py`에 둡니다.
- 재사용 가능한 test double과 protocol helper는 `tests/support.py` 같은 모듈에 둡니다.
- 선택적인 실제 데이터베이스 테스트는 `tests/integration`에 두고, 별도 테스트 DSN이 없으면 건너뜁니다.
