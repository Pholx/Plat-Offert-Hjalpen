/* ==========================================
   1. KONFIGURATION, HELPERS & GRUNDDATA
   ========================================== */

const SAFE_MASKIN_FALLBACK = { id: 0, namn: 'Okänd resurs', typ: 'maskin', timpris: 0 };

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

window.parseNum = function(val) {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'string') {
        val = val.replace(',', '.');
    }
    const parsed = parseFloat(val);
    return (isNaN(parsed) || parsed < 0) ? 0 : parsed;
};

const STANDARD_MASKINER = [
    { id: 1, namn: 'Fiberlaser', typ: 'maskin', timpris: 950 },
    { id: 2, namn: 'CNC-fräs (flerop)', typ: 'maskin', timpris: 1100 },
    { id: 3, namn: 'Kantbock', typ: 'maskin', timpris: 750 },
    { id: 4, namn: 'Trumling', typ: 'maskin', timpris: 650 },
    { id: 5, namn: 'Avgradning', typ: 'maskin', timpris: 600 },
    { id: 6, namn: 'Planslip', typ: 'maskin', timpris: 850 },
    { id: 7, namn: 'Mätmaskin', typ: 'maskin', timpris: 550, matmaskin: true },
    { id: 8, namn: 'Svetsning', typ: 'maskin', timpris: 700 },
    { id: 9, namn: 'Punktssvets', typ: 'maskin', timpris: 500 },
    { id: 10, namn: 'Riktning / rätning', typ: 'maskin', timpris: 650 },
    { id: 11, namn: 'Montering', typ: 'maskin', timpris: 400 },
    { id: 12, namn: 'Gnistning (EDM)', typ: 'maskin', timpris: 900 },
    { id: 13, namn: 'Svarvning', typ: 'maskin', timpris: 900 },
    { id: 17, namn: 'Excenterpress', typ: 'maskin', timpris: 650 },
    { id: 14, namn: '🔧 Verktyg', typ: 'material', timpris: 0 },
    { id: 15, namn: '🧱 Material', typ: 'material', timpris: 0 },
    { id: 16, namn: '🔩 Komponenter', typ: 'komponent', timpris: 0 }
];

window.maskiner = hamtaMaskinData();
window.momentRader = [];
let radCounter = 0;

function formateraValuta(varde) {
    return new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(varde);
}

function hamtaMaskinData() {
    const lagrad = localStorage.getItem('offerthjalpen_maskiner_v13');
    return lagrad ? JSON.parse(lagrad) : JSON.parse(JSON.stringify(STANDARD_MASKINER));
}

function hamtaMaskin(id) {
    return window.maskiner.find(x => x.id === id) || window.maskiner[0] || SAFE_MASKIN_FALLBACK;
}

/* ==========================================
   2. INITIALISERING, UTKAST & FILHANTERING
   ========================================== */

window.onload = function() {
    laddaUtkast();
};

function laddaUtkast() {
    const sparatUtkast = localStorage.getItem('offerthjalpen_utkast_v13');
    const datumEl = document.getElementById('datumVal');
    
    if (sparatUtkast) {
        try {
            const data = JSON.parse(sparatUtkast);
            laddaInDataITjansten(data);
        } catch(e) {
            datumEl.valueAsDate = new Date();
            window.laggTillMoment();
            document.getElementById('kundNamn').focus();
        }
    } else {
        datumEl.valueAsDate = new Date();
        window.laggTillMoment();
        document.getElementById('kundNamn').focus();
    }
}

function laddaInDataITjansten(data) {
    const datumEl = document.getElementById('datumVal');
    document.getElementById('kundNamn').value = data.kundNamn || '';
    document.getElementById('projektNamn').value = data.projektNamn || '';
    document.getElementById('materialVal').value = data.materialVal || 'Stål';
    document.getElementById('orderAntal').value = Math.max(1, window.parseNum(data.orderAntal) || 1);
    document.getElementById('paslagProcent').value = window.parseNum(data.paslagProcent);
    
    if (data.datumVal) {
        datumEl.value = data.datumVal;
    } else {
        datumEl.valueAsDate = new Date();
    }
    
    window.momentRader = data.momentRader || [];
    const giltigaIds = window.momentRader.map(r => parseInt(r.id)).filter(id => !isNaN(id));
    radCounter = giltigaIds.length > 0 ? Math.max(...giltigaIds) : 0;
    
    window.momentRader.forEach(rad => {
        const m = hamtaMaskin(rad.maskinId);
        if (m.typ === 'material' || m.typ === 'komponent') {
            rad.fixtur = false;
            rad.fixturMoment = [];
            rad.verktyg = false;
            rad.verktygMoment = [];
        }
        if (rad.extraAntal === undefined) rad.extraAntal = 1;
        if (rad.fixturMoment) rad.fixturMoment.forEach(f => { if (f.extraAntal === undefined) f.extraAntal = 1; });
        if (rad.verktygMoment) rad.verktygMoment.forEach(v => { if (v.extraAntal === undefined) v.extraAntal = 1; });
    });

    if(window.momentRader.length === 0) {
        window.laggTillMoment();
    } else {
        window.renderaAllaMoment();
        window.uppdateraTotal();
    }
}

window.sparaUtkast = function() {
    const data = byggaOffertObjekt();
    localStorage.setItem('offerthjalpen_utkast_v13', JSON.stringify(data));
};

function byggaOffertObjekt() {
    return {
        kundNamn: document.getElementById('kundNamn').value,
        projektNamn: document.getElementById('projektNamn').value,
        datumVal: document.getElementById('datumVal').value,
        materialVal: document.getElementById('materialVal').value,
        orderAntal: document.getElementById('orderAntal').value,
        paslagProcent: document.getElementById('paslagProcent').value,
        momentRader: window.momentRader,
        maskiner: window.maskiner
    };
}

window.laddaNerOffert = function() {
    const data = byggaOffertObjekt();
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const filNamn = `Offert_${data.kundNamn || 'Kund'}_${data.projektNamn || 'Projekt'}.json`.replace(/\s+/g, '_');
    a.download = filNamn;
    a.click();
    URL.revokeObjectURL(url);
};

window.laddaUppOffert = function(event) {
    const file = event.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.maskiner && Array.isArray(data.maskiner)) {
                const ersatt = confirm('Filen innehåller en maskinlista. Vill du ersätta nuvarande maskinlista med den från filen?');
                if (ersatt) {
                    window.maskiner = data.maskiner;
                    localStorage.setItem('offerthjalpen_maskiner_v13', JSON.stringify(window.maskiner));
                }
            }
            laddaInDataITjansten(data);
            window.sparaUtkast();
            alert("Offert inladdad!");
        } catch(err) {
            alert("Kunde inte läsa filen. Är det en giltig JSON-offert?");
        }
        event.target.value = '';
    };
    reader.readAsText(file);
};

