// ✅ كود بوت الحجز المحدث بالكامل - يشمل كل الميزات الأخيرة
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

// ✅ استقبال طلبات الحجز
app.post("/api/booking", async (req, res) => {
  const data = req.body;
  console.log("📦 البيانات المستلمة من النموذج:", data);

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

// ✅ تسجيل المستخدم عند أول تفاعل
bot.on("text", async (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text.trim();

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

        current.push({ chatId, name, phone });

        await fetch(`https://api.jsonbin.io/v3/b/${driversBin}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Master-Key": apiKey,
          },
          body: JSON.stringify(current),
        });

        delete registerState[chatId];
        return ctx.reply("✅ تم تسجيلك كسائق بنجاح.");
      } catch (err) {
        console.error(err);
        return ctx.reply("❌ حدث خطأ أثناء حفظ بياناتك.");
      }
    }
    return;
  }

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

      const baseMsg = `✅ تفاصيل حجزك:\n\n🆔 رقم الحجز: ${booking.bookingId}\n📍 مكان الركوب: ${booking.pickup}\n🎯 الوجهة: ${booking.destination}\n📅 التاريخ: ${booking.date}\n⏰ الوقت: ${booking.time}\n🚗 نوع السيارة: ${booking.car}\n💰 السعر: ${booking.price} دج\n👤 الاسم: ${booking.name}\n📞 الهاتف: ${booking.phone}\n👥 عدد الركاب: ${booking.passengers}`;

      if (booking.status === "confirmed") {
        return ctx.reply(`${baseMsg}\n\n✅ تم تأكيد هذا الحجز مسبقًا.`);
      } else if (booking.status === "cancelled") {
        return ctx.reply(`${baseMsg}\n\n❌ تم إلغاء هذا الحجز مسبقًا.`);
      } else if (booking.status === "accepted") {
        return ctx.reply(
          `${baseMsg}\n\n🚖 تم قبول الحجز من طرف أحد السائقين. يمكنك إلغاؤه إن أردت.`,
          Markup.inlineKeyboard([
            Markup.button.callback("❌ إلغاء", `cancel_${booking.bookingId}`),
          ]),
        );
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
      console.error(err);
      return ctx.reply("⚠️ حدث خطأ أثناء جلب بيانات الحجز.");
    }
  }

  return ctx.reply(
    "❓ لم أفهم رسالتك. أرسل /start أو رقم الحجز مثل: TXI123456",
  );
});

// ✅ التعامل مع أزرار التأكيد/الإلغاء/القبول
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

      if (!driver) {
        await ctx.editMessageReplyMarkup();
        return ctx.reply("❌ لم يتم العثور على حسابك كسائق");
      }

      const bookingsRes = await fetch(
        `https://api.jsonbin.io/v3/b/${binId}/latest`,
        {
          headers: { "X-Master-Key": apiKey },
        },
      );
      const bookingsJson = await bookingsRes.json();
      const bookings = bookingsJson.record;
      const index = bookings.findIndex((b) => b.bookingId === bookingId);

      if (index === -1) {
        await ctx.editMessageReplyMarkup();
        return ctx.reply("❌ الحجز غير موجود.");
      }

      const status = bookings[index].status;
      if (status !== "pending") {
        await ctx.editMessageReplyMarkup();
        return ctx.reply(`⚠️ هذا الحجز تمت معالجته مسبقًا (${status}).`);
      }

      bookings[index].status = "accepted";
      bookings[index].driverChatId = driverChatId;
      bookings[index].driverPhone = driver.phone;
      bookings[index].driverName = driver.name;

      // إرسال إشعار للعميل إن وجد
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
        const messageToClient = `🚖 تم قبول حجزك بنجاح من طرف السائق: ${driver.name}\n\n🆔 رقم الحجز: ${bookings[index].bookingId}\n📍 من: ${bookings[index].pickup}\n🎯 إلى: ${bookings[index].destination}\n📅 التاريخ: ${bookings[index].date}\n⏰ الوقت: ${bookings[index].time}`;
        await bot.telegram.sendMessage(matchedUser.chatId, messageToClient);
      }

      await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": apiKey,
        },
        body: JSON.stringify(bookings),
      });

      await ctx.editMessageReplyMarkup();
      await ctx.reply("✅ تم قبول الحجز بنجاح.");
    } catch (err) {
      console.error(err);
      await ctx.reply("⚠️ حدث خطأ أثناء قبول الحجز.");
    }
  }

  if (data.startsWith("confirm_") || data.startsWith("cancel_")) {
    const bookingId = data.split("_")[1];
    const action = data.startsWith("confirm") ? "confirmed" : "cancelled";

    try {
      const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
        headers: { "X-Master-Key": apiKey },
      });
      const json = await res.json();
      const bookings = json.record;
      const index = bookings.findIndex((b) => b.bookingId === bookingId);

      if (index === -1) {
        return ctx.answerCbQuery("❌ لم يتم العثور على الحجز.");
      }

      const currentStatus = bookings[index].status;
      if (currentStatus !== "pending" && currentStatus !== "accepted") {
        return ctx.answerCbQuery(
          `⚠️ تم التعامل مع هذا الحجز مسبقًا (${currentStatus})`,
          {
            show_alert: true,
          },
        );
      }

      bookings[index].status = action;

      await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": apiKey,
        },
        body: JSON.stringify(bookings),
      });

      await ctx.editMessageReplyMarkup();
      return ctx.reply(
        action === "confirmed"
          ? "✅ تم تأكيد الحجز بنجاح."
          : "❌ تم إلغاء الحجز.",
      );
    } catch (err) {
      console.error(err);
      return ctx.reply("⚠️ حدث خطأ أثناء تحديث الحجز.");
    }
  }

  ctx.answerCbQuery();
});

app.get("/", (req, res) => res.send("🚕 بوت الحجز شغال 👋"));
bot.launch();
app.listen(3000, () =>
  console.log("✅ السيرفر يعمل على http://localhost:3000"),
);
