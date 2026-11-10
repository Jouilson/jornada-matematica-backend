// Jornada Matemática Colaborativa - Servidor Backend
// Armazena equipes online, salva trabalhos, faz chat em tempo real e envia e-mail ao professor.
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const PROFESSOR_EMAIL = 'profjouilson@gmail.com';

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Banco de dados em arquivo JSON ----------
const DATABASE = {
  "6": [
    { topic: "Os Polígonos", titles: ["📐 Caçadores de Formas", "🎮 Polígonos nos Games", "🏰 Cidades Geométricas", "🎨 Arte com Polígonos", "🔍 Detetives do Perímetro"], q1: "O que faz uma figura geométrica ser um polígono e por que as linhas não se cruzam?", hint1: "Pense no formato do piso da sala." },
    { topic: "A Porcentagem", titles: ["🏷️ Super Descontos", "🍕 A Mágica do 100%", "📊 Porcentagem Diária", "🎮 Bateria e Porcentagem", "💰 Economizando com %"], q1: "O que a porcentagem (%) significa no dia a dia?", hint1: "Observe a bateria do celular." }
  ],
  "7": [
    { topic: "Sistemas de Equações do 1º Grau", titles: ["🕵️‍♂️ Dupla Dinâmica de Equações", "⚖️ O Enigma dos Dois Desconhecidos", "🍔 Compras na Lanchonete", "🎟️ Ingressos e Trocos", "🧩 Duas Pistas, Uma Solução"], q1: "Como duas informações desconhecidas se cruzam?", hint1: "Pense nos preços combinados de lanches." }
  ],
  "8": [
    { topic: "Equação do 2º Grau (Raízes)", titles: ["🚀 A Trajetória Perfeita", "🎯 O Enigma de Bhaskara", "🏀 A Parábola da Basquete", "🔍 Detetives das Raízes", "⚡ As Raízes da Equação"], q1: "O que significa encontrar as raízes da equação?", hint1: "Pense no arco que uma bola faz ao ser lançada." }
  ]
};
const PRESET_TEAM_NAMES = [
  "🚀 Exploradores da Galáxia Matemática",
  "🕵️‍♂️ Detetives da Lógica Secreta",
  "🎨 Mestres das Cores e Formas",
  "⚡ Esquadrão Raio Numérico",
  "🧠 Super Cientistas da Álgebra"
];

let db = { teamsByGrade: {} };

function initTeamsForGrade(grade) {
  const topicsList = DATABASE[grade] || DATABASE["6"];
  return PRESET_TEAM_NAMES.map((name, index) => ({
    name,
    grade,
    members: [],
    topic: topicsList[index % topicsList.length],
    selectedTitle: "",
    docContent: "",
    chat: [],
    aiChat: [],
    finished: false,
    updatedAt: Date.now()
  }));
}

function loadDB() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (!db.teamsByGrade) db.teamsByGrade = {};
    }
  } catch (e) { console.error('Erro ao carregar banco:', e.message); }
  // Garante que todos os anos tenham equipes inicializadas
  for (const g of ["6", "7", "8"]) {
    if (!db.teamsByGrade[g] || !Array.isArray(db.teamsByGrade[g]) || db.teamsByGrade[g].length === 0) {
      db.teamsByGrade[g] = initTeamsForGrade(g);
    }
  }
}

let saveTimer = null;
function saveDB() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); }
    catch (e) { console.error('Erro ao salvar banco:', e.message); }
  }, 300);
}

function getTeams(grade) { return db.teamsByGrade[grade] || []; }
function findTeam(grade, name) { return getTeams(grade).find(t => t.name === name); }
function teamRoom(grade, name) { return `team:${grade}:${name}`; }

loadDB();
saveDB();

// ---------- API REST ----------
app.get('/api/teams/:grade', (req, res) => {
  const grade = req.params.grade;
  const teams = getTeams(grade).map(t => ({
    name: t.name, grade: t.grade, members: t.members,
    topic: t.topic, selectedTitle: t.selectedTitle,
    docContent: t.docContent ? "" : "", // não envia o doc na listagem
    finished: t.finished
  }));
  res.json({ teams });
});

app.post('/api/join', (req, res) => {
  const { name, grade, teamName } = req.body || {};
  if (!name || !grade || !teamName) return res.status(400).json({ error: 'Dados incompletos' });
  const maxMembers = (grade === "8") ? 4 : 5;
  const teams = getTeams(grade);
  const team = findTeam(grade, teamName);
  if (!team) return res.status(404).json({ error: 'Equipe não encontrada' });
  if (!team.members.includes(name)) {
    const inAnother = teams.some(t => t.members.includes(name));
    if (inAnother) return res.status(400).json({ error: 'Você já está cadastrado em outra equipe deste ano!' });
    if (team.members.length >= maxMembers) return res.status(400).json({ error: `Esta equipe atingiu o limite máximo de ${maxMembers} alunos.` });
    team.members.push(name);
    team.updatedAt = Date.now();
    saveDB();
    io.to(teamRoom(grade, teamName)).emit('members-update', { members: team.members });
  }
  res.json({ ok: true, team });
});

