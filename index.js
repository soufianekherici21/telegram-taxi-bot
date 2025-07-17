const express = require("express");
const axios = require("axios");
const app = express();

const BIN_ID = "686e440cdfff172fa6580e1a";
const API_KEY = "$2a$10$vMpDP3Fww5je7/MNZOgzAOtxURMO3opCog2/MVJ9YS8W6LFy2l4JW";
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}/latest`;

app.get("/", (req, res) => {
  res.send("🚖 Telegram Taxi Bot is running.");
});

app.get("/data", async (req, res) => {
  try {
    const response = await axios.get(JSONBIN_URL, {
      headers: { "X-Master-Key": API_KEY },
    });
    res.json(response.data.record);
  } catch (error) {
    res.status(500).json({ error: "Error fetching data from JSONBin" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
