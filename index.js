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

// === OpenAI client (may be absent) ===
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const openai = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null;

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
  // 只處理文字訊息
  if (event.type !== "message" || event.message.type !== "text") {
    return Promise.resolve(null);
  }

  const text = (event.message.text || "").trim();

  // 1) 健康檢查指令：/ping -> pong
  if (text.toLowerCase() === "/ping") {
    return client.replyMessage(event.replyToken, { type: "text", text: "pong" });
  }

  // 2) 沒有 OpenAI 金鑰 → 直接回覆提示（並在 Logs 記錄）
  if (!openai) {
    console.error("MISSING_OPENAI_KEY: process.env.OPENAI_API_KEY is undefined");
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "目前尚未設定 OpenAI 金鑰，請稍後再試 🙏",
    });
  }

  try {
    // 3) 呼叫 GPT（使用建議且穩定的模型）
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant for a beginner used-car salesperson in Taiwan. Keep replies concise and practical.",
        },
        { role: "user", content: text },
      ],
      temperature: 0.7,
    });

    const reply =
      completion?.choices?.[0]?.message?.content?.trim() ||
      "（暫時無法產生回覆，請再試一次 🙏）";

    return client.replyMessage(event.replyToken, { type: "text", text: reply });
  } catch (err) {
    // 4) 詳細錯誤輸出到 Logs，協助定位（不會暴露金鑰）
    const status = err?.status || err?.response?.status;
    const data = err?.response?.data;
    console.error("GPT Error:", { status, message: err?.message, data });

    // 429/限流給出友善文字，其餘通用提示
    const msg =
      status === 429
        ? "系統忙碌（429），等一下再試或改用新金鑰 🙏"
        : "目前伺服器忙碌中，請稍後再試 🙏";
    return client.replyMessage(event.replyToken, { type: "text", text: msg });
  }
}

// === 健康檢查 HTTP 路由 ===
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    webhook: true,
    openaiKey: !!OPENAI_KEY, // 只回 true/false，不顯示金鑰
  });
});

// 根路徑：避免瀏覽器看到 Cannot GET /
app.get("/", (req, res) => {
  res.send("✅ LINE Bot is running. Use /health for status.");
});

// 在 Vercel 建議用 default export，不需 app.listen
export default app;
