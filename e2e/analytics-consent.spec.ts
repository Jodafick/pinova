import { test, expect } from '@playwright/test'

async function resetConsentState(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.removeItem('pinova_cookie_consent_v1')
    localStorage.removeItem('pinova_cookie_consent_decided')
    localStorage.removeItem('pinova_analytics_consent')
    localStorage.removeItem('pinova_analytics_opt_out')
    localStorage.removeItem('pinova_analytics_once_landing_viewed')
    localStorage.removeItem('pinova_analytics_distinct_id')
  })
}

async function routePosthogCapture(page: import('@playwright/test').Page, captures: string[]) {
  await page.route('**/capture/**', async (route) => {
    captures.push(route.request().postData() || '')
    await route.fulfill({ status: 200, body: '{"status":1}' })
  })
}

async function fireTestLandingEvent(page: import('@playwright/test').Page) {
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const api = (window as unknown as { __pinovaAnalyticsTest?: { isAnalyticsEnabled: () => boolean } })
          .__pinovaAnalyticsTest
        return api?.isAnalyticsEnabled?.() ?? false
      }),
    )
    .toBe(true)
  await page.evaluate(() => {
    ;(
      window as unknown as {
        __pinovaAnalyticsTest?: { trackEvent: (e: string, p?: object) => void }
      }
    ).__pinovaAnalyticsTest?.trackEvent('landing_viewed', {
      path: '/',
      page: 'home_landing',
      signup_platform: 'web',
    })
  })
}

test.describe('Analytics — consentement cookies → PostHog opt-in/out', () => {
  test('nécessaires seuls — opt-out PostHog, pas de capture', async ({ page }) => {
    const captures: string[] = []
    await routePosthogCapture(page, captures)

    await resetConsentState(page)
    await page.goto('/')
    await expect(page.getByTestId('cookie-consent-banner')).toBeVisible()
    await page.getByTestId('cookie-consent-necessary').click()
    await expect(page.getByTestId('cookie-consent-banner')).toBeHidden()

    const consent = await page.evaluate(() => localStorage.getItem('pinova_analytics_consent'))
    const optOut = await page.evaluate(() => localStorage.getItem('pinova_analytics_opt_out'))
    expect(consent).toBe('denied')
    expect(optOut).toBe('1')

    await page.evaluate(() => {
      ;(window as unknown as { __pinovaAnalyticsTest?: { trackEvent: (e: string) => void } }).__pinovaAnalyticsTest?.trackEvent(
        'landing_viewed',
      )
    })
    await page.waitForTimeout(500)
    expect(captures).toHaveLength(0)
  })

  test('accepter analytics — opt-in PostHog, capture landing_viewed', async ({ page }) => {
    const captures: string[] = []
    await routePosthogCapture(page, captures)

    await resetConsentState(page)
    await page.goto('/')
    await expect(page.getByTestId('cookie-consent-banner')).toBeVisible()
    await page.getByTestId('cookie-consent-accept').click()
    await expect(page.getByTestId('cookie-consent-banner')).toBeHidden()

    const consent = await page.evaluate(() => localStorage.getItem('pinova_analytics_consent'))
    const optOut = await page.evaluate(() => localStorage.getItem('pinova_analytics_opt_out'))
    expect(consent).toBe('granted')
    expect(optOut).toBe('0')

    await fireTestLandingEvent(page)
    await expect.poll(() => captures.length, { timeout: 10_000 }).toBeGreaterThan(0)
    expect(captures.some((body) => body.includes('landing_viewed'))).toBe(true)
  })

  test('bascule opt-out après refus — rechargement sans capture', async ({ page }) => {
    const captures: string[] = []
    await routePosthogCapture(page, captures)

    await resetConsentState(page)
    await page.goto('/')
    await page.getByTestId('cookie-consent-accept').click()
    await fireTestLandingEvent(page)
    await expect.poll(() => captures.length).toBeGreaterThan(0)

    captures.length = 0
    await page.evaluate(() => {
      ;(
        window as unknown as { __pinovaAnalyticsTest?: { setAnalyticsConsent: (g: boolean) => void } }
      ).__pinovaAnalyticsTest?.setAnalyticsConsent(false)
    })
    await page.evaluate(() => {
      ;(window as unknown as { __pinovaAnalyticsTest?: { trackEvent: (e: string) => void } }).__pinovaAnalyticsTest?.trackEvent(
        'landing_viewed',
      )
    })
    await page.waitForTimeout(500)
    expect(captures).toHaveLength(0)
  })
})