/* ==========================================
   3. HUVUDLOGIK FÖR MOMENT
   ========================================== */

window.laggTillMoment = function(maskinId = null) {
    if (!window.maskiner || window.maskiner.length === 0) {
        window.maskiner = JSON.parse(JSON.stringify(STANDARD_MASKINER));
        localStorage.setItem('offerthjalpen_maskiner_v13', JSON.stringify(window.maskiner));
    }
    const m = maskinId ? hamtaMaskin(maskinId) : hamtaMaskin(window.maskiner[0].id);
    
    window.momentRader.push({
        id: ++radCounter,
        maskinId: m.id,
        timpris: m.timpris,
        tidMin: '',
        tidSek: '',
        stalltid: '',
        antal: 1,
        fixtur: false,
        fixturMoment: [],
        verktyg: false,
        verktygMoment: [],
        extraBeskrivning: '',
        extraKostnad: '',
        extraAntal: 1
    });
    
    window.renderaAllaMoment();
    window.uppdateraTotal();
};

window.dupliceraMoment = function(id) {
    const originalRad = window.momentRader.find(r => r.id === id);
    if (!originalRad) return;
    
    const kopia = JSON.parse(JSON.stringify(originalRad));
    kopia.id = ++radCounter;
    
    const index = window.momentRader.findIndex(r => r.id === id);
    window.momentRader.splice(index + 1, 0, kopia);
    
    window.renderaAllaMoment();
    window.uppdateraTotal();
};

window.taBortMoment = function(id) {
    window.momentRader = window.momentRader.filter(r => r.id !== id);
    window.renderaAllaMoment();
    window.uppdateraTotal();
};

window.flyttaMoment = function(index, riktning) {
    const nyIndex = index + riktning;
    if (nyIndex < 0 || nyIndex >= window.momentRader.length) return;

    const temp = window.momentRader[index];
    window.momentRader[index] = window.momentRader[nyIndex];
    window.momentRader[nyIndex] = temp;

    window.renderaAllaMoment();
    window.uppdateraTotal();
};

window.rensaAllaMoment = function() {
    if (confirm('Vill du behålla kund/projekt/information? Tryck OK för att endast rensa moment, Avbryt för att rensa allt.')) {
        window.momentRader = [];
        window.laggTillMoment();
    } else {
        window.momentRader = [];
        document.getElementById('kundNamn').value = '';
        document.getElementById('projektNamn').value = '';
        document.getElementById('orderAntal').value = 1;
        document.getElementById('paslagProcent').value = 0;
        window.laggTillMoment();
    }
    window.renderaAllaMoment();
    window.uppdateraTotal();
    window.sparaUtkast();
};

window.uppdateraMoment = function(id, falt, varde) {
    const rad = window.momentRader.find(r => r.id === id);
    if (!rad) return;

    if (falt === 'maskinId') {
        const m = hamtaMaskin(parseInt(varde));
        rad.maskinId = m.id;
        rad.timpris = m.timpris;
        
        if (m.typ === 'material' || m.typ === 'komponent') {
            rad.fixtur = false;
            rad.fixturMoment = [];
            rad.verktyg = false;
            rad.verktygMoment = [];
        }
        window.renderaAllaMoment(); 
    } else {
        rad[falt] = varde;
        if (falt === 'fixtur' || falt === 'verktyg') {
            window.renderaAllaMoment();
        }
    }
    window.uppdateraTotal();
};

/* ==========================================
   4. RENDERER
   ========================================== */

window.renderaAllaMoment = function() {
    const container = document.getElementById('momentLista');
    if (!container) return;
    container.innerHTML = '';
    const orderAntal = Math.max(1, window.parseNum(document.getElementById('orderAntal').value) || 1);

    window.momentRader.forEach((rad, index) => {
        const m = hamtaMaskin(rad.maskinId);
        const typ = m.typ || 'maskin';
        const radKostnad = beraknaRadKostnad(rad, orderAntal);

        let html = `<div class="moment-rad-container" data-rad-id="${rad.id}">`;
        html += `<div class="rad-flex">`;

        html += `
            <div class="sortering-btn-container">
                <button class="btn-sortera" onclick="window.flyttaMoment(${index}, -1)" ${index === 0 ? 'disabled' : ''} title="Flytta upp">▲</button>
                <button class="btn-sortera" onclick="window.flyttaMoment(${index}, 1)" ${index === window.momentRader.length - 1 ? 'disabled' : ''} title="Flytta ned">▼</button>
            </div>
        `;

        html += `
            <div class="input-grupp" style="flex: 1; min-width: 180px;">
                <label>Kategori</label>
                <select onchange="window.uppdateraMoment(${rad.id}, 'maskinId', this.value)">
                    ${window.maskiner.map(mp => `<option value="${mp.id}" ${mp.id === rad.maskinId ? 'selected' : ''}>${escapeHtml(mp.namn)}</option>`).join('')}
                </select>
            </div>
        `;

        if (typ === 'maskin') {
            const arMatmaskin = m.matmaskin || m.namn.toLowerCase().includes('mätmaskin');
            const antalLabel = arMatmaskin ? 'Mätintervall' : 'Antal/Op';
            const antalPlaceholder = arMatmaskin ? 'Var X:e' : '1';

            html += `
                <div class="input-grupp" style="width: 80px;">
                    <label>Kr/h</label>
                    <input type="number" value="${escapeHtml(rad.timpris)}" oninput="window.uppdateraMoment(${rad.id}, 'timpris', this.value)">
                </div>
                <div class="input-grupp" style="width: 70px;">
                    <label>Min</label>
                    <input type="number" value="${escapeHtml(rad.tidMin)}" oninput="window.uppdateraMoment(${rad.id}, 'tidMin', this.value)">
                </div>
                <div class="input-grupp" style="width: 70px;">
                    <label>Sek</label>
                    <input type="number" value="${escapeHtml(rad.tidSek)}" oninput="window.uppdateraMoment(${rad.id}, 'tidSek', this.value)">
                </div>
                <div class="input-grupp" style="width: 80px;">
                    <label>Ställ (m)</label>
                    <input type="number" value="${escapeHtml(rad.stalltid)}" oninput="window.uppdateraMoment(${rad.id}, 'stalltid', this.value)">
                </div>
                <div class="input-grupp" style="width: 90px;">
                    <label>${antalLabel}</label>
                    <input type="number" value="${escapeHtml(rad.antal)}" min="1" placeholder="${antalPlaceholder}" oninput="window.uppdateraMoment(${rad.id}, 'antal', this.value)">
                </div>
                <div class="fixtur-label-container">
                    <label>
                        <input type="checkbox" ${rad.fixtur ? 'checked' : ''} onchange="window.uppdateraMoment(${rad.id}, 'fixtur', this.checked)"> 
                        Fixtur
                    </label>
                    <label>
                        <input type="checkbox" ${rad.verktyg ? 'checked' : ''} onchange="window.uppdateraMoment(${rad.id}, 'verktyg', this.checked)"> 
                        Verktyg
                    </label>
                </div>
            `;
        } else {
            html += `
                <div class="input-grupp" style="flex: 2; min-width: 200px;">
                    <label>Beskrivning / Info</label>
                    <input type="text" value="${escapeHtml(rad.extraBeskrivning)}" placeholder="T.ex. stålplåt, gängtapp, lim..." oninput="window.uppdateraMoment(${rad.id}, 'extraBeskrivning', this.value)">
                </div>
                <div class="input-grupp" style="width: 80px;">
                    <label>Antal</label>
                    <input type="number" value="${escapeHtml(rad.extraAntal || 1)}" min="1" oninput="window.uppdateraMoment(${rad.id}, 'extraAntal', this.value)">
                </div>
                <div class="input-grupp" style="width: 100px;">
                    <label>Á-pris (kr/st)</label>
                    <input type="number" value="${escapeHtml(rad.extraKostnad)}" oninput="window.uppdateraMoment(${rad.id}, 'extraKostnad', this.value)">
                </div>
            `;
        }

        html += `
                <div class="input-grupp rad-kostnad-container">
                    <label>Radkostnad</label>
                    <div class="rad-kostnad">${formateraValuta(radKostnad)}</div>
                </div>
                <div class="atgards-knappar-rad">
                    <button class="rad-action-btn btn-kopiera" onclick="window.dupliceraMoment(${rad.id})" title="Duplicera rad">📋</button>
                    <button class="rad-action-btn btn-tabort" onclick="window.taBortMoment(${rad.id})" title="Ta bort rad">🗑️</button>
                </div>
            </div>`;

        if (rad.fixtur && typ === 'maskin') {
            html += byggaFixturHtml(rad);
        }
        if (rad.verktyg && typ === 'maskin') {
            html += byggaVerktygHtml(rad);
        }

        html += `</div>`;
        container.insertAdjacentHTML('beforeend', html);
    });
};

