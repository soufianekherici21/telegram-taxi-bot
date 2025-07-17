const express = require("express");
const { Telegraf, Markup } = require("telegraf");
const axios = require("axios");
const app = express();

const BOT_TOKEN = "7761742753:AAHyx-hQQvu6NC7l9h8HhzDxEHl8SVy4uyo";
const bot = new Telegraf(BOT_TOKEN);

// الصفحة الرئيسية لعرض حالة البوت
app.get("/", (req, res) => {
  res.send("🚖 Telegram Taxi Bot is running.");
});

// Telegram bot
bot.start((ctx) => {
  ctx.reply(
    "👋 أهلاً بك في خدمة تأكيد الحجز!\n\n📲 أرسل رقم هاتفك الذي قمت بالحجز به (مثال: +213612345678)",
  );
});

bot.on("text", async (ctx) => {
  const phone = ctx.message.text.trim();
  if (!phone.startsWith("+213") || phone.length < 10) {
    return ctx.reply(
      "❌ رقم الهاتف غير صالح. الرجاء التأكد من إدخاله بصيغة: +213XXXXXXXXX",
    );
  }

  try {
    const response = await axios.get(
      "https://api.jsonbin.io/v3/b/686e440cdfff172fa6580e1a",
      {
        headers: {
          "X-Master-Key":
            "$2a$10$weUFaqkouXMo4Y8GFubF.ONUu8fUw1d2v7kGfut8g6P/wh3NG1w7y",
        },
      },
    );

    const data = response.data.record;

    // نبحث عن الحجز حسب الرقم، ونتجنب اللي عندهم status confirmed أو cancelled
    const booking = data.find(
      (b) =>
        b.phone === phone &&
        b.status !== "confirmed" &&
        b.status !== "cancelled",
    );

    if (!booking) {
      return ctx.reply(
        "❌ لم يتم العثور على حجز مرتبط بهذا الرقم أو تم تأكيده/إلغاؤه.",
      );
    }

    const message = `
📍 من: ${booking.from}
🎯 إلى: ${booking.to}
📅 التاريخ: ${booking.date}
⏰ الوقت: ${booking.time}
🚘 السيارة: ${booking.carType}
💰 السعر: ${booking.price}
👥 عدد الركاب: ${booking.passengers}
📱 الهاتف: ${booking.phone}
🔢 رقم الحجز: ${booking.code}

✅ هل تريد تأكيد أو إلغاء هذا الحجز؟`;

    ctx.reply(
      message,
      Markup.inlineKeyboard([
        Markup.button.callback("✅ تأكيد", `confirm_${booking.code}`),
        Markup.button.callback("❌ إلغاء", `cancel_${booking.code}`),
      ]),
    );
  } catch (err) {
    console.error(err);
    ctx.reply("⚠️ حدث خطأ أثناء جلب بيانات الحجز.");
  }
});

// عند الضغط على زر تأكيد أو إلغاء
bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const [action, code] = data.split("_");

  try {
    const response = await axios.get(
      "https://api.jsonbin.io/v3/b/686e440cdfff172fa6580e1a",
      {
        headers: {
          "X-Master-Key": "ضع_المفتاح_هنا",
        },
      },
    );

    const bookings = response.data.record;
    const index = bookings.findIndex((b) => b.code === code);

    if (index === -1) {
      return ctx.reply("❌ لم يتم العثور على هذا الحجز.");
    }

    if (
      bookings[index].status === "confirmed" ||
      bookings[index].status === "cancelled"
    ) {
      return ctx.reply("⚠️ هذا الحجز تم التعامل معه بالفعل.");
    }

    bookings[index].status = action === "confirm" ? "confirmed" : "cancelled";

    await axios.put(
      "https://api.jsonbin.io/v3/b/686e440cdfff172fa6580e1a",
      bookings,
      {
        headers: {
          "X-Master-Key":
            "$2a$10$weUFaqkouXMo4Y8GFubF.ONUu8fUw1d2v7kGfut8g6P/wh3NG1w7y",
          "Content-Type": "application/json",
        },
      },
    );

    ctx.reply(
      action === "confirm"
        ? "✅ تم تأكيد الحجز بنجاح."
        : "❌ تم إلغاء الحجز بنجاح.",
    );
  } catch (err) {
    console.error(err);
    ctx.reply("⚠️ حدث خطأ أثناء تحديث حالة الحجز.");
  }
});

bot.launch();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
