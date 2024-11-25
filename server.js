const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
var cookieParser = require('cookie-parser');

const app = express();
const port = 3000;

// เชื่อมต่อกับ MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // รหัสผ่าน MySQL
  database: 'feedfav' // ชื่อฐานข้อมูล
});

// เชื่อมต่อกับฐานข้อมูล
db.connect((err) => {
  if (err) {
    console.error('Database connection failed: ' + err.stack);
    return;
  }
  console.log('Connected to the MySQL database');
});

// ตั้งค่า middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // ตั้งค่า static files

app.use('/profile_pics', express.static(path.join(__dirname, 'public/profile_pics')));

// ใช้ session
app.use(
  session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true,
  })
);

// Route สำหรับหน้า index (หน้าแรก)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API: ลงทะเบียนผู้ใช้
app.post('/api/register', (req, res) => {
  const { username, email, password } = req.body;

  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      return res.status(500).send('Error hashing password');
    }

    db.query(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword],
      (err, result) => {
        if (err) {
          return res.status(500).send('Database error');
        }
        res.send({
          success: true,
          message: 'Registration successful! Redirecting to login...',
        });
      }
    );
  });
});

// API: ล็อกอินผู้ใช้
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  db.query('SELECT * FROM users WHERE email = ?', [email], (err, result) => {
    if (err) {
      return res.status(500).send('Server error');
    }

    if (result.length === 0) {
      return res.send('Invalid login credentials!');
    }

    const user = result[0];
    bcrypt.compare(password, user.password, (err, match) => {
      if (err) {
        return res.status(500).send('Server error');
      }

      if (match) {
        req.session.userId = user.id;
        req.session.username = user.username;
        res.redirect('/home');
      } else {
        res.redirect('/Login');
      }
    });
  });
});

// Route สำหรับหน้า Login
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Route สำหรับหน้า Home
app.get('/home', (req, res) => {
  if (req.session.userId) {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
  } else {
    res.redirect('/login');
  }
});

// API: Get posts for a specific tab (forYou or following)
app.get('/api/posts/:tab', (req, res) => {
  const tab = req.params.tab;

  const query = `
    SELECT posts.id, posts.text, posts.timestamp, posts.likes, posts.comments, users.username
    FROM posts
    JOIN users ON posts.user_id = users.id
    WHERE posts.tab = ?
    ORDER BY posts.timestamp DESC;
  `;

  db.query(query, [tab], (err, results) => {
    if (err) {
      console.error("Database Error:", err);
      return res.status(500).json({ error: 'Failed to fetch posts.' });
    }

    console.log("Fetched Posts:", results); // ดูว่าข้อมูลส่งกลับมาหรือไม่
    res.json(results);
  });
});


// API: Add new post
app.post('/api/posts/:tab', (req, res) => {
  const { text, timestamp } = req.body;
  const tab = req.params.tab;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const query = `INSERT INTO posts (user_id, text, timestamp, likes, comments, tab) VALUES (?, ?, ?, 0, '[]', ?)`;
  db.query(query, [userId, text, timestamp, tab], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to insert post.' });
    }
    res.json({ success: true, postId: result.insertId });
  });
});

// API: Like a post
app.post('/api/like', (req, res) => {
  const { postId } = req.body;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const checkQuery = 'SELECT * FROM likes WHERE post_id = ? AND user_id = ?';
  db.query(checkQuery, [postId, userId], (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (result.length > 0) {
      const unlikeQuery = 'DELETE FROM likes WHERE post_id = ? AND user_id = ?';
      db.query(unlikeQuery, [postId, userId], (err) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        const decrementQuery = 'UPDATE posts SET likes = likes - 1 WHERE id = ?';
        db.query(decrementQuery, [postId], (err) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          res.json({ success: true, liked: false });
        });
      });
    } else {
      const likeQuery = 'INSERT INTO likes (post_id, user_id) VALUES (?, ?)';
      db.query(likeQuery, [postId, userId], (err) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        const incrementQuery = 'UPDATE posts SET likes = likes + 1 WHERE id = ?';
        db.query(incrementQuery, [postId], (err) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          res.json({ success: true, liked: true });
        });
      });
    }
  });
});

