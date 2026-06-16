import { test, expect } from '@playwright/test'

const TEST_EMAIL = 'ux.funnel.e2e@fotoce.test'
const TEST_PASSWORD = 'Fotoce42!'
const TEST_OTP = '123456'
const PIN_SLUG = 'e2e-first-pin'
const FAKE_ACCESS = 'fake-access'
const FAKE_REFRESH = 'fake-refresh'

/** PNG 1×1 px — passe la modération locale sans blocage. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

function buildMePayload(onboardingCompleted: boolean) {
  return {
    id: 42,
    username: 'e2euser',
    email: TEST_EMAIL,
    birth_date: '1990-06-15',
    onboarding_completed_at: onboardingCompleted ? '2026-06-06T00:00:00Z' : null,
  }
}

async function resetConsentState(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('fotoce_flag_onboarding_v2', '1')
    localStorage.removeItem('fotoce_cookie_consent_v1')
    localStorage.removeItem('fotoce_cookie_consent_decided')
    localStorage.removeItem('fotoce_analytics_consent')
    localStorage.removeItem('fotoce_analytics_opt_out')
    localStorage.removeItem('fotoce_analytics_once_landing_viewed')
  })
}

async function clearAuthStorageOnce(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    localStorage.removeItem('fotoce_me_payload_v1')
    localStorage.removeItem('fotoce_token')
    localStorage.removeItem('fotoce_refresh_token')
  })
}

async function acceptCookiesIfVisible(page: import('@playwright/test').Page) {
  const banner = page.getByTestId('cookie-consent-banner')
  if (await banner.isVisible().catch(() => false)) {
    await page.getByTestId('cookie-consent-accept').click()
    await expect(banner).toBeHidden()
  }
}

test.describe('UX funnel — invité → register → OTP → onboarding → first_pin', () => {
  test('parcours complet avec assertions UX visibles', async ({ page }) => {
    test.setTimeout(120_000)
    let onboardingCompleted = false

    await resetConsentState(page)

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
          body: JSON.stringify({ access: FAKE_ACCESS, refresh: FAKE_REFRESH }),
        })
        return
      }
      if (url.includes('auth/token/refresh/') && method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ access: FAKE_ACCESS, refresh: FAKE_REFRESH }),
        })
        return
      }
      if (url.includes('me/') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildMePayload(onboardingCompleted)),
        })
        return
      }
      if (url.includes('me/') && method === 'PATCH') {
        onboardingCompleted = true
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildMePayload(true)),
        })
        return
      }
      if (url.includes('users/follow-suggestions/') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ results: [] }),
        })
        return
      }
      if (url.includes('profiles/') && url.includes('/follow/') && method === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
        return
      }
      if (url.includes('fotos/topics/') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ name: 'Design', originalName: 'Design', icon: 'palette' }]),
        })
        return
      }
      if (url.endsWith('fotos/') && method === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 9001,
            slug: PIN_SLUG,
            title: 'Mon premier foto E2E',
            topic: 'Design',
            image: '/media/e2e/pin.png',
            author_profile: { id: 42, username: 'e2euser', display_name: 'E2E User' },
            likes_count: 0,
            saves_count: 0,
          }),
        })
        return
      }
      if (method === 'GET' && /pins(\/|$|\?)/.test(url) && !url.includes(`fotos/${PIN_SLUG}`)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ results: [], next: null, count: 0 }),
        })
        return
      }
      if (url.includes(`fotos/${PIN_SLUG}/`) && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 9001,
            slug: PIN_SLUG,
            title: 'Mon premier foto E2E',
            topic: 'Design',
            image: '/media/e2e/pin.png',
            author_profile: { id: 42, username: 'e2euser', display_name: 'E2E User' },
            liked: false,
            saved: false,
            stats: { reactions: 0 },
          }),
        })
        return
      }
      await route.continue()
    })

    // ── Landing invité ──
    await page.goto('/')
    await clearAuthStorageOnce(page)
    await page.reload()
    await acceptCookiesIfVisible(page)
    await expect(page.getByTestId('landing-social-proof')).toBeVisible()
    await expect(page.getByTestId('landing-social-proof')).toContainText(/12[\s\u00a0]?000|12,000/i)

    // ── Register ──
    await page.goto('/register')
    await expect(page.getByTestId('register-social-proof')).toBeVisible()
    await page.getByTestId('register-email').fill(TEST_EMAIL)
    await page.locator('#register-password input, [data-testid="register-password"] input').first().fill(TEST_PASSWORD)
    await page.getByRole('checkbox').check()
    await page.getByTestId('register-submit').click()

    // ── OTP ──
    await expect(page).toHaveURL(/verify-otp/)
    await page.getByTestId('otp-input').fill(TEST_OTP)
    await page.getByTestId('otp-submit').click()
    await expect(page).not.toHaveURL(/verify-otp/, { timeout: 20_000 })

    await page.goto('/onboarding')
    await acceptCookiesIfVisible(page)
    await expect(page.getByTestId('onboarding-interest-design')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('onboarding-interest-design').click()
    await page.getByTestId('onboarding-interest-photography').click()
    await expect(page.getByTestId('onboarding-progress')).toBeVisible()
    await expect(page.getByText('(2/2+)')).toBeVisible()
    await page.getByTestId('onboarding-continue').click()

    await expect(page.getByRole('button', { name: /Passer|Skip/i })).toBeVisible()
    await page.getByRole('button', { name: /Passer|Skip/i }).click()

    await expect(page.getByTestId('onboarding-continue')).toBeEnabled()
    await page.getByTestId('onboarding-continue').click()

    await expect(page).toHaveURL(/\/(\?|$)/, { timeout: 15_000 })

    // ── Création du premier foto ──
    await page.goto('/create')
    await expect(page.getByTestId('create-foto-title')).toBeVisible()

    await page.getByTestId('create-foto-file').setInputFiles({
      name: 'foto.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    })

    await page.getByTestId('create-foto-title').fill('Mon premier foto E2E')
    await page.getByTestId('create-foto-category').fill('Design')

    await expect(page.getByTestId('create-foto-next')).toBeEnabled({ timeout: 20_000 })
    await page.getByTestId('create-foto-next').click()

    await expect(page.getByTestId('create-foto-publish')).toBeEnabled({ timeout: 15_000 })
    await page.getByTestId('create-foto-publish').click()

    await expect(page.getByRole('status')).toContainText(/publié|published/i, { timeout: 15_000 })
    await expect(page).toHaveURL(new RegExp(`foto=${PIN_SLUG}|/foto/${PIN_SLUG}`), { timeout: 15_000 })
  })
})
