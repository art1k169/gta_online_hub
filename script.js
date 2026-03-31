const CHANNEL_NAME = "GTAVONLINE000";
const SB_URL = 'https://zxyylxvqbblsdznaphdn.supabase.co'; 
const SB_KEY = 'sb_publishable_8iN4JtuIri5vsrsHuFBZYA_NyWA3eUw'; 

const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const sessionID = Math.random().toString(36).substring(7);

let unreadCounts = {}; 

document.addEventListener('DOMContentLoaded', () => {
    // 1. Навигация
    const menuItems = document.querySelectorAll('.menu-item');
    const tabs = document.querySelectorAll('.tab-content');
    
    menuItems.forEach(item => {
        item.onclick = () => {
            const target = item.getAttribute('data-tab');
            menuItems.forEach(i => i.classList.remove('active'));
            tabs.forEach(t => t.classList.remove('active'));
            item.classList.add('active');
            document.getElementById(target).classList.add('active');
            document.getElementById('main-title').textContent = item.textContent.trim();
            
            // Сброс уведомлений при клике
            unreadCounts[target] = 0;
            updateBadgeUI(target);
        };
    });

    // 2. Логика "Печатает..."
    const chatInput = document.getElementById('chat-input-field');
    chatInput.addEventListener('input', () => {
        const nick = localStorage.getItem('gta_hub_nick');
        if (nick) sendTypingStatus(nick);
    });

    // 3. Вход в чат
    const savedNick = localStorage.getItem('gta_hub_nick');
    if (savedNick) showChat(savedNick);
    
    document.getElementById('save-auth').onclick = () => {
        const nick = document.getElementById('user-nickname').value.trim();
        if (nick) { localStorage.setItem('gta_hub_nick', nick); showChat(nick); }
    };

    document.getElementById('logout-btn').onclick = () => {
        localStorage.removeItem('gta_hub_nick');
        location.reload();
    };

    document.getElementById('send-msg').onclick = sendMessage;
    chatInput.onkeypress = (e) => { if(e.key === 'Enter') sendMessage(); };

    // 4. Инициализация
    initRealtime();
    setInterval(updateOnlineStatus, 5000);
    setInterval(() => { 
        document.getElementById('date-display').textContent = new Date().toLocaleString('ru-RU'); 
    }, 1000);
    
    refreshData();
    document.getElementById('refresh-btn').onclick = refreshData;
});

function showChat(nick) {
    document.getElementById('auth-block').classList.add('hidden');
    document.getElementById('chat-block').classList.remove('hidden');
    document.getElementById('display-name').textContent = "Ник: " + nick;
}

// === REALTIME ===
async function initRealtime() {
    // История сообщений
    const { data } = await supabaseClient.from('messages').select('*').order('id', { ascending: true }).limit(50);
    if (data) data.forEach(m => renderMsg(m.nick, m.text));

    // Канал для чата (моментальные сообщения + typing)
    const chatChannel = supabaseClient.channel('room_1', { config: { broadcast: { self: false } } });

    chatChannel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            renderMsg(payload.new.nick, payload.new.text);
            incrementBadge('friends'); // Уведомление, если мы не в чате
        })
        .on('broadcast', { event: 'typing' }, payload => {
            handleTypingUI(payload.payload.nick);
        })
        .subscribe();
}

// Отправка статуса печати
let typingTimer;
function sendTypingStatus(nick) {
    supabaseClient.channel('room_1').send({
        type: 'broadcast',
        event: 'typing',
        payload: { nick }
    });
}

function handleTypingUI(nick) {
    const el = document.getElementById('typing-status');
    el.innerHTML = `${nick} печатает<span class="dot-ani"></span>`;
    el.style.opacity = '1';
    
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => { el.style.opacity = '0'; }, 2000);
}

// === УВЕДОМЛЕНИЯ (БАДЖИ) ===
function incrementBadge(tabId) {
    const activeTab = document.querySelector('.menu-item.active').getAttribute('data-tab');
    if (activeTab === tabId) return;
    
    unreadCounts[tabId] = (unreadCounts[tabId] || 0) + 1;
    updateBadgeUI(tabId);
}

