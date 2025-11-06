import express from "express";
import { middleware, Client } from "@line/bot-sdk";
import openai from "openai"; // 引入 OpenAI SDK

// 設置 LINE bot 的 Channel access token 和 Channel secret
const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_SECRET,
};

// 初始化 Express 應用程式
const app = express();

// 必須放在任何 body parser 之前，來處理 LINE 發來的 webhook 請求
app.post("/webhook", middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent)) // 處理每一個事件
    .then((result) => res.json(result))  // 回應處理結果
    .catch((err) => {
      console.error(err);  // 若發生錯誤，記錄錯誤
      res.status(500).end(); // 回應 500 錯誤
    });
});

const client = new Client(config);

// 處理收到的事件（訊息）
async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") {
    return Promise.resolve(null);  // 只處理文字訊息
  }

  const userMessage = event.message.text;  // 取得用戶發送的訊息

  // 使用 OpenAI GPT 回應訊息
  const gptResponse = await getGPTResponse(userMessage);

  // 回覆 GPT 生成的回應給用戶
  const echo = { type: "text", text: gptResponse };
  return client.replyMessage(event.replyToken, echo);
}

// 呼叫 OpenAI API，根據用戶訊息生成回應
async function getGPTResponse(userMessage) {
  const response = await openai.completions.create({
    model: "text-davinci-003", // 使用 GPT-3 的 Davinci 模型
    prompt: userMessage,  // 用戶的訊息作為提示詞
    max_tokens: 150,  // 設定 GPT 回應的最大長度
  });

  return response.choices[0].text.trim();  // 擷取 GPT 回應並去除多餘空白
}

app.listen(3000, () => {
  console.log("LINE bot server is running on port 3000");
});
