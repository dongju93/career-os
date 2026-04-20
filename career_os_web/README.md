# Career OS Web

`Career OS Web`은 React 기반 프런트엔드 애플리케이션입니다. 현재 저장소는 Vite 스타터를 바탕으로 구성되어 있고, 이후 화면 확장과 테스트 도입을 염두에 둔 패키지들이 함께 설치되어 있습니다.

이 문서는 현재 저장소의 `package.json`, `vite.config.ts`, `src/*` 기준으로 실제 설치 스택과 각 패키지의 역할을 정리합니다.

## 실행 방법

```bash
pnpm install
pnpm dev
```

자주 사용하는 명령:

```bash
pnpm build
pnpm preview
pnpm lint
pnpm lint:fix
pnpm format
pnpm test
pnpm test:e2e
```

Playwright 브라우저가 아직 없다면 처음 1회 아래 명령을 실행합니다.

```bash
pnpm exec playwright install chromium
```

## 스택 한눈에 보기

- 핵심 런타임: React, React DOM, TypeScript, Vite
- UI 확장 준비: Mantine, React Router, Zustand
- 스타일링 확장 준비: Tailwind CSS
- 코드 품질: Biome
- 빌드 최적화: React Compiler + Babel 연동
- 테스트 준비: Vitest, Testing Library, Playwright

## 현재 적용 상태

현재 코드에서 실제로 동작 중인 항목:

- `react`, `react-dom`
- `typescript`
- `vite`, `@vitejs/plugin-react`
- `@babel/core`, `@rolldown/plugin-babel`, `babel-plugin-react-compiler`
- `@biomejs/biome`
- `@mantine/core`, `@mantine/hooks`
- `react-router`
- `zustand`
- `tailwindcss`, `@tailwindcss/vite`
- `vitest`, `jsdom`
- `@testing-library/*`
- `@playwright/test`

현재 연결 방식:

- Mantine: `src/main.tsx`, `src/app/providers.tsx`, `src/app/theme.ts`
- React Router: `src/App.tsx`, `src/app/router.tsx`, `src/components/app-layout.tsx`
- Zustand: `src/store/workspace-store.ts`
- Tailwind CSS: `vite.config.ts`, `src/index.css`
- Vitest + Testing Library: `vite.config.ts`, `src/test/setup.ts`, `src/App.test.tsx`
- Playwright: `playwright.config.ts`, `tests/e2e/app.spec.ts`

## 패키지별 설명

### Runtime Dependencies

| 패키지           | 역할                               | 왜 사용하나                                                                                                      | 현재 상태 |
| ---------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------- |
| `react`          | 컴포넌트 기반 UI 라이브러리        | 선언형 UI 작성, 상태 기반 렌더링, 생태계 확장성이 좋아서 기본 프런트엔드 기반으로 적합합니다.                    | 사용 중   |
| `react-dom`      | React를 브라우저 DOM에 렌더링      | `src/main.tsx`에서 React 앱을 실제 브라우저 DOM에 마운트하기 위해 필요합니다.                                    | 사용 중   |
| `@mantine/core`  | Mantine UI 컴포넌트 모음           | 버튼, 폼, 모달 같은 공통 UI를 직접 전부 만들지 않고 빠르게 일관된 화면을 구성하기 좋습니다.                      | 사용 중   |
| `@mantine/hooks` | Mantine에서 제공하는 React 훅 모음 | UI 상태, DOM 이벤트, 브라우저 API 연동 같은 반복 코드를 줄이기 좋고 `@mantine/core`와 함께 쓰기 좋습니다.        | 사용 중   |
| `react-router`   | 클라이언트 사이드 라우팅           | 단일 페이지 앱에서 URL 기반 화면 전환과 레이아웃 분리를 체계적으로 관리하기 위해 사용합니다.                     | 사용 중   |
| `zustand`        | 경량 전역 상태 관리                | Context보다 가볍고 보일러플레이트가 적어서 인증 상태, 필터, UI 상태 같은 전역 상태를 단순하게 관리하기 좋습니다. | 사용 중   |

### Build and Language Tooling

| 패키지                        | 역할                           | 왜 사용하나                                                                                              | 현재 상태 |
| ----------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------- | --------- |
| `vite`                        | 개발 서버와 번들러             | 빠른 HMR, 짧은 빌드 시간, 단순한 설정으로 프런트엔드 개발 생산성을 높입니다.                             | 사용 중   |
| `typescript`                  | 정적 타입 시스템               | 컴포넌트 props, 상태, 유틸 함수 계약을 타입으로 검증해 리팩터링 안정성과 IDE 지원을 높입니다.            | 사용 중   |
| `@vitejs/plugin-react`        | Vite의 React 공식 플러그인     | JSX/TSX 처리, React Fast Refresh, React 전용 빌드 통합을 담당합니다.                                     | 사용 중   |
| `@babel/core`                 | Babel 변환 엔진                | React Compiler를 빌드 파이프라인에 연결하려면 Babel 기반 변환 단계가 필요합니다.                         | 사용 중   |
| `@rolldown/plugin-babel`      | Vite/Rolldown용 Babel 플러그인 | `vite.config.ts`에서 Babel preset을 적용해 React Compiler가 실제 번들 과정에서 동작하도록 연결합니다.    | 사용 중   |
| `babel-plugin-react-compiler` | React Compiler 플러그인        | React 코드 최적화를 컴파일 단계에서 처리할 수 있게 해 주며, 수동 최적화 부담을 줄이는 방향의 선택입니다. | 사용 중   |
| `@types/babel__core`          | Babel용 TypeScript 타입 정의   | TypeScript 기반 설정 파일에서 Babel 옵션을 타입 안전하게 다루기 위해 필요합니다.                         | 사용 중   |
| `@types/node`                 | Node.js 타입 정의              | `vite.config.ts` 같은 Node 실행 환경 설정 파일에서 타입 지원을 제공합니다.                               | 사용 중   |
| `@types/react`                | React 타입 정의                | 함수형 컴포넌트, JSX 타입, 훅 관련 타입을 TypeScript에서 안전하게 사용하기 위해 필요합니다.              | 사용 중   |
| `@types/react-dom`            | React DOM 타입 정의            | DOM 마운트 API와 관련 타입을 TypeScript에서 정확히 다루기 위해 필요합니다.                               | 사용 중   |

