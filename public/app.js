const authScreen = document.querySelector('.auth-screen');
const appScreen = document.querySelector('.app-screen');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const showSignup = document.getElementById('showSignup');
const showLogin = document.getElementById('showLogin');
const loginMessage = document.getElementById('loginMessage');
const signupMessage = document.getElementById('signupMessage');
const currentUserLabel = document.getElementById('currentUserLabel');
const actionToggle = document.getElementById('actionToggle');
const actionMenu = document.getElementById('actionMenu');
const dropdownLinks = document.querySelectorAll('.dropdown-link');
const exerciseSelect = document.getElementById('exerciseSelect');
const friendSelect = document.getElementById('friendSelect');
const workoutForm = document.getElementById('workoutForm');
const friendForm = document.getElementById('friendForm');
const liftInputs = document.getElementById('liftInputs');
const timeInputs = document.getElementById('timeInputs');
const friendList = document.getElementById('friendList');
const friendLeaderboard = document.getElementById('friendLeaderboard');
const globalLeaderboard = document.getElementById('globalLeaderboard');
const userStats = document.getElementById('userStats');
const rewardList = document.getElementById('rewardList');
const weightInput = document.getElementById('weightInput');
const repsInput = document.getElementById('repsInput');
const durationInput = document.getElementById('durationInput');
const activityFeed = document.getElementById('activityFeed');
const goalProgressBar = document.getElementById('goalProgressBar');
const goalProgressLabel = document.getElementById('goalProgressLabel');
const goalProgressTag = document.getElementById('goalProgressTag');
const friendSuggestions = document.getElementById('friendSuggestions');
const quickAccessGrid = document.getElementById('quickAccessGrid');
const pages = document.querySelectorAll('.page');

let users = [];
let exercises = [];
let currentUser = null;
let currentUserFavorites = [];

const exerciseIcons = {
  bench: '🏋️',
  squat: '🍑',
  deadlift: '🏋️',
  shoulder: '💪',
  bicep: '💥',
  plank: '🧘',
  skipping: '🤾',
  jogging: '🏃'
};

function setPage(pageId) {
  pages.forEach(page => page.classList.toggle('hidden', page.dataset.page !== pageId));
  history.replaceState(null, '', `#${pageId}`);
}

function getActivePage() {
  const hashPage = window.location.hash.replace('#', '');
  return ['overview', 'log', 'friends', 'leaderboards'].includes(hashPage) ? hashPage : 'overview';
}

function showAuthScreen() {
  authScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
}

function showAppScreen() {
  authScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  setPage(getActivePage());
}

function getExerciseIcon(exerciseId) {
  return exerciseIcons[exerciseId] || '🏋️';
}

async function fetchUsers() {
  const response = await fetch('/api/users');
  users = await response.json();
}

async function fetchExercises() {
  const response = await fetch('/api/exercises');
  exercises = await response.json();
  exerciseSelect.innerHTML = exercises
    .map(exercise => `<option value="${exercise.id}" data-kind="${exercise.kind}">${exercise.name}</option>`)
    .join('');
  updateInputFields();
}

async function loginUser(email, password) {
  loginMessage.textContent = '';
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const payload = await response.json();
  if (!response.ok) {
    loginMessage.textContent = payload.error || 'Login failed';
    return null;
  }
  return payload.user;
}

async function signupUser(name, email, password) {
  signupMessage.textContent = '';
  const response = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  const payload = await response.json();
  if (!response.ok) {
    signupMessage.textContent = payload.error || 'Signup failed';
    return null;
  }
  return payload.user;
}

async function loadUserProfile(userId) {
  const response = await fetch(`/api/user/${userId}/profile`);
  if (!response.ok) return null;
  const profile = await response.json();
  currentUser = profile;
  currentUserFavorites = profile.favoriteExercises || [];
  currentUserLabel.textContent = profile.name;
  localStorage.setItem('gymnakUser', JSON.stringify(profile));
  return profile;
}

