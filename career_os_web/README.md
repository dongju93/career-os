# CareerOS Web

![Vercel](https://img.shields.io/badge/Vercel-Deployed-000?logo=vercel&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)
[![codecov](https://codecov.io/github/dongju93/career-os/graph/badge.svg?flag=frontend&token=48VXFY8C3M)](https://codecov.io/github/dongju93/career-os)

구직 활동을 관리하는 Career OS의 React 기반 프론트엔드 애플리케이션입니다. Google OAuth 인증, 구직 활동 그룹 관리, 채용공고 저장·조회, AI 채팅 어시스턴트 기능을 제공합니다.

**프로덕션**: [https://career-os-sigma.vercel.app](https://career-os-sigma.vercel.app)

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

`VITE_API_BASE_URL`은 `.env` 파일이 아니라 `vite.config.ts`의 `define` 블록에 빌드 시 직접 치환됩니다. 로컬 API 서버로 전환하려면 `vite.config.ts` 상단의 주석 처리된 줄을 교체하세요.

```ts
// vite.config.ts
const VITE_API_BASE_URL = "https://career-os.fastapicloud.dev"; // Production
// const VITE_API_BASE_URL = 'http://localhost:8000'; // Local
```

ChatKit 임베드를 사용하려면 `career_os_web/`에 `.env.local` 파일을 생성합니다.

```dotenv
VITE_CHATKIT_DOMAIN_KEY=<OpenAI ChatKit 도메인 키>
```

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
| **@openai/chatkit-react**    | AI 채팅 UI 임베드        | OpenAI ChatKit 프로토콜을 준수하는 React 컴포넌트. 스트리밍 SSE 응답과 대화 이력을 내장 처리해 커스텀 채팅 UI를 구현하는 비용을 줄임                                         |

---

## UI/UX 설계 원칙

### 디자인 시스템

**글래스모피즘(Glassmorphism)** 테마를 기반으로, 실용적인 구직 관리 도구에 시각적 깊이감을 부여합니다.

- **배경 레이어**: 페이지 전체에 흐릿한 색상 그라디언트 블롭(cyan/teal/purple)을 배치해 생동감 있는 배경을 구성합니다.
- **Glass 카드**: `backdrop-filter: blur` + 반투명 흰색 배경으로 배경이 살짝 비쳐 보이는 유리 효과를 연출합니다. `.glass`, `.glass-strong`, `.glass-light` 세 단계로 강도를 구분해 레이어 계층을 표현합니다.
- **컬러 토큰**: 전체 색상은 `src/index.css`의 CSS 커스텀 프로퍼티(`--primary: hsl(185 72% 42%)`)로 정의하고, Tailwind `@theme inline`으로 유틸리티 클래스와 연결합니다. 한 곳만 바꾸면 전체 테마가 반영되는 구조입니다.

```
배경 블롭 (cyan/purple)
  └─ .glass-strong 사이드바 (backdrop-filter: blur(24px))
       └─ .glass 카드 (backdrop-filter: blur(20px))
            └─ .glass-light 내부 칩 (backdrop-filter: blur(12px))
```

### 상태 설계 (State Design)

모든 비동기 UI는 로딩 → 정상 → 오류 → 빈 상태 네 가지를 명시적으로 처리합니다.

| 상태           | 구현 방법                                                                  | 이유                                                 |
| -------------- | -------------------------------------------------------------------------- | ---------------------------------------------------- |
| **로딩**       | `Skeleton` 컴포넌트로 실제 카드 레이아웃과 동일한 형태의 플레이스홀더 표시 | 레이아웃 점프 방지, 체감 속도 개선                   |
| **오류**       | 에러 코드(예: `DATABASE_UNAVAILABLE`) + 한국어 메시지 + 다시 시도 버튼     | 개발자와 사용자 모두 원인을 파악할 수 있도록         |
| **빈 상태**    | 맥락에 맞는 안내 문구 + 바로 이어지는 CTA 버튼                             | 사용자가 다음 행동을 즉시 알 수 있도록               |
| **AI 생성 중** | 인디케이터 진행 바(indeterminate) + 예상 소요 시간 안내                    | 10~60초짜리 작업에서 이탈 방지 — Nielsen의 10초 규칙 |

### 시각적 정보 구조

**채용공고 카드**는 빠른 스캐닝을 위해 정보를 다층으로 설계했습니다.

```
┌─ [status accent bar] ─────────────────────────────────┐
│  [플랫폼 뱃지]  [지원 상태 뱃지]          [날짜] [↗]  │
│  ▸ 회사명                                              │
│  제목 (hover → teal)                                   │
│  ┌─ 장소 · 경력 · 마감 · 연봉 ─────────────────────┐  │
│  └───────────────────────────────────────────────────┘  │
│  [기술 스택 태그 최대 5개] [+N]                        │
└───────────────────────────────────────────────────────┘
```

- **좌측 accent bar**: 지원 상태(저장/지원/면접/오퍼/불합격)를 색상으로 구분해 뱃지 텍스트를 읽지 않아도 시각적 스캔이 가능합니다.
- **stretch link 패턴**: `<h3>` 안의 링크에 `after:absolute after:inset-0`을 적용해 카드 전체가 클릭 가능하면서, 내부 외부 링크 버튼의 클릭 영역은 독립적으로 유지합니다(`relative z-10`).
- **기술 태그 5개 제한**: 카드가 태그로 넘치지 않도록 상위 5개만 표시하고 나머지는 `+N`으로 요약합니다.

### 탐색 설계

**사이드바**는 단순 아이콘+레이블 조합 대신 각 항목에 한 줄 설명을 추가해 처음 방문하는 사용자의 탐색 비용을 줄입니다.

```
● 채용공고          ← label
  저장한 채용공고 관리  ← description (discoverability)
```

활성 항목은 `bg-primary/15 border border-primary/20`으로 강조하고, `ChevronRight` 아이콘이 `translateX(-1px) opacity-0 → 0 opacity-100`으로 전환되어 선택 상태를 동적으로 피드백합니다.

### 피드백 인터랙션

| 요소               | 피드백                      | 구현                                    |
| ------------------ | --------------------------- | --------------------------------------- |
| 카드 hover         | 2px 위로 이동 + 그림자 강화 | `.glass-hover` CSS 클래스               |
| 버튼 클릭          | 3% 축소                     | `active:scale-[0.97]`                   |
| 페이지 진입        | 아래에서 위로 페이드인      | `@keyframes fade-in` `.animate-fade-in` |
| 사이드바 항목 진입 | 왼쪽에서 슬라이드인         | `.animate-slide-in`                     |
| AI 생성 대기       | 좌우 이동 진행 바           | `@keyframes indeterminate-progress`     |

모든 전환은 `250–300ms ease` 범위로 제한해, 빠른 작업 흐름을 방해하지 않으면서도 상태 변화를 인지할 수 있는 속도를 유지합니다.

### 접근성

- 모든 아이콘 전용 버튼(`size="icon"`)에 `<span className="sr-only">` 레이블을 추가합니다.
- `:focus-visible` 링 스타일로 키보드 사용자의 포커스 위치를 항상 가시화합니다.
- 외부 링크(`<a target="_blank">`)에 `rel="noreferrer"` + `title` 속성을 부여합니다.
- 배경 장식 요소(블롭, accent bar 등)는 `aria-hidden="true"`로 스크린 리더에서 제외합니다.

### 모바일 대응

데스크톱 사이드바는 모바일에서 오버레이 드로어로 전환됩니다. 드로어 외부 영역 탭(반투명 오버레이)으로 닫을 수 있으며, 네비게이션 항목 클릭 시 자동으로 닫힙니다(`onClose` prop). 헤더 우상단에 아바타를 배치해 현재 로그인 계정을 항상 확인할 수 있습니다.

---

## 기능

- **Google OAuth 로그인** — `/login`에서 Google 계정으로 인증, `/auth/callback`에서 세션 사용자 확인
- **인증 상태 관리** — HttpOnly 세션 쿠키로 API 인증, Zustand로 현재 사용자 정보 관리
- **보호된 라우트** — 미인증 사용자는 로그인 페이지로 리다이렉트, 이후 원래 경로로 복귀
- **구직 활동 관리** — `/job-search-groups`에서 구직 라운드 생성·수정·종료·삭제, 진행 중/지난 활동 분리 조회
- **채용공고 목록** — `/job-postings`에서 저장한 채용공고를 카드 형태로 조회하고 구직 활동 그룹별로 필터링
- **채용공고 추가** — `/job-postings/new`에서 URL 입력으로 공고를 추출하고 현재 또는 선택한 구직 활동 그룹에 저장
- **채용공고 상세** — `/job-postings/:id`에서 저장된 공고의 상세 추출 정보를 조회하고, 메모를 작성·수정하며, 지원 자료(자기소개서 문항·이력서 요약·면접 예상 질문)를 AI로 생성
- **커리어 프로필** — `/profile`에서 경력·기술·자격 등 프로필 정보를 작성·수정 (지원 전략 분석의 입력 데이터)
- **지원 전략 (Application Strategist)** — `/strategist`에서 저장한 채용공고를 AI로 분석해 적합도·우선순위·다음 액션을 제안받고, 제안된 액션(상태 변경·그룹 이동·메모 저장 등)을 바로 적용
- **AI 채팅 어시스턴트** — 모든 인증 페이지 우하단의 플로팅 버튼으로 AI 어시스턴트를 열어 구직 활동 관련 질문을 한국어로 대화

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

단일 테스트 파일 실행:

```bash
pnpm vitest run src/path/to/file.test.tsx
```

커밋 전 기본 검증:

```bash
pnpm lint:fix
pnpm build
```

동작이 변경된 경우 `pnpm test`, 라우팅·브라우저 흐름이 변경된 경우 `pnpm test:e2e`를 추가로 실행하세요.

---

## 아키텍처

### 데이터 흐름

```
pages/          ← 라우트 단위 화면 (상태 조합 + 사용자 이벤트 처리)
  └─ services/  ← API 호출 (fetchWithApiRetry → Zod 검증 → ApiError 변환)
  └─ store/     ← 인증 전역 상태 (Zustand, localStorage 영속)
  └─ utils/     ← 순수 유틸 (날짜 포맷, URL 안전성 검사 등)
components/     ← 레이아웃 + 재사용 UI 프리미티브
```

### 인증

- 백엔드 세션 쿠키 기반. `fetchWithApiRetry`가 모든 요청에 `X-Career-OS-Client: web` 헤더를 자동으로 추가합니다.
- `useAuthStore`는 현재 사용자 정보를 `localStorage`에 영속합니다. 로그아웃 시 반드시 `resetAuthStore()`를 호출해 메모리 상태와 스토리지를 함께 초기화하세요 (`clearAuth()`는 메모리만 초기화합니다).

### API 응답 검증

모든 서비스 함수는 `src/services/schemas.ts`의 Zod v4 스키마로 응답을 검증합니다. 계약 불일치 시 `ApiError(code: CLIENT_CONTRACT_MISMATCH)`가 발생합니다. 새 서비스 함수 추가 시 이 패턴을 그대로 따르세요.

### ChatKit 어시스턴트

- `ChatKitFloatingAssistant`는 `AppLayout` 안에 마운트되며, 첫 열림 시 `<ChatKit>` 임베드를 로드한 뒤 CSS로 숨겨 상태를 유지합니다 (닫아도 스레드가 사라지지 않음).
- `chatKitFetch`는 스트리밍 응답이므로 `fetchWithApiRetry`를 우회합니다.

### 프로덕션 배포 (Vercel)

`vercel.json`에 Content Security Policy가 설정되어 있습니다. 새 외부 리소스(CDN, iframe 등)를 추가할 때는 반드시 해당 도메인을 CSP 허용 목록에도 추가하세요.
