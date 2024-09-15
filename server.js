const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const User = require('./models/user');
const Submission = require('./models/submission');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = 3000;

// AWS S3 configuration
const s3 = new S3Client({
  region: 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Middleware to parse JSON and form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Set up session middleware
app.use(
  session({
    secret: 'secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);

// Set up multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Function to upload file to AWS S3
const uploadFileToS3 = async (file) => {
  try {
    const params = {
      Bucket: 'robotics-help-portal',
      Key: `${uuidv4()}-${file.originalname}`,
      Body: file.buffer,
    };

    const command = new PutObjectCommand(params);
    const data = await s3.send(command);
    return `https://${params.Bucket}.s3.amazonaws.com/${params.Key}`;
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw new Error('File upload failed.');
  }
};

// Middleware to check if the user is a teacher
function checkTeacherRole(req, res, next) {
  if (req.session.role === 'teacher') {
    return next();
  } else {
    return res.status(403).send('Access Denied: Only teachers can access this page.');
  }
}

// Registration Route
app.post('/register', async (req, res) => {
  const { userId, password, role } = req.body;

  try {
    const existingUser = await User.findOne({ userId });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User ID already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ userId, password: hashedPassword, role });
    await newUser.save();

    res.json({ success: true, message: 'Registration successful!' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Login Route
app.post('/login', async (req, res) => {
  const { userId, password } = req.body;

  try {
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    req.session.userId = userId;
    req.session.role = user.role;

    if (user.role === 'teacher') {
      res.json({ success: true, redirect: '/teacher-dashboard.html' });
    } else {
      res.json({ success: true, redirect: '/student-dashboard.html' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Logout Route
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, redirect: '/index.html' });
  });
});

// Submission Route
app.post('/submit', upload.single('file'), async (req, res) => {
  const { problem, intended, actual } = req.body;

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'File is required.' });
  }

  try {
    const fileUrl = await uploadFileToS3(req.file);

    const newSubmission = new Submission({
      userId: req.session.userId,
      problem,
      intended,
      actual,
      fileUrl,
    });

    await newSubmission.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error during submission.' });
  }
});

// Submission feedback route
app.post('/submit-feedback/:submissionId', upload.single('feedback-file'), async (req, res) => {
  const { submissionId } = req.params;
  const { commentary } = req.body;

  try {
    let feedbackFileUrl = '';
    if (req.file) {
      feedbackFileUrl = await uploadFileToS3(req.file);
    }

    await Submission.findByIdAndUpdate(submissionId, {
      feedback: commentary,
      feedbackFileUrl: feedbackFileUrl,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error submitting feedback.' });
  }
});

// Fetch submissions for the logged-in student
app.get('/submissions', async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized access' });
  }

  try {
    const submissions = await Submission.find({ userId }).sort({ createdAt: -1 });
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching submissions.' });
  }
});

// Fetch all submissions for teacher
app.get('/teacher-submissions', checkTeacherRole, async (req, res) => {
  try {
    const submissions = await Submission.find().sort({ createdAt: -1 });
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching submissions.' });
  }
});

// Fetch all students for teacher
app.get('/teacher-students', checkTeacherRole, async (req, res) => {
  try {
    const students = await User.find({ role: 'student' });
    res.json(students);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching students.' });
  }
});

// Fetch submissions for a specific student (for teacher view)
app.get('/teacher-submissions/:studentId', checkTeacherRole, async (req, res) => {
  const { studentId } = req.params;

  try {
    const submissions = await Submission.find({ userId: studentId }).sort({ createdAt: -1 });
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching student submissions.' });
  }
});

// Serve static files for HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