async function updateFavorites(favoriteExercises) {
  if (!currentUser) return;
  const response = await fetch(`/api/user/${currentUser.id}/favorites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ favoriteExercises })
  });
  const updated = await response.json();
  if (response.ok) {
    currentUserFavorites = updated.favoriteExercises || [];
    localStorage.setItem('gymnakUser', JSON.stringify(updated));
    return updated;
  }
  return null;
}

function renderQuickAccess() {
  if (!quickAccessGrid) return;
  const favorites = exercises.filter(ex => currentUserFavorites.includes(ex.id));
  const others = exercises.filter(ex => !currentUserFavorites.includes(ex.id)).slice(0, 4);
  const cards = [...favorites, ...others];
  quickAccessGrid.innerHTML = cards
    .map(exercise => {
      const isFavorite = currentUserFavorites.includes(exercise.id);
      return `
        <div class="quick-card">
          <div class="quick-icon">${getExerciseIcon(exercise.id)}</div>
          <div class="quick-details">
            <h3>${exercise.name}</h3>
            <p>${exercise.kind === 'lift' ? 'Weight + reps' : 'Duration in ' + exercise.unit}</p>
          </div>
          <div class="quick-actions">
            <button type="button" class="quick-log" data-exercise-id="${exercise.id}">Log</button>
            <button type="button" class="quick-fav" data-exercise-id="${exercise.id}">${isFavorite ? '★ Favorite' : '☆ Favorite'}</button>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderFriendManager(friends) {
  if (!friends.length) {
    friendList.innerHTML = '<p>No friends added yet. Add a friend to start competing.</p>';
    return;
  }
  friendList.innerHTML = friends
    .map(friend => `
      <div class="friend-item">
        <div>
          <strong>${friend.name}</strong>
          <div class="status-tag">Friend</div>
        </div>
        <button data-friend-id="${friend.id}" class="remove-friend">Remove</button>
      </div>
    `)
    .join('');
  document.querySelectorAll('.remove-friend').forEach(button => {
    button.addEventListener('click', async event => {
      const friendId = event.currentTarget.dataset.friendId;
      await fetch('/api/friend/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, friendId })
      });
      await refreshAll();
    });
  });
}

function renderFriendSuggestions(availableFriends) {
  if (!availableFriends.length) {
    friendSuggestions.innerHTML = '<p>No new friend recommendations right now.</p>';
    return;
  }
  friendSuggestions.innerHTML = availableFriends
    .map(friend => `
      <div class="suggestion-item">
        <div>
          <strong>${friend.name}</strong>
          <p>Connect and compare your progress together.</p>
        </div>
        <button data-friend-id="${friend.id}" class="add-suggestion">Add</button>
      </div>
    `)
    .join('');
  document.querySelectorAll('.add-suggestion').forEach(button => {
    button.addEventListener('click', async event => {
      const friendId = event.currentTarget.dataset.friendId;
      await fetch('/api/friend/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, friendId })
      });
      await refreshAll();
    });
  });
}

