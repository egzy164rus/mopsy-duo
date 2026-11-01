/** api.js — тонкая обёртка над fetch: токен, идемпотентность, понятные ошибки. */

const TOKEN_KEY = 'mopsy_session';

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* приватный режим — играем без сохранения */
  }
};

export class ApiError extends Error {
  constructor(message, { status, code, retryIn } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryIn = retryIn;
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Нет связи с сервером. Проверьте интернет 🐾', { status: 0 });
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new ApiError(data?.error || 'Что-то пошло не так', {
      status: res.status,
      code: data?.code,
      retryIn: data?.retryIn,
    });
  }
  return data;
}

/** Уникальный ключ запроса — защита от двойных тапов и повторной отправки. */
export const idempotencyKey = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export const api = {
  register: (payload) => request('/api/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: payload }),
  telegram: (initData) => request('/api/auth/telegram', { method: 'POST', body: { initData } }),
  demo: (who) => request('/api/auth/demo', { method: 'POST', body: { who } }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  bootstrap: (invite) => request(`/api/bootstrap${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`),

  createPet: (payload) => request('/api/pets', { method: 'POST', body: payload }),
  joinPet: (code) => request('/api/pets/join', { method: 'POST', body: { code } }),

  action: (petId, type) =>
    request(`/api/pets/${petId}/action`, { method: 'POST', body: { type, idempotencyKey: idempotencyKey() } }),
  game: (petId, game, score) =>
    request(`/api/pets/${petId}/game`, {
      method: 'POST',
      body: { game, score, idempotencyKey: idempotencyKey() },
    }),
  buy: (petId, itemId) => request(`/api/pets/${petId}/buy`, { method: 'POST', body: { itemId } }),
  equip: (petId, itemId) => request(`/api/pets/${petId}/equip`, { method: 'POST', body: { itemId } }),
  room: (petId, roomId) => request(`/api/pets/${petId}/room`, { method: 'POST', body: { roomId } }),
  claimTask: (petId, taskId) => request(`/api/pets/${petId}/task`, { method: 'POST', body: { taskId } }),
  readNotifications: (petId) => request(`/api/pets/${petId}/read`, { method: 'POST', body: {} }),
};