// API: Add comment to a post
app.post('/api/comment', (req, res) => {
  const { postId, comment } = req.body;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!postId || !comment) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  // ดึงข้อมูลผู้ใช้ (username) จากฐานข้อมูล
  db.query('SELECT username FROM users WHERE id = ?', [userId], (err, results) => {
    if (err) {
      console.error('Database error:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const username = results[0].username;

    // ดึง comments เดิมจากฐานข้อมูล
    const fetchQuery = 'SELECT comments FROM posts WHERE id = ?';
    db.query(fetchQuery, [postId], (err, postResults) => {
      if (err) {
        console.error('Database error:', err.message);
        return res.status(500).json({ error: 'Database error' });
      }

      if (postResults.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }

      // แปลง comments เดิมจาก JSON
      const existingComments = JSON.parse(postResults[0].comments || '[]');

      // เพิ่มคอมเมนต์ใหม่พร้อม username
      const newComment = {
        userId,
        username,
        comment,
        timestamp: new Date().toISOString(),
      };
      existingComments.push(newComment);

      // อัปเดต comments กลับไปยังฐานข้อมูล
      const updateQuery = 'UPDATE posts SET comments = ? WHERE id = ?';
      db.query(updateQuery, [JSON.stringify(existingComments), postId], (err) => {
        if (err) {
          console.error('Database error:', err.message);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true });
      });
    });
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ error: 'Failed to logout.' });
    }
    res.clearCookie('connect.sid'); // ลบคุกกี้ของเซสชัน
    res.json({ success: true });
  });
});

// Route สำหรับหน้า Profile
app.get('/profile', (req, res) => {
  if (req.session.userId) {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
  } else {
    res.redirect('/login');
  }
});

// API: ดึงข้อมูลโปรไฟล์
app.get('/api/profile', (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const query = `SELECT username, email, profile_picture AS profilePicture FROM users WHERE id = ?`;
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(results[0]);
  });
});

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, 'public/profile_pics/');
  },
  filename: (req, file, cb) => {
    cb(null, `${req.session.userId}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage: storage,});

// API: Upload Profile Picture
app.post('/uploadProfilePic', upload.single('profilePic'), (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const profilePicture = req.file.filename;

  // บันทึกชื่อไฟล์รูปในฐานข้อมูล
  const query = `UPDATE users SET profile_picture = ? WHERE id = ?`;
  db.query(query, [profilePicture, userId], (err) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to update profile picture in database.' });
    }

    res.json({ success: true, filename: profilePicture });
  });
});


// API: Fetch Profile Data
app.get('/api/profile', (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const query = `SELECT username, email, profile_picture AS profilePicture FROM users WHERE id = ?`;
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(results[0]);
  });
});

// API: Fetch Profile Data
app.get('/api/profile', (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const query = `SELECT username, email, profile_picture AS profilePicture FROM users WHERE id = ?`;
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(results[0]);
  });
});

// API: Get posts for the current user
app.get('/api/userPosts', (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' }); // หากไม่มี session
  }

  const query = `
    SELECT id, text, timestamp, likes, comments 
    FROM posts
    WHERE user_id = ?
    ORDER BY timestamp DESC;
  `;

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Database Error:', err); // Debug Error
      return res.status(500).json({ error: 'Failed to fetch posts.' });
    }

    results.forEach((post) => {
      post.comments = JSON.parse(post.comments || '[]'); // แปลง comments จาก JSON string
    });

    res.json(results); // ส่งโพสต์กลับไปยัง Front-End
  });
});


// เริ่มเซิร์ฟเวอร์
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
