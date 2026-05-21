# Raynet Internship Project

## Design inspirace

- https://hoodie-sale-49085175.figma.site/

## Struktura projektu

```
.
├── frontend/          # React + TypeScript + Vite aplikace
├── backend/           # Express + TypeScript API server
├── data/              # JSON datové soubory
└── package.json       # Root konfigurace workspaces
```

## Požadavky

- Node.js 18+
- npm 9+

## Instalace

```bash
npm install
```

## Spuštění

Spuštění frontendu i backendu najednou:
```bash
npm run dev
```

Samostatné spuštění:
```bash
# Backend (port 3001)
npm run dev:backend

# Frontend (port 5173)
npm run dev:frontend
```


## Technologie

- **Frontend:** React 18, TypeScript, Vite, CSS Modules
- **Backend:** Express, TypeScript, CORS
- **Data:** JSON soubory

## API Endpoints

| Endpoint | Metoda | Popis |
|----------|--------|-------|
| `/api/hello` | GET | Test endpoint |

## Testovací uživatel
Email: manager@raynet.cz
Heslo: Raynet
