const { Telegraf } = require("telegraf");

const DRIVER_BOT_TOKEN = "8172628908:AAF-wpN3lS_rMlVKN8skVFqHp0FdKjk2Zdc";
const bot = new Telegraf(DRIVER_BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply("👋 أهلاً بك في بوت السائقين. سيتم إعلامك بالحجوزات الجديدة هنا.");
});

// يمكنك لاحقًا إضافة استقبال الحجوزات أو زر "وصلت إلى العميل"

bot.launch();
