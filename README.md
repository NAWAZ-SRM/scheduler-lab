# Scheduling Theory Workbench

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.12+-blue.svg" alt="Python 3.12+">
  <img src="https://img.shields.io/badge/React-19+-61DAFB.svg" alt="React 19+">
  <img src="https://img.shields.io/badge/FastAPI-0.109+-009688.svg" alt="FastAPI">
  <img src="https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg" alt="TypeScript">
</p>

A browser-based tool for simulating and comparing CPU scheduling algorithms. Engineers and students can describe workloads, pick from pre-built algorithms, create fused hybrid schedulers, and visualize performance through Gantt charts and metrics.

---

## Table of Contents

- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [License](#license)

---

## About

**Scheduling Theory Workbench** is an educational and research tool that makes CPU scheduling algorithm analysis accessible through an intuitive web interface. Whether you're a student learning operating systems concepts or an engineer optimizing workload performance, this tool lets you:

- Define realistic workloads with configurable arrival patterns, job durations, priorities, and deadlines
- Compare multiple scheduling algorithms side-by-side
- Create fused hybrid schedulers that dynamically switch between algorithms based on job characteristics
- Visualize scheduling decisions through interactive Gantt charts
- Analyze performance metrics like p95 latency, throughput, fairness, and deadline miss rate

### Core Value Proposition

> *"I want to know if SRPT with a small priority boost for GPU jobs would reduce my p95 latency. Let me test it in 30 seconds without writing a simulator."*

---

## Features

### 1. Workload Builder
- **Preset Scenarios**: Web API Server, ML Training Queue, Video Transcoding, Mixed Workload, Stress Test
- **Configurable Parameters**: 
  - Arrival patterns (Poisson, Bursty, Periodic, Uniform)
  - Job duration distributions with variance control
  - Priority spread configuration
  - Deadline assignment with tightness control
  - GPU job percentage
- **Custom JSON Input**: Define exact job specifications for precise testing

### 2. Algorithm Selection
Six pre-built scheduling algorithms:

| Algorithm | Description | Best For |
|-----------|-------------|----------|
| **FCFS** | First Come, First Served | Simple, starvation-free scheduling |
| **SJF** | Shortest Job First | Minimizing average wait time |
| **SRPT** | Shortest Remaining Processing Time | Optimal flow time, mixed workloads |
| **EDF** | Earliest Deadline First | Real-time systems with deadlines |
| **Round Robin** | Time-slice based | Fair time-sharing systems |
| **CFS** | Completely Fair Scheduler | Multi-tenant fairness |

Each algorithm includes configurable parameters (e.g., time quantum for RR, latency target for CFS).

### 3. Algorithm Fusion
Create hybrid schedulers that dynamically switch between algorithms based on:
- **Priority**: Route by job priority (high/medium/low)
- **Duration**: Route short jobs to one scheduler, long jobs to another
- **Deadline**: Use EDF for time-critical jobs, SRPT for others
- **GPU**: Separate schedulers for GPU and CPU workloads

### 4. Visualization & Metrics
- **Gantt Chart**: Interactive timeline showing job execution across slots
- **Metrics Cards**: p95 Latency, Throughput, Jain's Fairness Index, Deadline Miss Rate
- **Supporting Charts**: Queue depth over time, Latency CDF, Resource utilization

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| State Management | Zustand |
| Charts | Recharts, Custom SVG (Gantt) |
| Backend | FastAPI, Python 3.12 |
| Database | PostgreSQL 16 |
| ORM | SQLAlchemy 2.x (async) |
| Authentication | JWT |
| Deployment | Docker, Docker Compose |

---

## Quick Start

### Prerequisites

- **Python 3.12+** with `venv` support
- **Node.js 18+** and **npm**
- **PostgreSQL 16** (or use Docker)

### Option 1: Run Locally

#### 1. Clone the Repository

```bash
git clone https://github.com/NAWAZ-SRM/scheduler-lab.git
cd scheduler-lab
```

#### 2. Backend Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
cd backend
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run the backend server
uvicorn app.main:app --reload --port 8000
```

#### 3. Frontend Setup

```bash
# Open a new terminal
cd frontend

# Install dependencies
npm install

# Create environment file
echo "VITE_API_URL=http://localhost:8000/api" > .env

# Start development server
npm run dev
```

#### 4. Access the Application

Open your browser and navigate to:
- **Frontend**: http://localhost:5173
- **API Docs**: http://localhost:8000/api/docs

### Option 2: Run with Docker

```bash
# Build and start all services
docker-compose up --build

# Access at http://localhost:5173
```

---

## Project Structure

```
scheduler-lab/
├── backend/
│   ├── app/
│   │   ├── api/              # API routes
│   │   ├── config.py         # Configuration
│   │   ├── database.py       # Database connection
│   │   ├── main.py           # FastAPI application
│   │   ├── models/           # SQLAlchemy models
│   │   ├── routers/          # Route handlers
│   │   ├── schemas/          # Pydantic schemas
│   │   └── simulation/       # Simulation engine
│   │       ├── schedulers/   # Scheduling algorithms
│   │       ├── gantt.py      # Gantt chart generation
│   │       ├── metrics.py    # Performance metrics
│   │       ├── simulator.py  # Core simulator
│   │       └── workload.py   # Workload generator
│   ├── venv/                 # Python virtual environment
│   ├── requirements.txt      # Python dependencies
│   └── .env                 # Environment variables
│
├── frontend/
│   ├── src/
│   │   ├── api/              # API client
│   │   ├── components/       # React components
│   │   │   ├── MetricsCards.tsx
│   │   │   ├── GanttChart.tsx
│   │   │   ├── SupportingCharts.tsx
│   │   │   └── AlgorithmFusion.tsx
│   │   ├── pages/           # Page components
│   │   ├── stores/          # Zustand state stores
│   │   ├── types/           # TypeScript types
│   │   └── App.tsx         # Root component
│   ├── package.json
│   └── vite.config.ts
│
├── docker-compose.yml        # Docker orchestration
├── PRD_MVP.md              # Product requirements
└── README.md               # This file
```

---

## Configuration

### Backend Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/scheduler_db

# JWT Authentication
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# API
API_V1_PREFIX=/api

# Simulation
MAX_CUSTOM_JOBS=500
```

### Frontend Environment Variables

Create a `.env` file in the `frontend/` directory:

```env
VITE_API_URL=http://localhost:8000/api
```

---

## API Documentation

Once the backend is running, visit:
- **Swagger UI**: http://localhost:8000/api/docs
- **ReDoc**: http://localhost:8000/api/redoc

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Authenticate user |
| POST | `/api/simulations/run` | Start simulation |
| GET | `/api/simulations/stream/{token}` | Stream results via SSE |
| POST | `/api/simulations/save` | Save simulation results |
| GET | `/api/simulations` | List user's simulations |
| GET | `/api/schedulers` | List custom schedulers |
| POST | `/api/schedulers` | Create custom scheduler |
| POST | `/api/schedulers/validate` | Validate scheduler code |

---

## Development

### Running Tests

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

### Building for Production

```bash
# Frontend production build
cd frontend
npm run build

# Backend (with gunicorn)
cd backend
gunicorn app.main:app --workers 4 --bind 0.0.0.0:8000
```

---

## License

MIT License - See [LICENSE](LICENSE) for details.

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

*Built with FastAPI, React, and the goal of making scheduling theory accessible to everyone.*
