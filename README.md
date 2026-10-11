# RigidX

<div align="center">

```text
██████╗ ██╗ ██████╗ ██╗██████╗ ██╗  ██╗
██╔══██╗██║██╔════╝ ██║██╔══██╗╚██╗██╔╝
██████╔╝██║██║  ███╗██║██║  ██║ ╚███╔╝
██╔══██╗██║██║   ██║██║██║  ██║ ██╔██╗
██████╔╝██║╚██████╔╝██║██████╔╝██╔╝ ██╗
╚═════╝ ╚═╝ ╚═════╝ ╚═╝╚═════╝ ╚═╝  ╚═╝
```

**Talk freely. Stay anonymous.**

An anonymous space to connect, express yourself, and talk to AI — without the hassle of creating an account.

[Features](#features) · [Tech Stack](#tech-stack) · [Getting Started](#getting-started) · [API](#api) · [Deployment](#deployment)

</div>

---

## About

RigidX is an anonymous chat application built to make conversations easier to start.

Chat globally, create rooms around shared interests, or talk to an AI assistant. RigidX uses a lightweight interface and automatically generated anonymous identities to reduce the friction of traditional account-based platforms.

## Features

- **Anonymous identities** — automatically generated identity and handle, with no traditional sign-up flow.
- **Global chat** — participate in real-time conversations with other users.
- **Custom chat rooms** — create and join rooms for different topics.
- **Private rooms** — room visibility options for more controlled conversations.
- **AI chat** — chat with an AI assistant powered by the Groq API.
- **Real-time updates** — messaging and presence powered by Socket.IO.
- **Message interactions** — reactions and message editing.
- **Room management** — room descriptions, icons, and invite links.
- **Appearance customization** — choose different message themes.
- **Rate limiting and input validation** — server-side protections for chat and room operations.

> RigidX is built around a simple idea: make it easier to talk, without the pressure of a public profile.

## Tech Stack

<p>
  <img src="https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge-Node.js-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge-Express-000000?logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge-Socket.IO-010101?logo=socket.io&logoColor=white" alt="Socket.IO" />
  <img src="https://img.shields.io/badge-MongoDB-47A248?logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge-Groq-F55036?logo=groq&logoColor=white" alt="Groq" />
  <img src="https://img.shields.io/badge-Vercel-000000?logo=vercel&logoColor=white" alt="Vercel" />
  <img src="https://img.shields.io/badge-Render-46E3B7?logo=render&logoColor=black" alt="Render" />
</p>

| Technology | Purpose |
|---|---|
| React | Frontend UI |
| Vite | Development server and production builds |
| Node.js | Backend runtime |
| Express | REST API |
| Socket.IO | Real-time messaging and presence |
| MongoDB | Persistent message, room, and identity data |
| Mongoose | MongoDB object modeling |
| Groq API | AI inference |
| Helmet | HTTP security headers |
| Express Rate Limit | API request rate limiting |
| Vercel | Frontend deployment |
| Render | Backend deployment |

## Project Structure

```text
rigidX/
├── public/
│   └── logo.png
├── src/
│   ├── api/
│   │   ├── models/
│   │   │   ├── identity.js
│   │   │   ├── Message.js
│   │   │   └── Room.js
│   │   └── server.js
│   ├── assets/
│   ├── components/
│   │   ├── ChatPage.jsx
│   │   ├── ColorBends.jsx
│   │   ├── GlobalChat.jsx
│   │   ├── LandingPage.jsx
│   │   └── ShinyText.jsx
│   ├── lib/
│   │   └── utils.js
│   ├── service/
│   │   ├── identity.js
│   │   ├── socket.js
│   │   └── theme.js
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   └── main.jsx
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

## Getting Started

### Prerequisites

- Node.js and npm
- A MongoDB database
- A Groq API key for AI chat

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd rigidX
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root.

```env
PORT=3000
MONGODB_URI=mongo_string
GROQ_API_KEY=your_groq_api_key
CLIENT_ORIGIN=http://localhost:5173
IP_SALT=secret_val
```

Use the exact variables required by your server configuration. If you configure an admin token or other secrets, keep those private too.

**Never commit your real `.env` file or API keys.** Use `.env.example` for placeholders only.

### 4. Start the backend

```bash
node src/api/server.js
```

The backend starts on port `3000` by default.

### 5. Start the frontend

Open a second terminal in the project directory:

```bash
npm run rigidx
```

If you haven't added the custom script yet, use `npm run dev`.

Vite will display the local URL in your terminal.

## API

### AI Chat

**Endpoint:** `POST /api/chat`

Request:

```json
{
  "message": "Hey, what's up?",
  "history": []
}
```

Response:

```json
{
  "reply": "Hey! Not much, what's up with you?"
}
```

The backend forwards the conversation to the configured Groq model and returns the generated reply.

### Health Check

**Endpoint:** `GET /healthz`

Example response:

```json
{
  "ok": true
}
```

The health endpoint indicates whether the server is responding. It does not necessarily verify that every dependency is healthy.

## Available Scripts

| Command | Description |
|---|---|
| `npm run rigidx` | Start the Vite frontend using the custom script |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Build the frontend for production |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview the production build |

## Deployment

RigidX can be deployed with separate frontend, backend, and database services.

- **Frontend:** Vercel
- **Backend:** Render
- **Database:** MongoDB

Before deploying:

1. Set the production environment variables in your hosting dashboard.
2. Configure the frontend API URL to point to the deployed backend.
3. Set `CLIENT_ORIGIN` to the actual production frontend origin.
4. Configure the required production secrets, including `IP_SALT`.
5. Verify CORS, rate limits, database access, and WebSocket connectivity.

Never expose server-side API keys through frontend environment variables or client-side code.

## Privacy & Security

RigidX is designed to support anonymous conversations, but anonymity does not automatically guarantee complete privacy.

- No traditional sign-up flow is required by the current design.
- Anonymous identity information is stored in the browser.
- Messages and room data are stored in MongoDB.
- AI messages are sent to the configured AI provider for processing.
- Server-side credentials should remain in environment variables.
- Users should avoid sharing passwords, financial details, or other sensitive personal information in chat.

Review data retention, logging, and third-party provider policies before making stronger privacy or encryption guarantees.

## Contributing

Contributions, bug reports, and feature suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Run the linter and production build.
5. Open a pull request describing your changes.

## License

No license has been declared yet.

