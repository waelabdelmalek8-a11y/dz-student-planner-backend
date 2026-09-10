      import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map(x => x.trim())
    : true
}));

app.use(express.json({ limit: "1mb" }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

app.use("/api/", limiter);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "DZ Student Planner AI Backend",
    aiConfigured: Boolean(GEMINI_API_KEY)
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, student, subjects, exams, tasks } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "الرسالة مطلوبة"
      });
    }

    if (!GEMINI_API_KEY) {
      return res.status(503).json({
        error: "GEMINI_API_KEY غير مضبوط في الخادم"
      });
    }

    const context = {
      student: student || {},
      subjects: subjects || [],
      exams: exams || [],
      tasks: tasks || []
    };

    const systemPrompt = `
أنت المساعد الذكي الرسمي لتطبيق DZ Student Planner.

اختصاصك مساعدة طلبة الجامعات الجزائرية في:
- نظام LMD
- تنظيم الدراسة والمراجعة
- حساب المعدلات والنقاط
- حساب معاملات المواد
- التخطيط للامتحانات
- تنظيم المهام
- شرح الدروس بطريقة بسيطة
- تقديم نصائح دراسية عملية

قواعد مهمة:
1. أجب بالعربية الواضحة ويمكن استعمال كلمات فرنسية عند الحاجة.
2. لا تخترع قوانين خاصة بجامعة أو تخصص إذا لم تكن متأكدًا منها.
3. عند حساب المعدلات، وضّح طريقة الحساب والافتراضات.
4. إذا كانت المعلومات ناقصة، اطلب المعلومات الضرورية فقط.
5. اجعل الإجابة عملية ومختصرة قدر الإمكان.
6. لا تدّعي أنك تعرف معلومات شخصية غير موجودة في البيانات المرسلة.
7. ساعد الطالب على بناء خطة مراجعة واقعية حسب الوقت والامتحانات.

بيانات الطالب الحالية:
${JSON.stringify(context, null, 2)}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: systemPrompt
              }
            ]
          },
          contents: [
            {
              parts: [
                {
                  text: message
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1200
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("GEMINI ERROR:", response.status, data);

      return res.status(500).json({
        error: "حدث خطأ أثناء الاتصال بـ Gemini"
      });
    }

    const answer =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim() ||
      "ما قدرتش نولد إجابة حالياً، حاول مرة أخرى.";

    res.json({
      ok: true,
      answer
    });

  } catch (error) {
    console.error("GEMINI ERROR:", error);

    res.status(500).json({
      error: "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي"
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`DZ Student Planner AI Backend running on port ${PORT}`);
});
