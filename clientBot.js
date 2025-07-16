
const { Telegraf, Markup } = require("telegraf");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
require("dotenv").config();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const binId = process.env.JSONBIN_BOOKINGS_ID;
const usersBin = process.env.JSONBIN_USERS_ID;
const apiKey = process.env.JSONBIN_API_KEY;

// دالة مساعدة للبحث عن chatId العميل حسب رقم الهاتف
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

  if (data.startsWith("accept_")) {
    const bookingId = data.split("_")[1];

    try {
      const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
        headers: { "X-Master-Key": apiKey },
      });
      const json = await res.json();
      const bookings = json.record;

      const index = bookings.findIndex((b) => b.bookingId === bookingId);
      if (index === -1) return ctx.reply("❌ لم يتم العثور على الحجز.");

      const booking = bookings[index];
      bookings[index].status = "accepted";
      bookings[index].driverChatId = ctx.from.id;

      await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": apiKey,
        },
        body: JSON.stringify(bookings),
      });

      const userChatId = await getUserChatIdByPhone(booking.phone);

      if (userChatId) {
        const message = `🚖 تم قبول حجزك بنجاح!\n\n🆔 رقم الحجز: ${booking.bookingId}\n📍 من: ${booking.pickup}\n🎯 إلى: ${booking.destination}\n⏰ الوقت: ${booking.time}`;
        await bot.telegram.sendMessage(userChatId, message);
      } else {
        console.warn("⚠️ لم يتم العثور على chatId للعميل.");
      }

      return ctx.reply("✅ تم قبول الحجز وتم إشعار العميل.");
    } catch (err) {
      console.error("❌ خطأ أثناء قبول الحجز:", err);
      return ctx.reply("❌ حدث خطأ أثناء معالجة القبول.");
    }
  }

  if (data.startsWith("reject_")) {
    return ctx.reply("❌ تم رفض الحجز.");
  }

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
  console.log("📩 عميل جديد:", ctx.chat.id, ctx.message.text);
  const chatId = ctx.chat.id;
  const text = ctx.message.text.trim();

  const userMessage = text.toUpperCase();
  if (userMessage === "/START") {
    return ctx.reply(
      "👋 أهلًا بك! من فضلك أرسل رقم الحجز الذي وصلك (مثلاً: TXI123456)",
    );
  }

  if (/^TXI\d{6}$/.test(userMessage)) {
    try {
      const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
        headers: { "X-Master-Key": apiKey },
      });
      const data = await res.json();
      const bookings = data.record;
      const booking = bookings.find((b) => b.bookingId === userMessage);

      if (!booking) return ctx.reply("❌ لم يتم العثور على حجز بهذا الرقم.");

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
  console.log("🤖 بوت التليغرام للزبائن شغال");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
