const { Telegraf, Markup } = require("telegraf");
const axios = require("axios");

const bot = new Telegraf("8138462701:AAHR0cjGDtANdcnRXeECCx0pzrodChNJbE8"); // ضع توكن بوت الزبون هنا

const BIN_ID = "686e440cdfff172fa6580e1a";
const API_KEY = "$2a$10$vMpDP3Fww5je7/MNZOgzAOtxURMO3opCog2/MVJ9YS8W6LFy2l4JW";
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}/latest`;

bot.start((ctx) => {
  ctx.reply(
    "👋 أهلاً بك في خدمة تأكيد الحجز!\n\n📲 أرسل رقم هاتفك الذي قمت بالحجز به (مثال: +213612345678)",
  );
});

bot.on("text", async (ctx) => {
  const userPhone = ctx.message.text.trim();
  if (!/^\+213\d{9}$/.test(userPhone)) {
    return ctx.reply(
      "⚠️ يرجى إدخال رقم هاتف صحيح يبدأ بـ +213 ويحتوي على 9 أرقام بعده.",
    );
  }

  try {
    const response = await axios.get(JSONBIN_URL, {
      headers: {
        "X-Master-Key": API_KEY,
      },
    });

    const bookings = response.data.record;
    const normalizePhone = (phone) =>
      phone.replace(/\s+/g, "").replace(/^\+213/, "0");

    const normalizedUserPhone = normalizePhone(userPhone);

    const booking = bookings.find(
      (b) =>
        normalizePhone(b.phone) === normalizedUserPhone &&
        b.status === "في الانتظار",
    );

    if (!booking) {
      return ctx.reply(
        "❌ لم يتم العثور على حجز مرتبط بهذا الرقم أو تم تأكيده/إلغاؤه.",
      );
    }

    const bookingText = `
📍 من: ${booking.from}
🎯 إلى: ${booking.to}
📅 التاريخ: ${booking.date}
⏰ الوقت: ${booking.time}
🚕 نوع السيارة: ${booking.carType}
👤 عدد الركاب: ${booking.passengers}
📞 الهاتف: ${booking.phone}
💰 السعر: ${booking.price}
🔐 رقم الحجز: ${booking.code}
    `;

    ctx.reply(
      bookingText,
      Markup.inlineKeyboard([
        Markup.button.callback("✅ تأكيد الحجز", `confirm_${booking.code}`),
        Markup.button.callback("❌ إلغاء الحجز", `cancel_${booking.code}`),
      ]),
    );
  } catch (error) {
    console.error("❌ Error fetching booking:", error.message);
    ctx.reply("⚠️ حدث خطأ أثناء جلب معلومات الحجز. حاول لاحقًا.");
  }
});

// التأكيد
bot.action(/^confirm_(.+)/, async (ctx) => {
  const code = ctx.match[1];

  try {
    const response = await axios.get(JSONBIN_URL, {
      headers: { "X-Master-Key": API_KEY },
    });

    const bookings = response.data.record;
    const index = bookings.findIndex((b) => b.code === code);
    if (index === -1 || bookings[index].status !== "في الانتظار") {
      return ctx.reply("⚠️ لا يمكن تأكيد هذا الحجز.");
    }

    bookings[index].status = "مؤكد";

    await axios.put(`https://api.jsonbin.io/v3/b/${BIN_ID}`, bookings, {
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": API_KEY,
      },
    });

    ctx.editMessageReplyMarkup(); // إزالة الأزرار
    ctx.reply("✅ تم تأكيد الحجز بنجاح. شكراً لك!");
  } catch (error) {
    console.error("Error confirming booking:", error.message);
    ctx.reply("⚠️ حدث خطأ أثناء تأكيد الحجز.");
  }
});

// الإلغاء
bot.action(/^cancel_(.+)/, async (ctx) => {
  const code = ctx.match[1];

  try {
    const response = await axios.get(JSONBIN_URL, {
      headers: { "X-Master-Key": API_KEY },
    });

    const bookings = response.data.record;
    const index = bookings.findIndex((b) => b.code === code);
    if (index === -1 || bookings[index].status !== "في الانتظار") {
      return ctx.reply("⚠️ لا يمكن إلغاء هذا الحجز.");
    }

    bookings[index].status = "ملغى";

    await axios.put(`https://api.jsonbin.io/v3/b/${BIN_ID}`, bookings, {
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": API_KEY,
      },
    });

    ctx.editMessageReplyMarkup(); // إزالة الأزرار
    ctx.reply("❌ تم إلغاء الحجز بنجاح.");
  } catch (error) {
    console.error("Error cancelling booking:", error.message);
    ctx.reply("⚠️ حدث خطأ أثناء إلغاء الحجز.");
  }
});

bot.launch();