function renderGoalProgress(stats) {
  const target = 100;
  const progress = Math.min(100, Math.round((stats.scoreWithBonus / target) * 100));
  goalProgressBar.style.width = `${progress}%`;
  goalProgressLabel.textContent = progress >= 100 ? 'Target reached! Keep building momentum.' : `You have completed ${progress}% of your weekly goal.`;
  goalProgressTag.textContent = `Goal: ${target} pts`;
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function renderActivityFeed(activities) {
  if (!activities.length) {
    activityFeed.innerHTML = '<p>No recent workouts yet. Log your first session to build your feed.</p>';
    return;
  }
  const recent = activities.slice(-6).reverse();
  activityFeed.innerHTML = recent
    .map(item => `
      <div class="activity-item">
        <div>
          <strong>${item.name}</strong>
          <p>${item.kind === 'lift' ? `${item.weight} kg × ${item.reps} reps` : `${item.duration} ${item.unit}`}</p>
        </div>
        <div class="status-tag">${formatDate(item.createdAt)}</div>
      </div>
    `)
    .join('');
}

function renderFriendlyLeaderboard(list) {
  if (!list.length) {
    friendLeaderboard.innerHTML = '<p>Your friends leaderboard is empty. Invite some friends to compete.</p>';
    return;
  }
  friendLeaderboard.innerHTML = list
    .map((item, index) => `
      <div class="leaderboard-item">
        <div>
          <strong>#${index + 1} ${item.name}</strong>
          <div>Total score: ${item.scoreWithBonus} pts${item.bonusPoints ? ` (+${item.bonusPoints} bonus)` : ''} · Sessions: ${item.totalSessions}</div>
          <div>Weight: ${item.totalWeight} kg · Time: ${item.totalTimeMinutes} min</div>
        </div>
        <div class="status-tag">${item.rewards.length} rewards</div>
      </div>
    `)
    .join('');
}

function renderGlobalLeaderboard(list) {
  if (!list.length) {
    globalLeaderboard.innerHTML = '<p>No workouts logged across the platform yet.</p>';
    return;
  }
  globalLeaderboard.innerHTML = list
    .map((item, index) => `
      <div class="leaderboard-item">
        <div><strong>#${index + 1} ${item.name}</strong></div>
        <div class="status-tag">${item.scoreWithBonus} pts${item.bonusPoints ? ` (+${item.bonusPoints})` : ''}</div>
      </div>
    `)
    .join('');
}

function renderStats(data) {
  userStats.innerHTML = `
    <div class="stat-row"><span>Total workouts</span><strong>${data.stats.totalSessions}</strong></div>
    <div class="stat-row"><span>Total score</span><strong>${data.stats.scoreWithBonus}</strong></div>
    ${data.stats.bonusPoints ? `<div class="stat-row"><span>Weekly bonus</span><strong>+${data.stats.bonusPoints}</strong></div>` : ''}
    <div class="stat-row"><span>Total time</span><strong>${data.stats.totalTimeMinutes} min</strong></div>
  `;
  rewardList.innerHTML = `<h3>Rewards unlocked</h3>${data.rewards.length
    ? data.rewards
        .map(item => `
          <div class="reward-item">
            <div><strong>${item.name}</strong><p>${item.description}</p></div>
            <div class="status-tag">Unlocked</div>
          </div>
        `)
        .join('')
    : '<p>No rewards yet. Log workouts to unlock badges.</p>'}`;
  renderGoalProgress(data.stats);
  renderActivityFeed(data.activities);
}

async function refreshAll() {
  if (!currentUser) return;
  await fetchUsers();
  const [friendsResponse, friendLbResponse, globalLbResponse, statsResponse] = await Promise.all([
    fetch(`/api/friends/${currentUser.id}`),
    fetch(`/api/leaderboard/friends/${currentUser.id}`),
    fetch('/api/leaderboard/global'),
    fetch(`/api/user/${currentUser.id}/stats`)
  ]);
  const friends = await friendsResponse.json();
  const friendLeaderboardData = await friendLbResponse.json();
  const globalLeaderboardData = await globalLbResponse.json();
  const userData = await statsResponse.json();
  renderFriendManager(friends);
  renderFriendlyLeaderboard(friendLeaderboardData);
  renderGlobalLeaderboard(globalLeaderboardData);
  renderStats(userData);
  const availableFriends = users.filter(user => user.id !== currentUser.id && !friends.some(friend => friend.id === user.id));
  friendSelect.innerHTML = availableFriends.length
    ? availableFriends.map(user => `<option value="${user.id}">${user.name}</option>`).join('')
    : '<option value="">No new friends available</option>';
  renderFriendSuggestions(availableFriends);
  renderQuickAccess();
}

function updateInputFields() {
  const selected = exerciseSelect.selectedOptions[0];
  const kind = selected?.dataset?.kind;
  if (kind === 'lift') {
    liftInputs.classList.remove('hidden');
    timeInputs.classList.add('hidden');
  } else {
    liftInputs.classList.add('hidden');
    timeInputs.classList.remove('hidden');
  }
}

async function toggleFavorite(exerciseId) {
  const favorites = new Set(currentUserFavorites);
  if (favorites.has(exerciseId)) {
    favorites.delete(exerciseId);
  } else {
    favorites.add(exerciseId);
  }
  await updateFavorites([...favorites]);
  renderQuickAccess();
}

loginForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const user = await loginUser(email, password);
  if (!user) return;
  await loadUserProfile(user.id);
  await fetchExercises();
  await refreshAll();
  setPage('overview');
  showAppScreen();
});

signupForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value.trim();
  const user = await signupUser(name, email, password);
  if (!user) return;
  await loadUserProfile(user.id);
  await fetchExercises();
  await refreshAll();
  setPage('overview');
  showAppScreen();
});

showSignup?.addEventListener('click', () => {
  document.querySelector('.auth-login')?.classList.add('hidden');
  document.querySelector('.auth-signup')?.classList.remove('hidden');
});

showLogin?.addEventListener('click', () => {
  document.querySelector('.auth-signup')?.classList.add('hidden');
  document.querySelector('.auth-login')?.classList.remove('hidden');
});

actionToggle?.addEventListener('click', () => {
  actionMenu?.classList.toggle('hidden');
});

document.addEventListener('click', event => {
  if (!actionMenu || !actionToggle) return;
  if (!actionMenu.contains(event.target) && !actionToggle.contains(event.target)) {
    actionMenu.classList.add('hidden');
  }
});

dropdownLinks.forEach(link => {
  link.addEventListener('click', async event => {
    const page = event.currentTarget.dataset.page;
    const action = event.currentTarget.dataset.action;
    if (page) setPage(page);
    if (action === 'refresh') await refreshAll();
    if (action === 'logout') {
      localStorage.removeItem('gymnakUser');
      currentUser = null;
      showAuthScreen();
    }
    actionMenu?.classList.add('hidden');
  });
});

quickAccessGrid?.addEventListener('click', async event => {
  const logButton = event.target.closest('.quick-log');
  const favButton = event.target.closest('.quick-fav');
  if (logButton) {
    const exerciseId = logButton.dataset.exerciseId;
    exerciseSelect.value = exerciseId;
    updateInputFields();
    setPage('log');
    return;
  }
  if (favButton) {
    const exerciseId = favButton.dataset.exerciseId;
    await toggleFavorite(exerciseId);
  }
});

workoutForm?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!currentUser) return;
  const exerciseId = exerciseSelect.value;
  const activeExercise = exercises.find(ex => ex.id === exerciseId);
  await fetch('/api/activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: currentUser.id,
      exerciseId,
      weight: activeExercise.kind === 'lift' ? weightInput.value : 0,
      reps: activeExercise.kind === 'lift' ? repsInput.value : 0,
      duration: activeExercise.kind === 'time' ? durationInput.value : 0
    })
  });
  workoutForm.reset();
  updateInputFields();
  await refreshAll();
});

friendForm?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!currentUser) return;
  const friendId = friendSelect.value;
  if (!friendId) return;
  await fetch('/api/friend/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: currentUser.id, friendId })
  });
  await refreshAll();
});

async function init() {
  await fetchExercises();
  const saved = localStorage.getItem('gymnakUser');
  if (saved) {
    try {
      const storedUser = JSON.parse(saved);
      await loadUserProfile(storedUser.id);
      await refreshAll();
      setPage('overview');
      showAppScreen();
      return;
    } catch (error) {
      localStorage.removeItem('gymnakUser');
    }
  }
  showAuthScreen();
}

init().catch(error => {
  console.error('Initialization failed', error);
  document.body.innerHTML = '<div class="card"><h2>Initialization error</h2><p>Check the console and reload.</p></div>';
});
