const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ตรวจสอบและสร้างโฟลเดอร์ uploads หากยังไม่มี
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ตั้งค่า Multer สำหรับจัดการไฟล์อัปโหลด
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Middleware Setup
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

app.use(session({
  secret: 'glamour_secret_key_12345',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 3600000 * 24 } // 1 วัน
}));

// เชื่อมต่อฐานข้อมูล SQLite
const db = new sqlite3.Database('./dress_rental.db', (err) => {
  if (err) console.error('Database connection error:', err.message);
  else console.log('Connected to SQLite database.');
});

// สร้างตารางฐานข้อมูลอัตโนมัติ
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fullname TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS dresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    color TEXT,
    size TEXT,
    detail TEXT,
    price REAL NOT NULL,
    image TEXT,
    status TEXT DEFAULT 'ว่าง'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS rentals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    dress_id INTEGER,
    start_date TEXT,
    end_date TEXT,
    payment_slip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(dress_id) REFERENCES dresses(id)
  )`);
});

// ================= Routes =================

// หน้าหลัก (Home Page)
app.get('/', (req, res) => {
  db.all('SELECT * FROM dresses', [], (err, dresses) => {
    if (err) dresses = [];
    res.render('index', { 
      dresses: dresses, 
      user: req.session.user || null 
    });
  });
});

// หน้าเข้าสู่ระบบ (Login)
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err || !user) {
      return res.render('login', { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }
    if (bcrypt.compareSync(password, user.password)) {
      req.session.user = { id: user.id, fullname: user.fullname, username: user.username, role: user.role };
      return res.redirect('/');
    }
    res.render('login', { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  });
});

// หน้าสมัครสมาชิก (Register)
app.get('/register', (req, res) => {
  res.render('register', { error: null });
});

app.post('/register', (req, res) => {
  const { fullname, phone, address, username, password } = req.body;
  const hashPassword = bcrypt.hashSync(password, 10);
  const role = (username.toLowerCase() === 'jada') ? 'admin' : 'user';

  db.run(`INSERT INTO users (fullname, phone, address, username, password, role) VALUES (?, ?, ?, ?, ?, ?)`,
    [fullname, phone, address, username, hashPassword, role],
    function(err) {
      if (err) return res.render('register', { error: 'ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว' });
      res.redirect('/login');
    }
  );
});

// ออกจากระบบ (Logout)
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// ทำรายการจองเช่าชุด (Rent Route)
app.post('/rent/:id', upload.single('payment_slip'), (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  
  const dressId = req.params.id;
  const userId = req.session.user.id;
  const { start_date, end_date } = req.body;
  const slipImage = req.file ? req.file.filename : '';

  db.run(`INSERT INTO rentals (user_id, dress_id, start_date, end_date, payment_slip) VALUES (?, ?, ?, ?, ?)`,
    [userId, dressId, start_date, end_date, slipImage],
    function(err) {
      if (err) console.error(err);
      // เปลี่ยนสถานะชุดเป็น 'ถูกเช่าแล้ว'
      db.run(`UPDATE dresses SET status = 'ถูกเช่าแล้ว' WHERE id = ?`, [dressId], () => {
        res.redirect('/');
      });
    }
  );
});

// หน้าผู้ดูแลระบบ (Admin Panel)
app.get('/admin', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/');
  }
  db.all('SELECT * FROM dresses', [], (err, dresses) => {
    db.all(`SELECT rentals.*, users.fullname, dresses.name as dress_name 
            FROM rentals 
            JOIN users ON rentals.user_id = users.id 
            JOIN dresses ON rentals.dress_id = dresses.id`, [], (err, rentals) => {
      res.render('admin', { 
        dresses: dresses || [], 
        rentals: rentals || [],
        user: req.session.user 
      });
    });
  });
});

// แอดมินเพิ่มชุดใหม่ (Admin Add Dress)
app.post('/admin/add-dress', upload.single('image'), (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/');
  
  const { name, category, color, size, detail, price } = req.body;
  const imageName = req.file ? req.file.filename : 'default.jpg';

  db.run(`INSERT INTO dresses (name, category, color, size, detail, price, image) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, category, color, size, detail, price, imageName],
    (err) => {
      if (err) console.error(err);
      res.redirect('/admin');
    }
  );
});

// เริ่มต้นรันเซิร์ฟเวอร์
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});