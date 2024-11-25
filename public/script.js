// DOM elements
const postButton = document.getElementById('postButton');
const postText = document.getElementById('postText');
const feedContainer = document.getElementById('feed');
const forYouTab = document.getElementById('forYouTab');
const followingTab = document.getElementById('followingTab');

// Function to format the date to display post time
function formatTime(date) {
  return date.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' });
}

// Function to render posts for the active tab
async function renderPosts(posts) {
  console.log("Rendering posts:", posts); // Debugging log
  feedContainer.innerHTML = ''; // Clear existing posts

  posts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort posts by timestamp

  for (const post of posts) {
    const comments = post.comments ? JSON.parse(post.comments) : []; // Parse JSON comments
    const commentCount = comments.length;

    const postDiv = document.createElement('div');
    postDiv.classList.add('post');
    postDiv.innerHTML = `
      <p><strong>${post.username}</strong>: ${post.text}</p>
      <p><em>Posted at ${formatTime(new Date(post.timestamp))}</em></p>
      <div class="actions">
        <button class="like" onclick="toggleLike(this, ${post.id})">❤️ Like</button>
        <span class="like-count">${post.likes}</span> Likes
        <button class="comment" onclick="toggleComment(${post.id})">💬 Comment</button>
        <span class="comment-count">${commentCount}</span> Comments
      </div>
      <div class="comments-section">
        ${comments
          .map((c) => `
            <p>
              <strong>${c.username}</strong> (${formatTime(new Date(c.timestamp))}): 
              ${c.comment}
            </p>
          `)
          .join('')}
      </div>
    `;
    feedContainer.appendChild(postDiv);
  }
}

// Get the active tab ("forYou" or "following")
function getActiveTab() {
  return forYouTab.classList.contains('active') ? 'forYou' : 'following';
}

// Handle "Post" button click
postButton.addEventListener('click', async () => {
  const text = postText.value.trim();
  if (text) {
    const newPost = {
      text,
      timestamp: new Date().toISOString(),
    };

    const tab = getActiveTab();
    console.log("Posting to tab:", tab);

    try {
      const response = await fetch(`/api/posts/${tab}`, {
        method: 'POST',
        body: JSON.stringify(newPost),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      if (result.success) {
        console.log("Post added successfully:", result);
        const posts = await loadPosts(tab);
        renderPosts(posts);
      } else {
        console.error("Post failed:", result.error);
        alert(result.error || 'Failed to add post.');
      }
    } catch (error) {
      console.error("Error posting:", error);
      alert('An error occurred while posting. Please try again.');
    }

    postText.value = ''; // Clear input field
  } else {
    alert('Post text cannot be empty.');
  }
});

// Function to handle like/unlike toggling
async function toggleLike(button, postId) {
  const response = await fetch(`/api/like`, {
    method: 'POST',
    body: JSON.stringify({ postId }),
    headers: { 'Content-Type': 'application/json' },
  });

  const result = await response.json();
  if (result.success) {
    const likeCount = button.nextElementSibling;
    let count = parseInt(likeCount.innerText);

    if (result.liked) {
      button.classList.add('liked');
      likeCount.innerText = count + 1;
    } else {
      button.classList.remove('liked');
      likeCount.innerText = count - 1;
    }
  } else {
    alert(result.error || 'Failed to toggle like.');
  }
}

// Function to handle adding a comment
async function toggleComment(postId) {
  const comment = prompt('Enter your comment:');
  if (comment) {
    const response = await fetch(`/api/comment`, {
      method: 'POST',
      body: JSON.stringify({ postId, comment }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await response.json();
    if (result.success) {
      const posts = await loadPosts(getActiveTab());
      renderPosts(posts);
    } else {
      alert(result.error || 'Failed to add comment.');
    }
  }
}

// Load posts from the active tab
async function loadPosts(tab) {
  const response = await fetch(`/api/posts/${tab}`);
  const posts = await response.json();
  console.log("Loaded Posts:", posts);
  return posts;
}

// Load initial tab
(async () => {
  const tab = getActiveTab();
  renderPosts(await loadPosts(tab));
})();


