import express from "express";
import cors from "cors";

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

    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        model: "qwen3:8b",

        messages,

        think: false,

        stream: false,

        keep_alive: -1,

        options: {
          temperature: 0.8,

          num_predict: 50,

          num_ctx: 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();

    res.json({
      reply: data.message.content.trim(),
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to get response",
    });
  }
});

app.listen(3000, () => {
  console.log("server running");
});
