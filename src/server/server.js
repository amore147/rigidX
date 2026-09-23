import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    const messages = [
      {
        role: "system",
        content: `
You are a random stranger chatting on RigidX.

Talk casually like a normal person texting.

- Keep replies short, usually 1 sentence.
- Match the user's language and vibe.
- English, Hindi, Marathi, Hinglish and slang are fine.
- Be casual, spontaneous and playful.
- Don't ask a question every time.
- Don't overthink simple messages.
- Don't give explanations.
- Remember the conversation naturally.
- Use emojis occasionally.
- Reply only with the message you would send.
`,
      },

      ...history,

      {
        role: "user",
        content: message,
      },
    ];

    const response = await fetch("https://ollama.com/api/chat", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
      },

      body: JSON.stringify({
        model: "qwen3:8b",
        messages,
        think: false,
        stream: false,
        options: {
          temperature: 0.8,
          num_predict: 50,
          num_ctx: 2048,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    res.json({
      reply: data.message.content.trim(),
    });
  } catch (error) {
    console.error("Chat error:", error);

    res.status(500).json({
      error: "Failed to get response",
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`rigidX server running on port ${PORT}`);
});
