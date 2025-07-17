const { Telegraf } = require("telegraf");
const axios = require("axios");
require("dotenv").config();

const bot = new Telegraf(process.env.DRIVER_BOT_TOKEN);

// بيانات JSONBin
const BIN_ID = process.env.JSONBIN_BIN_ID;
const API_KEY = process.env.JSONBIN_API_KEY;
const BIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

// متغيرات التخزين المؤقت
const registrationSteps = new Map(); // chat_id => { step, name }

// جلب البيانات من JSONBin
async function fetchBookings() {
  const res = await axios.get(BIN_URL + "/latest", {
    headers: {
      "X-Master-Key": API_KEY,
    },
  });
  return res.data.record || [];
}

// حفظ البيانات في JSONBin
async function saveBookings(bookings) {
  await axios.put(BIN_URL, bookings, {
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": API_KEY,
    },
  });
}

// بدء البوت
bot.start((ctx) => {
  ctx.reply(
    "👋 أهلًا بك في بوت تسجيل السائقين!\n\n🛠 الأوامر المتاحة:\n/register - للتسجيل كسائق جديد\n/mybookings - عرض سجل الحجوزات",
  );
});

// أمر التسجيل
bot.command("register", (ctx) => {
  registrationSteps.set(ctx.chat.id, { step: "askName" });
  ctx.reply("👋 من فضلك أرسل اسمك الكامل:");
});

// استقبال الرسائل في التسجيل
bot.on("text", async (ctx) => {
  const stepData = registrationSteps.get(ctx.chat.id);
  if (!stepData) return;

  const text = ctx.message.text.trim();
  const allBookings = await fetchBookings();

  if (stepData.step === "askName") {
    stepData.name = text;
    stepData.step = "askPhone";
    registrationSteps.set(ctx.chat.id, stepData);
    ctx.reply("📞 الآن أرسل رقم هاتفك:");
  } else if (stepData.step === "askPhone") {
    const phone = text;
    const alreadyRegistered = allBookings.some((b) => b.driverPhone === phone);

    if (alreadyRegistered) {
      ctx.reply("⚠️ أنت مسجل مسبقًا كسائق.");
    } else {
      allBookings.push({
        driverName: stepData.name,
        driverPhone: phone,
        driverChatId: ctx.chat.id,
        registeredAt: new Date().toISOString(),
        driverConfirmed: true,
      });
      await saveBookings(allBookings);
      ctx.reply("✅ تم تسجيلك بنجاح كسائق!");
    }

    registrationSteps.delete(ctx.chat.id);
  }
});

// أمر عرض الحجوزات
bot.command("mybookings", async (ctx) => {
  const allBookings = await fetchBookings();
  const user = allBookings.find((b) => b.driverChatId === ctx.chat.id);

  if (!user) {
    ctx.reply("⚠️ لم يتم التعرف عليك كسائق.\nمن فضلك أرسل /register للتسجيل.");
    return;
  }

  const driverPhone = user.driverPhone;
  const myBookings = allBookings.filter(
    (b) => b.driverPhone === driverPhone && b.status === "confirmed",
  );

  if (myBookings.length === 0) {
    ctx.reply("🚫 لا توجد حجوزات مؤكدة لك حاليًا.");
    return;
  }

  for (const booking of myBookings) {
    ctx.reply(
      `📍 من: ${booking.pickup}\n🎯 إلى: ${booking.destination}\n📅 التاريخ: ${booking.date}\n⏰ الوقت: ${booking.time}\n🚗 نوع السيارة: ${booking.carType}\n💰 السعر: ${booking.price} دج\n👤 العميل: ${booking.name}\n📞 ${booking.phone}`,
    );
  }
});

// تشغيل البوت
bot.launch();
console.log("✅ Driver bot is running.");
