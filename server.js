const database = {
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

let currentUser = { name: "", grade: "", teamName: "" };
let currentTopicData = null;
let currentTeam = null;
let socket = null;
let autoSaveTimer = null;
let docEmitTimer = null;
let aiChatLocal = [];

const api = (url, opts) => fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts }).then(r => r.json());

function setSaveStatus(text, colorClass) {
    const s = document.getElementById('save-status');
    if (!s) return;
    s.className = `text-xs font-bold px-3 py-1 rounded-full ${colorClass || 'bg-gray-100 text-gray-500'}`;
    s.innerHTML = text;
}

async function loadPresetTeams() {
    const grade = document.getElementById("grade-select").value;
    const container = document.getElementById("teams-list-container");
    container.innerHTML = '<p class="text-xs text-gray-500 italic">Carregando equipes do servidor...</p>';
    if (!grade) { container.innerHTML = '<p class="text-xs text-gray-500 italic">Selecione o ano escolar acima.</p>'; return; }
    try {
        const data = await api(`/api/teams/${grade}`);
        renderTeamsList(data.teams || [], grade, container);
    } catch (e) {
        container.innerHTML = '<p class="text-xs text-red-500">Erro ao carregar equipes. Verifique sua conexão.</p>';
    }
}

function renderTeamsList(teams, grade, container) {
    const maxMembers = (grade === "8") ? 4 : 5;
    container.innerHTML = "";
    if (!teams.length) { container.innerHTML = '<p class="text-xs text-gray-500 italic">Nenhuma equipe.</p>'; return; }
    teams.forEach(team => {
        const isFull = team.members.length >= maxMembers;
        const div = document.createElement("div");
        div.className = "flex justify-between items-center bg-white p-2.5 rounded-xl border border-indigo-200 text-sm";
        div.innerHTML = `
            <div>
                <span class="font-bold text-indigo-900">${team.name}</span>
                <span class="text-xs text-gray-500 block">Tema: ${team.topic.topic} | Membros (${team.members.length}/${maxMembers}): ${team.members.join(", ") || "Vazio"}</span>
            </div>
            <button data-team="${encodeURIComponent(team.name)}" ${isFull ? 'disabled class="bg-gray-300 text-gray-500 px-3 py-1.5 rounded-lg text-xs cursor-not-allowed"' : 'class="join-btn bg-green-500 hover:bg-green-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs"'}>
                ${isFull ? 'Equipe Lotada' : 'Entrar na Equipe'}
            </button>
        `;
        container.appendChild(div);
    });
    container.querySelectorAll('.join-btn').forEach(btn => {
        btn.addEventListener('click', () => joinPresetTeam(decodeURIComponent(btn.dataset.team)));
    });
}

async function joinPresetTeam(teamName) {
    const studentName = document.getElementById("student-name").value.trim();
    const grade = document.getElementById("grade-select").value;
    if (!studentName) { alert("Digite seu nome completo antes de entrar em uma equipe!"); return; }
    try {
        const data = await api('/api/join', { method: 'POST', body: JSON.stringify({ name: studentName, grade, teamName }) });
        if (data.error) { alert(data.error); loadPresetTeams(); return; }
        currentUser = { name: studentName, grade, teamName };
        currentTeam = data.team;
        currentTopicData = data.team.topic;
        proceedAfterLogin(data.team);
    } catch (e) { alert("Erro ao entrar na equipe: " + e.message); }
}

function proceedAfterLogin(teamObj) {
    currentTopicData = teamObj.topic;
    document.getElementById("screen-login").classList.add("hidden");
    if (!teamObj.selectedTitle) {
        showTitleChoices(teamObj);
    } else {
        openWorkspace(teamObj);
    }
}

function showTitleChoices(teamObj) {
    document.getElementById("screen-title").classList.remove("hidden");
    const container = document.getElementById("title-suggestions");
    container.innerHTML = "";
    currentTopicData.titles.forEach(t => {
        const div = document.createElement("div");
        div.className = "p-4 rounded-2xl border-4 border-pink-200 hover:border-pink-500 bg-white cursor-pointer font-bold text-gray-800";
        div.innerText = t;
        div.onclick = async () => {
            const data = await api('/api/title', { method: 'POST', body: JSON.stringify({ grade: currentUser.grade, teamName: currentUser.teamName, title: t }) });
            if (data.team) openWorkspace(data.team);
        };
        container.appendChild(div);
    });
}

