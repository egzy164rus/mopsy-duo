/**
 * realtime.js — минималистичный realtime-хаб на Server-Sent Events.
 *
 * Почему SSE, а не WebSocket: в MVP нужен только поток «сервер → клиент»,
 * а действия игроков идут обычными HTTP-запросами (это же даёт бесплатную
 * защиту от дублей и удобную обработку ошибок). SSE работает через любые
 * прокси, включая Telegram WebView, и не требует зависимостей.
 * Для продакшена предусмотрен переход на Supabase Realtime / Socket.IO
 * (см. docs/BACKEND.md) — интерфейс хаба совпадает.
 */

/** petId -> Map<userId, Set<res>> */
const rooms = new Map();

export function subscribe(petId, userId, res) {
  if (!rooms.has(petId)) rooms.set(petId, new Map());
  const room = rooms.get(petId);
  if (!room.has(userId)) room.set(userId, new Set());
  room.get(userId).add(res);

  return () => {
    const set = room.get(userId);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) room.delete(userId);
    if (room.size === 0) rooms.delete(petId);
  };
}

export const onlineIds = (petId) => [...(rooms.get(petId)?.keys() || [])];

export function send(res, event, payload) {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  } catch {
    /* соединение закрыто — чистится в on('close') */
  }
}

/**
 * Рассылка события всем подписчикам питомца.
 * payloadBuilder(userId) позволяет отдать каждому игроку персонализированный срез
 * (например, флаги «моё действие» и счётчик непрочитанных).
 */
export function broadcast(petId, event, payloadBuilder, { exceptUserId = null } = {}) {
  const room = rooms.get(petId);
  if (!room) return 0;
  let sent = 0;
  for (const [userId, set] of room.entries()) {
    if (exceptUserId && userId === exceptUserId) continue;
    const payload = typeof payloadBuilder === 'function' ? payloadBuilder(userId) : payloadBuilder;
    for (const res of set) {
      send(res, event, payload);
      sent += 1;
    }
  }
  return sent;
}

export const stats = () => ({
  pets: rooms.size,
  connections: [...rooms.values()].reduce((acc, room) => acc + [...room.values()].reduce((a, s) => a + s.size, 0), 0),
});

// heartbeat, чтобы прокси не рвали «тихое» соединение
setInterval(() => {
  for (const room of rooms.values()) {
    for (const set of room.values()) {
      for (const res of set) {
        try {
          res.write(': ping\n\n');
        } catch {
          /* ignore */
        }
      }
    }
  }
}, 25_000).unref?.();
