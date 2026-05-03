export const API_BASE_URL = 'https://pinova-backend-4dt4.onrender.com';
export const API_URL = `${API_BASE_URL}/api/`;

/** Google OAuth — aligné backend : openid + userinfo.email + userinfo.profile uniquement. */
export const GOOGLE_SIGN_IN_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ')