### Styling and Code Quality

| 패키지              | 역할                           | 왜 사용하나                                                                                             | 현재 상태 |
| ------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------- | --------- |
| `@biomejs/biome`    | 포맷터 + 린터                  | 포맷팅과 정적 분석을 한 도구로 묶어 속도와 일관성을 확보할 수 있어 유지보수 비용이 낮습니다.            | 사용 중   |
| `tailwindcss`       | 유틸리티 퍼스트 CSS 프레임워크 | 반복적인 CSS 작성을 줄이고 토큰 기반 UI를 빠르게 조합할 수 있어 확장성 있는 스타일 시스템에 유리합니다. | 사용 중   |
| `@tailwindcss/vite` | Tailwind CSS용 Vite 플러그인   | Tailwind v4를 Vite 빌드 파이프라인에 자연스럽게 연결하기 위해 사용합니다.                               | 사용 중   |

참고:

- 현재 스타일은 Mantine 컴포넌트 + `src/index.css`, `src/App.css`의 CSS + Tailwind 유틸리티를 함께 사용합니다.
- Tailwind 관련 패키지는 `vite.config.ts`와 `src/index.css`에 연결되어 있습니다.

### Testing Stack

| 패키지                        | 역할                           | 왜 사용하나                                                                                        | 현재 상태 |
| ----------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------- | --------- |
| `vitest`                      | 단위/컴포넌트 테스트 러너      | Vite와 궁합이 좋고 실행 속도가 빨라 프런트엔드 테스트 기본 도구로 적합합니다.                      | 사용 중   |
| `jsdom`                       | 브라우저 유사 DOM 환경         | 실제 브라우저 없이도 컴포넌트를 렌더링하고 DOM 상호작용을 테스트할 수 있습니다.                    | 사용 중   |
| `@testing-library/react`      | React 컴포넌트 테스트 유틸리티 | 구현 상세보다 사용자가 보는 동작 중심으로 테스트를 작성하기 좋습니다.                              | 사용 중   |
| `@testing-library/dom`        | DOM 테스트 유틸리티            | DOM 질의와 assertion 보조 기능의 기반이 되는 패키지입니다.                                         | 사용 중   |
| `@testing-library/jest-dom`   | DOM assertion 확장             | `toBeInTheDocument`, `toHaveTextContent` 같은 가독성 높은 assertion을 추가합니다.                  | 사용 중   |
| `@testing-library/user-event` | 사용자 이벤트 시뮬레이션       | 단순 이벤트 dispatch보다 실제 사용자 입력 흐름에 가까운 상호작용 테스트를 작성할 수 있습니다.      | 사용 중   |
| `@playwright/test`            | E2E 브라우저 테스트            | 로그인, 폼 입력, 화면 이동 같은 실제 사용자 시나리오를 브라우저 수준에서 검증하기 위해 사용합니다. | 사용 중   |

참고:

- `package.json`에 `pnpm test`, `pnpm test:watch`, `pnpm test:e2e` 스크립트가 정의되어 있습니다.
- 단위 테스트는 `src/App.test.tsx`, E2E 테스트는 `tests/e2e/app.spec.ts`에 추가되어 있습니다.

## 왜 이런 조합인가

이 저장소의 현재 스택은 빠르게 개발을 시작하면서도 나중에 구조를 확장하기 쉽게 잡혀 있습니다.

- `React + TypeScript + Vite`는 빠른 개발 경험과 타입 안정성을 동시에 확보하는 기본 조합입니다.
- `Mantine + React Router + Zustand`는 UI, 라우팅, 전역 상태를 각각 명확히 분리해 애플리케이션 규모가 커져도 유지보수하기 쉽게 만듭니다.
- `Biome`은 코드 스타일과 린트 규칙을 한 번에 관리해 협업 시 불필요한 차이를 줄입니다.
- `React Compiler` 관련 설정은 성능 최적화를 컴파일 단계로 옮겨 장기적으로 컴포넌트 코드 부담을 줄이려는 선택입니다.
- `Vitest + Testing Library + Playwright`는 단위 테스트부터 브라우저 E2E까지 단계적으로 검증 범위를 넓힐 수 있는 구성입니다.

## 현재 구조

설치 스택이 현재 앱에서 어떻게 쓰이는지 요약하면 다음과 같습니다.

1. `src/main.tsx`에서 Mantine Provider와 전역 스타일을 연결합니다.
2. `src/App.tsx`와 `src/app/router.tsx`에서 React Router 기반 진입점을 구성합니다.
3. `src/components/app-layout.tsx`에서 Mantine `AppShell`과 `useDisclosure`를 사용합니다.
4. `src/store/workspace-store.ts`에서 Zustand 전역 상태를 관리합니다.
5. `src/index.css`와 JSX `className`에서 Tailwind 유틸리티를 사용합니다.
6. `src/App.test.tsx`와 `src/test/setup.ts`에서 Vitest + Testing Library를 사용합니다.
7. `playwright.config.ts`와 `tests/e2e/app.spec.ts`에서 Playwright E2E를 실행합니다.
