import { test, expect } from '@playwright/test'

const PIN_SLUG = 'e2e-test-pin'
const TEST_EMAIL = 'guest.e2e@pinova.test'
const TEST_PASSWORD = 'Pinova42'
const TEST_OTP = '123456'

test.describe('conversion invité → register → OTP → like restauré', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url()
      const method = route.request().method()

      if (url.includes('auth/registration/') && method === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' })
        return
      }
      if (url.includes('verify-otp/') && method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ access: 'fake-access', refresh: 'fake-refresh' }),
        })
        return
      }
      if (url.includes(`pins/${PIN_SLUG}/`) && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            slug: PIN_SLUG,
            title: 'E2E Pin',
            liked: false,
            saved: false,
            stats: { reactions: 0 },
          }),
        })
        return
      }
      if (url.includes(`pins/${PIN_SLUG}/like/`) && method === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
        return
      }
      if (url.includes('me/') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 42,
            username: 'guest',
            email: TEST_EMAIL,
            onboarding_completed_at: '2026-01-01T00:00:00Z',
          }),
        })
        return
      }
      await route.continue()
    })

    await page.addInitScript((slug) => {
      sessionStorage.setItem(
        'pinova-pending-intent',
        JSON.stringify({
          id: 'e2e-intent',
          type: 'like',
          resourceId: slug,
          metadata: { pinSlug: slug, returnPath: `/pin/${slug}` },
          createdAt: Date.now(),
        }),
      )
    }, PIN_SLUG)
  })

  test('guest like → register → OTP → replay succès', async ({ page }) => {
    await page.goto('/register')

    await page.getByTestId('register-email').fill(TEST_EMAIL)
    await page.locator('#register-password input, [data-testid="register-password"] input').first().fill(TEST_PASSWORD)
    await page.getByRole('checkbox').check()
    await page.getByTestId('register-submit').click()

    await expect(page).toHaveURL(/verify-otp/)
    await page.getByTestId('otp-input').fill(TEST_OTP)
    await page.getByTestId('otp-submit').click()

    await expect(page.getByText(/Action restaurée|Action restored/i)).toBeVisible({ timeout: 15000 })
  })
})
