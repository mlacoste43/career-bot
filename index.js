require("dotenv").config();

const { Telegraf } = require("telegraf");
const axios = require("axios");
const express = require("express");

const { VACANCY_PROMPT, HR_PROMPT } = require("./prompts");

const bot = new Telegraf(process.env.BOT_TOKEN);
const userModes = {};

// --------------------
// HUGGING FACE REQUEST (бесплатно)
// --------------------
async function askAI(prompt) {
  try {
    const response = await axios.post(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3",
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.7,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    
    // Извлекаем текст из ответа
    let result = response.data[0]?.generated_text || response.data;
    
    // Убираем исходный промпт из ответа
    if (result.startsWith(prompt)) {
      result = result.slice(prompt.length);
    }
    
    return result.trim() || "Получил ответ, но он пустой. Попробуйте переформулировать.";
    
  } catch (error) {
    console.log("Hugging Face error:", error.response?.data || error.message);
    
    // Если модель загружается (503 ошибка)
    if (error.response?.status === 503) {
      return "⏳ Модель загружается, подождите 30 секунд и попробуйте снова.";
    }
    
    return "❌ Ошибка AI. Попробуйте позже.";
  }
}

// --------------------
// COMMANDS
// --------------------
bot.command("start", (ctx) => {
  ctx.reply(
    `👋 Career AI Bot\n\nФункции:\n• Разбор вакансий\n• Ответы HR\n\nКоманды:\n/analyze - анализ вакансии\n/hr - ответ HR`
  );
});

bot.command("analyze", (ctx) => {
  userModes[ctx.from.id] = "analyze";
  ctx.reply("📄 Пришли текст вакансии");
});

bot.command("hr", (ctx) => {
  userModes[ctx.from.id] = "hr";
  ctx.reply("💬 Пришли сообщение HR");
});

// --------------------
// TEXT HANDLER
// --------------------
bot.on("text", async (ctx) => {
  const mode = userModes[ctx.from.id];
  if (!mode) {
    return ctx.reply("Выбери:\n/analyze\n/hr");
  }

  await ctx.reply("⏳ Думаю...");

  let prompt = "";
  if (mode === "analyze") {
    prompt = VACANCY_PROMPT + ctx.message.text;
  } else if (mode === "hr") {
    prompt = HR_PROMPT + ctx.message.text;
  }

  const response = await askAI(prompt);
  ctx.reply(response);
});

// --------------------
// RENDER WEBHOOK SETUP
// --------------------
const PORT = process.env.PORT || 10000;
const WEBHOOK_PATH = `/webhook/${bot.secretPathComponent()}`;
const WEBHOOK_URL = `${process.env.RENDER_EXTERNAL_URL}${WEBHOOK_PATH}`;

const app = express();
app.use(express.json());

app.post(WEBHOOK_PATH, (req, res) => {
  bot.handleUpdate(req.body, res);
});

app.get("/", (req, res) => {
  res.send("Bot is alive!");
});

app.get("/health", (req, res) => {
  res.send("OK");
});

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`✅ Server running on port ${PORT}`);
  try {
    await bot.telegram.setWebhook(WEBHOOK_URL);
    console.log(`✅ Webhook set to: ${WEBHOOK_URL}`);
  } catch (error) {
    console.error("❌ Webhook error:", error.message);
  }
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

console.log("🤖 Bot starting...");
