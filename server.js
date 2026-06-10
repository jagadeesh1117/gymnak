const express = require('express');
const path = require('path');
const { Low, JSONFile } = require('lowdb');

const app = express();
const port = process.env.PORT || 4000;

const dbFile = path.join(__dirname, 'data', 'db.json');
const adapter = new JSONFile(dbFile);
const db = new Low(adapter);

const defaultExercises = [
  { id: 'bench', name: 'Bench Press', kind: 'lift', unit: 'kg' },
  { id: 'squat', name: 'Squat', kind: 'lift', unit: 'kg' },
  { id: 'deadlift', name: 'Deadlift', kind: 'lift', unit: 'kg' },
  { id: 'shoulder', name: 'Shoulder Press', kind: 'lift', unit: 'kg' },
  { id: 'bicep', name: 'Bicep Curl', kind: 'lift', unit: 'kg' },
  { id: 'plank', name: 'Plank', kind: 'time', unit: 'sec' },
  { id: 'skipping', name: 'Skipping', kind: 'time', unit: 'min' },
  { id: 'jogging', name: 'Jogging', kind: 'time', unit: 'min' }
];

const defaultUsers = [
  {
    id: 'admin',
    name: 'Admin',
    email: 'admin@gymnak.com',
    password: 'admin123',
    role: 'admin',
    favoriteExercises: ['bench', 'plank', 'jogging'],
    rewards: [],
    targetScore: 100,
    achievements: []
  },
  {
    id: 'u1',
    name: 'Alex',
    email: 'alex@gymnak.com',
    password: 'alex123',
    favoriteExercises: ['bench', 'squat', 'plank'],
    rewards: [],
    targetScore: 100,
    achievements: []
  },
  {
    id: 'u2',
    name: 'Ria',
    email: 'ria@gymnak.com',
    password: 'ria123',
    favoriteExercises: ['deadlift', 'skipping', 'shoulder'],
    rewards: [],
    targetScore: 100,
    achievements: []
  },
  {
    id: 'u3',
    name: 'Mia',
    email: 'mia@gymnak.com',
    password: 'mia123',
    favoriteExercises: ['bicep', 'plank', 'jogging'],
    rewards: [],
    targetScore: 100,
    achievements: []
  },
  {
    id: 'u4',
    name: 'Leo',
    email: 'leo@gymnak.com',
    password: 'leo123',
    favoriteExercises: ['squat', 'deadlift', 'skipping'],
    rewards: [],
    targetScore: 100,
    achievements: []
  }
];

const defaultFriends = [
  { userId: 'u1', friendId: 'u2' },
  { userId: 'u1', friendId: 'u3' },
  { userId: 'u2', friendId: 'u4' }
];

const rewardDefinitions = [
  { id: 'starter', name: 'Starter Badge', description: 'First workout logged', condition: stats => stats.totalSessions >= 1 },
  { id: 'goal-setter', name: 'Goal Setter', description: 'Reached your weekly score goal', condition: stats => stats.weeklyScore >= 100 },
  { id: 'consistency', name: 'Consistency Champion', description: 'Logged at least 5 workouts', condition: stats => stats.totalSessions >= 5 },
  { id: 'time-master', name: 'Time Master', description: 'Logged 60 minutes of time-based training', condition: stats => stats.totalTimeMinutes >= 60 }
];

function calculatePoints(entry) {
  if (entry.kind === 'lift') {
    const weight = Number(entry.weight) || 0;
    const reps = Number(entry.reps) || 0;
    const intensity = Math.pow(Math.max(reps, 1), 1.1);
    return Math.round(weight * reps * 0.12 + intensity * 1.5);
  }
  if (entry.kind === 'time') {
    const duration = Number(entry.duration) || 0;
    if (entry.unit === 'sec') {
      return Math.round(duration * 0.25);
    }
    return Math.round(duration * 3.8);
  }
  return 0;
}

