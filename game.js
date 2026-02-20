"use strict";

/* ============================================================
   GAME CORE (Глубокий рефакторинг без ломания сохранений)
============================================================ */

const Game = {

    /* ===================== STATE ===================== */

    state: {
        subscribers: 0,
        cash: 0,
        gems: 0,
        prestigeLevel: 0,
        passiveCashPerSec: 0,
        passiveSubsPerSec: 0,
        clickBonus: 0,
        clickPower: 1,
        globalBonus: 1.0,
        lastDailyTime: 0,
        currentSkin: null,
        saveTimestamp: 0
    },

    SAVE_KEY: "glestream_save",

    /* ===================== DATA ===================== */

    contentUnlocks: [
        { id: 'youtab', name: '📹 YouTab', unlocked: true, subsReq: 0 },
        { id: 'tegigram', name: '📱 Tegigram', unlocked: false, subsReq: 500 },
        { id: 'kiktotk', name: '🎵 KikTotk', unlocked: false, subsReq: 2000 },
        { id: 'cosplay', name: '🧝 Косплей', unlocked: false, subsReq: 5000 },
        { id: 'spofifi', name: '🎧 Spofifi', unlocked: false, subsReq: 10000 }
    ],

    contentItems: [
        { id: 'youtab', name: 'Стриминг', baseSubsPrice: 100, baseCashPrice: 0, subsPerSec: 0, cashPerSec: 0.01, clickBonus: 1, multiplierTarget: null, count: 0 },
        { id: 'tegigram', name: 'Посты', baseSubsPrice: 500, baseCashPrice: 0.25, subsPerSec: 0.5, cashPerSec: 0.02, clickBonus: 0, multiplierTarget: null, count: 0 },
        { id: 'kiktotk', name: 'Ролики', baseSubsPrice: 1000, baseCashPrice: 2, subsPerSec: 5, cashPerSec: 0.05, clickBonus: 0, multiplierTarget: null, count: 0 },
        { id: 'cosplay', name: 'Косплей', baseSubsPrice: 2000, baseCashPrice: 10, subsPerSec: 0, cashPerSec: 0, clickBonus: 10, multiplierTarget: 'youtab', multiplierValue: 0.25, count: 0 },
        { id: 'spofifi', name: 'Треки', baseSubsPrice: 5000, baseCashPrice: 50, subsPerSec: 0, cashPerSec: 1, clickBonus: 0, multiplierTarget: null, count: 0 }
    ],

    skins: [
        { id: 'default', name: 'Классика', emoji: '🎭', bonus: 1.0, price: 0, owned: true },
        { id: 'cyber', name: 'Кибер', emoji: '👾', bonus: 1.1, price: 50, owned: false },
        { id: 'vampire', name: 'Вампир', emoji: '🧛', bonus: 1.15, price: 100, owned: false },
        { id: 'robot', name: 'Робо', emoji: '🤖', bonus: 1.2, price: 200, owned: false },
        { id: 'angel', name: 'Ангел', emoji: '👼', bonus: 1.3, price: 500, owned: false },
        { id: 'demon', name: 'Демон', emoji: '😈', bonus: 1.4, price: 1000, owned: false }
    ],

    /* ===================== DOM CACHE ===================== */

    cache() {
        this.ui = {
            subs: document.getElementById("subsDisplay"),
            cash: document.getElementById("cashDisplay"),
            gems: document.getElementById("gemsDisplay"),
            passive: document.getElementById("passiveIncomeDisplay"),
            prestigeBtn: document.getElementById("prestigeButton"),
            prestigeFill: document.getElementById("prestigeProgressFill"),
            prestigeCost: document.getElementById("prestigeCostDisplay"),
            nextPreview: document.getElementById("nextContentPreview"),
            contentContainer: document.getElementById("contentContainer"),
            clickBtn: document.getElementById("clickButton"),
            floating: document.getElementById("floatingContainer"),
            dailyBtn: document.getElementById("dailyRewardBtn"),
            modal: document.getElementById("characterModal"),
            skinsContainer: document.getElementById("skinsContainer"),
            avatar: document.getElementById("avatarEmoji"),
            modalAvatar: document.getElementById("modalAvatar"),
            characterName: document.getElementById("characterName"),
            characterBonus: document.getElementById("characterBonus")
        };
    },

    /* ===================== UTIL ===================== */

    format(num) {
        if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
        if (num >= 1e3) return (num / 1e3).toFixed(1) + "K";
        return Math.floor(num);
    },

    price(content) {
        return {
            subs: Math.floor(content.baseSubsPrice * Math.pow(1.8, content.count)),
            cash: +(content.baseCashPrice * Math.pow(1.6, content.count)).toFixed(2)
        };
    },

    /* ===================== LOGIC ===================== */

    recalcPassive() {
        let cash = 0;
        let subs = 0;

        this.contentItems.forEach(c => {
            cash += c.cashPerSec * c.count;
            subs += c.subsPerSec * c.count;
        });

        this.state.passiveCashPerSec = cash * this.state.globalBonus;
        this.state.passiveSubsPerSec = subs * this.state.globalBonus;
    },

    recalcClick() {
        let bonus = 0;
        this.contentItems.forEach(c => bonus += c.clickBonus * c.count);
        this.state.clickPower = 1 + bonus;
    },

    /* ===================== ACTIONS ===================== */

    click() {
        this.state.subscribers += this.state.clickPower * this.state.globalBonus;
        this.renderStats();
    },

    idleTick() {
        this.state.cash += this.state.passiveCashPerSec;
        this.state.subscribers += this.state.passiveSubsPerSec;
        this.renderStats();
    },

    purchase(id) {
        const c = this.contentItems.find(x => x.id === id);
        if (!c) return;

        const price = this.price(c);
        if (this.state.subscribers < price.subs || this.state.cash < price.cash) return;

        this.state.cash -= price.cash;
        c.count++;

        this.recalcPassive();
        this.recalcClick();
        this.renderAll();
        this.saveGame();
    },

    /* ===================== RENDER ===================== */

    renderStats() {
        this.ui.subs.innerText = this.format(this.state.subscribers);
        this.ui.cash.innerText = this.state.cash.toFixed(1);
        this.ui.gems.innerText = this.state.gems;
        this.ui.passive.innerText =
            "+" + this.state.passiveCashPerSec.toFixed(2) + " $/сек";
    },

    renderContent() {
        let html = "";

        this.contentItems.forEach(c => {
            const unlock = this.contentUnlocks.find(u => u.id === c.id);
            if (!unlock || !unlock.unlocked) return;

            const p = this.price(c);

            html += `
            <div class="content-item">
                <div>
                    ${c.name} ${c.count ? "(Lv." + c.count + ")" : ""}
                </div>
                <button data-id="${c.id}">
                    ${this.format(p.subs)} 👥
                </button>
            </div>
            `;
        });

        this.ui.contentContainer.innerHTML = html;
    },

    renderAll() {
        this.renderStats();
        this.renderContent();
    },

    /* ===================== SAVE / LOAD ===================== */

    saveGame() {
        this.state.saveTimestamp = Date.now();

        const saveData = {
            subscribers: this.state.subscribers,
            cash: this.state.cash,
            gems: this.state.gems,
            prestigeLevel: this.state.prestigeLevel,
            passiveCashPerSec: this.state.passiveCashPerSec,
            passiveSubsPerSec: this.state.passiveSubsPerSec,
            clickPower: this.state.clickPower,
            globalBonus: this.state.globalBonus,
            contentItems: this.contentItems.map(c => ({ id: c.id, count: c.count })),
            contentUnlocks: this.contentUnlocks.map(u => ({ id: u.id, unlocked: u.unlocked })),
            skins: this.skins.map(s => ({ id: s.id, owned: s.owned })),
            currentSkin: this.state.currentSkin?.id || "default",
            lastDailyTime: this.state.lastDailyTime,
            timestamp: this.state.saveTimestamp
        };

        localStorage.setItem(this.SAVE_KEY, JSON.stringify(saveData));
    },

    loadGame() {
        const saved = localStorage.getItem(this.SAVE_KEY);
        if (!saved) return;

        const data = JSON.parse(saved);

        Object.assign(this.state, {
            subscribers: data.subscribers || 0,
            cash: data.cash || 0,
            gems: data.gems || 0,
            prestigeLevel: data.prestigeLevel || 0,
            globalBonus: data.globalBonus || 1.0,
            lastDailyTime: data.lastDailyTime || 0
        });

        if (data.contentItems) {
            data.contentItems.forEach(sc => {
                const c = this.contentItems.find(x => x.id === sc.id);
                if (c) c.count = sc.count;
            });
        }

        this.recalcPassive();
        this.recalcClick();

        /* === ОФФЛАЙН ДОХОД === */
        if (data.timestamp) {
            const delta = (Date.now() - data.timestamp) / 1000;
            this.state.cash += this.state.passiveCashPerSec * delta;
            this.state.subscribers += this.state.passiveSubsPerSec * delta;
        }
    },

    /* ===================== INIT ===================== */

    init() {
        this.cache();
        this.loadGame();
        this.renderAll();

        this.ui.clickBtn.addEventListener("click", () => this.click());

        this.ui.contentContainer.addEventListener("click", e => {
            const btn = e.target.closest("button[data-id]");
            if (!btn) return;
            this.purchase(btn.dataset.id);
        });

        setInterval(() => this.idleTick(), 1000);
        setInterval(() => this.saveGame(), 30000);

        window.addEventListener("beforeunload", () => this.saveGame());
    }
};

/* ===================== START ===================== */

window.addEventListener("load", () => Game.init());
