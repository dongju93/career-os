# CareerOS Web

![Vercel](https://img.shields.io/badge/Vercel-Deployed-000?logo=vercel&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)
[![codecov](https://codecov.io/github/dongju93/career-os/graph/badge.svg?flag=frontend&token=48VXFY8C3M)](https://codecov.io/github/dongju93/career-os)

구직 활동을 관리하는 Career OS의 React 기반 프론트엔드 애플리케이션입니다. Google OAuth 인증과 채용공고 관리 기능을 제공합니다.

**프로덕션**: `https://career-os-sigma.vercel.app`

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

| 항목                 | 링크                                                                  |
| -------------------- | --------------------------------------------------------------------- |
| 프론트엔드 배포 관리 | [Vercel - career-os](https://vercel.com/dongju93s-projects/career-os) |

---

## 시작하기

### 사전 요구사항

- Node.js `≥ 20` + [`pnpm`](https://pnpm.io/)
- 실행 중인 CareerOS API 서버 (로컬 또는 프로덕션)

### 설치

```bash
pnpm install
```

### 환경 변수

`career_os_web/`에 `.env.local` 파일을 생성합니다.

```dotenv
VITE_API_BASE_URL=http://localhost:8000
```

별도 오버라이드가 없으면 프로덕션 API 주소(`https://career-os.fastapicloud.dev`)를 사용합니다.

### 실행

```bash
pnpm dev
```

개발 서버: `http://localhost:5173`

---

## 기술 스택

| 라이브러리                   | 용도                     | 선정 이유                                                                                                                                                                    |
| ---------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **React 19**                 | UI 라이브러리            | 컴포넌트 기반 UI 작성 모델이 안정적이고 생태계가 가장 넓음. SPA를 시작점으로 두면서도 이후 라우팅, 테스트, 최적화 도구 선택지가 풍부함                                       |
| **TypeScript 7**             | 정적 타입 시스템         | 화면 상태와 API 응답 계약을 컴파일 단계에서 검증할 수 있어 리팩터링 안정성이 높음. native preview는 기존 TypeScript 생태계를 유지하면서 타입 체크 성능 개선을 기대할 수 있음 |
| **Vite 8**                   | 개발 서버·번들러         | 개발 서버 시작과 HMR이 빠르고 설정 부담이 낮음. React, Tailwind CSS, Vitest 등 현대 프론트엔드 도구와의 플러그인 생태계가 성숙함                                             |
| **Mantine 9**                | UI 컴포넌트 라이브러리   | 접근성, 테마, 기본 컴포넌트 품질을 빠르게 확보할 수 있음. 모든 UI를 직접 구현하는 비용을 줄이면서도 커스터마이징 여지가 충분함                                               |
| **React Router 7**           | 클라이언트 사이드 라우팅 | React 생태계의 대표 라우터로 SPA 라우팅부터 확장된 데이터·프레임워크 모드까지 선택지가 넓음. URL 기반 화면 구조와 인증 흐름을 명확히 표현하기 좋음                           |
| **Zustand 5**                | 전역 상태 관리           | Provider 중심 구조 없이 hook 기반으로 필요한 전역 상태만 작게 관리할 수 있음. Redux 계열보다 보일러플레이트가 적고 Context보다 렌더링 제어가 쉬움                            |
| **Tailwind CSS 4**           | 유틸리티 퍼스트 CSS      | 디자인 토큰과 유틸리티 클래스로 일관된 UI를 빠르게 구성할 수 있음. 런타임 CSS-in-JS 없이 빌드 타임에 스타일을 생성해 번들·런타임 부담이 낮음                                 |
| **React Compiler**           | 빌드 타임 최적화         | React 팀이 제공하는 자동 메모이제이션 경로라 수동 최적화 코드의 남용을 줄일 수 있음. React 19 기반 프로젝트에서 장기적인 최적화 방향과 잘 맞음                               |
| **Biome**                    | 린터·포매터              | 포맷터와 린터를 한 도구로 통합해 ESLint·Prettier 조합보다 설정과 실행 흐름이 단순함. Rust 기반이라 대규모 검사에서도 피드백이 빠름                                           |
| **Vitest + Testing Library** | 단위·컴포넌트 테스트     | Vite 기반 프로젝트와 설정·변환 파이프라인을 공유해 테스트 환경 구성이 단순함. Testing Library는 구현 세부보다 사용자 관점 검증을 유도함                                      |
| **Playwright**               | E2E 브라우저 테스트      | 실제 브라우저 기반 검증, auto-wait, trace, 병렬 실행 지원이 강함. 로그인·화면 전환 같은 사용자 흐름 회귀를 단위 테스트보다 현실적으로 확인 가능                              |

---

## 기능

- **Google OAuth 로그인** — `/login`에서 Google 계정으로 인증, `/auth/callback`에서 세션 사용자 확인
- **인증 상태 관리** — HttpOnly 세션 쿠키로 API 인증, Zustand로 현재 사용자 정보 관리
- **보호된 라우트** — 미인증 사용자는 로그인 페이지로 리다이렉트, 이후 원래 경로로 복귀
- **채용공고 목록** — `/job-postings`에서 저장한 채용공고를 카드 형태로 조회
- **채용공고 추가** — `/job-postings/new`에서 URL 입력으로 공고 추출 및 저장

---

## 개발

### 명령어

```bash
pnpm dev           # 개발 서버 (HMR)
pnpm build         # tsgo -b && vite build
pnpm preview       # 프로덕션 빌드 미리보기
pnpm lint          # 린트 검사
pnpm lint:fix      # 린트 자동 수정
pnpm format        # 코드 포매팅
pnpm test          # 단위/컴포넌트 테스트
pnpm test:watch    # 테스트 와치 모드
pnpm test:e2e      # Playwright E2E 테스트
```

Playwright 브라우저가 없다면 최초 1회 실행:

```bash
pnpm exec playwright install chromium
```
