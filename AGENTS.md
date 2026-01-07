# AGENTS Instructions

Backend uchun talablar (Codex yo‘riqnoma matni):

Auth: Har qanday xizmatdan foydalanish va chat uchun isAuthenticated tekshirilsin. Login bo‘lmasa 401 qaytarsin.
Agent verifikatsiya:
POST /api/agent/verification/request — telefon, mail, faceId, hujjat, uy manzili yuboriladi.
GET /api/agent/verification/status — pending/approved/rejected.
Agentlar ro‘yxati:
agents?type=local|international&sort=rating|new&filters=...&page=...&limit=3
Javobda: agents[] + total + page.
Xizmatdan foydalanish (eskrow):
POST /api/delivery/orders — agentId, price, currency, route, weight, deliveryType.
GET /api/delivery/orders/:id — holat va eskrow info.
Chat:
POST /api/chat/start — agentId + serviceContext.
GET /api/chat/threads — foydalanuvchi uchun chatlar.
POST /api/chat/messages — matn, threadId.
Nizo (dispute):
POST /api/disputes — orderId, message, evidence[].
GET /api/disputes/:id — holat.
Agent qulayliklari:
GET /api/agent/dashboard — active jobs, rating, payouts, verification status.
Real‑time:
ws://.../ws — chat va order statuslari uchun.
