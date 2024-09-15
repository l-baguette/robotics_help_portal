// Handle registration
document.getElementById('register-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const userId = document.getElementById('userId').value;
  const password = document.getElementById('password').value;
  const role = 'student'; // Default role

  const response = await fetch('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, password, role })
  });

  const result = await response.json();
  if (result.success) {
    alert(result.message);
    window.location.href = '/index.html';
  } else {
    alert(result.message);
  }
});

// Handle login and role-based redirection
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const userId = document.getElementById('userId').value;
  const password = document.getElementById('password').value;

  const response = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, password })
  });

  const result = await response.json();
  if (result.success) {
    window.location.href = result.redirect;
  } else {
    alert(result.message);
  }
});

// Handle logout
document.getElementById('logout-btn')?.addEventListener('click', async () => {
  const response = await fetch('/logout', { method: 'POST' });
  const result = await response.json();
  if (result.success) {
    window.location.href = result.redirect;
  }
});

// Fetch and display submissions for students
document.addEventListener('DOMContentLoaded', async () => {
  const submissionsList = document.getElementById('submissions-list');

  if (!submissionsList) return;

  try {
    const response = await fetch('/submissions');
    const submissions = await response.json();

    if (submissions.length === 0) {
      submissionsList.innerHTML = '<p>No submissions found.</p>';
      return;
    }

    submissionsList.innerHTML = ''; // Ensure no duplicates

    submissions.forEach(submission => {
      const submissionDiv = document.createElement('div');
      submissionDiv.classList.add('submission');

      submissionDiv.innerHTML = `
        <h3>Submitted on: ${new Date(submission.createdAt).toLocaleString()}</h3>
        <p><strong>Problem:</strong> ${submission.problem}</p>
        <p><strong>Intended:</strong> ${submission.intended}</p>
        <p><strong>Actual:</strong> ${submission.actual}</p>
        <p><strong>File:</strong> <a href="${submission.fileUrl}" download>Download File</a></p>
        ${submission.feedback ? `
          <div class="feedback">
            <h4>Feedback:</h4>
            <p>${submission.feedback}</p>
            ${submission.feedbackFileUrl ? `<p><strong>Feedback File:</strong> <a href="${submission.feedbackFileUrl}" download>Download File</a></p>` : ''}
          </div>
        ` : '<p>No feedback yet.</p>'}
        <hr>
      `;

      submissionsList.appendChild(submissionDiv);
    });
  } catch (error) {
    submissionsList.innerHTML = '<p>Error loading submissions. Please try again.</p>';
  }
});

// Fetch and display all submissions for teachers
document.addEventListener('DOMContentLoaded', async () => {
  const allSubmissionsList = document.getElementById('all-submissions-list');

  if (!allSubmissionsList) return;

  try {
    const response = await fetch('/teacher-submissions');
    const submissions = await response.json();

    if (submissions.length === 0) {
      allSubmissionsList.innerHTML = '<p>No submissions found.</p>';
      return;
    }

    submissionsList.innerHTML = ''; // Ensure no duplicates

    submissions.forEach(submission => {
      const submissionDiv = document.createElement('div');
      submissionDiv.classList.add('submission');

      submissionDiv.innerHTML = `
        <h3>Submitted by: ${submission.userId}</h3>
        <h3>Submitted on: ${new Date(submission.createdAt).toLocaleString()}</h3>
        <p><strong>Problem:</strong> ${submission.problem}</p>
        <p><strong>Intended:</strong> ${submission.intended}</p>
        <p><strong>Actual:</strong> ${submission.actual}</p>
        <p><strong>File:</strong> <a href="${submission.fileUrl}" download>Download File</a></p>
        ${submission.feedback ? `
          <div class="feedback">
            <h4>Feedback:</h4>
            <p>${submission.feedback}</p>
            ${submission.feedbackFileUrl ? `<p><strong>Feedback File:</strong> <a href="${submission.feedbackFileUrl}" download>Download File</a></p>` : ''}
          </div>
        ` : '<p>No feedback yet.</p>'}
        <button onclick="window.location.href='/add-feedback.html?submissionId=${submission._id}'">Add Feedback</button>
        <hr>
      `;

      allSubmissionsList.appendChild(submissionDiv);
    });
  } catch (error) {
    allSubmissionsList.innerHTML = '<p>Error loading submissions. Please try again.</p>';
  }
});
