# ♟️Scoreboard

**A scoreboard for your game night!**

A self-hosted web application to track boardgame scores, players, and statistics for groups of friends or families. Built with FastAPI, Material Design, and SQLite.

> [!WARNING]  
> **This application is designed for local use only. Do not expose to the internet!**

## 🎯 Features

### 🎮 Game Management
- **Board Games**: Create and manage board games with different win conditions
- **Win Types**: Support for 4 different win conditions:
  - `winner`: Simple winner selection
  - `points`: Points-based scoring
  - `highest_points`: Highest points per game
  - `task`: Task-based objectives
- **Tasks**: Create custom tasks for task-based games
- **Game Recording**: Record played games with detailed scoring and player participation

### 👥 Player & Group Management
- **Players**: Add players with custom names and colors
- **Societies**: Create groups ("societies") with selected players and games
- **User Authentication**: Secure admin access with user management
- **Public View**: Share societies and game history without login

### 📊 Comprehensive Statistics
- **Most Wins**: Track who wins the most games
- **Best Win Ratio**: Calculate win percentages for players
- **Most Points**: Total points accumulated across games
- **Highest Points**: Best single-game scores
- **Most Won Tasks**: Track task completion (task-based games only)
- **Most Popular Days**: See when games are typically played
- **Longest Win Streaks**: Track consecutive wins
- **Time Filtering**: Filter statistics by day, week, month, year, or all time

### 🎨 User Interface
- **Material Design**: Modern, responsive interface
- **Dark Theme**: Switch between light and dark theme.
- **Interactive Charts**: Visual representation of statistics
- **Mobile Friendly**: Works on all device sizes
- **Real-time Updates**: AJAX-powered dynamic content

## 🚀 Installation

### Prerequisites
- Docker and Docker Compose
- Git

### Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Bardesss/scoreboard.git
   cd scoreboard
   ```

2. **Start the application:**
   ```bash
   docker-compose up --build
   ```

3. **Access the application:**
   - Open your browser and go to [http://localhost:6060](http://localhost:6060)
   - You'll be redirected to the setup page on first run

## 🔧 First Run Setup

1. **Create Admin Account:**
   - Visit [http://localhost:6060](http://localhost:6060)
   - You'll be redirected to `/setup`
   - Create your initial admin username and password

2. **Set Up Your Game Environment:**
   - **Players**: Add all players with names and colors
   - **Board Games**: Create games with appropriate win types
   - **Tasks**: Add tasks for task-based games
   - **Societies**: Create groups with selected players and games

3. **Start Recording Games:**
   - Navigate to a society
   - Click "Add Played Game"
   - Fill in the game details and scores
   - View statistics and track progress

## 📈 Usage Guide

### Admin Panel
- **Players**: Manage player profiles, names, and colors
- **Board Games**: Create games with win conditions
- **Tasks**: Define objectives for task-based games
- **Societies**: Organize players into groups
- **Played Games**: Record and edit game results
- **Statistics**: View detailed analytics

### Public View
- **Societies**: Browse available groups
- **Game History**: View past games and results
- **Statistics**: See public statistics (read-only)

### Statistics Features
- **Time Filtering**: Use the period selector to filter data
- **Interactive Charts**: Click on charts for detailed views
- **Export Ready**: All data is stored in SQLite for easy backup

## 🔄 Updating

To update to the latest version:

1. **Stop the application:**
   ```bash
   docker-compose down
   ```

2. **Pull latest changes:**
   ```bash
   git pull origin main
   ```

3. **Restart with updates:**
   ```bash
   docker-compose up --build
   ```

> **Note**: Your data is preserved in the SQLite database file (`scoreboard.db`).

## 🗄️ Data Management

### Database
- **SQLite**: Lightweight, file-based database
- **Location**: `data/scoreboard.db` (inside Docker container)
- **Backup**: Simply copy the database file to backup your data

### File Structure
```
scoreboard/
├── data/                 # Database and persistent data
├── src/                  # Application source code
│   ├── templates/        # HTML templates
│   ├── static/          # CSS, JS, and assets
│   └── main.py          # FastAPI application
├── docker-compose.yml   # Docker configuration
└── README.md           # This file
```

## 🔒 Security

- **Local Use Only**: Designed for private networks
- **User Authentication**: Admin access control
- **Input Validation**: All user inputs are sanitized
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Output encoding and validation

## 🛠️ Technical Details

### Technology Stack
- **Backend**: FastAPI (Python)
- **Database**: SQLite
- **Frontend**: HTML, CSS, JavaScript
- **UI Framework**: Material Design Components
- **Charts**: Chart.js
- **Container**: Docker

### API Endpoints
- **Web Interface**: HTML pages for user interaction
- **REST API**: JSON endpoints for AJAX requests
- **Statistics API**: Dynamic data loading for charts

## 🔌 API Reference

The application provides a complete REST API for programmatic access to all data.

### Authentication
Most endpoints require authentication. Use the web interface to log in first, then include session cookies in your requests.

### Base URL
```
http://localhost:6060/api
```

### Available Endpoints

#### Players
- `GET /api/players` - Get all players
- `GET /api/players/{id}` - Get specific player
- `POST /api/players` - Create new player
- `PUT /api/players/{id}` - Update player
- `DELETE /api/players/{id}` - Delete player

#### Board Games
- `GET /api/boardgames` - Get all board games
- `GET /api/boardgames/{id}` - Get specific board game
- `POST /api/boardgames` - Create new board game
- `PUT /api/boardgames/{id}` - Update board game
- `DELETE /api/boardgames/{id}` - Delete board game

#### Tasks
- `GET /api/tasks` - Get all tasks (optional: `?boardgame_id=X`)
- `GET /api/tasks/{id}` - Get specific task
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/{id}` - Update task
- `DELETE /api/tasks/{id}` - Delete task

#### Societies
- `GET /api/societies` - Get all societies
- `GET /api/societies/{id}` - Get specific society
- `POST /api/societies` - Create new society
- `PUT /api/societies/{id}` - Update society
- `DELETE /api/societies/{id}` - Delete society

#### Played Games
- `GET /api/played-games` - Get all played games (optional: `?society_id=X`)
- `GET /api/played-games/{id}` - Get specific played game
- `POST /api/played-games` - Create new played game
- `PUT /api/played-games/{id}` - Update played game
- `DELETE /api/played-games/{id}` - Delete played game

#### Statistics
- `GET /api/societies/{id}/stats` - Get society statistics
- `GET /api/societies/{id}/dropdown-data` - Get date filter options

### Example Usage

```bash
# Get all players
curl http://localhost:6060/api/players

# Create a new board game
curl -X POST http://localhost:6060/api/boardgames \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "name=Monopoly&win_type=points"

# Get statistics for a society
curl http://localhost:6060/api/societies/1/stats?period=month
```

### Response Format
All endpoints return JSON responses. Error responses include an `error` field with a descriptive message.

## 🐛 Troubleshooting

### Common Issues

1. **Port Already in Use:**
   - Change the port in `docker-compose.yml`
   - Default port is 6060

2. **Database Permission Errors:**
   - Ensure Docker has write access to the `data/` directory
   - Check file permissions on the host system

3. **Container Won't Start:**
   - Check Docker logs: `docker-compose logs`
   - Verify Docker and Docker Compose are installed

### Getting Help
- Check the Docker logs for error messages
- Ensure all prerequisites are installed
- Verify network connectivity if using remote Docker


## 🤝 Contributing

This is a personal project, but suggestions and feedback are welcome through GitHub issues. Please feel free to fork the repo and create pull requests with improvements.

---

**Happy Gaming! 🎲**
