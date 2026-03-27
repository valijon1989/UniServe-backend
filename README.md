# UniServe Backend

## Socket.IO

Development connection note:

- URL: `http://localhost:5001`
- Path: `/ws`
- Client version: `v4`
- Auth methods:
  - `Authorization: Bearer <accessToken>`
  - query `token=<accessToken>`
  - auth payload `{ "token": "<accessToken>" }`

## Skriptlar

`coverImageUrl` bo'sh (yoki placeholder bo'lib qolgan) `Product` va `Service` hujjatlarida `images[0]` asosida `coverImageUrl` (va kerak bo'lsa `coverImage`) ni to'ldirish:

```bash
npm run backfill:cover-images
```

`source.unsplash.com` va beqaror random URLlarni tozalash, `images[0]` ni `coverImageUrl`ga yozish (rasm topilmasa deterministik barqaror URL yaratadi):

```bash
npm run fix:listings-images
```
