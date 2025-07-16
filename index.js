const express = require("express");
const cors = require("cors");
require("dotenv").config();

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.json());

const apiKey = process.env.JSONBIN_API_KEY;
const binId = process.env.JSONBIN_BOOKINGS_ID;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;
const { Telegraf } = require("telegraf");
const bot = new Telegraf(process.env.TELEGRAM_DRIVER_TOKEN); // استخدم بوت السائقين فقط هنا

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 السيرفر شغال على المنفذ ${PORT}`);
});
