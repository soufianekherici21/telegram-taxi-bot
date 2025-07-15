// ✅ index.js - نسخة محدثة بالكامل مع منطق: لا يمكن للعميل تأكيد الحجز فقط الإلغاء

const { Telegraf, Markup } = require("telegraf");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const binId = process.env.JSONBIN_BOOKINGS_ID;
const driversBin = process.env.JSONBIN_DRIVERS_ID;
const usersBin = process.env.JSONBIN_USERS_ID;
const apiKey = process.env.JSONBIN_API_KEY;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

const app = express();
app.use(cors());
app.use(express.json());

const registerState = {};

// ✅ استقبال طلبات الحجز
app.post("/api/booking", async (req, res) => {
  const data = req.body;

  const message = `🚖 تم تسجيل حجز جديد\n\n🆔 رقم الحجز: ${data.bookingId}\n📍 مكان الركوب: ${data.pickup}\n🎯 الوجهة: ${data.destination}\n📅 التاريخ: ${data.date}\n⏰ الوقت: ${data.time}\n🚗 نوع السيارة: ${data.car}\n💰 السعر: ${data.price} دج\n👤 الاسم: ${data.name}\n📞 الهاتف: ${data.phone}\n👥 عدد الركاب: ${data.passengers}`;

  try {
    await bot.telegram.sendMessage(telegramChatId, message, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ قبول", callback_data: `accept_${data.bookingId}` },
            { text: "❌ رفض", callback_data: `reject_${data.bookingId}` },
          ],
        ],
      },
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
    console.error("❌ فشل في الحفظ أو الإرسال:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ معالجة رسائل البوت
bot.on("text", async (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text.trim();

  // تسجيل الرقم تلقائيًا
  if (/^\+?\d{9,13}$/.test(text)) {
    const phone = text.replace(/\s/g, "");
    try {
      const res = await fetch(
        `https://api.jsonbin.io/v3/b/${usersBin}/latest`,
        {
          headers: { "X-Master-Key": apiKey },
        },
      );
      const json = await res.json();
      const current = Array.isArray(json.record) ? json.record : [];

      const existing = current.find((u) => u.chatId === chatId);
      if (!existing) {
        current.push({ chatId, phone });
        await fetch(`https://api.jsonbin.io/v3/b/${usersBin}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Master-Key": apiKey,
          },
          body: JSON.stringify(current),
        });
      }
    } catch (err) {
      console.error("فشل في ربط الهاتف:", err);
    }
    return ctx.reply("✅ تم ربط رقم هاتفك.");
  }

  const userMessage = text.toUpperCase();
  if (userMessage === "/START") {
    return ctx.reply(
      "👋 أرسل رقم الحجز (مثلاً: TXI123456) لرؤية التفاصيل أو إلغائه.",
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

      const baseMsg = `✅ تفاصيل حجزك:\n\n🆔 رقم الحجز: ${booking.bookingId}\n📍 مكان الركوب: ${booking.pickup}\n🎯 الوجهة: ${booking.destination}\n📅 التاريخ: ${booking.date}\n⏰ الوقت: ${booking.time}\n🚗 نوع السيارة: ${booking.car}\n💰 السعر: ${booking.price} دج\n👤 الاسم: ${booking.name}\n📞 الهاتف: ${booking.phone}\n👥 عدد الركاب: ${booking.passengers}`;

      if (booking.status === "confirmed") {
        return ctx.reply(`${baseMsg}\n\n✅ تم تأكيد هذا الحجز مسبقًا.`);
      } else if (booking.status === "cancelled") {
        return ctx.reply(`${baseMsg}\n\n❌ تم إلغاء هذا الحجز مسبقًا.`);
      } else if (booking.status === "accepted") {
        return ctx.reply(
          `${baseMsg}\n\n🚖 تم قبول حجزك من طرف السائق. يمكنك الإلغاء إن أردت.`,
          Markup.inlineKeyboard([
            Markup.button.callback(
              "❌ إلغاء الحجز",
              `cancel_${booking.bookingId}`,
            ),
          ]),
        );
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

  return ctx.reply("❓ أرسل /start أو رقم الحجز مثل: TXI123456");
});

// ✅ أزرار القبول/الإلغاء/تأكيد السائق
bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const chatId = ctx.chat.id;

  if (data.startsWith("accept_")) {
    const bookingId = data.split("_")[1];
    const driverChatId = ctx.from.id;

    try {
      const driverRes = await fetch(
        `https://api.jsonbin.io/v3/b/${driversBin}/latest`,
        {
          headers: { "X-Master-Key": apiKey },
        },
      );
      const driverJson = await driverRes.json();
      const drivers = driverJson.record;
      const driver = drivers.find((d) => d.chatId === driverChatId);
      if (!driver) return ctx.reply("❌ لم يتم العثور على حسابك كسائق.");

      const bookingsRes = await fetch(
        `https://api.jsonbin.io/v3/b/${binId}/latest`,
        {
          headers: { "X-Master-Key": apiKey },
        },
      );
      const bookingsJson = await bookingsRes.json();
      const bookings = bookingsJson.record;
      const index = bookings.findIndex((b) => b.bookingId === bookingId);
      if (index === -1) return ctx.reply("❌ الحجز غير موجود.");

      const status = bookings[index].status;
      if (status !== "pending")
        return ctx.reply(`⚠️ هذا الحجز تمت معالجته مسبقًا (${status}).`);

      bookings[index].status = "accepted";
      bookings[index].driverChatId = driverChatId;
      bookings[index].driverPhone = driver.phone;
      bookings[index].driverName = driver.name;

      await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": apiKey,
        },
        body: JSON.stringify(bookings),
      });

      // إشعار للعميل
      const clientPhone = bookings[index].phone;
      const userListRes = await fetch(
        `https://api.jsonbin.io/v3/b/${usersBin}/latest`,
        {
          headers: { "X-Master-Key": apiKey },
        },
      );
      const userListJson = await userListRes.json();
      const users = userListJson.record;
      const matchedUser = users.find((u) => u.phone === clientPhone);

      if (matchedUser) {
        const messageToClient = `🚖 تم قبول حجزك من طرف السائق: ${driver.name}

🆔 رقم الحجز: ${bookings[index].bookingId}
📍 من: ${bookings[index].pickup}
🎯 إلى: ${bookings[index].destination}
📅 التاريخ: ${bookings[index].date}
⏰ الوقت: ${bookings[index].time}`;
        await bot.telegram.sendMessage(matchedUser.chatId, messageToClient);
      }

      await ctx.editMessageReplyMarkup();
      return ctx.reply("✅ تم قبول الحجز بنجاح.");
    } catch (err) {
      console.error(err);
      return ctx.reply("⚠️ حدث خطأ أثناء قبول الحجز.");
    }
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

      if (index === -1) return ctx.answerCbQuery("❌ لم يتم العثور على الحجز.");
      bookings[index].status = "cancelled";

      await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": apiKey,
        },
        body: JSON.stringify(bookings),
      });

      await ctx.editMessageReplyMarkup();
      return ctx.reply("❌ تم إلغاء الحجز.");
    } catch (err) {
      console.error(err);
      return ctx.reply("⚠️ حدث خطأ أثناء إلغاء الحجز.");
    }
  }

  ctx.answerCbQuery();
});

app.get("/", (req, res) => res.send("🚕 بوت الحجز شغال 👋"));
bot.launch();
app.listen(3000, () =>
  console.log("✅ السيرفر يعمل على http://localhost:3000"),
);
