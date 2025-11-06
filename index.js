import express from "express";
import { middleware, Client } from "@line/bot-sdk";
import OpenAI from "openai";

// LINE 設定
const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_SECRET,
};

// 初始化 LINE 客戶端
const client = new Client(config);

// 初始化 OpenAI 客戶端（這步很重要）
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();

// 處理 LINE webhook
app.post("/webhook", middleware(config), async (req, res) => {
  try {
    const results = await Promise.all(req.body.events.map(handleEvent));
    res.json(results);
  } catch (err) {
    console.error("Webhook Error:", err);
    res.status(500).end();
  }
});

// 處理收到的訊息事件
async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") {
    return Promise.resolve(null);
  }

  const userMessage = event.message.text;

  try {
    // 呼叫 GPT 生成回覆
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant for a used car salesperson." },
        { role: "user", content: userMessage },
      ],
    });

    const replyText = completion.choices[0].message.content.trim();

    // 回傳訊息給使用者
    await client.replyMessage(event.replyToken, {
      type: "text",
      text: replyText,
    });
  } catch (error) {
    console.error("GPT Error:", error);

    // 若 GPT 出錯，回覆一個簡短提示
    await client.replyMessage(event.replyToken, {
      type: "text",
      text: "目前伺服器忙碌中，請稍後再試 🙏",
    });
  }
}

app.get("/", (req, res) => {
  res.send("LINE Bot server is running 🚗");
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
