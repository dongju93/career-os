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

| 라이브러리                   | 용도                     | 선정 이유                                                                                                           |
| ---------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **React 19**                 | UI 라이브러리            | 선언형 컴포넌트 기반 UI 작성. 생태계가 넓고 커뮤니티 지원이 활발해 프론트엔드 기반으로 적합                         |
| **TypeScript 7**             | 정적 타입 시스템         | 컴포넌트 props·상태·API 응답 계약을 타입으로 검증해 리팩터링 안정성과 IDE 지원을 높임                               |
| **Vite 8**                   | 개발 서버·번들러         | 빠른 HMR과 짧은 빌드 시간. ESM 네이티브 기반으로 개발 생산성이 높음                                                 |
| **Mantine 9**                | UI 컴포넌트 라이브러리   | Provider·테마 기반 의존성으로 유지. 실제 화면 primitive는 `src/components/ui/` 사용. 접근성과 커스터마이징 지원     |
| **React Router 7**           | 클라이언트 사이드 라우팅 | URL 기반 화면 전환·레이아웃 분리·인증 리다이렉트를 체계적으로 관리                                                  |
| **Zustand 5**                | 전역 상태 관리           | Context 대비 보일러플레이트가 적고 가벼움. `persist` 미들웨어로 현재 사용자 정보를 `localStorage`에 영속 저장       |
| **Tailwind CSS 4**           | 유틸리티 퍼스트 CSS      | 반복 CSS 작성을 줄이고 토큰 기반 UI를 빠르게 조합. `@tailwindcss/vite` 플러그인으로 별도 설정 파일 없이 Vite에 연동 |
| **React Compiler**           | 빌드 타임 최적화         | `babel-plugin-react-compiler`가 컴파일 단계에서 메모이제이션을 자동 처리해 수동 `useMemo`/`useCallback` 부담을 줄임 |
| **Biome**                    | 린터·포매터              | 포매팅과 정적 분석을 단일 도구로 처리. Rust 기반으로 속도가 빠르고 설정이 단순함                                    |
| **Vitest + Testing Library** | 단위·컴포넌트 테스트     | Vite와 궁합이 좋아 설정 없이 테스트 가능. 사용자 동작 중심 테스트 작성으로 신뢰성 높은 검증                         |
| **Playwright**               | E2E 브라우저 테스트      | 실제 사용자 시나리오(로그인·화면 이동 등)를 브라우저 수준에서 검증                                                  |

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
