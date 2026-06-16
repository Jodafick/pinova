import { execSync } from 'node:child_process'
import path from 'node:path'
import { test, expect } from '@playwright/test'
import {
  E2E_USERS,
  cancelAccountDeletion,
  downloadExportZip,
  fetchMeUserId,
  loginUser,
  patchBirthDate,
  attemptTeenPinPublish,
  resetCookieConsent,
  seedAuthInPage,
} from './helpers/gdpr-api'

async function routePosthogCapture(page: import('@playwright/test').Page, captures: string[]) {
  await page.route('**/capture/**', async (route) => {
    captures.push(route.request().postData() || '')
    await route.fulfill({ status: 200, body: '{"status":1}' })
  })
}

async function dismissAlertModal(page: import('@playwright/test').Page) {
  const dialogOk = page.getByRole('dialog').getByRole('button', { name: /^OK$/i })
  if (await dialogOk.isVisible({ timeout: 3000 }).catch(() => false)) {
    await dialogOk.click()
    return
  }
  const alertOk = page.getByRole('button', { name: /^OK$/i })
  if (await alertOk.isVisible({ timeout: 2000 }).catch(() => false)) {
    await alertOk.click()
  }
}

function resetE2eGdprState() {
  const backendDir = path.join(process.cwd(), '..', 'fotoce-backend')
  execSync('python manage.py seed_e2e_gdpr_users', {
    cwd: backendDir,
    env: { ...process.env, CELERY_TASK_ALWAYS_EAGER: 'True' },
    stdio: 'pipe',
  })
}

test.describe('RGPD — flux réels (API locale, sans mocks métier)', () => {
  test.use({ baseURL: 'http://localhost:5175' })
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(() => {
    resetE2eGdprState()
  })

  test('bannière cookies → consent API → PostHog opt-in', async ({ page }) => {
    const captures: string[] = []
    await routePosthogCapture(page, captures)
    await resetCookieConsent(page)

    const consentRequest = page.waitForResponse(
      (res) => res.url().includes('/api/account/consent/') && res.request().method() === 'POST',
    )

    await page.goto('/')
    await expect(page.getByTestId('cookie-consent-banner')).toBeVisible()
    await page.getByTestId('cookie-consent-accept').click()
    await expect(page.getByTestId('cookie-consent-banner')).toBeHidden()

    const consentRes = await consentRequest
    expect(consentRes.status()).toBe(200)
    const consentBody = (await consentRes.json()) as { analytics?: boolean }
    expect(consentBody.analytics).toBe(true)

    const consent = await page.evaluate(() => window.localStorage.getItem('fotoce_analytics_consent'))
    expect(consent).toBe('granted')

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const api = (window as unknown as { __fotoceAnalyticsTest?: { isAnalyticsEnabled: () => boolean } })
            .__fotoceAnalyticsTest
          return api?.isAnalyticsEnabled?.() ?? false
        }),
      )
      .toBe(true)

    await page.evaluate(() => {
      ;(
        window as unknown as { __fotoceAnalyticsTest?: { trackEvent: (e: string, p?: object) => void } }
      ).__fotoceAnalyticsTest?.trackEvent('landing_viewed', { path: '/', page: 'home_landing' })
    })

    await expect.poll(() => captures.length, { timeout: 10_000 }).toBeGreaterThan(0)
    expect(captures.some((body) => body.includes('landing_viewed'))).toBe(true)
  })

  test('export données — UI → POST → e-mail (202) → ZIP 24h', async ({ page, request }) => {
    resetE2eGdprState()
    const tokens = await loginUser(request, E2E_USERS.export)
    await seedAuthInPage(page, tokens, request)

    await page.goto('/settings/settings-danger')
    const exportBtn = page.getByTestId('settings-export-data')
    await expect(exportBtn).toBeVisible({ timeout: 30_000 })
    await expect(exportBtn).toBeEnabled()

    const [exportRes] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/account/export-data/') && res.request().method() === 'POST',
      ),
      exportBtn.click(),
    ])
    expect(exportRes.status()).toBe(202)
    const exportBody = (await exportRes.json()) as {
      job_id: number
      status: string
      download_token?: string
      message?: string
    }
    expect(exportBody.message).toMatch(/e-mail|email/i)
    expect(exportBody.download_token).toBeTruthy()

    await dismissAlertModal(page)

    const zip = await downloadExportZip(request, exportBody.download_token!)
    expect(zip.status).toBe(200)
    expect(zip.contentType).toContain('zip')
    expect(zip.bytes.slice(0, 2).toString('hex')).toBe('504b')
    expect(zip.bytes.length).toBeGreaterThan(100)
  })

  test('mineur < 13 rejeté, 13–17 publication bloquée', async ({ request }) => {
    const adultTokens = await loginUser(request, E2E_USERS.export)
    const tooYoung = new Date()
    tooYoung.setFullYear(tooYoung.getFullYear() - 12)
    const under13 = await patchBirthDate(request, adultTokens, tooYoung.toISOString().slice(0, 10))
    expect(under13.status).toBe(400)
    await patchBirthDate(request, adultTokens, '1995-03-15')

    const teenTokens = await loginUser(request, E2E_USERS.teen)
    const teenId = await fetchMeUserId(request, teenTokens)
    const publishStatus = await attemptTeenPinPublish(request, teenTokens, teenId)
    expect(publishStatus).toBe(400)
  })

  test('suppression compte — confirmation → export optionnel → purge 30j', async ({ page, request }) => {
    resetE2eGdprState()
    const tokens = await loginUser(request, E2E_USERS.delete)
    await cancelAccountDeletion(request, tokens)
    await seedAuthInPage(page, tokens, request)

    await page.goto('/settings/settings-danger')
    const scheduleBtn = page.getByRole('button', { name: /Programmer la suppression|Schedule account deletion/i })
    await expect(scheduleBtn).toBeVisible({ timeout: 30_000 })
    await scheduleBtn.click()

    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: /^OK$/i }).click()

    const exportConfirm = dialog.getByRole('button', { name: /Confirmer|Confirm/i })
    if (await exportConfirm.isVisible({ timeout: 5000 }).catch(() => false)) {
      await exportConfirm.click()
    }

    await dialog.getByRole('textbox').fill('SUPPRIMER')

    const [deletionRes] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes('/api/me/account-deletion/request/') && res.request().method() === 'POST',
      ),
      dialog.getByRole('button', { name: /^OK$/i }).click(),
    ])

    expect(deletionRes.status()).toBe(200)
    const deletionBody = (await deletionRes.json()) as {
      scheduled_at?: string
      export_job_id?: number
    }
    expect(deletionBody.scheduled_at).toBeTruthy()

    const scheduledAt = new Date(deletionBody.scheduled_at!)
    const graceDays = (scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    expect(graceDays).toBeGreaterThan(29)
    expect(graceDays).toBeLessThan(31)

    await dismissAlertModal(page)
    await cancelAccountDeletion(request, tokens)
  })
})
