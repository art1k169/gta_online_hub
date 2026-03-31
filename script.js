const CHANNEL_NAME = "GTAVONLINE000";

// Твои данные Supabase
const SB_URL = 'https://zxyylxvqbblsdznaphdn.supabase.co'; 
const SB_KEY = 'sb_publishable_8iN4JtuIri5vsrsHuFBZYA_NyWA3eUw'; 

// Инициализация клиента
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

document.addEventListener('DOMContentLoaded', () => {
    // 1. Навигация по вкладкам
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
        };
    });

    // 2. Настройки (модалка и цвета)
    const modal = document.getElementById('settings-modal');
    document.getElementById('settings-btn').onclick = () => modal.classList.add('open');
    document.getElementById('close-settings').onclick = () => modal.classList.remove('open');
    document.getElementById('accent-color').oninput = (e) => document.documentElement.style.setProperty('--accent', e.target.value);
    document.getElementById('bg-color').oninput = (e) => document.documentElement.style.setProperty('--bg-sidebar', e.target.value);

    // 3. Логика входа в чат
    const savedNick = localStorage.getItem('gta_hub_nick');
    if (savedNick) showChat(savedNick);
    
    document.getElementById('save-auth').onclick = () => {
        const nick = document.getElementById('user-nickname').value.trim();
        if (nick) { 
            localStorage.setItem('gta_hub_nick', nick); 
            showChat(nick); 
        }
    };

    document.getElementById('logout-btn').onclick = () => {
        localStorage.removeItem('gta_hub_nick');
        location.reload();
    };

    // 4. Управление чатом
    document.getElementById('send-msg').onclick = sendMessage;
    document.getElementById('chat-input-field').onkeypress = (e) => { 
        if(e.key === 'Enter') sendMessage(); 
    };

    // 5. Запуск фоновых процессов
    initChat();
    setInterval(updateOnlineStatus, 10000); // Обновление онлайна каждые 10 сек
    setInterval(() => { 
        document.getElementById('date-display').textContent = new Date().toLocaleString('ru-RU'); 
    }, 1000);
    
    refreshData(); // Загрузка новостей
    document.getElementById('refresh-btn').onclick = refreshData;
});

// === ФУНКЦИИ ЧАТА ===

function showChat(nick) {
    document.getElementById('auth-block').classList.add('hidden');
    document.getElementById('chat-block').classList.remove('hidden');
    document.getElementById('display-name').textContent = "Ник: " + nick;
    updateOnlineStatus();
}

async function initChat() {
    // Загружаем последние 50 сообщений
    const { data } = await supabaseClient
        .from('messages')
        .select('*')
        .order('id', { ascending: true })
        .limit(50);

    if (data) data.forEach(m => renderMsg(m.nick, m.text));

    // Слушаем новые сообщения (Realtime)
    supabaseClient
        .channel('schema-db-changes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            renderMsg(payload.new.nick, payload.new.text);
        })
        .subscribe();
}

async function sendMessage() {
    const input = document.getElementById('chat-input-field');
    const nick = localStorage.getItem('gta_hub_nick');
    if (input.value.trim() && nick) {
        const messageText = input.value.trim();
        input.value = ''; // Очищаем сразу для скорости
        await supabaseClient.from('messages').insert([{ nick: nick, text: messageText }]);
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

// === ФУНКЦИЯ ОНЛАЙНА ===

async function updateOnlineStatus() {
    const nick = localStorage.getItem('gta_hub_nick');
    if (!nick) return;

    // Обновляем себя
    await supabaseClient.from('online_users').upsert({ nick: nick, last_seen: new Date() });
    
    // Считаем активных за последние 30 секунд
    const threshold = new Date(Date.now() - 30000).toISOString();
    const { data } = await supabaseClient
        .from('online_users')
        .select('nick')
        .gt('last_seen', threshold);
    
    const countEl = document.getElementById('online-count');
    if (countEl) countEl.textContent = `Онлайн: ${data ? data.length : 0}`;
}

// === ЗАГРУЗКА ИЗ TELEGRAM ===

async function refreshData() {
    const loader = document.getElementById('loader');
    if (loader) loader.className = 'loader-visible';
    
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
            cars: document.getElementById('container-cars') 
        };
        
        Object.values(containers).forEach(c => { if(c) c.innerHTML = ''; });

        messages.forEach(msg => {
            const textEl = msg.querySelector('.tgme_widget_message_text');
            if (!textEl) return;
            
            const photo = msg.querySelector('.tgme_widget_message_photo_wrap');
            const imgUrl = photo ? photo.style.backgroundImage.slice(4, -1).replace(/"/g, "") : 'https://media.rockstargames.com/rockstargames-newsite/img/global/games/fob/640/gta-online.jpg';
            
            const card = `
                <div class="card">
                    <div class="card-image"><img src="${imgUrl}"></div>
                    <div class="card-info">
                        <h3>Новости GTA HUB</h3>
                        <a href="https://t.me/${CHANNEL_NAME}" target="_blank" class="btn-tg">В КАНАЛ</a>
                    </div>
                </div>`;
            
            const text = textEl.innerText.toLowerCase();
            if (text.includes('#бонусы')) containers.bonuses.innerHTML += card;
            else if (text.includes('#акции')) containers.deals.innerHTML += card;
            else if (text.includes('#кайо')) containers.cayo.innerHTML += card;
            else if (text.includes('#авто')) containers.cars.innerHTML += card;
            else if (containers.news) containers.news.innerHTML += card;
        });
    } catch (e) {
        console.error("Ошибка синхронизации данных");
    }
    if (loader) setTimeout(() => loader.className = 'loader-hidden', 500);
}
