# VetMaster

منصة امتحانات بيطرية بسيطة تعمل مباشرة على المتصفح، وتشمل:

- امتحان من 10 أسئلة.
- مؤقت 15 دقيقة.
- نتيجة فورية بعد الإنهاء.
- مراجعة الإجابات الصحيحة والخاطئة.
- حفظ أفضل نتيجة وآخر نتيجة على نفس الجهاز.
- حفظ الأسئلة الخاطئة في قسم **تدرب على أخطائك**.
- تصميم متجاوب مع الكمبيوتر والهاتف.

## الملفات المطلوبة

ارفع هذه الملفات الخمسة إلى الصفحة الرئيسية لمستودع GitHub:

1. `index.html`
2. `style.css`
3. `app.js`
4. `questions.json`
5. `README.md`

> ارفع الملفات نفسها، وليس ملف ZIP.

## النشر على Vercel

1. افتح Vercel واضغط **Add New → Project**.
2. اختر مستودع `vetmaster`.
3. اجعل **Framework Preset** على `Other`.
4. لا تضف Build Command.
5. اضغط **Deploy**.

## إضافة أسئلة جديدة

افتح `questions.json` وأضف سؤالًا بنفس هذا الشكل:

```json
{
  "id": "unique-question-id",
  "category": "Viral Diseases",
  "question": "Write the question here.",
  "options": [
    "First option",
    "Second option",
    "Third option",
    "Fourth option"
  ],
  "answer": 1,
  "explanation": "Short explanation of the correct answer."
}
```

قيمة `answer` تبدأ من الصفر:

- `0` = الخيار الأول
- `1` = الخيار الثاني
- `2` = الخيار الثالث
- `3` = الخيار الرابع

## ملاحظة

النتائج والأسئلة الخاطئة تُحفظ داخل متصفح المستخدم عبر `localStorage`، لذلك لا تحتاج النسخة الأولى إلى قاعدة بيانات.
