const { Telegraf, Markup } = require("telegraf");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
require("dotenv").config();
const bot = new Telegraf(process.env.TELEGRAM_CLIENT_TOKEN);
const binId = process.env.JSONBIN_BOOKINGS_ID;
const usersBin = process.env.JSONBIN_USERS_ID;
const apiKey = process.env.JSONBIN_API_KEY;

// ❌ حذف Webhook لتفادي تعارضات
bot.telegram
  .deleteWebhook()
  .then(() => {
    console.log("✅ Webhook تم حذفه بنجاح");
  })
  .catch((err) => {
    console.warn("⚠️ فشل في حذف Webhook:", err.message);
  });

// 🧠 دالة مساعدة لجلب chatId من رقم الهاتف
async function getUserChatIdByPhone(phone) {
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${usersBin}/latest`, {
      headers: { "X-Master-Key": apiKey },
    });
    const json = await res.json();
    const users = json.record;
    const user = users.find((u) => u.phone === phone);
    return user?.chatId || null;
  } catch (err) {
    console.error("❌ فشل في جلب usersBin:", err);
    return null;
  }
}

bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;

  if (data.startsWith("cancel_")) {
    const bookingId = data.split("_")[1];

    try {
      const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
        headers: { "X-Master-Key": apiKey },
      });
      const json = await res.json();
      const bookings = json.record;

      const index = bookings.findIndex((b) => b.bookingId === bookingId);
      if (index === -1) return ctx.reply("❌ لم يتم العثور على الحجز.");

      bookings[index].status = "cancelled";

      await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": apiKey,
        },
        body: JSON.stringify(bookings),
      });

      return ctx.reply("✅ تم إلغاء حجزك بنجاح.");
    } catch (err) {
      console.error("❌ خطأ أثناء إلغاء الحجز:", err);
      return ctx.reply("❌ حدث خطأ أثناء إلغاء الحجز.");
    }
  }
});

bot.on("text", async (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text.trim();
  const upper = text.toUpperCase();

  if (upper === "/START") {
    return ctx.reply("👋 أهلًا بك! أرسل رقم الحجز الذي وصلك (مثل: TXI123456)");
  }

  if (/^TXI\d{6}$/.test(upper)) {
    try {
      const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
        headers: { "X-Master-Key": apiKey },
      });
      const data = await res.json();
      const bookings = data.record;
      const booking = bookings.find((b) => b.bookingId === upper);

      if (!booking) return ctx.reply("❌ لم يتم العثور على حجز بهذا الرقم.");

      // 🔐 تخزين رقم الهاتف + chatId في usersBin
      if (usersBin) {
        try {
          const usersRes = await fetch(
            `https://api.jsonbin.io/v3/b/${usersBin}/latest`,
            {
              headers: { "X-Master-Key": apiKey },
            },
          );
          const usersData = await usersRes.json();
          const users = usersData.record;

          const alreadyExists = users.some(
            (u) => u.phone === booking.phone || u.chatId === chatId,
          );

          if (!alreadyExists) {
            users.push({ phone: booking.phone, chatId });

            await fetch(`https://api.jsonbin.io/v3/b/${usersBin}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                "X-Master-Key": apiKey,
              },
              body: JSON.stringify(users),
            });

            console.log(`✅ تم ربط رقم ${booking.phone} بـ chatId: ${chatId}`);
          }
        } catch (e) {
          console.error("❌ فشل في تحديث Bin المستخدمين:", e);
        }
      }

      // 📩 رسالة تفاصيل الحجز
      const baseMsg = `✅ تفاصيل حجزك:

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

      if (booking.status === "confirmed") {
        return ctx.reply(`${baseMsg}\n\n✅ تم تأكيد هذا الحجز مسبقًا.`);
      } else if (booking.status === "cancelled") {
        return ctx.reply(`${baseMsg}\n\n❌ تم إلغاء هذا الحجز مسبقًا.`);
      } else {
        return ctx.reply(
          `${baseMsg}\n\n⚠️ حجزك قيد الانتظار. يمكنك الإلغاء في أي وقت.`,
          Markup.inlineKeyboard([
            Markup.button.callback(
              "❌ إلغاء الحجز",
              `cancel_${booking.bookingId}`,
            ),
          ]),
        );
      }
    } catch (err) {
      console.error(err);
      return ctx.reply("⚠️ حدث خطأ أثناء جلب بيانات الحجز.");
    }
  }

  return ctx.reply(
    "❓ لم أفهم رسالتك. أرسل /start أو رقم الحجز مثل: TXI123456",
  );
});

bot.launch().then(() => {
  console.log("🤖 بوت الزبائن شغال");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
