const { Telegraf } = require("telegraf");
const fetch = require("node-fetch");

// استبدل هذا بالتوكن الخاص ببوت السائقين
const bot = new Telegraf("8172628908:AAF-wpN3lS_rMlVKN8skVFqHp0FdKjk2Zdc");

// بيانات JSONBin
const BIN_ID = "686e440cdfff172fa6580e1a"; // نفس Bin الحجوزات
const API_KEY = "$2a$10$vMpDP3Fww5je7/MNZOgzAOtxURMO3opCog2/MVJ9YS8W6LFy2l4JW";

// /start
bot.start((ctx) => {
  ctx.reply(`👋 أهلاً ${ctx.from.first_name} في بوت السائقين!
📲 للتسجيل، أرسل رقم هاتفك بالأمر التالي:
مثال: /register +213612345678`);
});

// /register +213xxxxxxxxx
bot.command("register", async (ctx) => {
  const input = ctx.message.text.trim().split(" ");

  if (input.length !== 2 || !input[1].startsWith("+213")) {
    return ctx.reply(
      "📵 من فضلك أرسل رقم الهاتف بعد الأمر:\n/register +213612345678",
    );
  }

  const phone = input[1].replace(/\s+/g, "");
  const chatId = ctx.chat.id;
  const name = ctx.from.first_name;

  try {
    // جلب البيانات من JSONBin
    const response = await fetch(
      `https://api.jsonbin.io/v3/b/${BIN_ID}/latest`,
      {
        headers: {
          "X-Master-Key": API_KEY,
        },
      },
    );

    const data = await response.json();
    const bookings = data.record || [];

    // تحديث الحجز إذا وجد رقم الهاتف
    let updated = false;
    const updatedBookings = bookings.map((booking) => {
      if (
        booking.phone === phone &&
        booking.status === "مؤكد" &&
        !booking.driver
      ) {
        booking.driver = {
          name: name,
          chatId: chatId,
        };
        updated = true;
      }
      return booking;
    });

    if (!updated) {
      return ctx.reply(
        "⚠️ لم يتم العثور على أي حجز مؤكد بهذا الرقم أو تم قبوله من قبل.",
      );
    }

    // تحديث BIN
    await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": API_KEY,
        "X-Bin-Name": "taxi-bookings",
      },
      body: JSON.stringify(updatedBookings),
    });

    ctx.reply("✅ تم تسجيلك كسائق بنجاح! سيتم إشعارك بالحجوزات القادمة.");
  } catch (error) {
    console.error("❌ خطأ أثناء التسجيل:", error.message);
    ctx.reply("⚠️ حدث خطأ أثناء التسجيل. يرجى المحاولة لاحقًا.");
  }
});

bot.launch();
console.log("🚀 Driver bot is running...");