async function openWorkspace(teamObj) {
    try {
        const state = await api(`/api/state/${currentUser.grade}/${encodeURIComponent(currentUser.teamName)}`);
        if (state.team) teamObj = state.team;
    } catch (e) {}
    currentTeam = teamObj;
    currentTopicData = teamObj.topic;
    aiChatLocal = teamObj.aiChat || [];

    document.getElementById("screen-title").classList.add("hidden");
    document.getElementById("screen-workspace").classList.remove("hidden");
    document.getElementById("workspace-team-name").innerText = `Equipe: ${teamObj.name} (${teamObj.members.join(", ")})`;
    document.getElementById("workspace-title-display").innerText = `Título: ${teamObj.selectedTitle}`;
    document.getElementById("doc-header-title").innerText = teamObj.selectedTitle || "Relatório da Equipe";
    const editor = document.getElementById("docs-editor");
    if (teamObj.docContent) {
        editor.innerHTML = teamObj.docContent;
    }
    renderChat(teamObj.chat || []);
    renderAI(aiChatLocal);

    if (!socket) socket = io();
    socket.emit('join-team', { grade: currentUser.grade, teamName: currentUser.teamName, userName: currentUser.name });

    socket.on('chat', (msg) => { renderChatAppend(msg); });
    socket.on('doc-update', ({ docContent, by }) => {
        const ed = document.getElementById("docs-editor");
        if (document.activeElement !== ed) {
            if (ed.innerHTML !== docContent) {
                ed.innerHTML = docContent;
                setSaveStatus('<i class="fa-solid fa-sync"></i> Atualizado por ' + by, 'bg-blue-100 text-blue-700');
            }
        }
    });
    socket.on('members-update', ({ members }) => {
        document.getElementById("workspace-team-name").innerText = `Equipe: ${currentTeam.name} (${members.join(", ")})`;
        currentTeam.members = members;
    });
    socket.on('title-update', ({ title }) => {
        document.getElementById("workspace-title-display").innerText = `Título: ${title}`;
        document.getElementById("doc-header-title").innerText = title;
    });
    socket.on('user-joined', ({ userName, online }) => { document.getElementById('online-num').innerText = online; });
    socket.on('user-left', ({ userName, online }) => { document.getElementById('online-num').innerText = Math.max(1, online); });

    if (autoSaveTimer) clearInterval(autoSaveTimer);
    autoSaveTimer = setInterval(() => { saveWorkSilently(); }, 2000);
    window.addEventListener('beforeunload', saveWorkSilently);

    editor.addEventListener('input', () => {
        if (docEmitTimer) clearTimeout(docEmitTimer);
        docEmitTimer = setTimeout(() => {
            if (socket) socket.emit('doc-update', { grade: currentUser.grade, teamName: currentUser.teamName, docContent: editor.innerHTML, by: currentUser.name });
        }, 800);
    });

    setSaveStatus('<i class="fa-solid fa-cloud"></i> Salvo na nuvem', 'bg-green-100 text-green-700');
}

function docCommand(command, value = null) { document.execCommand(command, false, value); }

function insertPromptHelper(faseNum) {
    const editor = document.getElementById("docs-editor");
    let text = "";
    if (faseNum === 1) text = `<br><b>[Fase 1 - Investigação]:</b> ${currentTopicData.q1}<br><i>Resposta: </i><br>`;
    if (faseNum === 2) text = `<br><b>[Fase 2 - Cotidiano]:</b> Onde observamos isso na prática...<br>`;
    if (faseNum === 3) text = `<br><b>[Fase 3 - Solução/Projeto]:</b> Nosso projeto criado foi...<br>`;
    editor.innerHTML += text;
}

async function saveWorkSilently() {
    if (!currentUser.teamName) return;
    const docContent = document.getElementById("docs-editor").innerHTML;
    try {
        await api('/api/save', { method: 'POST', body: JSON.stringify({ grade: currentUser.grade, teamName: currentUser.teamName, docContent }) });
        setSaveStatus('<i class="fa-solid fa-cloud"></i> Salvo na nuvem', 'bg-green-100 text-green-700');
    } catch (e) {
        setSaveStatus('<i class="fa-solid fa-triangle-exclamation"></i> Erro ao salvar', 'bg-red-100 text-red-700');
    }
}

