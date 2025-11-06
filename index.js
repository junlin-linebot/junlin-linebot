import express from "express";
import { middleware, Client } from "@line/bot-sdk";
import OpenAI from "openai";

// === LINE 設定 ===
const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_SECRET,
};

// 初始化 LINE 客戶端
const client = new Client(config);

// === 初始化 OpenAI ===
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();

// === LINE webhook 路由 ===
app.post("/webhook", middleware(config), async (req, res) => {
  try {
    const results = await Promise.all(req.body.events.map(handleEvent));
    res.json(results);
  } catch (err) {
    console.error("Webhook Error:", err);
    res.status(500).end();
  }
});

// === 處理 LINE 事件 ===
async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") {
    return Promise.resolve(null);
  }

  const userMessage = event.message.text;

  try {
    // 呼叫 GPT 模型產生回覆
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // ✅ 建議改這個模型（更快更穩）
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant for a used car salesperson.",
        },
        { role: "user", content: userMessage },
      ],
    });

    const replyText =
      completion.choices?.[0]?.message?.content?.trim() ||
      "（無法產生回覆，請稍後再試 🙏）";

    // 回覆使用者
    await client.replyMessage(event.replyToken, {
      type: "text",
      text: replyText,
    });
  } catch (error) {
    console.error("GPT Error:", error);

    // 若 GPT 出錯，回覆錯誤訊息
    await client.replyMessage(event.replyToken, {
      type: "text",
      text: "目前伺服器忙碌中，請稍後再試 🙏",
    });
  }
}

// === 基本首頁測試 ===
app.get("/", (req, res) => {
  res.send("✅ LINE Bot server is running and connected to GPT!");
});

export default app;
