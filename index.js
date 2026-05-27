require("dotenv").config();

const { Telegraf } = require("telegraf");
const axios = require("axios");
const express = require("express");

const { VACANCY_PROMPT, HR_PROMPT } = require("./prompts");

const bot = new Telegraf(process.env.BOT_TOKEN);
const userModes = {};

// --------------------
// OPENROUTER REQUEST
// --------------------
async function askAI(prompt) {
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "google/gemini-2.0-flash-exp:free",
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data.choices[0].message.content;
  } catch (error) {
    console.log(error.response?.data || error.message);
    return "Ошибка AI.";
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

// Создаём Express сервер
const app = express();

// Парсим JSON от Telegram
app.use(express.json());

// Эндпоинт для вебхука Telegram
app.post(WEBHOOK_PATH, (req, res) => {
  bot.handleUpdate(req.body, res);
});

// Health check для Render
app.get("/", (req, res) => {
  res.send("Bot is alive!");
});

app.get("/health", (req, res) => {
  res.send("OK");
});

// Запускаем сервер
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`✅ Server running on port ${PORT}`);
  
  // Устанавливаем вебхук
  try {
    await bot.telegram.setWebhook(WEBHOOK_URL);
    console.log(`✅ Webhook set to: ${WEBHOOK_URL}`);
  } catch (error) {
    console.error("❌ Webhook error:", error.message);
  }
});

// Graceful shutdown
process.once("SIGINT", () => {
  bot.stop("SIGINT");
  process.exit(0);
});
process.once("SIGTERM", () => {
  bot.stop("SIGTERM");
  process.exit(0);
});

console.log("🤖 Bot starting...");
