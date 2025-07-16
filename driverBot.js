const { Telegraf } = require("telegraf");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
require("dotenv").config();

const bot = new Telegraf(process.env.TELEGRAM_DRIVER_TOKEN);
const driversBin = process.env.JSONBIN_DRIVERS_ID;
const bookingsBin = process.env.JSONBIN_BOOKINGS_ID;
const apiKey = process.env.JSONBIN_API_KEY;

const registerState = {};

// ✅ التحقق إذا السائق مسجل
async function isDriverRegistered(chatId) {
  try {
    const res = await fetch(
      `https://api.jsonbin.io/v3/b/${driversBin}/latest`,
      {
        headers: { "X-Master-Key": apiKey },
      },
    );
    const json = await res.json();
    const drivers = Array.isArray(json.record) ? json.record : [];
    return drivers.some((driver) => driver.chatId === chatId);
  } catch (err) {
    console.error("❌ خطأ أثناء التحقق من السائق:", err);
    return false;
  }
}

// ✅ عرض سجل الحجوزات الخاصة بالسائق
async function getDriverBookings(chatId) {
  try {
    const res = await fetch(
      `https://api.jsonbin.io/v3/b/${bookingsBin}/latest`,
      {
        headers: { "X-Master-Key": apiKey },
      },
    );
    const json = await res.json();
    const allBookings = json.record;

    return allBookings.filter((b) => b.driverChatId === chatId);
  } catch (err) {
    console.error("❌ فشل في جلب الحجوزات:", err);
    return [];
  }
}

bot.on("text", async (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text.trim();

  // ⛔️ إذا مش مسجل، أظهر رسالة تحذير (إلا إذا أرسل /start أو /register)
  if (text !== "/start" && text !== "/register") {
    const registered = await isDriverRegistered(chatId);
    if (!registered) {
      return ctx.reply(
        "⚠️ لم يتم التعرف عليك كسائق.\nمن فضلك أرسل /register للتسجيل.",
      );
    }
  }

  // 🟢 /start
  if (text === "/start") {
    return ctx.reply(
      "👋 أهلًا بك في بوت تسجيل السائقين!\n\n🛠 الأوامر المتاحة:\n/register - للتسجيل كسائق جديد\n/mybookings - عرض سجل الحجوزات",
    );
  }

  // 🟢 /register
  if (text === "/register") {
    registerState[chatId] = { step: "awaiting_name" };
    return ctx.reply("👋 من فضلك أرسل اسمك الكامل:");
  }

  // 🟢 /mybookings
  if (text === "/mybookings") {
    const bookings = await getDriverBookings(chatId);

    if (!bookings.length) {
      return ctx.reply("📭 لا يوجد أي حجز مسجل باسمك حتى الآن.");
    }

    for (const booking of bookings) {
      const msg = `📦 حجز:

🆔 ${booking.bookingId}
📍 من: ${booking.pickup}
🎯 إلى: ${booking.destination}
📅 ${booking.date} ⏰ ${booking.time}
👤 ${booking.name} - 📞 ${booking.phone}
🚗 ${booking.car} | 👥 ${booking.passengers}
💰 ${booking.price} دج
📌 الحالة: ${booking.status}`;

      await ctx.reply(msg);
    }
    return;
  }

  // ✅ التسجيل
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

        const existingDriver = current.find(
          (driver) => driver.chatId === chatId || driver.phone === phone,
        );

        if (existingDriver) {
          delete registerState[chatId];
          return ctx.reply("⚠️ أنت مسجل مسبقًا كسائق.");
        }

        current.push({
          chatId,
          name,
          phone,
          registeredAt: new Date().toISOString(),
        });

        await fetch(`https://api.jsonbin.io/v3/b/${driversBin}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Master-Key": apiKey,
          },
          body: JSON.stringify(current),
        });

        delete registerState[chatId];
        return ctx.reply(
          "✅ تم تسجيلك كسائق بنجاح.\n\nسيتم إشعارك بالحجوزات الجديدة.",
        );
      } catch (err) {
        console.error("❌ خطأ في تسجيل السائق:", err);
        return ctx.reply("❌ حدث خطأ أثناء حفظ بياناتك. حاول مرة أخرى.");
      }
    }
    return;
  }

  return ctx.reply("❓ لم أفهم رسالتك.\n\nاكتب /start لعرض الأوامر.");
});

bot.launch().then(() => {
  console.log("🚗 بوت التليغرام للسائقين شغال");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
