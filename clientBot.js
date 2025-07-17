const { Telegraf, Markup } = require("telegraf");
const axios = require("axios");

const BOT_TOKEN = "🔒 ضع هنا التوكن الخاص ببوت الزبائن";
const bot = new Telegraf(BOT_TOKEN);

const API_URL = "https://telegram-taxi-bot.onrender.com/data";

bot.start((ctx) => {
  ctx.reply(
    "👋 أهلاً بك في خدمة تأكيد الحجز!\n\n📲 أرسل رقم هاتفك الذي قمت بالحجز به (مثال: +213612345678)",
  );
});

bot.on("text", async (ctx) => {
  const phone = ctx.message.text.trim();
  try {
    const response = await axios.get(API_URL);
    const bookings = response.data;

    const booking = bookings.find(
      (b) => b.phone === phone && b.status === "pending",
    );

    if (!booking) {
      return ctx.reply(
        "❌ لم يتم العثور على حجز مرتبط بهذا الرقم أو تم تأكيده/إلغاؤه.",
      );
    }

    const summary = `
📍 من: ${booking.from}
🎯 إلى: ${booking.to}
📅 التاريخ: ${booking.date}
⏰ الوقت: ${booking.time}
🚕 النوع: ${booking.carType}
💰 السعر: ${booking.price} دج
📞 الهاتف: ${booking.phone}
👤 عدد الركاب: ${booking.passengers}
`;

    ctx.reply(
      summary,
      Markup.inlineKeyboard([
        Markup.button.callback("✅ تأكيد الحجز", `confirm_${booking.id}`),
        Markup.button.callback("❌ إلغاء الحجز", `cancel_${booking.id}`),
      ]),
    );
  } catch (err) {
    ctx.reply("❌ حدث خطأ أثناء معالجة الطلب.");
  }
});

bot.action(/confirm_(.*)/, async (ctx) => {
  const id = ctx.match[1];
  await updateStatus(id, "confirmed");
  ctx.editMessageReplyMarkup(); // إخفاء الأزرار
  ctx.reply("✅ تم تأكيد الحجز بنجاح.");
});

bot.action(/cancel_(.*)/, async (ctx) => {
  const id = ctx.match[1];
  await updateStatus(id, "cancelled");
  ctx.editMessageReplyMarkup();
  ctx.reply("❌ تم إلغاء الحجز.");
});

async function updateStatus(id, status) {
  try {
    const response = await axios.get(API_URL, {
      headers: { "X-Master-Key": API_KEY },
    });
    let bookings = response.data.record;

    const index = bookings.findIndex((b) => b.id === id);
    if (index !== -1) {
      bookings[index].status = status;
    }

    await axios.put(`https://api.jsonbin.io/v3/b/${BIN_ID}`, bookings, {
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": API_KEY,
        "X-Bin-Versioning": false,
      },
    });
  } catch (error) {
    console.error("Error updating status:", error.message);
  }
}

bot.launch();
