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

    if (!message?.trim()) {
      return res.status(400).json({
        error: "Message is required",
      });
    }

    if (!process.env.GROQ_API_KEY) {
      console.error("GROQ_API_KEY is missing");
      return res.status(500).json({
        error: "Server configuration error",
      });
    }

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
        content: message.trim(),
      },
    ];

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },

        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          messages,
          temperature: 0.8,
          max_tokens: 50,
          include_reasoning: false,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error(`Groq error: ${response.status} - ${errorText}`);

      return res.status(502).json({
        error: "AI provider error",
      });
    }

    const data = await response.json();

    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      console.error("Invalid Groq response:", data);

      return res.status(502).json({
        error: "Empty AI response",
      });
    }

    res.json({
      reply,
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
