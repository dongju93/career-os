import { expect, test } from '@playwright/test';

test('redirects unauthenticated visitors to the login page', async ({
  page,
}) => {
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
