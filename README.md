# Egyptian Arabic Call Transcriber — نسخة التدقيق

تطبيق React + TypeScript مع خادم Express لتحليل المكالمات وتفريغها وتقييم جودة الخدمة.

## المتطلبات
- Node.js 22 أو إصدار LTS حديث متوافق.
- مفاتيح الخدمات التي ستستخدمها فقط، مثل `GEMINI_API_KEY` أو `OPENAI_API_KEY`.
- `ffprobe` إذا كانت وظائف قياس مدة الصوت تعتمد عليه.

## تشغيل التطوير
1. انسخ `.env.example` إلى `.env` واملأ المفاتيح المطلوبة محليًا.
2. ثبّت الاعتماديات: `npm install`.
3. افحص الأنواع: `npm run lint`.
4. شغّل الاختبارات: `npm test`.
5. ابنِ التطبيق: `npm run build`.
6. ابدأ الخادم: `npm run dev`.

## متغيرات البيئة المهمة
- `PORT`: منفذ الخادم (الافتراضي 3000).
- `BACKUP_DOWNLOAD_TOKEN`: سر عشوائي لا يقل عن 32 محرفًا لحماية تنزيل النسخ الاحتياطية.
- حد رفع الصوت: 50 ميجابايت بعد فك Base64؛ البيانات غير الصالحة تُرفض قبل بدء التحليل. جسم JSON محدود إلى 70 ميجابايت، وبيانات URL-encoded إلى 1 ميجابايت.
- `BACKUP_DOWNLOAD_FILE`: اسم ملف فقط داخل مجلد `backups/` (ZIP أو TAR.GZ)، دون مسار؛ الافتراضي `backup_2026-09-20.zip`. استجابة التنزيل تضبط `Cache-Control: no-store`. لا تضعه في واجهة المتصفح أو مستودع Git. يرسل فقط في ترويسة `x-backup-token` من عميل إداري موثوق.
- مفاتيح خدمات الذكاء الاصطناعي: تحفظ في إعدادات الاستضافة/الأسرار، ولا ترفع إلى Git.

## تنبيه أمان قبل النشر
مسار تنزيل النسخة الاحتياطية أصبح محميًا بمتغير بيئة. لكن مراجعة التدقيق وجدت أن مسارات API الخاصة بالمكالمات والذاكرة لا تتطلب مصادقة ظاهرة في الكود الحالي. **لا تستخدم النسخة مع بيانات عملاء حقيقية على استضافة عامة قبل تنفيذ تسجيل دخول وصلاحيات وعزل بيانات كل صيدلية وحماية CSRF ومعدلات الطلبات واختبارات HTTP تكاملية.**

## البيانات والخصوصية
قد يحتوي `data/audio_cache/` و`data/hindsight_memory_bank.json` ومجلد `backups/` على تسجيلات أو نصوص أو بيانات تشغيل حساسة. تم تجاهلها في `.gitignore` للمساعدة في منع إضافتها مستقبلًا إلى Git، لكن ذلك لا يزيل ملفات سبق تتبعها ولا ينظف الأرشيف الحالي. افحص سجل Git ونسخ النشر واحذف الأسرار وفق سياسة الاحتفاظ قبل النشر.

## الاختبارات
- `npm run test:node`: يشغّل اختبارات الانحدار والأمان باستخدام Node.js 22 دون الحاجة إلى `tsx`.
- `npm test`: مسار الاختبار المعتاد ويحتاج تثبيت الاعتماديات.
- الاختبارات تتضمن التحقق من Base64 وحد حجم الصوت، كما تتضمن HTTP محليًا لسياسة الوصول (رفض الوصول المجهول في الإنتاج، إبقاء health متاحًا، رفض الكتابة من مصدر مختلف، وإغلاق الخدمة عند غياب أسرار المصادقة).
- نجاح اختبارات سياسة الوصول لا يغني عن اختبار Express الكامل بعد تثبيت الاعتماديات.


## Deployment security gate (interim)

For public deployments, set `NODE_ENV=production`, `APP_BASIC_AUTH_USER` (at least 3 characters), and `APP_BASIC_AUTH_PASSWORD` (at least 24 characters) using the host's secret manager. If credentials are missing or too weak, the app denies access rather than serving the UI/API publicly. `/api/health` remains public for platform health checks. This is an interim Basic Auth barrier, not the final multi-user login/tenant isolation system. Use HTTPS only; do not place secrets in source control or browser code.
