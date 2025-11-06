import express from 'express';
import axios from 'axios';
import { middleware, Client } from '@line/bot-sdk';

// 建立 Express 應用程式
const app = express();
app.use(express.json());  // 確保資料解析成 JSON 格式

// LINE 設定
const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_SECRET,
};

// LINE 客戶端
const client = new Client(config);

// GPT API 金鑰
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Webhook 路由
app.post("/webhook", middleware(config), async (req, res) => {
  try {
    // 確保 LINE 傳來的資料格式正確
    const bodyString = JSON.stringify(req.body);
    
    // 驗證 LINE 訊息簽名
    const signature = req.headers["x-line-signature"];
    if (!signature) {
      res.status(400).send("Missing signature");
      return;
    }

    const isValid = validateSignature(bodyString, signature);
    if (!isValid) {
      res.status(400).send("Invalid signature");
      return;
    }

    // 處理事件
    const events = req.body.events;
    await Promise.all(events.map(handleEvent));
    res.status(200).send("OK");
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Webhook failed');
  }
});

// 處理 LINE 訊息
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const userMessage = event.message.text;
  let replyText = "目前系統有點忙，請稍後再試 🙏";

  try {
    // 連接 OpenAI API
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: userMessage }],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
      }
    );
    replyText = response.data.choices?.[0]?.message?.content?.trim() || replyText;
  } catch (err) {
    console.error("GPT error:", err.response?.data || err.message);
  }

  // 回應使用者
  await client.replyMessage(event.replyToken, {
    type: 'text',
    text: replyText,
  });
}

// 驗證簽名
function validateSignature(body, signature) {
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', process.env.LINE_SECRET);
  hmac.update(body);
  const digest = hmac.digest('base64');
  return digest === signature;
}

export default app;