/* ==========================================
   5. BERÄKNINGAR
   ========================================== */

function beraknaFixturRadKostnad(fix) {
    const m = hamtaMaskin(fix.maskinId);
    if (m.typ === 'material' || m.typ === 'komponent') {
        return window.parseNum(fix.extraKostnad) * Math.max(1, window.parseNum(fix.extraAntal || 1));
    } else {
        return window.parseNum(fix.tidTimmar) * window.parseNum(fix.timpris);
    }
}

function beraknaVerktygRadKostnad(verk) {
    const m = hamtaMaskin(verk.maskinId);
    if (m.typ === 'material' || m.typ === 'komponent') {
        return window.parseNum(verk.extraKostnad) * Math.max(1, window.parseNum(verk.extraAntal || 1));
    } else {
        return window.parseNum(verk.tidTimmar) * window.parseNum(verk.timpris);
    }
}

function beraknaFixturTotal(rad) {
    if (!rad.fixtur || !rad.fixturMoment) return 0;
    const m = hamtaMaskin(rad.maskinId);
    if (m.typ !== 'maskin') return 0; // Fix för punkt 1: endast maskiner får beräkna fixturtotal
    let sum = 0;
    rad.fixturMoment.forEach(fix => {
        sum += beraknaFixturRadKostnad(fix);
    });
    return sum;
}

function beraknaVerktygTotal(rad) {
    if (!rad.verktyg || !rad.verktygMoment) return 0;
    const m = hamtaMaskin(rad.maskinId);
    if (m.typ !== 'maskin') return 0; // Fix för punkt 1: endast maskiner får beräkna verktygstotal
    let sum = 0;
    rad.verktygMoment.forEach(verk => {
        sum += beraknaVerktygRadKostnad(verk);
    });
    return sum;
}

function beraknaRadKostnad(rad, orderAntal) {
    const m = hamtaMaskin(rad.maskinId);
    
    if (m.typ === 'material' || m.typ === 'komponent') {
        return window.parseNum(rad.extraKostnad) * Math.max(1, window.parseNum(rad.extraAntal || 1));
    }

    const valtfalt = Math.max(1, Math.floor(window.parseNum(rad.antal)) || 1);
    const minuterTotalTid = window.parseNum(rad.tidMin) + (window.parseNum(rad.tidSek) / 60);
    const stallMin = window.parseNum(rad.stalltid);
    const timpris = window.parseNum(rad.timpris);

    let antalKorningar = Math.ceil(orderAntal / valtfalt);

    const maskinKostnad = ((stallMin + (minuterTotalTid * antalKorningar)) / 60) * timpris;
    const fixturKostnad = beraknaFixturTotal(rad);
    const verktygKostnad = beraknaVerktygTotal(rad);

    return maskinKostnad + fixturKostnad + verktygKostnad;
}

