require("dotenv").config();

const { Telegraf } = require("telegraf");
const axios = require("axios");

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
        model: "deepseek/deepseek-v4-flash:free",
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
// WEBHOOK MODE FOR RENDER
// --------------------
const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = `/webhook/${bot.secretPathComponent()}`;

// Запускаем вебхук
bot.telegram.setWebhook(`${process.env.RENDER_EXTERNAL_URL}${WEBHOOK_PATH}`);

// Создаём Express сервер (или используем встроенный в Telegraf)
const express = require("express");
const app = express();

app.use(express.json());
app.use(bot.webhookCallback(WEBHOOK_PATH));

app.get("/", (req, res) => {
  res.send("Bot is running!");
});

// Для пингования (чтобы бот не засыпал)
app.get("/health", (req, res) => {
  res.send("OK");
});

app.listen(PORT, () => {
  console.log(`Bot running on port ${PORT}`);
  console.log(`Webhook path: ${WEBHOOK_PATH}`);
});

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
