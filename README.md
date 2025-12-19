# MCP Registry

A comprehensive registry and management platform for Model Context Protocol (MCP) services. This monorepo contains both the frontend and backend applications for discovering, managing, and interacting with MCP agents and services.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Frontend Setup](#frontend-setup)
  - [Backend Setup](#backend-setup)
- [Development](#development)
- [Deployment](#deployment)
- [Technology Stack](#technology-stack)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

The MCP Registry is a platform designed to help developers discover, register, and manage Model Context Protocol services. It provides a user-friendly interface for browsing available MCP agents, viewing their details, and managing service registrations.

## ✨ Features

- **Service Registry**: Register and manage MCP services with metadata
- **Search & Filter**: Find services by name, endpoint, or status
- **Service Management**: Create, update, and delete service entries
- **Service Details**: View comprehensive information about each service
- **Chat Interface**: Interact with MCP agents through a chat interface
- **SVG Generation**: Generate SVG graphics from natural language descriptions using Google Gemini AI
- **Visual SVG Rendering**: View generated SVGs directly in the chat with code toggle
- **Real-time Progress**: Server-Sent Events (SSE) for live job progress updates
- **Multi-Tier Fallback**: Robust API fallback strategy for reliable AI generation
- **Modern UI**: Built with Next.js and Tailwind CSS for a responsive experience

## 📁 Repository Structure

```
mcp-registry/
├── app/                    # Frontend Next.js application
│   ├── chat/              # Chat interface pages
│   ├── settings/          # Settings pages
│   └── page.tsx           # Main registry page
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   └── ...               # Feature components
├── backend/              # Backend Express API
│   ├── src/             # Backend source code
│   │   └── server.ts    # Express server
│   ├── prisma/          # Prisma schema and migrations
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── package.json     # Backend dependencies
├── types/               # TypeScript type definitions
├── lib/                 # Utility functions and helpers
├── public/              # Static assets
└── README.md            # This file
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **pnpm** (for frontend)
- **npm** (for backend)
- **Git**

### Frontend Setup

The frontend is a Next.js application located in the `mcp-registry-main/` directory.

1. **Navigate to the frontend directory:**
   ```bash
   cd mcp-registry-main
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Run the development server:**
   ```bash
   pnpm dev
   ```

4. **Build for production:**
   ```bash
   pnpm build
   ```

5. **Start production server:**
   ```bash
   pnpm start
   ```

6. **Lint the code:**
   ```bash
   pnpm lint
   ```

The frontend will be available at `http://localhost:3000`

### Backend Setup

The backend is an Express.js API with Prisma ORM, located in the `backend/` directory.

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the `backend/` directory:
   ```env
   DATABASE_URL="file:./dev.db"
   PORT=3001
   NODE_ENV=development
   ```

4. **Run Prisma migrations:**
   ```bash
   npx prisma migrate dev
   ```

5. **Generate Prisma client:**
   ```bash
   npx prisma generate
   ```

6. **Start the development server:**
   ```bash
   npm start
   ```

7. **Build TypeScript:**
   ```bash
   npm run build
   ```

The backend API will be available at `http://localhost:3001` (or the port specified in your `.env` file)

### Database

The backend uses **SQLite** by default (configured in `prisma/schema.prisma`). For production deployments, you may want to switch to PostgreSQL or another database by updating the `datasource` in `prisma/schema.prisma` and providing the appropriate `DATABASE_URL` in your `.env` file.

## 💻 Development

Both frontend and backend can be developed independently:

- **Frontend**: Runs on port 3000 (default Next.js port)
- **Backend**: Runs on port 3001 (configurable via environment variables)

The frontend communicates with the backend API. Make sure both servers are running during development.

### Running Both Services

You can run both services simultaneously by opening two terminal windows:

**Terminal 1 - Frontend:**
```bash
cd mcp-registry-main
pnpm dev
```

**Terminal 2 - Backend:**
```bash
cd backend
npm start
```

## 🚢 Deployment

### Frontend Deployment

The frontend is configured for deployment on Vercel:

- **Live URL**: [https://vercel.com/sentilabs/v0-logo-design](https://vercel.com/sentilabs/v0-logo-design)
- **Build on v0**: [https://v0.app/chat/nokJqOBoETr](https://v0.app/chat/nokJqOBoETr)

To deploy to Vercel:
1. Connect your GitHub repository to Vercel
2. Configure build settings (Vercel auto-detects Next.js)
3. Deploy

### Backend Deployment

For backend deployment, you can use platforms like:
- **Railway**
- **Render**
- **Heroku**
- **AWS/DigitalOcean**

Make sure to:
1. Set up environment variables
2. Configure the database (use PostgreSQL for production)
3. Run migrations: `npx prisma migrate deploy`
4. Build and start the server

## 🛠 Technology Stack

### Frontend
- **Next.js 16** - React framework
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Radix UI** - Accessible component primitives
- **shadcn/ui** - UI component library

### Backend
- **Express.js 5** - Web framework
- **Prisma** - ORM and database toolkit
- **TypeScript** - Type safety
- **PostgreSQL** - Database (production), SQLite (development)
- **Google Gemini API** - AI-powered SVG generation
- **Google Vision API** - Image analysis capabilities
- **Server-Sent Events (SSE)** - Real-time progress streaming
- **WebSocket** - Bidirectional communication
- **ts-node** - TypeScript execution

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For issues, questions, or contributions, please open an issue on the [GitHub repository](https://github.com/mcpmessenger/mcp-registry).

---

Built with ❤️ for the MCP community
