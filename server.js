const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // For password encryption
const multer = require('multer'); // For file uploads
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3'); // AWS S3 for file storage
const User = require('./models/user'); // Import user model
const Submission = require('./models/submission'); // Import submission model
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // For unique file names
require('dotenv').config(); // To load environment variables

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

const app = express();
const PORT = 3000;

// AWS S3 configuration
const s3 = new S3Client({
  region: 'us-east-2', // Replace with your region
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Connect to MongoDB (replace with your own MongoDB URI)
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));


// Middleware to parse JSON and form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public')); // Serve static files

// Set up session middleware
app.use(
  session({
    secret: 'secret_key', // Replace with a strong secret
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // Set true for HTTPS
  })
);

// Set up multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Function to upload file to AWS S3
const uploadFileToS3 = async (file) => {
  try {
    const params = {
      Bucket: 'robotics-help-portal', // Replace with your S3 bucket name
      Key: `${uuidv4()}-${file.originalname}`, // Unique file name in S3
      Body: file.buffer
    };

    const command = new PutObjectCommand(params);
    const data = await s3.send(command);
    return `https://${params.Bucket}.s3.amazonaws.com/${params.Key}`;
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw new Error('File upload failed.');
  }
};

// Registration Route
app.post('/register', async (req, res) => {
  const { userId, password, role } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ userId });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User ID already exists' });
    }

    // Encrypt password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
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
    // Find user in MongoDB
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    // Set session for the user
    req.session.userId = userId;
    req.session.role = user.role;

    // Redirect based on role
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

// Submission Route with detailed logging
app.post('/submit', upload.single('file'), async (req, res) => {
  const { problem, intended, actual } = req.body;

  // Log incoming data for debugging
  console.log('Problem:', problem);
  console.log('Intended:', intended);
  console.log('Actual:', actual);
  console.log('File:', req.file);

  if (!req.file) {
    console.error('No file uploaded.');
    return res.status(400).json({ success: false, message: 'File is required.' });
  }

  try {
    // Upload file to S3
    const fileUrl = await uploadFileToS3(req.file);
    console.log('File uploaded to S3 successfully:', fileUrl);

    const newSubmission = new Submission({
      userId: req.session.userId,
      problem,
      intended,
      actual,
      fileUrl,
    });

    await newSubmission.save();
    console.log('Submission saved to MongoDB successfully.');
    res.json({ success: true });
  } catch (error) {
    console.error('Error during submission:', error);
    res.status(500).json({ success: false, message: 'Error during submission.' });
  }
});

// Submission feedback route
app.post('/submit-feedback/:submissionId', upload.single('feedback-file'), async (req, res) => {
  const { submissionId } = req.params;
  const { commentary } = req.body;

  try {
    // If the teacher has attached a file, upload it to S3
    let feedbackFileUrl = '';
    if (req.file) {
      feedbackFileUrl = await uploadFileToS3(req.file);
    }

    // Update the submission with the feedback and optional file
    await Submission.findByIdAndUpdate(submissionId, {
      feedback: commentary,
      feedbackFileUrl: feedbackFileUrl,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ success: false, message: 'Error submitting feedback.' });
  }
});

// Fetch submissions for logged-in student
app.get('/submissions', async (req, res) => {
  const userId = req.session.userId; // Get userId from the session
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
app.get('/teacher-submissions', async (req, res) => {
  if (req.session.role !== 'teacher') {
    return res.status(401).json({ success: false, message: 'Unauthorized access' });
  }

  try {
    const submissions = await Submission.find().sort({ createdAt: -1 });
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching submissions.' });
  }
});

// Fetch all students for teacher
app.get('/teacher-students', async (req, res) => {
  if (req.session.role !== 'teacher') {
    return res.status(401).json({ success: false, message: 'Unauthorized access' });
  }

  try {
    const students = await User.find({ role: 'student' });
    res.json(students);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching students.' });
  }
});

// Fetch submissions for a specific student (for teacher view)
app.get('/teacher-submissions/:studentId', async (req, res) => {
  const { studentId } = req.params;

  if (req.session.role !== 'teacher') {
    return res.status(401).json({ success: false, message: 'Unauthorized access' });
  }

  try {
    const submissions = await Submission.find({ userId: studentId }).sort({ createdAt: -1 });
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching student submissions.' });
  }
});

// Fetch the list of students (excluding the teacher)
app.get('/students', async (req, res) => {
  try {
    const students = await User.find({ role: 'student' });
    res.json(students);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching students.' });
  }
});


// Serve static files for HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
