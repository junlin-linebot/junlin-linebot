import express from "express";
import { middleware, Client } from "@line/bot-sdk";
import OpenAI from "openai";

// === LINE 設定 ===
const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_SECRET,
};

// === 初始化 LINE 客戶端 ===
const client = new Client(config);

// === 初始化 OpenAI 客戶端（新版金鑰需加入 project） ===
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,      // 你的 sk-proj- 金鑰
  project: process.env.OPENAI_PROJECT,     // 你的 proj_ 開頭的 Project ID
});

// === 建立 Express 伺服器 ===
const app = express();

// === 處理 LINE Webhook ===
app.post("/webhook", middleware(config), async (req, res) => {
  try {
    const results = await Promise.all(req.body.events.map(handleEvent));
    res.json(results);
  } catch (err) {
    console.error("Webhook Error:", err);
    res.status(500).end();
  }
});

// === 處理每個事件 ===
async function handleEvent(event) {
  // 只處理文字訊息
  if (event.type !== "message" || event.message.type !== "text") {
    return Promise.resolve(null);
  }

  const userMessage = event.message.text.trim();

  // 測試指令
  if (userMessage.toLowerCase() === "/ping") {
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "pong ✅",
    });
  }

  try {
    // 呼叫 GPT 產生回覆
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // 使用穩定且快速的模型
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant for a beginner used car salesperson in Taiwan. Keep replies friendly and clear.",
        },
        { role: "user", content: userMessage },
      ],
    });

    const replyText = completion.choices[0].message.content.trim();

    // 回傳給 LINE 使用者
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: replyText,
    });
  } catch (error) {
    console.error("GPT Error:", error);
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "目前伺服器忙碌中，請稍後再試 🙏",
    });
  }
}

// === 健康檢查 (Health check) ===
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    webhook: true,
    openaiKey: !!process.env.OPENAI_API_KEY,
    project: !!process.env.OPENAI_PROJECT,
  });
});

app.get("/", (req, res) => {
  res.send("🚗 LINE Bot server is running with new OpenAI project support.");
});

// === 給 Vercel 使用 ===
export default app;