window.uppdateraTotal = function() {
    const orderAntal = Math.max(1, window.parseNum(document.getElementById('orderAntal').value) || 1);
    const paslag = window.parseNum(document.getElementById('paslagProcent').value);
    
    let totalSjalvkostnad = 0;
    let totalFixturSum = 0;
    let totalVerktygSum = 0;

    window.momentRader.forEach(rad => {
        const kost = beraknaRadKostnad(rad, orderAntal);
        totalSjalvkostnad += kost;
        
        const fixKost = beraknaFixturTotal(rad);
        const verkKost = beraknaVerktygTotal(rad);
        totalFixturSum += fixKost;
        totalVerktygSum += verkKost;

        const el = document.querySelector(`[data-rad-id="${rad.id}"] .rad-kostnad`);
        if (el) el.textContent = formateraValuta(kost);

        if (rad.fixtur) {
            const fixTotEl = document.getElementById(`fixtur-total-${rad.id}`);
            if (fixTotEl) fixTotEl.textContent = formateraValuta(fixKost);

            if(rad.fixturMoment) {
                rad.fixturMoment.forEach((fix, idx) => {
                    const fixRadKostEl = document.getElementById(`fix-radkost-${rad.id}-${idx}`);
                    if (fixRadKostEl) fixRadKostEl.textContent = formateraValuta(beraknaFixturRadKostnad(fix));
                });
            }
        }
        
        if (rad.verktyg) {
            const verkTotEl = document.getElementById(`verktyg-total-${rad.id}`);
            if (verkTotEl) verkTotEl.textContent = formateraValuta(verkKost);

            if(rad.verktygMoment) {
                rad.verktygMoment.forEach((verk, idx) => {
                    const verkRadKostEl = document.getElementById(`verk-radkost-${rad.id}-${idx}`);
                    if (verkRadKostEl) verkRadKostEl.textContent = formateraValuta(beraknaVerktygRadKostnad(verk));
                });
            }
        }
    });

    const totalSjalvkostnadUtanFixVerk = totalSjalvkostnad - totalFixturSum - totalVerktygSum;

    const kundPrisTotal = totalSjalvkostnad * (1 + (paslag / 100));
    const kundPrisUtanFixVerk = totalSjalvkostnadUtanFixVerk * (1 + (paslag / 100));

    document.getElementById('totalPris').textContent = formateraValuta(totalSjalvkostnad);
    document.getElementById('stuckPris').textContent = formateraValuta(totalSjalvkostnad / orderAntal);
    document.getElementById('antalMoment').textContent = window.momentRader.length;
    
    document.getElementById('kundPris').textContent = formateraValuta(kundPrisTotal);
    document.getElementById('kundStuckPris').textContent = formateraValuta(kundPrisTotal / orderAntal);
    document.getElementById('displayPaslag').textContent = paslag;
    
    const elTotUtan = document.getElementById('totalPrisUtanFixVerk');
    if (elTotUtan) elTotUtan.textContent = formateraValuta(totalSjalvkostnadUtanFixVerk);

    const elStkUtan = document.getElementById('stuckPrisUtanFixVerk');
    if (elStkUtan) elStkUtan.textContent = formateraValuta(totalSjalvkostnadUtanFixVerk / orderAntal);

    const elKundUtan = document.getElementById('kundPrisUtanFixVerk');
    if (elKundUtan) elKundUtan.textContent = formateraValuta(kundPrisUtanFixVerk);

    const elKundStkUtan = document.getElementById('kundStuckPrisUtanFixVerk');
    if (elKundStkUtan) elKundStkUtan.textContent = formateraValuta(kundPrisUtanFixVerk / orderAntal);

    window.sparaUtkast();
};

/* ==========================================
   6. FIXTUR & VERKTYG LOGIK
   ========================================== */

// --- FIXTUR ---
window.laggTillFixturMoment = function(radId) {
    const rad = window.momentRader.find(r => r.id === radId);
    if (!rad) return;
    if (!rad.fixturMoment) rad.fixturMoment = [];

    const m = hamtaMaskin(window.maskiner[0]?.id);
    rad.fixturMoment.push({
        maskinId: m.id,
        timpris: m.timpris,
        tidTimmar: '',
        extraBeskrivning: '',
        extraKostnad: '',
        extraAntal: 1
    });

    window.renderaAllaMoment();
    window.uppdateraTotal();
};

window.taBortFixturMoment = function(radId, idx) {
    const rad = window.momentRader.find(r => r.id === radId);
    if (rad && rad.fixturMoment) {
        rad.fixturMoment.splice(idx, 1);
        window.renderaAllaMoment();
        window.uppdateraTotal();
    }
};

window.uppdateraFixturMoment = function(radId, idx, falt, val) {
    const rad = window.momentRader.find(r => r.id === radId);
    if (!rad || !rad.fixturMoment || !rad.fixturMoment[idx]) return;

    const fix = rad.fixturMoment[idx];

    if (falt === 'maskinId') {
        const m = hamtaMaskin(parseInt(val));
        fix.maskinId = m.id;
        fix.timpris = m.timpris;
        window.renderaAllaMoment();
    } else {
        fix[falt] = val;
    }
    window.uppdateraTotal();
};

