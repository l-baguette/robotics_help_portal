const mongoose = require('mongoose');


const submissionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    problem: { type: String, required: true },
    intended: { type: String, required: true },
    actual: { type: String, required: true },
    fileUrl: { type: String, required: true },
    feedback: { type: String, default: '' }, // Feedback text
    feedbackFileUrl: { type: String, default: '' }, // Feedback file URL
  },
  { timestamps: true }
);


module.exports = mongoose.model('Submission', submissionSchema);