function getWeekStart() {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

function getWeekActivities(userId) {
  const weekStart = getWeekStart();
  return getUserActivities(userId).filter(activity => new Date(activity.createdAt) >= weekStart);
}

function buildStats(entries, bonusPoints = 0) {
  const totalTimeSeconds = entries
    .filter(item => item.kind === 'time')
    .reduce((sum, item) => sum + (item.unit === 'sec' ? item.duration : item.duration * 60), 0);
  const baseScore = entries.reduce((sum, item) => sum + calculatePoints(item), 0);
  return {
    totalSessions: entries.length,
    weeklyScore: baseScore,
    totalScore: baseScore,
    bonusPoints,
    scoreWithBonus: baseScore + bonusPoints,
    totalTimeMinutes: Number((totalTimeSeconds / 60).toFixed(1))
  };
}

function getWeeklyRanking(users) {
  const scores = users.map(user => {
    const entries = getWeekActivities(user.id);
    const score = entries.reduce((sum, item) => sum + calculatePoints(item), 0);
    return { user, score };
  });
  return scores.sort((a, b) => b.score - a.score);
}

function updateAllRewards() {
  const users = db.data.users;
  const weeklyRanks = getWeeklyRanking(users).filter(rank => rank.score > 0);
  const topGlobal = weeklyRanks.slice(0, 3).map((rank, index) => ({ userId: rank.user.id, placement: index + 1 }));
  const localLeaders = new Set();
  users.forEach(user => {
    const friendGroup = [user.id, ...getFriends(user.id).map(friend => friend.id)];
    if (friendGroup.length <= 1) return;
    const groupScores = friendGroup.map(memberId => {
      const entries = getWeekActivities(memberId);
      const score = entries.reduce((sum, item) => sum + calculatePoints(item), 0);
      return { memberId, score };
    });
    const leader = groupScores.sort((a, b) => b.score - a.score)[0];
    if (leader && leader.score > 0) {
      localLeaders.add(leader.memberId);
    }
  });

  users.forEach(user => {
    const entries = getWeekActivities(user.id);
    const stats = buildStats(entries);
    const badges = rewardDefinitions
      .filter(reward => reward.condition(stats))
      .map(reward => ({ id: reward.id, name: reward.name, description: reward.description }));

    const globalBadge = topGlobal.find(rank => rank.userId === user.id);
    if (globalBadge) {
      const globalReward = {
        id: `global-${globalBadge.placement}`,
        name: globalBadge.placement === 1 ? 'Global Weekly Champion' : globalBadge.placement === 2 ? 'Global Contender' : 'Global Podium',
        description: globalBadge.placement === 1 ? 'Top performer across GYMNK this week' : globalBadge.placement === 2 ? 'Strong second-place performer this week' : 'Top 3 global performer this week'
      };
      badges.push(globalReward);
    }

    if (localLeaders.has(user.id)) {
      badges.push({
        id: 'local-leader',
        name: 'Local Crew Leader',
        description: 'Highest scoring athlete in your friend group this week'
      });
    }

    user.rewards = badges;
  });
}

function formatLeaderboardItem(user, entries, bonusPoints = 0) {
  const totalWeight = entries
    .filter(item => item.kind === 'lift')
    .reduce((sum, item) => sum + (item.weight * item.reps), 0);
  const totalTimeMinutes = entries
    .filter(item => item.kind === 'time')
    .reduce((sum, item) => sum + (item.unit === 'sec' ? item.duration / 60 : item.duration), 0);
  const stats = buildStats(entries, bonusPoints);
  return {
    userId: user.id,
    name: user.name,
    totalScore: stats.totalScore,
    bonusPoints: stats.bonusPoints,
    scoreWithBonus: stats.scoreWithBonus,
    totalWeight,
    totalTimeMinutes: Number(totalTimeMinutes.toFixed(1)),
    totalSessions: entries.length,
    exercises: entries,
    rewards: user.rewards || []
  };
}

async function loadDatabase() {
  await db.read();
  db.data ||= { users: defaultUsers, exercises: defaultExercises, activities: [], friendships: defaultFriends };
  await db.write();
}

function findUser(userId) {
  return db.data.users.find(user => user.id === userId);
}

function findUserByEmail(email) {
  return db.data.users.find(user => user.email?.toLowerCase() === email?.toLowerCase());
}

function cleanUser(user) {
  if (!user) return null;
  const { password, ...rest } = user;
  return rest;
}

function getUserActivities(userId) {
  return db.data.activities.filter(activity => activity.userId === userId);
}

function getFriends(userId) {
  return db.data.friendships
    .filter(link => link.userId === userId)
    .map(link => findUser(link.friendId))
    .filter(Boolean);
}

function awardRewardsToUser(userId) {
  updateAllRewards();
}

function getUserBonusPoints(user) {
  return (user.rewards || []).reduce((sum, reward) => {
    if (reward.id === 'global-1') return sum + 50;
    if (reward.id === 'global-2') return sum + 30;
    if (reward.id === 'global-3') return sum + 20;
    if (reward.id === 'local-leader') return sum + 20;
    return sum;
  }, 0);
}

app.use(express.json());

app.get('/api/users', async (req, res) => {
  await db.read();
  res.json(db.data.users.map(user => ({
    id: user.id,
    name: user.name,
    rewards: user.rewards || [],
    favoriteExercises: user.favoriteExercises || []
  })));
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  await db.read();
  const user = findUserByEmail(email);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({ user: cleanUser(user) });
});

app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  await db.read();
  if (findUserByEmail(email)) {
    return res.status(409).json({ error: 'Email already exists' });
  }
  const id = `u${Date.now()}`;
  const newUser = {
    id,
    name,
    email,
    password,
    favoriteExercises: ['bench', 'squat', 'plank'],
    rewards: [],
    targetScore: 100,
    achievements: []
  };
  db.data.users.push(newUser);
  await db.write();
  res.json({ user: cleanUser(newUser) });
});

