const { Telegraf, Markup } = require("telegraf");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const app = express();
app.use(cors()); // ✅ للسماح بالوصول من Blogger
app.use(express.json());

const binId = process.env.JSONBIN_BOOKINGS_ID;
const apiKey = process.env.JSONBIN_API_KEY;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

// ✅ استقبال رسالة من المستخدم (رقم الحجز)
bot.on("text", async (ctx) => {
  const userMessage = ctx.message.text.trim().toUpperCase();

  if (userMessage === "/START") {
    return ctx.reply("👋 أهلًا بك! من فضلك أرسل رقم الحجز الذي وصلك (مثلاً: TXI123456)");
  }

  if (/^TXI\d{6}$/.test(userMessage)) {
    try {
      const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
        headers: { "X-Master-Key": apiKey },
      });
      const data = await res.json();
      const bookings = data.record;
      const booking = bookings.find((b) => b.bookingId === userMessage);

      if (booking) {
        const msg = `✅ تفاصيل حجزك:

🆔 رقم الحجز: ${booking.bookingId}
📍 مكان الركوب: ${booking.pickup}
🎯 الوجهة: ${booking.destination}
📅 التاريخ: ${booking.date}
⏰ الوقت: ${booking.time}
🚗 نوع السيارة: ${booking.car}
💰 السعر: ${booking.price} دج
👤 الاسم: ${booking.name}
📞 الهاتف: ${booking.phone}
👥 عدد الركاب: ${booking.passengers}`;

        // ✅ إرسال مع أزرار
        return ctx.reply(msg, Markup.inlineKeyboard([
          Markup.button.callback("✅ تأكيد", `confirm_${booking.bookingId}`),
          Markup.button.callback("❌ إلغاء", `cancel_${booking.bookingId}`)
        ]));
      } else {
        return ctx.reply("❌ لم يتم العثور على حجز بهذا الرقم.");
      }
    } catch (err) {
      console.error("❌ خطأ أثناء جلب الحجز:", err);
      return ctx.reply("⚠️ حدث خطأ أثناء جلب بيانات الحجز.");
    }
  }

  return ctx.reply("❓ لم أفهم رسالتك. أرسل /start أو رقم الحجز مثل: TXI123456");
});

// ✅ أزرار التأكيد أو الإلغاء
bot.on("callback_query", async (ctx) => {
  const action = ctx.callbackQuery.data;
  const bookingId = action.split("_")[1];

  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
      headers: { "X-Master-Key": apiKey },
    });
    const json = await res.json();
    const bookings = json.record;

    const index = bookings.findIndex((b) => b.bookingId === bookingId);
    if (index === -1) return ctx.answerCbQuery("❌ لم يتم العثور على الحجز.");

    if (action.startsWith("confirm")) {
      bookings[index].status = "confirmed";
      await ctx.editMessageReplyMarkup(); // حذف الأزرار
      await ctx.reply("✅ تم تأكيد الحجز بنجاح.");
    } else if (action.startsWith("cancel")) {
      bookings[index].status = "cancelled";
      await ctx.editMessageReplyMarkup();
      await ctx.reply("❌ تم إلغاء الحجز.");
    }

    await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": apiKey,
      },
      body: JSON.stringify(bookings),
    });
  } catch (err) {
    console.error("❌ خطأ أثناء تعديل حالة الحجز:", err);
    ctx.reply("⚠️ حدث خطأ أثناء تحديث حالة الحجز.");
  }

  ctx.answerCbQuery();
});

// ✅ نقطة استلام الحجز من موقعك
app.post("/api/booking", async (req, res) => {
  const data = req.body;
  console.log("📦 حجز جديد:", data);

  const message = `🚖 تم تسجيل حجز جديد

🆔 رقم الحجز: ${data.bookingId}
📍 مكان الركوب: ${data.pickup}
🎯 الوجهة: ${data.destination}
📅 التاريخ: ${data.date}
⏰ الوقت: ${data.time}
🚗 نوع السيارة: ${data.car}
💰 السعر: ${data.price} دج
👤 الاسم: ${data.name}
📞 الهاتف: ${data.phone}
👥 عدد الركاب: ${data.passengers}`;

  try {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: message,
      }),
    });

    const resBin = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
      headers: { "X-Master-Key": apiKey },
    });
    const json = await resBin.json();
    const current = Array.isArray(json.record) ? json.record : [];

    current.push({
      ...data,
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": apiKey,
      },
      body: JSON.stringify(current),
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ فشل في حفظ الحجز أو الإرسال:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ إطلاق البوت والسيرفر
bot.launch();
app.listen(3000, () => console.log("✅ السيرفر يعمل على http://localhost:3000"));
