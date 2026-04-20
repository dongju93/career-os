import { expect, test } from '@playwright/test';

test('loads the overview route and opens the tooling page', async ({
  page,
}) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: /all installed packages are now wired into the app/i,
    }),
  ).toBeVisible();

  await page.getByRole('link', { name: /tooling/i }).click();

  await expect(
    page.getByRole('heading', {
      name: /each installed package now has a working entry point/i,
    }),
  ).toBeVisible();
});
