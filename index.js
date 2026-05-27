require("dotenv").config();

const { Telegraf } = require("telegraf");
const axios = require("axios");

const {
  VACANCY_PROMPT,
  HR_PROMPT,
} = require("./prompts");

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

        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
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
// START
// --------------------

bot.start((ctx) => {

  ctx.reply(
    `👋 Career AI Bot

Функции:
• Разбор вакансий
• Ответы HR

Команды:
/analyze - анализ вакансии
/hr - ответ HR`
  );
});


// --------------------
// ANALYZE
// --------------------

bot.command("analyze", (ctx) => {

  userModes[ctx.from.id] = "analyze";

  ctx.reply("📄 Пришли текст вакансии");
});


// --------------------
// HR
// --------------------

bot.command("hr", (ctx) => {

  userModes[ctx.from.id] = "hr";

  ctx.reply("💬 Пришли сообщение HR");
});


// --------------------
// TEXT
// --------------------

bot.on("text", async (ctx) => {

  const mode = userModes[ctx.from.id];

  if (!mode) {

    return ctx.reply(
      "Выбери:\n/analyze\n/hr"
    );
  }

  await ctx.reply("⏳ Думаю...");

  let prompt = "";

  if (mode === "analyze") {

    prompt =
      VACANCY_PROMPT + ctx.message.text;

  } else if (mode === "hr") {

    prompt =
      HR_PROMPT + ctx.message.text;
  }

  const response = await askAI(prompt);

  ctx.reply(response);
});


// --------------------
// LAUNCH
// --------------------

bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

console.log("Bot started...");