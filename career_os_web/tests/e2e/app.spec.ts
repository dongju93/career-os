import { expect, test } from '@playwright/test';

test('redirects unauthenticated visitors to the login page', async ({
  page,
}) => {
  await page.goto('/tooling');

  await expect(
    page.getByRole('heading', {
      name: /sign in to your account/i,
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login\?next=%2Ftooling$/);
  await expect(
    page.getByRole('button', { name: /continue with google/i }),
  ).toBeVisible();
});
