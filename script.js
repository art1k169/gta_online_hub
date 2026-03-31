const CHANNEL_NAME = "GTAVONLINE000";

document.addEventListener('DOMContentLoaded', () => {
    const menuItems = document.querySelectorAll('.menu-item');
    const tabs = document.querySelectorAll('.tab-content');
    
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-tab');
            menuItems.forEach(i => i.classList.remove('active'));
            tabs.forEach(t => t.classList.remove('active'));
            item.classList.add('active');
            document.getElementById(target).classList.add('active');
            document.getElementById('main-title').textContent = item.textContent.trim();
        });
    });

    const modal = document.getElementById('settings-modal');
    document.getElementById('settings-btn').onclick = () => modal.classList.add('open');
    document.getElementById('close-settings').onclick = () => modal.classList.remove('open');
    document.getElementById('accent-color').oninput = (e) => document.documentElement.style.setProperty('--accent', e.target.value);
    document.getElementById('bg-color').oninput = (e) => document.documentElement.style.setProperty('--bg-sidebar', e.target.value);

    const savedNick = localStorage.getItem('gta_hub_nick');
    if (savedNick) showChat(savedNick);
    document.getElementById('save-auth').onclick = () => {
        const nick = document.getElementById('user-nickname').value.trim();
        if (nick) { localStorage.setItem('gta_hub_nick', nick); showChat(nick); }
    };
    document.getElementById('logout-btn').onclick = () => {
        localStorage.removeItem('gta_hub_nick');
        document.getElementById('chat-block').classList.add('hidden');
        document.getElementById('auth-block').classList.remove('hidden');
    };

    document.getElementById('send-msg').onclick = sendMessage;
    document.getElementById('chat-input-field').onkeypress = (e) => { if(e.key === 'Enter') sendMessage(); };

    setInterval(() => { document.getElementById('date-display').textContent = new Date().toLocaleString('ru-RU'); }, 1000);
    refreshData();
    setInterval(refreshData, 5000);
    document.getElementById('refresh-btn').onclick = refreshData;
});

function showChat(nick) {
    document.getElementById('auth-block').classList.add('hidden');
    document.getElementById('chat-block').classList.remove('hidden');
    document.getElementById('display-name').textContent = "Ник: " + nick;
}

function sendMessage() {
    const input = document.getElementById('chat-input-field');
    const nick = localStorage.getItem('gta_hub_nick');
    if (input.value.trim() && nick) {
        const msg = document.createElement('div');
        msg.className = 'msg';
        msg.innerHTML = `<b>${nick}</b> ${input.value}`;
        const container = document.getElementById('chat-messages');
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
        input.value = '';
    }
}

async function refreshData() {
    const loader = document.getElementById('loader');
    loader.className = 'loader-visible';
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
        Object.values(containers).forEach(c => c.innerHTML = '');

        messages.forEach(msg => {
            const textEl = msg.querySelector('.tgme_widget_message_text');
            const timeEl = msg.querySelector('time');
            if (!textEl) return;
            const time = timeEl ? new Date(timeEl.getAttribute('datetime')).toLocaleString('ru-RU', {day:'2-digit', month:'long', hour:'2-digit', minute:'2-digit'}) : "Недавно";
            const photo = msg.querySelector('.tgme_widget_message_photo_wrap');
            const imgUrl = photo ? photo.style.backgroundImage.slice(4, -1).replace(/"/g, "") : 'https://media.rockstargames.com/rockstargames-newsite/img/global/games/fob/640/gta-online.jpg';
            
            const card = `<div class="card"><div class="card-image"><img src="${imgUrl}"></div><div class="card-info"><h3>${time}</h3><a href="https://t.me/${CHANNEL_NAME}" target="_blank" class="btn-tg">В КАНАЛ</a></div></div>`;
            const text = textEl.innerText.toLowerCase();
            if (text.includes('#бонусы')) containers.bonuses.innerHTML += card;
            else if (text.includes('#акции')) containers.deals.innerHTML += card;
            else if (text.includes('#кайо')) containers.cayo.innerHTML += card;
            else if (text.includes('#авто')) containers.cars.innerHTML += card;
            else containers.news.innerHTML += card;
        });
    } catch (e) { console.log("sync error"); }
    setTimeout(() => loader.className = 'loader-hidden', 500);
}