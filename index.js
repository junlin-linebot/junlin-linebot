import express from "express";
import axios from "axios";
import { middleware, Client } from "@line/bot-sdk";

const app = express();

const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_SECRET,
};

const client = new Client(config);

// GPT API 設定
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 接收 LINE 訊息
app.post("/webhook", middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    await Promise.all(events.map(handleEvent));
    res.status(200).send("OK");
  } catch (error) {
    console.error(error);
    res.status(500).end();
  }
});

// 處理訊息
async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") return;

  const userMessage = event.message.text;

  // 發送到 GPT
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

  const replyText = response.data.choices[0].message.content;

  // 回覆使用者
  await client.replyMessage(event.replyToken, {
    type: "text",
    text: replyText,
  });
}

export default app;
