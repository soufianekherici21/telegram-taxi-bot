
const { Telegraf } = require("telegraf");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
require("dotenv").config();

const bot = new Telegraf(process.env.TELEGRAM_DRIVER_TOKEN);
const driversBin = process.env.JSONBIN_DRIVERS_ID;
const apiKey = process.env.JSONBIN_API_KEY;

const registerState = {};

bot.on("text", async (ctx) => {
  console.log("👨‍💼 سائق جديد:", ctx.chat.id, ctx.message.text);
  const chatId = ctx.chat.id;
  const text = ctx.message.text.trim();

  if (text === "/start") {
    return ctx.reply(
      "👋 أهلًا بك في بوت تسجيل السائقين!\n\nأرسل /register للتسجيل كسائق جديد",
    );
  }

  if (text === "/register") {
    registerState[chatId] = { step: "awaiting_name" };
    return ctx.reply("👋 من فضلك أرسل اسمك الكامل:");
  }

  if (registerState[chatId]) {
    const state = registerState[chatId];

    if (state.step === "awaiting_name") {
      registerState[chatId].name = text;
      registerState[chatId].step = "awaiting_phone";
      return ctx.reply("📞 الآن أرسل رقم هاتفك:");
    }

    if (state.step === "awaiting_phone") {
      const phone = text;
      const name = state.name;

      try {
        const res = await fetch(
          `https://api.jsonbin.io/v3/b/${driversBin}/latest`,
          {
            headers: { "X-Master-Key": apiKey },
          },
        );
        const json = await res.json();
        const current = Array.isArray(json.record) ? json.record : [];

        // التحقق من عدم وجود السائق مسبقًا
        const existingDriver = current.find(
          (driver) => driver.chatId === chatId || driver.phone === phone,
        );

        if (existingDriver) {
          delete registerState[chatId];
          return ctx.reply("⚠️ أنت مسجل مسبقًا كسائق.");
        }

        current.push({ chatId, name, phone, registeredAt: new Date().toISOString() });

        await fetch(`https://api.jsonbin.io/v3/b/${driversBin}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Master-Key": apiKey,
          },
          body: JSON.stringify(current),
        });

        delete registerState[chatId];
        return ctx.reply("✅ تم تسجيلك كسائق بنجاح.\n\nسيتم إشعارك بالحجوزات الجديدة.");
      } catch (err) {
        console.error("❌ خطأ في تسجيل السائق:", err);
        return ctx.reply("❌ حدث خطأ أثناء حفظ بياناتك. حاول مرة أخرى.");
      }
    }
    return;
  }

  return ctx.reply(
    "❓ لم أفهم رسالتك.\n\nأرسل /start للبدء أو /register للتسجيل كسائق",
  );
});

bot.launch().then(() => {
  console.log("🚗 بوت التليغرام للسائقين شغال");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