app.post('/api/title', (req, res) => {
  const { grade, teamName, title } = req.body || {};
  const team = findTeam(grade, teamName);
  if (!team) return res.status(404).json({ error: 'Equipe não encontrada' });
  team.selectedTitle = title;
  team.updatedAt = Date.now();
  saveDB();
  io.to(teamRoom(grade, teamName)).emit('title-update', { title });
  res.json({ ok: true, team });
});

// Salva o conteúdo do documento (botão Salvar / auto-save)
app.post('/api/save', (req, res) => {
  const { grade, teamName, docContent } = req.body || {};
  const team = findTeam(grade, teamName);
  if (!team) return res.status(404).json({ error: 'Equipe não encontrada' });
  team.docContent = docContent || "";
  team.updatedAt = Date.now();
  saveDB();
  res.json({ ok: true, savedAt: new Date().toISOString() });
});

// Salva uma interação da IA (para o histórico ficar compartilhado)
app.post('/api/ai', (req, res) => {
  const { grade, teamName, entries } = req.body || {};
  const team = findTeam(grade, teamName);
  if (!team) return res.status(404).json({ error: 'Equipe não encontrada' });
  if (Array.isArray(entries)) team.aiChat = entries;
  team.updatedAt = Date.now();
  saveDB();
  res.json({ ok: true });
});

// Estado completo da equipe (ao entrar no workspace)
app.get('/api/state/:grade/:teamName', (req, res) => {
  const team = findTeam(req.params.grade, req.params.teamName);
  if (!team) return res.status(404).json({ error: 'Equipe não encontrada' });
  res.json({ team });
});

// Envio de e-mail ao professor (proxy via FormSubmit - sem necessidade de conta/senha)
app.post('/api/send-email', async (req, res) => {
  const { grade, teamName } = req.body || {};
  const team = findTeam(grade, teamName);
  if (!team) return res.status(404).json({ error: 'Equipe não encontrada' });
  team.finished = true;
  team.updatedAt = Date.now();
  saveDB();

  const tempDivText = (team.docContent || "").replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const payload = {
    _subject: `Trabalho de Matemática - ${team.grade}º Ano - Equipe: ${team.name}`,
    _replyto: PROFESSOR_EMAIL,
    _template: "table",
    "Ano": `${team.grade}º Ano`,
    "Equipe": team.name,
    "Tema": team.topic?.topic || "-",
    "Título": team.selectedTitle || "-",
    "Integrantes": team.members.join(", ") || "-",
    "Conteúdo do Trabalho": tempDivText || "(vazio)"
  };
  try {
    const resp = await fetch(`https://formsubmit.co/ajax/${PROFESSOR_EMAIL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await resp.json().catch(() => ({}));
    res.json({ ok: true, provider: 'formsubmit', info: data });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ---------- Socket.io: chat em tempo real + sincronia do documento ----------
io.on('connection', (socket) => {
  socket.on('join-team', ({ grade, teamName, userName }) => {
    const room = teamRoom(grade, teamName);
    socket.join(room);
    socket.data.room = room;
    socket.data.userName = userName;
    io.to(room).emit('user-joined', { userName, online: countOnline(room) });
  });

  socket.on('chat', ({ grade, teamName, sender, text, time }) => {
    const team = findTeam(grade, teamName);
    if (!team) return;
    const msg = { sender, text, time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    team.chat.push(msg);
    if (team.chat.length > 200) team.chat = team.chat.slice(-200);
    team.updatedAt = Date.now();
    saveDB();
    io.to(teamRoom(grade, teamName)).emit('chat', msg);
  });

  // Sincronia em tempo real do documento (broadcast para outros membros)
  socket.on('doc-update', ({ grade, teamName, docContent, by }) => {
    const team = findTeam(grade, teamName);
    if (!team) return;
    team.docContent = docContent || "";
    team.updatedAt = Date.now();
    saveDB();
    socket.to(teamRoom(grade, teamName)).emit('doc-update', { docContent, by });
  });

  socket.on('disconnect', () => {
    if (socket.data.room) {
      io.to(socket.data.room).emit('user-left', { userName: socket.data.userName, online: countOnline(socket.data.room) - 1 });
    }
  });
});

function countOnline(room) {
  const r = io.sockets.adapter.rooms.get(room);
  return r ? r.size : 0;
}

server.listen(PORT, () => {
  console.log(`✅ Jornada Matemática rodando em http://localhost:${PORT}`);
});
