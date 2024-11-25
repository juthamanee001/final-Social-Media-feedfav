// ฟังก์ชันสำหรับตั้งค่า Cookie
function setCookie(name, value, days) {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = "expires=" + date.toUTCString();
  document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

// ฟังก์ชันสำหรับอ่านค่า Cookie
function getCookie(name) {
  const decodedCookie = decodeURIComponent(document.cookie);
  const cookies = decodedCookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    let cookie = cookies[i].trim();
    if (cookie.indexOf(name + "=") === 0) {
      return cookie.substring(name.length + 1, cookie.length);
    }
  }
  return "";
}

// โหลดข้อมูลโปรไฟล์
async function loadProfile() {
  try {
    const response = await fetch('/api/profile');
    if (response.ok) {
      const data = await response.json();
      document.getElementById('username').innerText = data.username;
      document.getElementById('email').innerText = data.email;

      // โหลดรูปภาพจากเซิร์ฟเวอร์ หากมีการอัปเดต
      if (data.profilePicture) {
        const timestamp = new Date().getTime(); // ป้องกันแคช
        document.querySelector('#displayPic img').src = `profile_pics/${data.profilePicture}?t=${timestamp}`;
      } else {
        // ใช้รูป default ถ้าผู้ใช้ยังไม่มีรูปภาพ
        document.querySelector('#displayPic img').src = `profile_pics/default-avatar.png`;
      }
    } else {
      console.error('Failed to load profile data.');
    }
  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

// เปลี่ยนการคลิกปุ่มเป็นคลิกรูปภาพเพื่อเปลี่ยน
document.getElementById('displayPic').addEventListener('click', () => {
  document.getElementById('fileField').click(); // คลิกเพื่อเรียก input file
});

// อัปโหลดและเปลี่ยนรูปภาพ
document.getElementById('fileField').addEventListener('change', () => {
  const fileInput = document.getElementById('fileField');
  const file = fileInput.files[0];

  if (file) {
    const formData = new FormData();
    formData.append('profilePic', file);

    fetch('/uploadProfilePic', {
      method: 'POST',
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          const timestamp = new Date().getTime();
          document.querySelector('#displayPic img').src = `profile_pics/${data.filename}?t=${timestamp}`;
          alert('Profile picture updated successfully!');
        } else {
          alert('Failed to update profile picture.');
        }
      })
      .catch((error) => {
        console.error('Error updating profile picture:', error);
      });
  } else {
    alert('No file selected.');
  }
});

// Logout (ไม่ลบคุกกี้รูปภาพ)
const logoutLink = document.getElementById('logoutLink');
logoutLink.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    const response = await fetch('/api/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (response.ok) {
      window.location.href = '/login';
    } else {
      alert('Logout failed.');
    }
  } catch (error) {
    console.error('Error during logout:', error);
    alert('An error occurred while logging out.');
  }
});

// Load user-specific posts
async function loadUserPosts() {
  try {
    const response = await fetch('/api/userPosts');
    if (response.ok) {
      const posts = await response.json();
      console.log('Fetched posts:', posts); // Debug: ตรวจสอบข้อมูลที่ได้จาก API

      const postsContainer = document.getElementById('profilePosts');
      postsContainer.innerHTML = '';

      if (posts.length > 0) {
        posts.forEach((post) => {
          const postDiv = document.createElement('div');
          postDiv.classList.add('post');
          postDiv.innerHTML = `
            <p>${post.text}</p>
            <p><em>Posted at ${new Date(post.timestamp).toLocaleString('en-US', {
              timeZone: 'Asia/Bangkok',
            })}</em></p>
            <div class="actions">
              <button class="like" onclick="toggleLike(this, ${post.id})">❤️ Like</button>
              <span class="like-count">${post.likes}</span> Likes
              <button class="comment" onclick="toggleComment(${post.id})">💬 Comment</button>
              <span class="comment-count">${post.comments.length}</span> Comments
            </div>
          `;
          postsContainer.appendChild(postDiv);
        });
      } else {
        postsContainer.innerHTML = '<p>No posts found.</p>'; // หากไม่มีโพสต์
      }
    } else {
      console.error('Failed to load user posts:', response.statusText);
    }
  } catch (error) {
    console.error('Error loading user posts:', error); // หาก fetch มีข้อผิดพลาด
  }
}

// Function to handle like toggling
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

// Function to handle adding comments
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
      loadUserPosts(); // Reload posts after adding a comment
    } else {
      alert(result.error || 'Failed to add comment.');
    }
  }
}

// โหลดข้อมูลโปรไฟล์เมื่อหน้าเพจโหลด
loadProfile();
loadUserPosts(); // อยู่ท้ายไฟล์ `profile.js`
