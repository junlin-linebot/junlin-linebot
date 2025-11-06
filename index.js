import express from "express";
import axios from "axios";
import { middleware, Client } from "@line/bot-sdk";

const app = express();
app.use(express.json());

const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_SECRET,
};

const client = new Client(config);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.post("/webhook", middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    await Promise.all(events.map(handleEvent));
    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).send("Webhook failed");
  }
});

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") return;

  const userMessage = event.message.text;
  let replyText = "目前系統有點忙，請稍後再試！🙏 (The bot is busy now)";

  try {
   const response = await axios.post(
  "https://api.openai.com/v1/chat/completions",
  JSON.stringify({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: userMessage }],
  }),
  {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
  }
);

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

  await client.replyMessage(event.replyToken, {
    type: "text",
    text: replyText,
  });
}

export default app;
