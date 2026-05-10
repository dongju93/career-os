import { expect, test } from '@playwright/test';

test('redirects unauthenticated visitors to the login page', async ({
  page,
}) => {
  await page.route('https://career-os.fastapicloud.dev/v1/auth/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/problem+json',
      body: JSON.stringify({
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        detail: '인증이 필요합니다',
        instance: '/v1/auth/me',
      }),
    }),
  );

  await page.goto('/job-postings');

  await expect(
    page.getByRole('heading', {
      name: /^Career OS$/,
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login\?next=%2Fjob-postings$/);
  await expect(
    page.getByRole('button', { name: /Google로 계속하기/ }),
  ).toBeVisible();
});
