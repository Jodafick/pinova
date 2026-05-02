export const API_BASE_URL = 'https://pinova-backend-4dt4.onrender.com';
export const API_URL = `${API_BASE_URL}/api/`;

/** Google OAuth — mêmes scopes que la console Google (userinfo + People : langue, anniversaire). */
export const GOOGLE_SIGN_IN_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/profile.language.read',
  'https://www.googleapis.com/auth/user.birthday.read',
].join(' ');
