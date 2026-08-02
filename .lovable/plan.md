## الوضع التقني (مهم قبل البدء)

Cloudflare Stream **لا يسحب** البث من خادم Xtream. هو يستقبل فقط:
- **VOD**: رفع ملف أو `copy from URL` (يمكن تنفيذه بالكامل من داخل التطبيق).
- **Live**: دفع RTMPS/SRT إلى "Live Input" (يحتاج عملية `ffmpeg` تعمل خارج التطبيق على الـ VPS، عملية واحدة لكل قناة).

لذلك الحل ينقسم إلى: طبقة تكامل كاملة داخل التطبيق + عامل إعادة بث (restreamer) يعمل على VPS الحالي `tv.canarmodern.com`.

```text
Xtream (.ts)  ──ffmpeg──►  Cloudflare Live Input (RTMPS)  ──►  Stream HLS/DASH
     │                              ▲                                │
     └── fallback proxy ────────────┘ (تُدار من لوحة الأدمن)          ▼
                                                            مشغّل Nova TV
```

## ما سيتم بناؤه

### 1. قاعدة البيانات
جدول `cf_stream_assets`: يربط محتوى Xtream بـ Cloudflare.
- `kind` (live/movie/series), `xtream_id`, `cf_uid` (أو `live_input_id`),
  `playback_hls`, `playback_dash`, `status` (pending/ready/errored/live/idle),
  `last_seen_at`, `created_by`, `org_id`.
- RLS: قراءة للمستخدمين المصادَقين، كتابة للأدمن فقط + GRANT كاملة.
- جدول `cf_stream_events` لسجل التحويلات والأخطاء (مرتبط بـ `audit_logs` الحالي).

### 2. طبقة الخادم
- `src/lib/cloudflare-stream.server.ts`: عميل REST لـ Cloudflare (إنشاء live input، نسخ VOD من URL، حالة الأصل، حذف، توليد رابط تشغيل موقّع).
- `src/lib/cloudflare-stream.functions.ts`: دوال خادم محمية بـ `requireSupabaseAuth` + فحص دور admin:
  - `provisionLiveInput(channelId)` → ينشئ Live Input ويعيد مفتاح RTMPS للـ restreamer.
  - `ingestVodFromXtream(kind, id)` → يستخدم copy-from-URL مع رابط Xtream موقّع مؤقت.
  - `getAssetStatus`, `listAssets`, `removeAsset`.
- `src/routes/api/public/cf-stream-webhook.ts`: يستقبل webhooks الجاهزية/الحالة من Cloudflare مع تحقق توقيع HMAC (`Webhook-Signature`) قبل أي كتابة.
- `src/routes/api/public/cf-restreamer-config.ts`: يعيد لعامل الـ VPS قائمة القنوات ومفاتيح الدفع، محمي بـ Bearer token سري.

### 3. لوحة الأدمن
صفحة جديدة `/admin/cdn` بنفس نمط صفحات الأدمن الحالية:
- جدول الأصول مع الحالة الحية، أزرار "تفعيل على Cloudflare" / "إيقاف" لكل قناة أو فيلم.
- عرض RTMPS URL + Key للنسخ.
- مؤشر صحة الـ restreamer (آخر heartbeat).

### 4. التشغيل في المشغّل
`src/lib/device-playback.ts` و`src/routes/watch.$kind.$id.tsx`:
- إذا وُجد أصل Cloudflare بحالة `ready`/`live` → استخدم رابط HLS من Cloudflare مباشرة.
- غير ذلك → السلوك الحالي (بروكسي Xtream) دون أي تغيير.
لا يُحذف أي منطق قائم؛ Cloudflare يصبح مسارًا مفضّلًا فقط.

### 5. عامل إعادة البث (VPS)
- `infra/restreamer/` : سكربت Node/bash + `docker-compose` service.
- يسحب الإعدادات من `/api/public/cf-restreamer-config`، يشغّل `ffmpeg -i <xtream .ts> -c copy -f flv rtmps://...` لكل قناة مفعّلة، مع إعادة تشغيل تلقائي وheartbeat.
- توثيق في `docs/CLOUDFLARE_STREAM.md` يشمل التكلفة (Cloudflare يحاسب لكل دقيقة بث مخزّنة/مشاهدة) والحدود.

## الأسرار المطلوبة منك
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_STREAM_API_TOKEN` (صلاحية Stream:Edit)
- `CLOUDFLARE_STREAM_WEBHOOK_SECRET`
- `NOVA_RESTREAMER_TOKEN` (سأولّده تلقائيًا)

## تحذير التكلفة
البث المباشر عبر Cloudflare Stream يُحاسَب لكل دقيقة بث ولكل دقيقة مشاهدة. تشغيل مئات القنوات 24/7 سيكون مكلفًا جدًا. أنصح بتفعيله انتقائيًا لأهم القنوات فقط، وهو ما تسمح به لوحة `/admin/cdn` المقترحة.