function updateBadgeUI(tabId) {
    const menuItem = document.querySelector(`[data-tab="${tabId}"]`);
    if (!menuItem) return;
    let badge = menuItem.querySelector('.badge');
    
    if (!unreadCounts[tabId] || unreadCounts[tabId] === 0) {
        if (badge) badge.remove();
        return;
    }

    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'badge';
        menuItem.appendChild(badge);
    }
    badge.textContent = unreadCounts[tabId];
}

async function sendMessage() {
    const input = document.getElementById('chat-input-field');
    const nick = localStorage.getItem('gta_hub_nick');
    if (input.value.trim() && nick) {
        const txt = input.value.trim();
        input.value = '';
        // Сначала сохраняем в базу, Realtime сам отобразит его нам
        await supabaseClient.from('messages').insert([{ nick, text: txt }]);
    }
}

function renderMsg(nick, text) {
    const msg = document.createElement('div');
    msg.className = 'msg';
    msg.innerHTML = `<b>${nick}</b> ${text}`;
    const container = document.getElementById('chat-messages');
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

// ОНЛАЙН
async function updateOnlineStatus() {
    const nick = localStorage.getItem('gta_hub_nick');
    if (!nick) return;
    await supabaseClient.from('online_users').upsert({ id: sessionID, nick, last_seen: new Date().toISOString() });
    
    const threshold = new Date(Date.now() - 15000).toISOString();
    const { data } = await supabaseClient.from('online_users').select('id').gt('last_seen', threshold);
    document.getElementById('online-count').textContent = `Онлайн: ${data ? data.length : 0}`;
}

// ТЕЛЕГРАМ
async function refreshData() {
    try {
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent('https://t.me/s/'+CHANNEL_NAME)}&t=${Date.now()}`);
        const data = await res.json();
        const doc = new DOMParser().parseFromString(data.contents, 'text/html');
        const messages = Array.from(doc.querySelectorAll('.tgme_widget_message')).reverse();
        
        const containers = { 
            news: document.getElementById('container-news'), 
            bonuses: document.getElementById('container-bonuses'), 
            deals: document.getElementById('container-deals'), 
            cayo: document.getElementById('container-cayo'), 
            cars: document.getElementById('container-cars'),
            siteU: document.getElementById('container-siteU')
        };
        
        Object.values(containers).forEach(c => { if(c) c.innerHTML = ''; });

        messages.forEach(msg => {
            const textEl = msg.querySelector('.tgme_widget_message_text');
            if (!textEl) return;
            const text = textEl.innerText.toLowerCase();
            const photo = msg.querySelector('.tgme_widget_message_photo_wrap');
            const imgUrl = photo ? photo.style.backgroundImage.slice(4, -1).replace(/"/g, "") : 'https://media.rockstargames.com/rockstargames-newsite/img/global/games/fob/640/gta-online.jpg';
            const card = `<div class="card"><div class="card-image"><img src="${imgUrl}"></div><div class="card-info"><h3>Новости HUB</h3><a href="https://t.me/${CHANNEL_NAME}" target="_blank" class="btn-tg">В КАНАЛ</a></div></div>`;
            
            if (text.includes('#siteu')) { containers.siteU.innerHTML += card; incrementBadge('site-updates'); }
            else if (text.includes('#бонусы')) { containers.bonuses.innerHTML += card; incrementBadge('bonuses'); }
            else if (text.includes('#акции')) { containers.deals.innerHTML += card; incrementBadge('deals'); }
            else if (text.includes('#кайо')) { containers.cayo.innerHTML += card; incrementBadge('cayo'); }
            else if (text.includes('#авто')) { containers.cars.innerHTML += card; incrementBadge('cars'); }
            else { containers.news.innerHTML += card; }
        });
    } catch (e) { console.error("Update error"); }
}