app.get('/api/user/:userId/profile', async (req, res) => {
  await db.read();
  const user = findUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(cleanUser(user));
});

app.post('/api/user/:userId/favorites', async (req, res) => {
  await db.read();
  const user = findUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const favoriteExercises = Array.isArray(req.body.favoriteExercises) ? req.body.favoriteExercises : user.favoriteExercises || [];
  user.favoriteExercises = favoriteExercises;
  await db.write();
  res.json(cleanUser(user));
});

app.get('/api/exercises', async (req, res) => {
  await db.read();
  res.json(db.data.exercises);
});

app.get('/api/friends/:userId', async (req, res) => {
  await db.read();
  const friends = getFriends(req.params.userId);
  res.json(friends || []);
});

app.get('/api/leaderboard/global', async (req, res) => {
  await db.read();
  updateAllRewards();
  await db.write();
  const leaderboard = db.data.users.map(user => {
    const entries = getWeekActivities(user.id);
    const bonus = getUserBonusPoints(user);
    return formatLeaderboardItem(user, entries, bonus);
  });
  res.json(
    leaderboard
      .sort((a, b) => b.scoreWithBonus - a.scoreWithBonus)
      .map((stats, index) => ({ ...stats, rank: index + 1 }))
  );
});

app.get('/api/leaderboard/friends/:userId', async (req, res) => {
  await db.read();
  updateAllRewards();
  await db.write();
  const user = findUser(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const friends = getFriends(user.id);
  const friendData = friends.map(friend => {
    const entries = getWeekActivities(friend.id);
    const bonus = getUserBonusPoints(friend);
    return formatLeaderboardItem(friend, entries, bonus);
  });
  res.json(friendData.sort((a, b) => b.scoreWithBonus - a.scoreWithBonus));
});

app.get('/api/user/:userId/stats', async (req, res) => {
  await db.read();
  updateAllRewards();
  await db.write();
  const user = findUser(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const entries = getWeekActivities(user.id);
  const bonus = getUserBonusPoints(user);
  res.json({ stats: buildStats(entries, bonus), rewards: user.rewards || [], activities: entries });
});

app.post('/api/activity', async (req, res) => {
  await db.read();
  const { userId, exerciseId, weight, reps, duration } = req.body;
  const user = findUser(userId);
  const exercise = db.data.exercises.find(item => item.id === exerciseId);
  if (!user || !exercise) {
    return res.status(400).json({ error: 'Missing user or exercise' });
  }
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    exerciseId,
    name: exercise.name,
    kind: exercise.kind,
    unit: exercise.unit,
    weight: exercise.kind === 'lift' ? Number(weight) || 0 : undefined,
    reps: exercise.kind === 'lift' ? Number(reps) || 0 : undefined,
    duration: exercise.kind === 'time' ? Number(duration) || 0 : undefined,
    score: calculatePoints({ kind: exercise.kind, weight: Number(weight), reps: Number(reps), duration: Number(duration), unit: exercise.unit }),
    createdAt: new Date().toISOString()
  };
  db.data.activities.push(entry);
  updateAllRewards();
  await db.write();

  res.json({ success: true, activity: entry });
});

app.post('/api/friend/add', async (req, res) => {
  await db.read();
  const { userId, friendId } = req.body;
  if (!findUser(userId) || !findUser(friendId) || userId === friendId) {
    return res.status(400).json({ error: 'Invalid user or friend' });
  }
  const existing = db.data.friendships.find(link => link.userId === userId && link.friendId === friendId);
  if (!existing) {
    db.data.friendships.push({ userId, friendId });
    await db.write();
  }
  res.json({ success: true });
});

app.post('/api/friend/remove', async (req, res) => {
  await db.read();
  const { userId, friendId } = req.body;
  db.data.friendships = db.data.friendships.filter(link => !(link.userId === userId && link.friendId === friendId));
  await db.write();
  res.json({ success: true });
});

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

loadDatabase().then(() => {
  app.listen(port, () => {
    console.log(`Gym social leaderboard app running at http://localhost:${port}`);
  });
});
