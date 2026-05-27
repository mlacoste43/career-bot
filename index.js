require("dotenv").config();

const { Telegraf } = require("telegraf");
const axios = require("axios");
const express = require("express");

const { VACANCY_PROMPT, HR_PROMPT } = require("./prompts");

const bot = new Telegraf(process.env.BOT_TOKEN);
const userModes = {};

// --------------------
// AI REQUEST (несколько API для надёжности)
// --------------------
async function askAI(prompt, mode) {
  // Сначала пробуем OpenRouter (платные модели дёшево, но нужно добавить баланс)
  // Для начала просто используем заглушки или Koala
  
  // ВАРИАНТ 1: Koala AI (бесплатно, без ключа)
  try {
    const response = await axios.post(
      "https://api.koala.sh/v1/chat/completions",
      {
        model: "koala-7b",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 15000, // 15 секунд таймаут
      }
    );
    return response.data.choices[0].message.content;
  } catch (error) {
    console.log("Koala API error:", error.message);
  }

  // ВАРИАНТ 2: Если Koala не работает - возвращаем умную заглушку
  console.log("Using fallback response (no API available)");
  
  if (mode === "analyze") {
    return generateVacancyAnalysis(prompt);
  } else {
    return generateHRResponse(prompt);
  }
}

// --------------------
// ЗАГЛУШКИ ДЛЯ РАБОТЫ БЕЗ API
// --------------------
function generateVacancyAnalysis(vacancyText) {
  const hasExperience = /опыт|experience|год|лет/i.test(vacancyText);
  const hasTeam = /команд|team|коллектив/i.test(vacancyText);
  const hasRemote = /удален|remote|из дома/i.test(vacancyText);
  
  let analysis = "📊 **Анализ вакансии**\n\n";
  
  if (hasExperience) {
    analysis += "✅ **Требуемый опыт:** Указан (проверьте соответствие)\n";
  } else {
    analysis += "⚠️ **Требуемый опыт:** Не указан (уточните на собеседовании)\n";
  }
  
  if (hasTeam) {
    analysis += "✅ **Работа в команде:** Упомянуто\n";
  }
  
  if (hasRemote) {
    analysis += "✅ **Формат работы:** Удалёнка возможна\n";
  } else {
    analysis += "⚠️ **Формат работы:** Не указан (уточните)\n";
  }
  
  analysis += "\n💡 **Советы кандидату:**\n";
  analysis += "• Выделите релевантный опыт в резюме\n";
  analysis += "• Подготовьте вопросы о задачах и команде\n";
  analysis += "• Уточните KPI и ожидания от первых месяцев\n";
  
  analysis += "\n\n_🤖 Бот работает в офлайн-режиме. Для полного анализа добавьте API ключ._";
  
  return analysis;
}

function generateHRResponse(messageText) {
  const isQuestion = /\?|вас интересует|расскажите|какой|когда|где/i.test(messageText);
  const hasSalary = /зарплат|salary|оклад|ставк/i.test(messageText);
  const hasExperience = /опыт|experience|год/i.test(messageText);
  
  let response = "💬 **Ответ HR**\n\n";
  
  if (isQuestion) {
    response += "Здравствуйте! Спасибо за вопросы.\n\n";
    if (hasSalary) {
      response += "По зарплатным ожиданиям: я готов обсудить этот вопрос на собеседовании, исходя из рынка и моих навыков.\n\n";
    }
    if (hasExperience) {
      response += "Мой опыт соответствует требованиям, и я могу предоставить подробности в резюме.\n\n";
    }
    response += "Буду рад обсудить детали в личной встрече или созвоне. Когда вам удобно?";
  } else {
    response += "Здравствуйте! Спасибо за предложение.\n\n";
    response += "Вакансия выглядит интересно. Я внимательно изучил требования и считаю, что мой опыт может быть полезен.\n\n";
    response += "Буду рад обсудить детали и ответить на вопросы. Когда можно созвониться?";
  }
  
  response += "\n\n_🤖 Бот работает в офлайн-режиме. Для персонализированных ответов добавьте API ключ._";
  
  return response;
}