function byggaFixturHtml(rad) {
    const fixTot = beraknaFixturTotal(rad);

    let fixRaderHtml = (rad.fixturMoment || []).map((fix, idx) => {
        const fMaskin = hamtaMaskin(fix.maskinId);
        const fTyp = fMaskin.typ || 'maskin';
        const fixRadKost = beraknaFixturRadKostnad(fix);

        let faltHtml = '';
        if (fTyp === 'maskin') {
            faltHtml = `
                <div class="input-grupp" style="width: 80px;">
                    <label>Kr/h</label>
                    <input type="number" value="${escapeHtml(fix.timpris)}" oninput="window.uppdateraFixturMoment(${rad.id}, ${idx}, 'timpris', this.value)">
                </div>
                <div class="input-grupp" style="width: 90px;">
                    <label>Timmar (h)</label>
                    <input type="number" step="0.1" value="${escapeHtml(fix.tidTimmar)}" placeholder="0.0" oninput="window.uppdateraFixturMoment(${rad.id}, ${idx}, 'tidTimmar', this.value)">
                </div>
            `;
        } else {
            faltHtml = `
                <div class="input-grupp" style="flex: 2; min-width: 170px;">
                    <label>Beskrivning / Material</label>
                    <input type="text" value="${escapeHtml(fix.extraBeskrivning)}" placeholder="T.ex. platta, gängtapp..." oninput="window.uppdateraFixturMoment(${rad.id}, ${idx}, 'extraBeskrivning', this.value)">
                </div>
                <div class="input-grupp" style="width: 70px;">
                    <label>Antal</label>
                    <input type="number" value="${escapeHtml(fix.extraAntal || 1)}" min="1" oninput="window.uppdateraFixturMoment(${rad.id}, ${idx}, 'extraAntal', this.value)">
                </div>
                <div class="input-grupp" style="width: 90px;">
                    <label>Á-pris (kr)</label>
                    <input type="number" value="${escapeHtml(fix.extraKostnad)}" placeholder="0" oninput="window.uppdateraFixturMoment(${rad.id}, ${idx}, 'extraKostnad', this.value)">
                </div>
            `;
        }

        return `
            <div class="rad-flex" style="background: white; padding: 10px; border-radius: 8px; border: 1px solid #dde1e6; margin-top: 6px;">
                <div class="input-grupp" style="flex: 1; min-width: 150px;">
                    <label>Kategori</label>
                    <select onchange="window.uppdateraFixturMoment(${rad.id}, ${idx}, 'maskinId', this.value)">
                        ${window.maskiner.map(mp => `<option value="${mp.id}" ${mp.id === fix.maskinId ? 'selected' : ''}>${escapeHtml(mp.namn)}</option>`).join('')}
                    </select>
                </div>
                ${faltHtml}
                <div class="input-grupp rad-kostnad-container">
                    <label>Radkostnad</label>
                    <div class="rad-kostnad" id="fix-radkost-${rad.id}-${idx}">${formateraValuta(fixRadKost)}</div>
                </div>
                <div class="atgards-knappar-rad">
                    <button class="rad-action-btn btn-tabort" onclick="window.taBortFixturMoment(${rad.id}, ${idx})" title="Ta bort fixturrad">🗑️</button>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="fixtur-wrapper">
            <div class="fixtur-header">
                <h4>🛠️ Fixtur (engångs)</h4>
                <div class="fixtur-total-badge">Fixturtotalkostnad: <span id="fixtur-total-${rad.id}">${formateraValuta(fixTot)}</span></div>
            </div>
            <div class="fixtur-moment-lista">
                ${fixRaderHtml}
            </div>
            <button class="btn btn-outline btn-sm" style="margin-top:10px; background: white;" onclick="window.laggTillFixturMoment(${rad.id})">➕ Lägg till fixturop / material</button>
        </div>
    `;
}

// --- VERKTYG ---
window.laggTillVerktygMoment = function(radId) {
    const rad = window.momentRader.find(r => r.id === radId);
    if (!rad) return;
    if (!rad.verktygMoment) rad.verktygMoment = [];

    const m = hamtaMaskin(window.maskiner[0]?.id);
    rad.verktygMoment.push({
        maskinId: m.id,
        timpris: m.timpris,
        tidTimmar: '',
        extraBeskrivning: '',
        extraKostnad: '',
        extraAntal: 1
    });

    window.renderaAllaMoment();
    window.uppdateraTotal();
};

window.taBortVerktygMoment = function(radId, idx) {
    const rad = window.momentRader.find(r => r.id === radId);
    if (rad && rad.verktygMoment) {
        rad.verktygMoment.splice(idx, 1);
        window.renderaAllaMoment();
        window.uppdateraTotal();
    }
};

window.uppdateraVerktygMoment = function(radId, idx, falt, val) {
    const rad = window.momentRader.find(r => r.id === radId);
    if (!rad || !rad.verktygMoment || !rad.verktygMoment[idx]) return;

    const verk = rad.verktygMoment[idx];

    if (falt === 'maskinId') {
        const m = hamtaMaskin(parseInt(val));
        verk.maskinId = m.id;
        verk.timpris = m.timpris;
        window.renderaAllaMoment();
    } else {
        verk[falt] = val;
    }
    window.uppdateraTotal();
};

function byggaVerktygHtml(rad) {
    const verkTot = beraknaVerktygTotal(rad);

    let verkRaderHtml = (rad.verktygMoment || []).map((verk, idx) => {
        const vMaskin = hamtaMaskin(verk.maskinId);
        const vTyp = vMaskin.typ || 'maskin';
        const verkRadKost = beraknaVerktygRadKostnad(verk);

        let faltHtml = '';
        if (vTyp === 'maskin') {
            faltHtml = `
                <div class="input-grupp" style="width: 80px;">
                    <label>Kr/h</label>
                    <input type="number" value="${escapeHtml(verk.timpris)}" oninput="window.uppdateraVerktygMoment(${rad.id}, ${idx}, 'timpris', this.value)">
                </div>
                <div class="input-grupp" style="width: 90px;">
                    <label>Timmar (h)</label>
                    <input type="number" step="0.1" value="${escapeHtml(verk.tidTimmar)}" placeholder="0.0" oninput="window.uppdateraVerktygMoment(${rad.id}, ${idx}, 'tidTimmar', this.value)">
                </div>
            `;
        } else {
            faltHtml = `
                <div class="input-grupp" style="flex: 2; min-width: 170px;">
                    <label>Beskrivning / Material</label>
                    <input type="text" value="${escapeHtml(verk.extraBeskrivning)}" placeholder="T.ex. borr, skär..." oninput="window.uppdateraVerktygMoment(${rad.id}, ${idx}, 'extraBeskrivning', this.value)">
                </div>
                <div class="input-grupp" style="width: 70px;">
                    <label>Antal</label>
                    <input type="number" value="${escapeHtml(verk.extraAntal || 1)}" min="1" oninput="window.uppdateraVerktygMoment(${rad.id}, ${idx}, 'extraAntal', this.value)">
                </div>
                <div class="input-grupp" style="width: 90px;">
                    <label>Á-pris (kr)</label>
                    <input type="number" value="${escapeHtml(verk.extraKostnad)}" placeholder="0" oninput="window.uppdateraVerktygMoment(${rad.id}, ${idx}, 'extraKostnad', this.value)">
                </div>
            `;
        }

        return `
            <div class="rad-flex" style="background: white; padding: 10px; border-radius: 8px; border: 1px solid #dde1e6; margin-top: 6px;">
                <div class="input-grupp" style="flex: 1; min-width: 150px;">
                    <label>Kategori</label>
                    <select onchange="window.uppdateraVerktygMoment(${rad.id}, ${idx}, 'maskinId', this.value)">
                        ${window.maskiner.map(mp => `<option value="${mp.id}" ${mp.id === verk.maskinId ? 'selected' : ''}>${escapeHtml(mp.namn)}</option>`).join('')}
                    </select>
                </div>
                ${faltHtml}
                <div class="input-grupp rad-kostnad-container">
                    <label>Radkostnad</label>
                    <div class="rad-kostnad" id="verk-radkost-${rad.id}-${idx}">${formateraValuta(verkRadKost)}</div>
                </div>
                <div class="atgards-knappar-rad">
                    <button class="rad-action-btn btn-tabort" onclick="window.taBortVerktygMoment(${rad.id}, ${idx})" title="Ta bort verktygsrad">🗑️</button>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="verktyg-wrapper">
            <div class="verktyg-header">
                <h4>🪚 Verktyg (engångs)</h4>
                <div class="verktyg-total-badge">Verktygstotalkostnad: <span id="verktyg-total-${rad.id}">${formateraValuta(verkTot)}</span></div>
            </div>
            <div class="verktyg-moment-lista">
                ${verkRaderHtml}
            </div>
            <button class="btn btn-outline btn-sm" style="margin-top:10px; background: white;" onclick="window.laggTillVerktygMoment(${rad.id})">➕ Lägg till verktygsop / material</button>
        </div>
    `;
}

/* ==========================================
   7. ADMIN PANEL, SAMMANSTÄLLNING & EXCEL
   ========================================== */

window.toggleAdmin = function() {
    document.getElementById('adminPanel').classList.toggle('visible');
    window.renderaAdminTabell();
};

window.ändraMaskinTypAdmin = function(index, nyTyp) {
    const m = window.maskiner[index];
    if (!m) return;
    m.typ = nyTyp;
    
    if (nyTyp === 'material' || nyTyp === 'komponent') {
        window.momentRader.forEach(rad => {
            if (rad.maskinId === m.id) {
                rad.fixtur = false;
                rad.fixturMoment = [];
                rad.verktyg = false;
                rad.verktygMoment = [];
            }
        });
    }
    
    window.renderaAdminTabell();
    window.renderaAllaMoment();
    window.uppdateraTotal();
};

window.renderaAdminTabell = function() {
    const tbody = document.getElementById('adminTabellBody');
    if (!tbody) return;
    
    tbody.innerHTML = window.maskiner.map((m, i) => `
        <tr>
            <td><input type="text" value="${escapeHtml(m.namn)}" onchange="window.maskiner[${i}].namn = this.value; window.renderaAllaMoment();"></td>
            <td>
                <select onchange="window.ändraMaskinTypAdmin(${i}, this.value)">
                    <option value="maskin" ${m.typ === 'maskin' ? 'selected' : ''}>Maskin</option>
                    <option value="material" ${m.typ === 'material' ? 'selected' : ''}>Material/Verktyg</option>
                    <option value="komponent" ${m.typ === 'komponent' ? 'selected' : ''}>Komponent</option>
                </select>
            </td>
            <td><input type="number" value="${escapeHtml(m.timpris)}" ${m.typ !== 'maskin' ? 'disabled' : ''} onchange="window.maskiner[${i}].timpris = window.parseNum(this.value); window.uppdateraTotal();"></td>
            <td style="text-align:center;"><input type="checkbox" ${m.matmaskin || m.namn.toLowerCase().includes('mätmaskin') ? 'checked' : ''} onchange="window.maskiner[${i}].matmaskin = this.checked; window.renderaAllaMoment();"></td>
            <td><button class="btn btn-outline btn-sm" onclick="window.taBortMaskinAdmin(${i})">Ta bort</button></td>
        </tr>
    `).join('');
};

window.laggTillResursAdmin = function() {
    window.maskiner.push({ id: Date.now(), namn: 'Ny post', typ: 'maskin', timpris: 500 });
    window.renderaAdminTabell();
    window.renderaAllaMoment();
    window.uppdateraTotal();
};

window.taBortMaskinAdmin = function(index) {
    const maskinSomTasBort = window.maskiner[index];
    const anvands = window.momentRader.some(m => m.maskinId === maskinSomTasBort.id);

    if (anvands) {
        if (!confirm(`Resursen "${maskinSomTasBort.namn}" används i dina valda moment. Vill du ändå ta bort den?`)) return;
    }

    window.maskiner.splice(index, 1);
    window.renderaAdminTabell();
    window.renderaAllaMoment();
    window.uppdateraTotal();
};

window.sparaMaskinData = function() {
    localStorage.setItem('offerthjalpen_maskiner_v13', JSON.stringify(window.maskiner));
    alert('Resurser sparade!');
    window.renderaAllaMoment();
};

window.laddaStandardMaskiner = function() {
    if(confirm('Återställa till standardresurser? Alla egna ändringar i listan försvinner.')) {
        window.maskiner = JSON.parse(JSON.stringify(STANDARD_MASKINER));
        localStorage.removeItem('offerthjalpen_maskiner_v13'); 
        window.renderaAdminTabell();
        window.renderaAllaMoment();
        window.uppdateraTotal();
    }
};

window.uppdateraTimprisPaaAllaRader = function() {
    if (!confirm('Uppdatera timpriset på alla befintliga momentrader utifrån nuvarande maskinlista?')) return;
    let antalUppdaterade = 0;
    window.momentRader.forEach(rad => {
        const m = hamtaMaskin(rad.maskinId);
        if (m && m.typ === 'maskin') {
            rad.timpris = m.timpris;
            antalUppdaterade++;
        }
        ['fixturMoment', 'verktygMoment'].forEach(key => {
            if (rad[key]) {
                rad[key].forEach(item => {
                    const mm = hamtaMaskin(item.maskinId);
                    if (mm && mm.typ === 'maskin') {
                        item.timpris = mm.timpris;
                    }
                });
            }
        });
    });
    window.renderaAllaMoment();
    window.uppdateraTotal();
    alert(`${antalUppdaterade} rader uppdaterade.`);
};

window.stangSammanstallning = function() {
    document.getElementById('sammanstallningPanel').classList.remove('visible');
};

function rensaSterskrifter(txt) {
    return (txt || '').toString().replace(/[\t\r\n]/g, ' ');
}

window.kopieraTillExcel = function() {
    const orderAntal = Math.max(1, window.parseNum(document.getElementById('orderAntal').value) || 1);
    const paslag = window.parseNum(document.getElementById('paslagProcent').value);
    
    let text = "Maskin/Kategori\tTyp\tTid/Antal/Info\tKostnad (kr)\n";
    
    let totalSjalv = 0;
    let totalFixturSum = 0;
    let totalVerktygSum = 0;

    window.momentRader.forEach((rad) => {
        const m = hamtaMaskin(rad.maskinId);
        const totRadKost = beraknaRadKostnad(rad, orderAntal);
        const fixKostTot = beraknaFixturTotal(rad);
        const verkKostTot = beraknaVerktygTotal(rad);
        const renMaskinKost = totRadKost - fixKostTot - verkKostTot;
        
        totalSjalv += totRadKost;
        let info = "";

        if (m.typ === 'maskin') {
            info = `${window.parseNum(rad.tidMin)}m ${window.parseNum(rad.tidSek)}s (Ställ: ${window.parseNum(rad.stalltid)}m)`;
        } else {
            info = `${rensaSterskrifter(rad.extraBeskrivning) || '-'} (Antal: ${window.parseNum(rad.extraAntal || 1)})`;
        }
        
        text += `${rensaSterskrifter(m.namn)}\t${m.typ}\t${info}\t${Math.round(renMaskinKost)}\n`;
        
        if (rad.fixtur && rad.fixturMoment && rad.fixturMoment.length > 0) {
            rad.fixturMoment.forEach(fix => {
                const fm = hamtaMaskin(fix.maskinId);
                const fkost = beraknaFixturRadKostnad(fix);
                totalFixturSum += fkost;
                let finfo = fm.typ === 'maskin' ? `${window.parseNum(fix.tidTimmar)}h` : `${rensaSterskrifter(fix.extraBeskrivning) || '-'} (Antal: ${window.parseNum(fix.extraAntal || 1)})`;
                text += `-> Fixtur: ${rensaSterskrifter(fm.namn)}\t${fm.typ}\t${finfo}\t${Math.round(fkost)}\n`;
            });
        }

        if (rad.verktyg && rad.verktygMoment && rad.verktygMoment.length > 0) {
            rad.verktygMoment.forEach(verk => {
                const vm = hamtaMaskin(verk.maskinId);
                const vkost = beraknaVerktygRadKostnad(verk);
                totalVerktygSum += vkost;
                let vinfo = vm.typ === 'maskin' ? `${window.parseNum(verk.tidTimmar)}h` : `${rensaSterskrifter(verk.extraBeskrivning) || '-'} (Antal: ${window.parseNum(verk.extraAntal || 1)})`;
                text += `-> Verktyg: ${rensaSterskrifter(vm.namn)}\t${vm.typ}\t${vinfo}\t${Math.round(vkost)}\n`;
            });
        }
    });

    const kundPris = totalSjalv * (1 + (paslag/100));
    const totalUtanFixVerk = totalSjalv - totalFixturSum - totalVerktygSum;
    const kundPrisUtanFixVerk = totalUtanFixVerk * (1 + (paslag/100));

    text += `\nSjälvkostnad (Första order):\t\t\t${Math.round(totalSjalv)}\n`;
    text += `Påslag (%):\t\t\t${paslag}\n`;
    text += `Kundpris (Första order):\t\t\t${Math.round(kundPris)}\n`;
    text += `\n--- ÅTERKOMMANDE ORDER (EXKL. FIXTUR & VERKTYG) ---\n`;
    text += `Självkostnad återkommande:\t\t\t${Math.round(totalUtanFixVerk)} (${Math.round(totalUtanFixVerk / orderAntal)} kr/st)\n`;
    text += `Kundpris återkommande:\t\t\t${Math.round(kundPrisUtanFixVerk)} (${Math.round(kundPrisUtanFixVerk / orderAntal)} kr/st)\n`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            alert("Offerten har kopierats! Klistra in direkt i Excel (Ctrl+V).");
        }).catch(() => {
            kopieraTillTextarea(text);
        });
    } else {
        kopieraTillTextarea(text);
    }
};

function kopieraTillTextarea(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        alert("Offerten har kopierats! Klistra in i Excel (Ctrl+V).");
    } catch (e) {
        alert("Kunde inte kopiera. Vänligen kopiera manuellt från sammanställningen.");
    }
    document.body.removeChild(textarea);
}

