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
    console.error("❌ فشل في الحفظ أو الإرسال:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

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

      // إشعار العميل
      const clientPhone = bookings[index].phone;
      if (usersBin) {
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
      }
    } catch (err) {
      console.error("❌ خطأ أثناء قبول الحجز:", err);
      await ctx.reply("⚠️ حدث خطأ أثناء قبول الحجز.");
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
      const currentStatus = bookings[index].status;

      if (currentStatus !== "pending") {
        return ctx.answerCbQuery(
          `⚠️ تم التعامل مع هذا الحجز مسبقًا (${currentStatus})`,
          {
            show_alert: true,
          },
        );
      }

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