// --------------------
// COMMANDS
// --------------------
bot.command("start", (ctx) => {
  ctx.reply(
    `👋 **Career AI Bot**\n\nФункции:\n• 📄 Разбор вакансий\n• 💬 Ответы HR\n\nКоманды:\n/analyze - анализ вакансии\n/hr - ответ HR\n\n_Бот анализирует текст и даёт советы._`,
    { parse_mode: "Markdown" }
  );
});

bot.command("analyze", (ctx) => {
  userModes[ctx.from.id] = "analyze";
  ctx.reply("📄 **Пришли текст вакансии**\n\nОтправьте описание вакансии, и я проанализирую её.", { parse_mode: "Markdown" });
});

bot.command("hr", (ctx) => {
  userModes[ctx.from.id] = "hr";
  ctx.reply("💬 **Пришли сообщение от HR**\n\nНапишите, что вам написал HR, и я помогу составить ответ.", { parse_mode: "Markdown" });
});

// --------------------
// TEXT HANDLER
// --------------------
bot.on("text", async (ctx) => {
  const mode = userModes[ctx.from.id];
  
  if (!mode) {
    return ctx.reply(
      "❓ **Выберите режим:**\n/analyze - анализ вакансии\n/hr - ответ HR",
      { parse_mode: "Markdown" }
    );
  }
  
  // Отправляем статус "печатает"
  await ctx.reply("⏳ **Анализирую...**", { parse_mode: "Markdown" });
  
  let prompt = "";
  if (mode === "analyze") {
    prompt = VACANCY_PROMPT + ctx.message.text;
  } else if (mode === "hr") {
    prompt = HR_PROMPT + ctx.message.text;
  }
  
  const response = await askAI(prompt, mode);
  
  // Разбиваем длинные сообщения
  if (response.length > 4000) {
    for (let i = 0; i < response.length; i += 4000) {
      await ctx.reply(response.substring(i, i + 4000), { parse_mode: "Markdown" });
    }
  } else {
    await ctx.reply(response, { parse_mode: "Markdown" });
  }
  
  // Сбрасываем режим после ответа
  delete userModes[ctx.from.id];
});

// --------------------
// RENDER WEBHOOK SETUP
// --------------------
const PORT = process.env.PORT || 10000;
const WEBHOOK_PATH = `/webhook/${bot.secretPathComponent()}`;
const WEBHOOK_URL = `${process.env.RENDER_EXTERNAL_URL}${WEBHOOK_PATH}`;

const app = express();
app.use(express.json());

// Эндпоинт для вебхука Telegram
app.post(WEBHOOK_PATH, (req, res) => {
  bot.handleUpdate(req.body, res);
});

// Health check для Render
app.get("/", (req, res) => {
  res.send("🤖 Bot is alive! Status: OK");
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Запускаем сервер
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`✅ Server running on port ${PORT}`);
  
  try {
    // Устанавливаем вебхук
    await bot.telegram.setWebhook(WEBHOOK_URL);
    console.log(`✅ Webhook set to: ${WEBHOOK_URL}`);
    
    // Проверяем вебхук
    const webhookInfo = await bot.telegram.getWebhookInfo();
    console.log(`📡 Webhook info:`, webhookInfo);
    
  } catch (error) {
    console.error("❌ Webhook error:", error.message);
  }
});

// Graceful shutdown
process.once("SIGINT", () => {
  console.log("Shutting down...");
  bot.stop("SIGINT");
  process.exit(0);
});
process.once("SIGTERM", () => {
  console.log("Shutting down...");
  bot.stop("SIGTERM");
  process.exit(0);
});

console.log("🤖 Career Bot starting...");
console.log(`🔗 Webhook path: ${WEBHOOK_PATH}`);
