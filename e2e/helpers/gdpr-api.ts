import type { APIRequestContext, Page } from '@playwright/test'

export const E2E_API_BASE = (process.env.PLAYWRIGHT_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
export const E2E_API_URL = `${E2E_API_BASE}/api/`
export const E2E_PASSWORD = 'Fotoce2026'

export const E2E_USERS = {
  export: 'gdpr.export@fotoce.test',
  delete: 'gdpr.delete@fotoce.test',
  teen: 'gdpr.teen@fotoce.test',
} as const

export type AuthTokens = { access: string; refresh: string }

export async function loginUser(
  request: APIRequestContext,
  email: string,
  password = E2E_PASSWORD,
): Promise<AuthTokens> {
  const res = await request.post(`${E2E_API_URL}auth/login/`, {
    data: { email, password },
  })
  if (!res.ok()) {
    throw new Error(`login failed (${res.status()}): ${await res.text()}`)
  }
  const body = (await res.json()) as { access?: string; refresh?: string }
  if (!body.access) {
    throw new Error('login response missing access token')
  }
  return { access: body.access, refresh: body.refresh || 'e2e-refresh-token' }
}

export async function seedAuthInPage(
  page: Page,
  tokens: AuthTokens,
  request?: APIRequestContext,
): Promise<void> {
  let me: Record<string, unknown> | null = null
  if (request) {
    const res = await request.get(`${E2E_API_URL}me/`, { headers: await authHeaders(tokens) })
    if (res.ok()) {
      me = (await res.json()) as Record<string, unknown>
    }
  }

  await page.addInitScript((payload) => {
    window.localStorage.setItem('fotoce_token', payload.access)
    window.localStorage.setItem('fotoce_refresh_token', payload.refresh)
    window.localStorage.setItem('fotoce_cookie_consent_decided', '1')
    window.localStorage.setItem(
      'fotoce_cookie_consent_v1',
      JSON.stringify({ necessary: true, analytics: false, decidedAt: new Date().toISOString() }),
    )
    window.localStorage.setItem('fotoce_analytics_consent', 'denied')
    if (payload.me) {
      window.localStorage.setItem('fotoce_me_payload_v1', JSON.stringify(payload.me))
    }
  }, { ...tokens, me })
}

export async function resetCookieConsent(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.removeItem('fotoce_cookie_consent_v1')
    window.localStorage.removeItem('fotoce_cookie_consent_decided')
    window.localStorage.removeItem('fotoce_analytics_consent')
    window.localStorage.removeItem('fotoce_analytics_opt_out')
    window.localStorage.removeItem('fotoce_analytics_once_landing_viewed')
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) void reg.unregister()
      })
    }
  })
}

export async function authHeaders(tokens: AuthTokens): Promise<Record<string, string>> {
  return {
    Authorization: `Bearer ${tokens.access}`,
    'Content-Type': 'application/json',
  }
}

export async function requestDataExport(
  request: APIRequestContext,
  tokens: AuthTokens,
): Promise<{ job_id: number; status: string; download_token?: string; expires_at: string }> {
  const res = await request.post(`${E2E_API_URL}account/export-data/`, {
    headers: await authHeaders(tokens),
    data: {},
  })
  if (!res.ok()) {
    throw new Error(`export-data failed (${res.status()}): ${await res.text()}`)
  }
  return (await res.json()) as {
    job_id: number
    status: string
    download_token?: string
    expires_at: string
  }
}

export async function downloadExportZip(
  request: APIRequestContext,
  downloadToken: string,
): Promise<{ status: number; contentType: string; bytes: Buffer }> {
  const res = await request.get(`${E2E_API_URL}account/export-download/${downloadToken}/`)
  const bytes = Buffer.from(await res.body())
  return {
    status: res.status(),
    contentType: res.headers()['content-type'] || '',
    bytes,
  }
}

export async function cancelAccountDeletion(
  request: APIRequestContext,
  tokens: AuthTokens,
): Promise<void> {
  await request.post(`${E2E_API_URL}me/account-deletion/cancel/`, {
    headers: await authHeaders(tokens),
    data: {},
  })
}

export async function patchBirthDate(
  request: APIRequestContext,
  tokens: AuthTokens,
  birthDate: string,
): Promise<{ status: number; body: unknown }> {
  const res = await request.patch(`${E2E_API_URL}me/`, {
    headers: await authHeaders(tokens),
    data: { birth_date: birthDate },
  })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = await res.text()
  }
  return { status: res.status(), body }
}

export async function attemptTeenPinPublish(
  request: APIRequestContext,
  tokens: AuthTokens,
  userId: number,
): Promise<number> {
  const res = await request.post(`${E2E_API_URL}pins/`, {
    headers: {
      Authorization: `Bearer ${tokens.access}`,
    },
    multipart: {
      title: 'E2E teen foto',
      description: '',
      topic: 'General',
      visibility: 'public',
      is_story: 'false',
      author: String(userId),
    },
  })
  return res.status()
}

export async function fetchMeUserId(request: APIRequestContext, tokens: AuthTokens): Promise<number> {
  const res = await request.get(`${E2E_API_URL}me/`, {
    headers: await authHeaders(tokens),
  })
  const body = (await res.json()) as { id: number }
  return body.id
}
