<pre align="center">

██████╗ ██╗ ██████╗ ██╗██████╗ ██╗  ██╗
██╔══██╗██║██╔════╝ ██║██╔══██╗╚██╗██╔╝
██████╔╝██║██║  ███╗██║██║  ██║ ╚███╔╝
██╔══██╗██║██║   ██║██║██║  ██║ ██╔██╗
██████╔╝██║╚██████╔╝██║██████╔╝██╔╝ ██╗
╚═════╝ ╚═╝ ╚═════╝ ╚═╝╚═════╝ ╚═╝  ╚═╝

</pre>

<p align="center">Talk freely. Stay anonymous.</p>

---

Anonymous AI chat app. No sign-up, no profile — open it and start talking.

## Stack

<p>
  <img src="https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-000000?logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/Groq-F55036?logo=groq&logoColor=white" />
  <img src="https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white" />
  <img src="https://img.shields.io/badge/Render-46E3B7?logo=render&logoColor=black" />
</p>

React + Vite frontend, Express backend, Groq API for inference.

## Structure

rigidX/
├── public/
├── src/
│ ├── api/server.js
│ ├── components/
│ ├── service/
│ └── App.jsx
├── index.html
└── vite.config.js


## API

`POST /api/chat`

```json
// request
{ "message": "hello", "history": [] }

// response
{ "reply": "..." }
```

## Env vars

| Var | Where |
|---|---|
| `GROQ_API_KEY` | backend only |
| `VITE_API_URL` | frontend |

## Run locally

npm install
node src/api/server.js
npm run dev

## Scripts

`dev` · `build` · `lint` · `preview`

## Deploy

Frontend on Vercel, backend on Render.

## License

None declared.