window.visaSammanstallning = function() {
    const panel = document.getElementById('sammanstallningPanel');
    const innehall = document.getElementById('sammanstallningInnehall');
    const orderAntal = Math.max(1, window.parseNum(document.getElementById('orderAntal').value) || 1);
    const paslag = window.parseNum(document.getElementById('paslagProcent').value);

    if (window.momentRader.length === 0) {
        alert('Inga moment att sammanställa!');
        return;
    }

    let totalMaskin = 0, totalFixtur = 0, totalVerktyg = 0, totalFastaKostnader = 0;
    
    let html = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; background:#f8f9fc; padding:15px; border-radius:10px; margin-bottom:20px;">
            <div><strong>Kund:</strong> ${escapeHtml(document.getElementById('kundNamn').value) || '-'}</div>
            <div><strong>Projekt:</strong> ${escapeHtml(document.getElementById('projektNamn').value) || '-'}</div>
            <div><strong>Datum:</strong> ${escapeHtml(document.getElementById('datumVal').value)}</div>
            <div><strong>Huvudmaterial:</strong> ${escapeHtml(document.getElementById('materialVal').value)}</div>
            <div><strong>Orderantal:</strong> ${orderAntal} st</div>
            <div><strong>Påslag:</strong> ${paslag}%</div>
        </div>
        <table>
            <thead>
                <tr>
                    <th style="width:30px;">#</th>
                    <th>Kategori</th>
                    <th>Timpris/Á-pris</th>
                    <th>Tid / Antal</th>
                    <th>Ställ (min)</th>
                    <th>Info</th>
                    <th style="text-align:right;">Kostnad (kr)</th>
                </tr>
            </thead>
            <tbody>
    `;

    window.momentRader.forEach((rad, idx) => {
        const m = hamtaMaskin(rad.maskinId);
        const typ = m.typ || 'maskin';
        
        let ikoner = '';
        if(rad.fixtur) ikoner += ' 🔧 (med fixtur)';
        if(rad.verktyg) ikoner += ' 🪚 (med verktyg)';

        html += `
            <tr class="momentgrupp">
                <td>${idx+1}</td>
                <td colspan="6"><strong>${escapeHtml(m.namn)}</strong>${ikoner}</td>
            </tr>
        `;

        if (typ === 'material' || typ === 'komponent') {
            const beskrivning = escapeHtml(rad.extraBeskrivning) || '-';
            const antal = Math.max(1, window.parseNum(rad.extraAntal || 1));
            const aPris = window.parseNum(rad.extraKostnad);
            const kost = aPris * antal;
            totalFastaKostnader += kost;

            html += `
                <tr class="materialrad">
                    <td></td>
                    <td style="padding-left:25px;">📝 ${beskrivning}</td>
                    <td>${formateraValuta(aPris)} kr/st</td>
                    <td>${antal} st</td>
                    <td>-</td>
                    <td>-</td>
                    <td style="text-align:right;">${formateraValuta(kost)}</td>
                </tr>
            `;
        } else {
            const minuterTotalTid = window.parseNum(rad.tidMin) + (window.parseNum(rad.tidSek) / 60);
            const stallMin = window.parseNum(rad.stalltid);
            const valtfalt = Math.max(1, Math.floor(window.parseNum(rad.antal)) || 1);
            const antalKorningar = Math.ceil(orderAntal / valtfalt);
            const arMatmaskin = m.matmaskin || m.namn.toLowerCase().includes('mätmaskin');
            const radTimpris = window.parseNum(rad.timpris);
            
            const stallKost = (stallMin / 60) * radTimpris;
            const bearbetningKost = ((minuterTotalTid * antalKorningar) / 60) * radTimpris;
            
            totalMaskin += (stallKost + bearbetningKost);

            if (stallMin > 0) {
                html += `
                    <tr class="stallrad">
                        <td></td>
                        <td style="padding-left:25px;">🔧 Ställ (engång)</td>
                        <td>${radTimpris} kr/h</td>
                        <td>${stallMin.toFixed(1)} min</td>
                        <td>-</td>
                        <td>-</td>
                        <td style="text-align:right;">${formateraValuta(stallKost)}</td>
                    </tr>
                `;
            }
            if (minuterTotalTid > 0) {
                if (arMatmaskin) {
                    html += `
                        <tr class="bearbetningsrad">
                            <td></td>
                            <td style="padding-left:25px;">🔍 Mätning (${antalKorningar} st utförs)</td>
                            <td>${radTimpris} kr/h</td>
                            <td>${(minuterTotalTid * antalKorningar).toFixed(1)} min</td>
                            <td>-</td>
                            <td>Var ${valtfalt}:e detalj</td>
                            <td style="text-align:right;">${formateraValuta(bearbetningKost)}</td>
                        </tr>
                    `;
                } else {
                    html += `
                        <tr class="bearbetningsrad">
                            <td></td>
                            <td style="padding-left:25px;">⚙️ Bearbetning (${antalKorningar} körningar)</td>
                            <td>${radTimpris} kr/h</td>
                            <td>${(minuterTotalTid * antalKorningar).toFixed(1)} min</td>
                            <td>-</td>
                            <td>Antal/Op: ${valtfalt}</td>
                            <td style="text-align:right;">${formateraValuta(bearbetningKost)}</td>
                        </tr>
                    `;
                }
            }

            if (rad.fixtur && rad.fixturMoment) {
                let fixTotal = 0;
                let fixRaderSpec = '';

                rad.fixturMoment.forEach(fix => {
                    const fMaskin = hamtaMaskin(fix.maskinId);
                    const fTyp = fMaskin.typ || 'maskin';
                    const fKost = beraknaFixturRadKostnad(fix);
                    fixTotal += fKost;

                    if (fTyp === 'material' || fTyp === 'komponent') {
                        const besk = fix.extraBeskrivning ? `: ${escapeHtml(fix.extraBeskrivning)}` : '';
                        const fAntal = Math.max(1, window.parseNum(fix.extraAntal || 1));
                        fixRaderSpec += `<br> • ${escapeHtml(fMaskin.namn)}${besk} (${fAntal} st, ${formateraValuta(fKost)})`;
                    } else {
                        const fTimmar = window.parseNum(fix.tidTimmar);
                        fixRaderSpec += `<br> • ${escapeHtml(fMaskin.namn)}: ${fTimmar.toFixed(1)}h @ ${window.parseNum(fix.timpris)} kr/h (${formateraValuta(fKost)})`;
                    }
                });

                totalFixtur += fixTotal;

                html += `
                    <tr class="fixturrad">
                        <td></td>
                        <td style="padding-left:25px;">🔩 Fixtur (engångs)</td>
                        <td colspan="4">${fixRaderSpec || 'Inga specifierade fixturmoment'}</td>
                        <td style="text-align:right;">${formateraValuta(fixTotal)}</td>
                    </tr>
                `;
            }

            if (rad.verktyg && rad.verktygMoment) {
                let verkTotal = 0;
                let verkRaderSpec = '';

                rad.verktygMoment.forEach(verk => {
                    const vMaskin = hamtaMaskin(verk.maskinId);
                    const vTyp = vMaskin.typ || 'maskin';
                    const vKost = beraknaVerktygRadKostnad(verk);
                    verkTotal += vKost;

                    if (vTyp === 'material' || vTyp === 'komponent') {
                        const besk = verk.extraBeskrivning ? `: ${escapeHtml(verk.extraBeskrivning)}` : '';
                        const vAntal = Math.max(1, window.parseNum(verk.extraAntal || 1));
                        verkRaderSpec += `<br> • ${escapeHtml(vMaskin.namn)}${besk} (${vAntal} st, ${formateraValuta(vKost)})`;
                    } else {
                        const vTimmar = window.parseNum(verk.tidTimmar);
                        verkRaderSpec += `<br> • ${escapeHtml(vMaskin.namn)}: ${vTimmar.toFixed(1)}h @ ${window.parseNum(verk.timpris)} kr/h (${formateraValuta(vKost)})`;
                    }
                });

                totalVerktyg += verkTotal;

                html += `
                    <tr class="verktygrad">
                        <td></td>
                        <td style="padding-left:25px;">🪚 Verktyg (engångs)</td>
                        <td colspan="4">${verkRaderSpec || 'Inga specifierade verktygsmoment'}</td>
                        <td style="text-align:right;">${formateraValuta(verkTotal)}</td>
                    </tr>
                `;
            }
        }
        html += `<tr><td colspan="7" style="border-bottom:1px solid #dde1e6;"></td></tr>`;
    });

    const totalSjalvKostnad = totalMaskin + totalFixtur + totalVerktyg + totalFastaKostnader;
    const kundPris = totalSjalvKostnad * (1 + (paslag / 100));

    const totalSjalvUtanFixVerk = totalMaskin + totalFastaKostnader;
    const kundPrisUtanFixVerk = totalSjalvUtanFixVerk * (1 + (paslag / 100));

    html += `
            </tbody>
        </table>
        <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px; background:#f8f9fc; padding:15px; border-radius:10px; margin-top:15px;">
            <div><strong>Maskin/Tid:</strong> ${formateraValuta(totalMaskin)}</div>
            <div><strong>Fixtur:</strong> ${formateraValuta(totalFixtur)}</div>
            <div><strong>Verktyg:</strong> ${formateraValuta(totalVerktyg)}</div>
            <div><strong>Övrigt Mat/Komp:</strong> ${formateraValuta(totalFastaKostnader)}</div>
            <div><strong>Självkostnad per detalj:</strong> ${formateraValuta(totalSjalvKostnad / orderAntal)}</div>
        </div>
        
        <div style="background:#1a1a2e; color:white; padding: 20px; border-radius: 10px; margin-top: 15px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div style="font-size: 14px; color: #a1a1aa;">Självkostnad (Första order inkl. fixtur/verktyg)</div>
                <div style="font-size: 20px;">${formateraValuta(totalSjalvKostnad)}</div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 14px; color: #f5c842;">Kundpris (Inkl. ${paslag}% påslag)</div>
                <div style="font-size: 28px; font-weight: 700;">${formateraValuta(kundPris)}</div>
                <div style="font-size: 14px; color: #a1a1aa;">${formateraValuta(kundPris / orderAntal)} kr/st</div>
            </div>
        </div>

        <div style="background:#22223b; color:white; padding: 18px 20px; border-radius: 10px; margin-top: 10px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid #f5c842;">
            <div>
                <div style="font-size: 14px; font-weight: 600; color: #f5c842; margin-bottom: 2px;">🔄 Återkommande order (utan fixtur & verktyg)</div>
                <div style="font-size: 13px; color: #d1d5db;">Självkostnad: ${formateraValuta(totalSjalvUtanFixVerk)} kr (${formateraValuta(totalSjalvUtanFixVerk / orderAntal)} kr/st)</div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 13px; color: #a1a1aa;">Kundpris återkommande</div>
                <div style="font-size: 22px; font-weight: 700; color: #4ade80;">${formateraValuta(kundPrisUtanFixVerk)} kr</div>
                <div style="font-size: 13px; color: #a1a1aa;">${formateraValuta(kundPrisUtanFixVerk / orderAntal)} kr/st</div>
            </div>
        </div>
    `;

    innehall.innerHTML = html;
    panel.classList.add('visible');
    panel.scrollIntoView({ behavior: 'smooth' });
};