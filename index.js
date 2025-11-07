import express from "express";
import { middleware, Client } from "@line/bot-sdk";
import OpenAI from "openai";

// === LINE config ===
const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_SECRET,
};

const app = express();
const client = new Client(config);

// === OpenAI config (新版金鑰相容) ===
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG, // 新增這行！對應新版 project key
});

// === webhook ===
app.post("/webhook", middleware(config), async (req, res) => {
  try {
    const results = await Promise.all(req.body.events.map(handleEvent));
    res.json(results);
  } catch (err) {
    console.error("Webhook Error:", err);
    res.status(500).end();
  }
});

// === event handler ===
async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") {
    return Promise.resolve(null);
  }

  const text = event.message.text.trim();

  // 測試指令
  if (text.toLowerCase() === "/ping") {
    return client.replyMessage(event.replyToken, { type: "text", text: "pong" });
  }

  try {
    // 呼叫 GPT
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // 穩定又便宜的模型
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant for a beginner used car salesperson in Taiwan. Keep replies practical and clear.",
        },
        { role: "user", content: text },
      ],
      temperature: 0.7,
    });

    const replyText =
      completion?.choices?.[0]?.message?.content?.trim() ||
      "（暫時無法產生回覆，請稍後再試 🙏）";

    return client.replyMessage(event.replyToken, { type: "text", text: replyText });
  } catch (err) {
    const status = err?.status || err?.response?.status;
    const data = err?.response?.data;
    console.error("GPT Error:", { status, message: err?.message, data });

    const msg =
      status === 429
        ? "系統忙碌（429），等一下再試或換一組金鑰 🙏"
        : status === 401
        ? "金鑰驗證失敗，請確認 OPENAI_API_KEY 和 OPENAI_ORG 設定正確 ⚙️"
        : "目前伺服器忙碌中，請稍後再試 🙏";

    return client.replyMessage(event.replyToken, { type: "text", text: msg });
  }
}

// === health check routes ===
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    webhook: true,
    openaiKey: !!process.env.OPENAI_API_KEY,
    organization: !!process.env.OPENAI_ORG,
  });
});

app.get("/", (req, res) => {
  res.send("✅ LINE Bot server is running with new OpenAI key support.");
});

// Vercel 專用：使用 default export
export default app;
