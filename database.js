const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./dress_rental.db');

db.serialize(() => {
  // Model 1: ผู้เช่า
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fullname TEXT,
    phone TEXT,
    address TEXT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user'
  )`);

  // Model 2: ชุด
  db.run(`CREATE TABLE IF NOT EXISTS dresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    category TEXT,
    color TEXT,
    size TEXT,
    detail TEXT,
    price REAL,
    image TEXT,
    status TEXT DEFAULT 'ว่าง'
  )`);

  // Model 3: รายการเช่า[cite: 1]
  db.run(`CREATE TABLE IF NOT EXISTS rentals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    dress_id INTEGER,
    start_date TEXT,
    end_date TEXT,
    payment_slip TEXT,
    status TEXT DEFAULT 'รออนุมัติ',
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(dress_id) REFERENCES dresses(id)
  )`);
});

module.exports = db;