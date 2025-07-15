// index.js
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
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  }),
);
app.use(express.json());

const registerState = {};

// استقبال طلبات الحجز
app.post("/api/booking", async (req, res) => {
  const data = req.body;
  console.log("📦 البيانات المستلمة:", data);

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
    console.error("❌ فشل في المعالجة:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// التعامل مع رسائل البوت
bot.on("text", async (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text.trim();
  const normalizedPhone = text.replace(/[^0-9]/g, "").replace(/^213/, "0");

  // محاولة ربط رقم العميل بالبوت تلقائيًا
  if (/^0\d{9}$/.test(normalizedPhone)) {
    try {
      const res = await fetch(
        `https://api.jsonbin.io/v3/b/${usersBin}/latest`,
        {
          headers: { "X-Master-Key": apiKey },
        },
      );
      const json = await res.json();
      const users = Array.isArray(json.record) ? json.record : [];
      const exists = users.find((u) => u.phone === normalizedPhone);

      if (!exists) {
        users.push({ chatId, phone: normalizedPhone });
        await fetch(`https://api.jsonbin.io/v3/b/${usersBin}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Master-Key": apiKey,
          },
          body: JSON.stringify(users),
        });
        await ctx.reply("✅ تم ربط رقمك بالبوت.");
      }
    } catch (err) {
      console.error("❌ فشل في تسجيل المستخدم:", err);
    }
  }

  const upper = text.toUpperCase();
  if (upper === "/START") {
    return ctx.reply(
      "👋 أهلًا بك! أرسل رقم الحجز (مثل: TXI123456) لرؤية التفاصيل أو إلغاء الحجز.",
    );
  }

  if (/^TXI\d{6}$/.test(upper)) {
    try {
      const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
        headers: { "X-Master-Key": apiKey },
      });
      const data = await res.json();
      const bookings = data.record;
      const booking = bookings.find((b) => b.bookingId === upper);

      if (!booking) return ctx.reply("❌ لم يتم العثور على هذا الحجز.");

      const baseMsg = `✅ تفاصيل حجزك:

🆔 رقم الحجز: ${booking.bookingId}
📍 من: ${booking.pickup}
🎯 إلى: ${booking.destination}
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
        return ctx.reply(`${baseMsg}\n\n❌ تم إلغاء هذا الحجز.`);
      } else {
        return ctx.reply(
          baseMsg,
          Markup.inlineKeyboard([
            Markup.button.callback("✅ تأكيد", `confirm_${booking.bookingId}`),
            Markup.button.callback("❌ إلغاء", `cancel_${booking.bookingId}`),
          ]),
        );
      }
    } catch (err) {
      console.error("❌ خطأ في جلب البيانات:", err);
      return ctx.reply("⚠️ فشل في تحميل معلومات الحجز.");
    }
  }

  return ctx.reply("❓ لم أفهمك. أرسل /start أو رقم الحجز (TXIxxxxxx).");
});

// التعامل مع الأزرار
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

      if (!driver) return ctx.reply("❌ لم يتم العثور على السائق.");

      const bookingsRes = await fetch(
        `https://api.jsonbin.io/v3/b/${binId}/latest`,
        {
          headers: { "X-Master-Key": apiKey },
        },
      );
      const bookingsJson = await bookingsRes.json();
      const bookings = bookingsJson.record;
      const index = bookings.findIndex((b) => b.bookingId === bookingId);

      if (index === -1 || bookings[index].status !== "pending") {
        return ctx.reply("⚠️ الحجز غير صالح أو تمت معالجته مسبقًا.");
      }

      bookings[index].status = "accepted";
      bookings[index].driverChatId = driverChatId;
      bookings[index].driverPhone = driver.phone;

      await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": apiKey,
        },
        body: JSON.stringify(bookings),
      });

      await ctx.reply("✅ تم قبول الحجز بنجاح.");

      // 🔔 إرسال إشعار للعميل
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
        const driverName = driver.name || "سائق";
        const messageToClient = `🚖 تم قبول حجزك بنجاح من طرف السائق: ${driverName}

🆔 رقم الحجز: ${bookings[index].bookingId}
📍 من: ${bookings[index].pickup}
🎯 إلى: ${bookings[index].destination}
📅 التاريخ: ${bookings[index].date}
⏰ الوقت: ${bookings[index].time}`;

        await bot.telegram.sendMessage(matchedUser.chatId, messageToClient);
      }
    } catch (err) {
      console.error("❌ فشل قبول الحجز:", err);
    }
  }
});

app.get("/", (req, res) => res.send("🚕 بوت الحجز شغال 👋"));
bot.launch();
app.listen(3000, () =>
  console.log("✅ السيرفر يعمل على http://localhost:3000"),
);
