const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseManager {
    constructor() {
        this.db = null;
        this.dbPath = path.join(__dirname, 'game.db');
    }

    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Error opening database:', err);
                    reject(err);
                } else {
                    console.log('✅ Connected to SQLite database');
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async createTables() {
        return new Promise((resolve, reject) => {
            const queries = [
                // Players table
                `CREATE TABLE IF NOT EXISTS players (
                    id TEXT PRIMARY KEY,
                    username TEXT,
                    money INTEGER DEFAULT 100,
                    total_earnings INTEGER DEFAULT 0,
                    towers_built INTEGER DEFAULT 0,
                    ghosts_killed INTEGER DEFAULT 0,
                    time_played INTEGER DEFAULT 0,
                    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,

                // Game sessions table
                `CREATE TABLE IF NOT EXISTS game_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    player_id TEXT,
                    session_start DATETIME DEFAULT CURRENT_TIMESTAMP,
                    session_end DATETIME,
                    money_earned INTEGER DEFAULT 0,
                    towers_placed INTEGER DEFAULT 0,
                    ghosts_defeated INTEGER DEFAULT 0,
                    wave_reached INTEGER DEFAULT 1,
                    FOREIGN KEY (player_id) REFERENCES players (id)
                )`,

                // High scores table
                `CREATE TABLE IF NOT EXISTS high_scores (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    player_id TEXT,
                    score INTEGER,
                    wave_reached INTEGER,
                    ghosts_killed INTEGER,
                    money_earned INTEGER,
                    game_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (player_id) REFERENCES players (id)
                )`,

                // Towers table for persistent tower data
                `CREATE TABLE IF NOT EXISTS towers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    player_id TEXT,
                    room_id INTEGER,
                    col INTEGER,
                    row INTEGER,
                    tower_type TEXT,
                    cost INTEGER,
                    damage_dealt INTEGER DEFAULT 0,
                    ghosts_killed INTEGER DEFAULT 0,
                    placed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (player_id) REFERENCES players (id)
                )`
            ];

            let completed = 0;
            queries.forEach((query) => {
                this.db.run(query, (err) => {
                    if (err) {
                        console.error('❌ Error creating table:', err);
                        reject(err);
                    } else {
                        completed++;
                        if (completed === queries.length) {
                            console.log('✅ All database tables created/verified');
                            resolve();
                        }
                    }
                });
            });
        });
    }

    // Player operations
    async savePlayer(playerData) {
        return new Promise((resolve, reject) => {
            const { id, username, money, totalEarnings, towersBuilt, ghostsKilled, timePlayed } = playerData;
            
            this.db.run(
                `INSERT OR REPLACE INTO players 
                (id, username, money, total_earnings, towers_built, ghosts_killed, time_played, last_seen) 
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [id, username, money, totalEarnings, towersBuilt, ghostsKilled, timePlayed],
                function(err) {
                    if (err) {
                        console.error('❌ Error saving player:', err);
                        reject(err);
                    } else {
                        console.log(`💾 Player ${id} saved to database`);
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    async getPlayer(playerId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM players WHERE id = ?',
                [playerId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    async saveGameSession(sessionData) {
        return new Promise((resolve, reject) => {
            const { playerId, moneyEarned, towersPlaced, ghostsDefeated, waveReached } = sessionData;
            
            this.db.run(
                `INSERT INTO game_sessions 
                (player_id, session_end, money_earned, towers_placed, ghosts_defeated, wave_reached) 
                VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?)`,
                [playerId, moneyEarned, towersPlaced, ghostsDefeated, waveReached],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    async getTopScores(limit = 10) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT player_id, MAX(score) as best_score, MAX(wave_reached) as best_wave 
                FROM high_scores 
                GROUP BY player_id 
                ORDER BY best_score DESC 
                LIMIT ?`,
                [limit],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    async saveHighScore(scoreData) {
        return new Promise((resolve, reject) => {
            const { playerId, score, waveReached, ghostsKilled, moneyEarned } = scoreData;
            
            this.db.run(
                `INSERT INTO high_scores 
                (player_id, score, wave_reached, ghosts_killed, money_earned) 
                VALUES (?, ?, ?, ?, ?)`,
                [playerId, score, waveReached, ghostsKilled, moneyEarned],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    async saveTowerStats(towerData) {
        return new Promise((resolve, reject) => {
            const { playerId, roomId, col, row, towerType, cost, damageDealt, ghostsKilled } = towerData;
            
            this.db.run(
                `INSERT INTO towers 
                (player_id, room_id, col, row, tower_type, cost, damage_dealt, ghosts_killed) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [playerId, roomId, col, row, towerType, cost, damageDealt, ghostsKilled],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    async getPlayerStats(playerId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT 
                    p.*,
                    COUNT(DISTINCT t.id) as total_towers,
                    SUM(t.damage_dealt) as total_damage,
                    COUNT(DISTINCT s.id) as sessions_played,
                    MAX(s.wave_reached) as best_wave
                FROM players p
                LEFT JOIN towers t ON p.id = t.player_id
                LEFT JOIN game_sessions s ON p.id = s.player_id
                WHERE p.id = ?
                GROUP BY p.id`,
                [playerId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('❌ Error closing database:', err);
                } else {
                    console.log('✅ Database connection closed');
                }
            });
        }
    }
}

module.exports = DatabaseManager;