async function saveWorkManually() {
    setSaveStatus('<i class="fa-solid fa-spinner fa-spin"></i> Salvando...', 'bg-yellow-100 text-yellow-700');
    await saveWorkSilently();
    const status = document.getElementById("save-status");
    status.innerHTML = '<i class="fa-solid fa-check"></i> Salvo!';
    setTimeout(() => { status.innerHTML = '<i class="fa-solid fa-cloud"></i> Salvo na nuvem'; }, 2000);
}

function sendChatMessage() {
    const input = document.getElementById("chat-input");
    const msg = input.value.trim();
    if (!msg || !socket) return;
    socket.emit('chat', {
        grade: currentUser.grade, teamName: currentUser.teamName,
        sender: currentUser.name, text: msg,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    input.value = "";
}

function renderChat(chatList) {
    const container = document.getElementById("chat-messages");
    if (!chatList.length) { container.innerHTML = '<p class="text-gray-500 italic text-center">Troquem ideias aqui!</p>'; return; }
    container.innerHTML = chatList.map(c => chatBubble(c)).join("");
    container.scrollTop = container.scrollHeight;
}

function renderChatAppend(msg) {
    const container = document.getElementById("chat-messages");
    if (container.querySelector('.italic')) container.innerHTML = '';
    container.insertAdjacentHTML('beforeend', chatBubble(msg));
    container.scrollTop = container.scrollHeight;
}

function chatBubble(c) {
    const mine = c.sender === currentUser.name;
    return `<div class="p-2 rounded-xl border ${mine ? 'bg-indigo-600 text-white border-indigo-700 ml-6' : 'bg-white border-indigo-100'}">
        <span class="font-bold ${mine ? 'text-indigo-100' : 'text-indigo-700'}">${c.sender}</span> <span class="text-[10px] ${mine ? 'text-indigo-200' : 'text-gray-400'}">${c.time}</span>
        <p class="${mine ? 'text-white' : 'text-gray-800'} mt-0.5">${escapeHtml(c.text)}</p>
    </div>`;
}

function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

async function askAI() {
    const input = document.getElementById("ai-input");
    const query = input.value.trim();
    if (!query) return;
    aiChatLocal.push({ sender: currentUser.name, text: query });
    let aiReply = `Ótima pergunta sobre ${currentTopicData.topic}! Para responder a isso no trabalho, pensem em como aplicamos esse conceito no cotidiano (na escola, nas compras ou em jogos). Pesquisem exemplos práticos e registrem no documento!`;
    if (query.toLowerCase().includes("polígono") || query.toLowerCase().includes("poligono")) {
        aiReply = "Polígonos são figuras geométricas planas fechadas formadas apenas por segmentos de reta que não se cruzam (como triângulos, quadrados e hexágonos). No cotidiano, vemos polígonos nas janelas, pisos, placas de trânsito e em gráficos de jogos!";
    } else if (query.toLowerCase().includes("porcentagem") || query.toLowerCase().includes("%")) {
        aiReply = "A porcentagem representa uma razão com base 100. Pensem nela como fatias de um total de 100 partes. No dia a dia, usamos em descontos de lojas, promoções e na bateria do celular!";
    } else if (query.toLowerCase().includes("equação") || query.toLowerCase().includes("equacao") || query.toLowerCase().includes("bhaskara")) {
        aiReply = "Uma equação envolve valores desconhecidos (incógnitas). No 8º ano, as equações do 2º grau ajudam a calcular áreas, trajetórias de objetos e lançamentos! Use a fórmula de Bhaskara: x = (-b ± √(b²-4ac)) / 2a.";
    }
    aiChatLocal.push({ sender: "Professor IA 🤖", text: aiReply });
    input.value = "";
    renderAI(aiChatLocal);
    try { await api('/api/ai', { method: 'POST', body: JSON.stringify({ grade: currentUser.grade, teamName: currentUser.teamName, entries: aiChatLocal }) }); } catch (e) {}
}

function renderAI(aiList) {
    const container = document.getElementById("ai-messages");
    if (!aiList.length) {
        container.innerHTML = '<div class="bg-white p-2 rounded-xl border border-pink-100 text-gray-800"><b>Professor IA:</b> Olá! Pergunte-me qualquer dúvida!</div>';
        return;
    }
    container.innerHTML = aiList.map(a => `
        <div class="p-2 rounded-xl border ${a.sender.includes('IA') ? 'bg-pink-100 border-pink-200 text-pink-950 font-medium' : 'bg-white border-pink-100 text-gray-800'}">
            <b>${a.sender}:</b> ${escapeHtml(a.text)}
        </div>
    `).join("");
    container.scrollTop = container.scrollHeight;
}

async function downloadPDF() {
    const btn = event?.target;
    const originalText = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando PDF...'; btn.disabled = true; }
    try {
        const team = currentTeam || {};
        const docContent = document.getElementById("docs-editor") ? document.getElementById("docs-editor").innerHTML : (team.docContent || "");
        const title = team.selectedTitle || document.getElementById("doc-header-title")?.innerText || "Relatório da Equipe";

        const printArea = document.createElement('div');
        printArea.style.cssText = 'position:absolute;left:-9999px;top:0;width:700px;padding:40px;background:white;font-family:Poppins,sans-serif;color:#1f2937;';
        printArea.innerHTML = `
            <div style="text-align:center;border-bottom:4px solid #6d28d9;padding-bottom:16px;margin-bottom:20px;">
                <h1 style="color:#6d28d9;font-size:24px;font-weight:900;margin:0;">${escapeHtml(title)}</h1>
                <p style="color:#7c3aed;font-size:13px;font-weight:700;margin:6px 0 0;">Jornada Matemática Colaborativa — ${team.grade || currentUser.grade}º Ano</p>
            </div>
            <p style="font-size:13px;margin:4px 0;"><b>Equipe:</b> ${escapeHtml((team.members || []).join(", ") || "-")}</p>
            <p style="font-size:13px;margin:4px 0;"><b>Tema:</b> ${escapeHtml(team.topic?.topic || currentTopicData?.topic || "-")}</p>
            <p style="font-size:13px;margin:4px 0 16px;"><b>Data:</b> ${new Date().toLocaleDateString('pt-BR')}</p>
            <hr style="border:1px solid #e5e7eb;margin:12px 0;">
            <div style="font-size:14px;line-height:1.6;">${docContent}</div>
        `;
        document.body.appendChild(printArea);
        const canvas = await html2canvas(printArea, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        document.body.removeChild(printArea);

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }
        const safeTitle = (title || "trabalho").replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_').slice(0, 40);
        pdf.save(`${safeTitle}_${team.name ? team.name.replace(/[^\w\s-]/g,'').trim().replace(/\s+/g,'_') : 'equipe'}.pdf`);
    } catch (e) {
        alert("Erro ao gerar PDF: " + e.message);
    } finally {
        if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
    }
}

async function sendWorkByEmail() {
    await saveWorkSilently();
    const statusEl = document.getElementById('email-status');
    try {
        const data = await api('/api/send-email', { method: 'POST', body: JSON.stringify({ grade: currentUser.grade, teamName: currentUser.teamName }) });
        if (data.ok) {
            if (statusEl) statusEl.innerText = "✅ E-mail enviado! (Na primeira vez, o professor recebe um e-mail de confirmação da FormSubmit — basta clicar em 'Activate Form' e os próximos chegam direto.)";
            return true;
        } else {
            if (statusEl) statusEl.innerText = "⚠️ Não foi possível enviar agora: " + (data.error || "");
            return false;
        }
    } catch (e) {
        if (statusEl) statusEl.innerText = "⚠️ Erro de conexão no envio: " + e.message;
        return false;
    }
}

async function finishWorkspace() {
    await saveWorkSilently();
    let team = currentTeam;
    try {
        const state = await api(`/api/state/${currentUser.grade}/${encodeURIComponent(currentUser.teamName)}`);
        if (state.team) team = state.team;
    } catch (e) {}
    currentTeam = team;
    document.getElementById("screen-workspace").classList.add("hidden");
    document.getElementById("screen-finish").classList.remove("hidden");
    if (typeof confetti === 'function') confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
    document.getElementById("final-report-view").innerHTML = `
        <h3 class="text-xl font-black text-purple-900">${escapeHtml(team.selectedTitle || "")}</h3>
        <p class="text-xs font-bold text-purple-600">Assunto: ${team.topic?.topic || ""} (${team.grade}º Ano)</p>
        <p class="text-sm font-semibold text-gray-700">Equipe: ${(team.members || []).join(", ")}</p>
        <hr class="my-2">
        <div class="p-4 bg-gray-50 rounded-xl border border-gray-200">${team.docContent || ""}</div>
    `;
    sendWorkByEmail();
}
