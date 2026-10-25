/* ==========================================================================
   KONEKSI SUPABASE
   ========================================================================== */
const supabaseUrl = 'https://wdhfthzuihakjlygttcw.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkaGZ0aHp1aWhha2pseWd0dGN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NzUxMTEsImV4cCI6MjA4NDI1MTExMX0.GFQfFILjDekr0ugH9-Ux3GhV9Zi3jmnzY5z4YtqV_Bw'; 
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

/* ==========================================================================
   INISIALISASI & MANAJEMEN DATA (FULL ONLINE SUPABASE)
   ========================================================================== */
let db = {
    participants: [],
    costs: [],
    payments: [],
    expenses: [],
    categories: [
        'Tiket Kereta Berangkat', 'Tiket Kereta Pulang', 'Tiket Kereta PP', 'Sewa Bus/Transportasi', 
        'Penginapan/Hotel', 'Pembelian Kaos', 'Tiket Wisata', 'Konsumsi/Makan Minum', 
        'Parkir & Tol', 'Administrasi', 'Lain-lain', 'Diskon/Penyesuaian'
    ]
};

async function loadData() {
    try {
        const [resPart, resCost, resPay, resExp, resCat] = await Promise.all([
            supabaseClient.from('participants').select('*'),
            supabaseClient.from('costs').select('*'),
            supabaseClient.from('payments').select('*'),
            supabaseClient.from('expenses').select('*'),
            supabaseClient.from('categories').select('*')
        ]);

        if (resPart.error) console.error('Error load participants:', resPart.error.message);
        if (resCost.error) console.error('Error load costs:', resCost.error.message);
        if (resPay.error) console.error('Error load payments:', resPay.error.message);
        if (resExp.error) console.error('Error load expenses:', resExp.error.message);

        if (resPart.data && resPart.data.length > 0) {
            db.participants = resPart.data.map(p => ({
                id: p.id,
                name: p.name || p.nama || '',
                family: p.family || p.keluarga || 'None',
                shirt: p.shirt || p.ukuran_kaos || '',
                status: p.status || 'Aktif',
                regDate: p.regDate || p.reg_date || p.created_at || new Date().toISOString()
            }));
        }

        if (resCost.data && resCost.data.length > 0) {
            db.costs = resCost.data.map(c => ({
                id: c.id,
                participantId: c.participantId || c.participant_id || '',
                category: c.category || c.kategori || '',
                price: Number(c.price || c.harga || 0),
                qty: Number(c.qty || 1),
                total: Number(c.total || c.harga || 0),
                notes: c.notes || c.catatan || ''
            }));
        }

        if (resPay.data && resPay.data.length > 0) {
            db.payments = resPay.data.map(p => {
                let parsedAlloc = p.allocations || p.alokasi || [];
                if (typeof parsedAlloc === 'string') {
                    try { parsedAlloc = JSON.parse(parsedAlloc); } catch(e) { parsedAlloc = []; }
                }
                return {
                    id: p.id,
                    date: p.date || p.tanggal || '',
                    name: p.name || p.pembayar || '',
                    amount: Number(p.amount || p.nominal || 0),
                    method: p.method || p.metode || 'Transfer',
                    ref: p.ref || p.referensi || '',
                    notes: p.notes || p.catatan || '',
                    allocations: parsedAlloc
                };
            });
        }

        if (resExp.data && resExp.data.length > 0) {
            db.expenses = resExp.data.map(e => ({
                id: e.id,
                date: e.date || e.tanggal || '',
                category: e.category || e.kategori || '',
                desc: e.desc || e.keterangan || '',
                vendor: e.vendor || e.penerima || '',
                amount: Number(e.amount || e.nominal || 0),
                method: e.method || e.metode || 'Transfer',
                ref: e.ref || '',
                notes: e.notes || ''
            }));
        }

        if (resCat.data && resCat.data.length > 0) {
            db.categories = resCat.data.map(cat => cat.name || cat.kategori);
        }

        console.log("Data berhasil dimuat 100% dari Supabase Cloud!");
    } catch (e) {
        showToast('Gagal memuat data dari internet.', 'danger');
        console.error('Load Data Exception:', e);
    }
}

async function saveData() {
    try {
        if (db.categories && db.categories.length > 0) {
            const catPayload = db.categories.map(c => ({ name: c }));
            const { error } = await supabaseClient.from('categories').upsert(catPayload, { onConflict: 'name' });
            if (error) console.error('Gagal sinkronisasi background kategori:', error.message);
        }
    } catch (e) {
        console.error('Gagal sinkronisasi background', e);
    }
}

function generateId(prefix = 'ID') {
    return prefix + '-' + Date.now().toString() + '-' + Math.floor(Math.random() * 1000);
}

function formatRp(angka) {
    if (isNaN(angka) || angka === null || angka === '') return 'Rp0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(angka));
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ==========================================================================
   PERHITUNGAN INTI (CORE CALCULATOR)
   ========================================================================== */
function calcParticipantStats(participantId) {
    const pCosts = db.costs.filter(c => c.participantId === participantId);
    const totalTagihan = pCosts.reduce((sum, c) => sum + c.total, 0);

    let totalDibayar = 0;
    db.payments.forEach(pay => {
        if (pay.allocations) {
            const alloc = pay.allocations.find(a => a.participantId === participantId);
            if (alloc) totalDibayar += alloc.amount;
        }
    });

    const sisa = totalTagihan - totalDibayar;
    let kelebihan = 0;
    let sisaTagihanAktif = 0;
    let status = 'BELUM BAYAR';
    let badgeClass = 'badge-danger';

    if (sisa === 0 && totalTagihan > 0) {
        status = 'LUNAS';
        badgeClass = 'badge-success';
    } else if (sisa < 0) {
        status = 'KELEBIHAN BAYAR';
        badgeClass = 'badge-info';
        kelebihan = Math.abs(sisa);
    } else if (sisa > 0 && totalDibayar > 0) {
        status = 'CICILAN';
        badgeClass = 'badge-warning';
        sisaTagihanAktif = sisa;
    } else if (sisa > 0) {
        sisaTagihanAktif = sisa;
    } else if (totalTagihan === 0 && totalDibayar === 0) {
        status = 'BELUM ADA TAGIHAN';
        badgeClass = 'badge-secondary';
    }

    return { totalTagihan, totalDibayar, sisa: sisaTagihanAktif, kelebihan, status, badgeClass, rawSisa: sisa };
}

function calcFamilyStats(familyName) {
    const members = db.participants.filter(p => p.family === familyName);
    let fTagihan = 0, fDibayar = 0, fSisa = 0, fKelebihan = 0;
    
    members.forEach(m => {
        const stats = calcParticipantStats(m.id);
        fTagihan += stats.totalTagihan;
        fDibayar += stats.totalDibayar;
        fSisa += stats.sisa;
        fKelebihan += stats.kelebihan;
    });

    return { totalTagihan: fTagihan, totalDibayar: fDibayar, sisa: fSisa, kelebihan: fKelebihan, members };
}

/* ==========================================================================
   KOMPONEN UI, NAVIGASI & HISTORY API (REVISI 4: PWA Native Back Button)
   ========================================================================== */
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { if(toast.parentNode) toast.remove(); }, 3000);
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('show');
    // Mencegah back button langsung keluar aplikasi jika modal terbuka
    history.pushState({ modal: modalId }, '', '#' + modalId);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if(modal && modal.classList.contains('show')) {
        modal.classList.remove('show');
        // Jika hash saat ini adalah modal, kita back agar sinkron
        if(window.location.hash === '#' + modalId) {
            history.back();
        }
    }
}

let confirmCallback = null;
function confirmAction(title, message, callback) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    confirmCallback = callback;
    openModal('modal-confirm');
}

document.getElementById('btn-confirm-cancel').addEventListener('click', () => {
    closeModal('modal-confirm');
    confirmCallback = null;
});

document.getElementById('btn-confirm-ok').addEventListener('click', () => {
    closeModal('modal-confirm');
    if (confirmCallback) confirmCallback();
});

document.querySelectorAll('.btn-close, .btn-secondary').forEach(btn => {
    if(btn.id !== 'btn-confirm-cancel' && btn.id !== 'btn-close-ringkasan-footer') {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) closeModal(modal.id);
        });
    }
});
document.getElementById('btn-close-ringkasan-footer').addEventListener('click', () => closeModal('modal-ringkasan'));

const sidebar = document.getElementById('sidebar');
const mobileMenuBtn = document.getElementById('btn-mobile-menu');
const sidebarOverlay = document.getElementById('sidebar-overlay');

function closeSidebarMobile() {
    if(window.innerWidth <= 768) {
        sidebar.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    }
}

// Fungsi Navigasi View Sentral dengan History API
function switchView(targetId, skipHistory = false) {
    document.querySelectorAll('.nav-link').forEach(nav => {
        nav.classList.remove('active');
        if(nav.getAttribute('data-target') === targetId) nav.classList.add('active');
    });

    document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
    
    const targetView = document.getElementById(targetId);
    if(targetView) targetView.classList.add('active');
    
    const activeNav = document.querySelector(`.nav-link[data-target="${targetId}"]`);
    if(targetId === 'view-dashboard') {
        document.getElementById('page-title').innerHTML = '<span class="topbar-title-main">TOUR MANAGEMENT</span><span class="topbar-title-sub">DAVKA TOUR AND TRAVEL</span>';
    } else if (targetId === 'view-participant-detail') {
        document.getElementById('page-title').textContent = 'Detail Peserta';
    } else if (activeNav) {
        document.getElementById('page-title').textContent = activeNav.textContent;
    }
    
    closeSidebarMobile();
    refreshActiveView(targetId);

    if (!skipHistory) {
        history.pushState({ view: targetId }, '', '#' + targetId);
    }
}

// Event Listener Menu Samping
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = e.target.getAttribute('data-target');
        switchView(targetId);
    });
});

mobileMenuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
});

if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeSidebarMobile);
}

// REVISI 4: Menangani tombol kembali fisik HP Android / Geser iOS (History API Popstate)
window.addEventListener('popstate', (e) => {
    // Cek jika yang sedang terbuka adalah modal, maka tutup modalnya saja
    const openModalEl = document.querySelector('.modal.show');
    if (openModalEl) {
        openModalEl.classList.remove('show');
        return; 
    }

    if (e.state && e.state.view) {
        switchView(e.state.view, true);
        if (e.state.view === 'view-participant-detail' && e.state.detailId) {
            renderDetailParticipant(e.state.detailId);
        }
    } else {
        // Fallback jika tidak ada state (kembali ke dashboard)
        switchView('view-dashboard', true);
    }
});

function refreshActiveView(viewId) {
    switch(viewId) {
        case 'view-dashboard': renderDashboard(); break;
        case 'view-participants': renderParticipants(); break;
        case 'view-costs': renderCostsMaster(); break;
        case 'view-payments': renderPayments(); break;
        case 'view-expenses': renderExpenses(); break;
        case 'view-participant-detail': 
            if(currentDetailId) renderDetailParticipant(currentDetailId); 
            break;
    }
}

function refreshAll() {
    saveData();
    const activeView = document.querySelector('.view-section.active');
    if (activeView) refreshActiveView(activeView.id);
}

function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
/* ==========================================================================
   MODUL 1: DASHBOARD
   ========================================================================== */
function renderDashboard() {
    const activeParticipants = db.participants.filter(p => p.status === 'Aktif');
    const families = [...new Set(activeParticipants.map(p => p.family))].sort();
    
    document.getElementById('dash-total-peserta').textContent = activeParticipants.length;
    document.getElementById('dash-total-keluarga').textContent = families.length;

    let categoryTotals = {};
    let categoryQtys = {}; 
    let usedCategories = new Set();
    
    db.costs.forEach(c => {
        const p = activeParticipants.find(part => part.id === c.participantId);
        if(p) {
            if(!categoryTotals[c.category]) categoryTotals[c.category] = 0;
            if(!categoryQtys[c.category]) categoryQtys[c.category] = 0;
            
            categoryTotals[c.category] += c.total;
            categoryQtys[c.category] += (c.qty || 1); 
            usedCategories.add(c.category);
        }
    });
    
    const usedCatArray = Array.from(usedCategories).sort();
    const catContainer = document.getElementById('dash-summary-categories');
    catContainer.innerHTML = '';
    
    if (usedCatArray.length === 0) {
        catContainer.innerHTML = '<p class="text-muted" style="grid-column: 1/-1;">Belum ada data rincian biaya peserta.</p>';
    } else {
        usedCatArray.forEach(cat => {
            let unitName = 'Item';
            const catLower = cat.toLowerCase();
            
            if (catLower.includes('kaos')) unitName = 'pcs';
            else if (catLower.includes('tiket')) unitName = 'tiket';
            else if (catLower.includes('penginapan') || catLower.includes('hotel')) unitName = 'kamar';
            else if (catLower.includes('bus') || catLower.includes('transportasi')) unitName = 'unit';
            else if (catLower.includes('makan') || catLower.includes('konsumsi')) unitName = 'porsi';

            catContainer.innerHTML += `
                <div class="cat-sum-item">
                    <span class="cat-sum-label">${escapeHTML(cat)}</span>
                    <div class="cat-sum-detail mt-5">
                        <span class="cat-sum-qty">${categoryQtys[cat]} ${unitName}</span>
                        <span class="cat-sum-value">${formatRp(categoryTotals[cat])}</span>
                    </div>
                </div>
            `;
        });
    }

    const filterSelect = document.getElementById('dash-filter-keluarga');
    const currentFilterVal = filterSelect.value;
    filterSelect.innerHTML = '<option value="none">None</option>'; 
    filterSelect.innerHTML += '<option value="">Semua Keluarga</option>';
    families.forEach(f => {
        filterSelect.innerHTML += `<option value="${escapeHTML(f)}">${escapeHTML(f)}</option>`;
    });
    
    if(!currentFilterVal) filterSelect.value = 'none';
    else filterSelect.value = currentFilterVal;

    const theadTr = document.getElementById('dash-table-header');
    let thHtml = `<th>Nama</th><th>Keluarga</th>`;
    usedCatArray.forEach(cat => {
        thHtml += `<th>${escapeHTML(cat)}</th>`;
    });
    thHtml += `<th>Total Biaya</th><th>Aksi</th>`;
    theadTr.innerHTML = thHtml;

    const tbody = document.querySelector('#table-dash-peserta tbody');
    tbody.innerHTML = '';
    const activeFilter = filterSelect.value; 

    activeParticipants.forEach(p => {
        const pCosts = db.costs.filter(c => c.participantId === p.id);
        let pCatTotals = {};
        let pTotalBiaya = 0;
        
        pCosts.forEach(c => {
            if(!pCatTotals[c.category]) pCatTotals[c.category] = 0;
            pCatTotals[c.category] += c.total;
            pTotalBiaya += c.total;
        });
        
        const tr = document.createElement('tr');
        tr.setAttribute('data-family', p.family);
        
        if (activeFilter === 'none') tr.style.display = 'none';
        else if (activeFilter && activeFilter !== p.family) tr.style.display = 'none';
        else tr.style.display = '';

        let tdHtml = `
            <td><strong>${escapeHTML(p.name)}</strong></td>
            <td>${escapeHTML(p.family)}</td>
        `;
        usedCatArray.forEach(cat => {
            tdHtml += `<td>${formatRp(pCatTotals[cat] || 0)}</td>`;
        });
        tdHtml += `
            <td><strong>${formatRp(pTotalBiaya)}</strong></td>
            <td><button class="btn btn-sm btn-outline-primary" onclick="openParticipantDetail('${p.id}')">Detail</button></td>
        `;
        
        tr.innerHTML = tdHtml;
        tbody.appendChild(tr);
    });
}

document.getElementById('dash-filter-keluarga').addEventListener('change', function(e) {
    const family = e.target.value;
    const rows = document.querySelectorAll('#table-dash-peserta tbody tr');
    
    rows.forEach(row => {
        if (family === 'none') row.style.display = 'none'; 
        else if (family === '') row.style.display = ''; 
        else {
            const rowFam = row.getAttribute('data-family');
            row.style.display = (rowFam === family) ? '' : 'none';
        }
    });
});

/* ==========================================================================
   MODUL 3: PESERTA & KELUARGA
   ========================================================================== */
function renderParticipants() {
    const tbody = document.querySelector('#table-participants tbody');
    tbody.innerHTML = '';
    
    const families = [...new Set(db.participants.map(p => p.family))].sort();
    const filterSelect = document.getElementById('filter-participant-family');
    
    filterSelect.innerHTML = '<option value="none">None</option>';
    filterSelect.innerHTML += '<option value="">Semua Keluarga</option>';
    families.forEach(f => {
        filterSelect.innerHTML += `<option value="${escapeHTML(f)}">${escapeHTML(f)}</option>`;
    });

    document.getElementById('filter-participant-name').value = '';
    filterSelect.value = 'none'; 

    db.participants.forEach((p) => {
        const tr = document.createElement('tr');
        tr.style.display = 'none';
        // REVISI 3: Menghapus sel kolom ID Peserta dari tampilan HTML
        tr.innerHTML = `
            <td><strong>${escapeHTML(p.name)}</strong></td>
            <td>${escapeHTML(p.family)}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="openParticipantDetail('${p.id}')">Detail / Biaya</button>
                <button class="btn btn-sm btn-outline-secondary ml-10" onclick="editParticipant('${p.id}')">Edit</button>
                <button class="btn btn-sm btn-danger ml-10" onclick="deleteParticipant('${p.id}')">Hapus</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById('filter-participant-name').addEventListener('input', applyParticipantFilter);
document.getElementById('filter-participant-family').addEventListener('change', applyParticipantFilter);

function applyParticipantFilter() {
    const nameTerm = document.getElementById('filter-participant-name').value.toLowerCase().trim();
    const familyTerm = document.getElementById('filter-participant-family').value;
    const rows = document.querySelectorAll('#table-participants tbody tr');
    
    if (familyTerm === 'none') {
        rows.forEach(row => { row.style.display = 'none'; });
        return;
    }

    rows.forEach(row => {
        // REVISI 3: Karena <th>ID</th> dihapus, indeks `.children` bergeser.
        // children[0] = Nama Lengkap, children[1] = Keluarga.
        const nameMatch = nameTerm === '' || row.children[0].textContent.toLowerCase().includes(nameTerm);
        const familyMatch = familyTerm === '' || row.children[1].textContent === familyTerm;
        row.style.display = (nameMatch && familyMatch) ? '' : 'none';
    });
}

function populateFamilyDatalist() {
    const families = [...new Set(db.participants.map(p => p.family).filter(Boolean))].sort();
    const dropdownList = document.getElementById('family-dropdown-list');
    if (!dropdownList) return;
    
    dropdownList.innerHTML = '';
    
    const liNone = document.createElement('li');
    liNone.className = 'opt-default-none';
    liNone.textContent = 'None';
    liNone.addEventListener('click', (e) => {
        e.stopPropagation();
        selectFamilyOption('None', false);
    });
    dropdownList.appendChild(liNone);

    const liNew = document.createElement('li');
    liNew.className = 'opt-new-family';
    liNew.textContent = '+ Buat Keluarga / Grup Baru...';
    liNew.addEventListener('click', (e) => {
        e.stopPropagation();
        selectFamilyOption('', true);
    });
    dropdownList.appendChild(liNew);

    families.forEach(f => {
        const li = document.createElement('li');
        li.textContent = f;
        li.addEventListener('click', (e) => {
            e.stopPropagation();
            selectFamilyOption(f, false);
        });
        dropdownList.appendChild(li);
    });
}

function selectFamilyOption(val, isNewMode) {
    const familyInput = document.getElementById('part-family');
    const dropdownList = document.getElementById('family-dropdown-list');
    if (!familyInput || !dropdownList) return;

    dropdownList.classList.remove('show');

    if (isNewMode) {
        familyInput.readOnly = false;
        familyInput.value = '';
        familyInput.placeholder = 'Ketik nama keluarga/grup baru...';
        familyInput.focus();
    } else {
        familyInput.readOnly = true;
        familyInput.value = val;
    }
}

(function setupFamilyComboEvents() {
    const familyInput = document.getElementById('part-family');
    const familyArrow = document.getElementById('family-combo-arrow');
    const dropdownList = document.getElementById('family-dropdown-list');
    const comboWrapper = document.getElementById('family-combo-wrapper');

    if (!familyInput || !dropdownList) return;

    familyInput.addEventListener('click', (e) => {
        if (familyInput.readOnly) {
            e.stopPropagation();
            populateFamilyDatalist();
            dropdownList.classList.toggle('show');
        }
    });

    if (familyArrow) {
        familyArrow.addEventListener('click', (e) => {
            e.stopPropagation();
            populateFamilyDatalist();
            dropdownList.classList.toggle('show');
        });
    }

    document.addEventListener('click', (e) => {
        if (comboWrapper && !comboWrapper.contains(e.target)) {
            dropdownList.classList.remove('show');
        }
    });
})();

function addParticipantRow(name = '', shirt = '') {
    const container = document.getElementById('participant-dynamic-container');
    const rowId = 'part-row-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    
    const rowHTML = `
        <div class="dynamic-row part-dynamic-row" id="${rowId}">
            <div class="form-group col-name">
                <label>Nama Lengkap *</label>
                <input type="text" class="form-control part-name-input" value="${escapeHTML(name)}" required placeholder="Ketik nama...">
            </div>
            <div class="form-group col-shirt">
                <label>Ukuran Kaos</label>
                <select class="form-control part-shirt-input">
                    <option value="" ${shirt === '' ? 'selected' : ''}>Tidak ada/Belum tahu</option>
                    <option value="S" ${shirt === 'S' ? 'selected' : ''}>S</option>
                    <option value="M" ${shirt === 'M' ? 'selected' : ''}>M</option>
                    <option value="L" ${shirt === 'L' ? 'selected' : ''}>L</option>
                    <option value="XL" ${shirt === 'XL' ? 'selected' : ''}>XL</option>
                    <option value="XXL" ${shirt === 'XXL' ? 'selected' : ''}>XXL</option>
                    <option value="XXXL" ${shirt === 'XXXL' ? 'selected' : ''}>XXXL</option>
                </select>
            </div>
            <div class="form-group col-action">
                <button type="button" class="btn btn-outline-danger btn-sm w-100 btn-remove-part-row" onclick="removeParticipantRow('${rowId}')">&times; Hapus</button>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', rowHTML);
    updateParticipantRemoveButtons();
}

window.removeParticipantRow = function(rowId) {
    const row = document.getElementById(rowId);
    if(row) row.remove();
    updateParticipantRemoveButtons();
}

function updateParticipantRemoveButtons() {
    const rows = document.querySelectorAll('.part-dynamic-row');
    const btns = document.querySelectorAll('.btn-remove-part-row');
    if (rows.length <= 1) btns.forEach(btn => btn.style.display = 'none');
    else btns.forEach(btn => btn.style.display = 'block');
}

document.getElementById('btn-add-participant-row').addEventListener('click', () => {
    addParticipantRow();
});

document.getElementById('btn-add-participant').addEventListener('click', () => {
    document.getElementById('form-participant').reset();
    document.getElementById('part-id').value = '';
    document.getElementById('participant-form-title').textContent = 'Tambah Peserta';
    
    populateFamilyDatalist();
    selectFamilyOption('None', false);
    
    document.getElementById('participant-dynamic-container').innerHTML = '';
    addParticipantRow();
    
    document.getElementById('btn-add-participant-row').style.display = 'block';
    openModal('modal-participant-form');
});

document.getElementById('form-participant').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('part-id').value;
    const finalFamily = document.getElementById('part-family').value.trim();
    
    if (!finalFamily || finalFamily.toLowerCase() === 'none') {
        showToast('Silakan pilih nama keluarga/grup atau buat keluarga baru!', 'warning');
        return;
    }

    const rows = document.querySelectorAll('.part-dynamic-row');
    let addedCount = 0;

    if (id) {
        const nameInput = rows[0].querySelector('.part-name-input').value.trim();
        const shirtInput = rows[0].querySelector('.part-shirt-input').value;
        
        const index = db.participants.findIndex(p => p.id === id);
        if (index > -1) {
            const updatedPart = {
                id: id,
                name: nameInput,
                family: finalFamily,
                shirt: shirtInput,
                status: db.participants[index].status || 'Aktif',
                regDate: db.participants[index].regDate || new Date().toISOString()
            };

            const { error } = await supabaseClient.from('participants').upsert([updatedPart]);
            if (error) {
                showToast('Gagal mengubah ke Supabase: ' + error.message, 'danger');
                return;
            }

            db.participants[index] = updatedPart;
            showToast('Data peserta berhasil diubah.');
        }
    } else {
        let newRecords = [];
        rows.forEach(row => {
            const nameInput = row.querySelector('.part-name-input').value.trim();
            const shirtInput = row.querySelector('.part-shirt-input').value;
            
            if (nameInput) {
                newRecords.push({
                    id: generateId('PRT'),
                    name: nameInput,
                    family: finalFamily,
                    shirt: shirtInput,
                    status: 'Aktif',
                    regDate: new Date().toISOString()
                });
                addedCount++;
            }
        });
        
        if (newRecords.length > 0) {
            const { error } = await supabaseClient.from('participants').insert(newRecords);
            if (error) {
                showToast('Gagal menyimpan ke Supabase: ' + error.message, 'danger');
                return;
            }
            db.participants.push(...newRecords);
            showToast(`${addedCount} Peserta baru berhasil disimpan ke server cloud.`);
        }
    }
    
    closeModal('modal-participant-form');
    refreshAll();
});

window.editParticipant = function(id) {
    const p = db.participants.find(x => x.id === id);
    if(!p) return;
    
    populateFamilyDatalist();
    
    document.getElementById('part-id').value = p.id;
    selectFamilyOption(p.family, false);
    
    document.getElementById('participant-dynamic-container').innerHTML = '';
    addParticipantRow(p.name, p.shirt);
    
    document.getElementById('btn-add-participant-row').style.display = 'none';
    document.getElementById('participant-form-title').textContent = 'Edit Peserta';
    openModal('modal-participant-form');
}

window.deleteParticipant = function(id) {
    const hasPayment = db.payments.some(pay => pay.allocations && pay.allocations.some(a => a.participantId === id));
    if (hasPayment) {
        alert('Gagal! Peserta ini sudah memiliki riwayat pembayaran. Batalkan pembayarannya terlebih dahulu.');
        return;
    }
    
    confirmAction('Hapus Peserta', 'Yakin ingin menghapus peserta ini dari Cloud? Seluruh rincian biayanya juga akan terhapus permanen.', async () => {
        const { error: errPart } = await supabaseClient.from('participants').delete().eq('id', id);
        const { error: errCost } = await supabaseClient.from('costs').delete().eq('participantId', id);
        
        if (errPart || errCost) {
            showToast('Gagal menghapus dari Supabase. Silakan coba lagi.', 'danger');
            return;
        }

        db.participants = db.participants.filter(p => p.id !== id);
        db.costs = db.costs.filter(c => c.participantId !== id);
        showToast('Peserta berhasil dihapus.');
        refreshAll();
    });
}
/* ==========================================================================
   MODUL 4: DETAIL PESERTA & CETAK RINGKASAN (JPEG)
   ========================================================================== */
let currentDetailId = null;

// REVISI 4: Navigasi ke Detail Peserta Menggunakan History API
window.openParticipantDetail = function(id) {
    currentDetailId = id;
    switchView('view-participant-detail', true); // skip default history
    history.pushState({ view: 'view-participant-detail', detailId: id }, '', '#detail-' + id);
    renderDetailParticipant(id);
}

function renderDetailParticipant(id) {
    if(!id) return;
    const p = db.participants.find(x => x.id === id);
    if(!p) return;

    const stats = calcParticipantStats(id);

    document.getElementById('detail-part-name').textContent = p.name;
    document.getElementById('detail-part-family').textContent = p.family;
    // REVISI 3: ID Peserta tidak lagi dirender di UI detail
    
    const badge = document.getElementById('detail-part-status-badge');
    badge.textContent = stats.status;
    badge.className = `badge ${stats.badgeClass}`;

    document.getElementById('detail-total-tagihan').textContent = formatRp(stats.totalTagihan);
    document.getElementById('detail-total-dibayar').textContent = formatRp(stats.totalDibayar);
    
    if (stats.kelebihan > 0) {
        document.getElementById('detail-sisa-tagihan').textContent = `+${formatRp(stats.kelebihan)} (Lebih)`;
        document.getElementById('detail-sisa-tagihan').className = 'stat-value text-info';
    } else {
        document.getElementById('detail-sisa-tagihan').textContent = formatRp(stats.sisa);
        document.getElementById('detail-sisa-tagihan').className = 'stat-value text-danger';
    }

    const tbodyCosts = document.querySelector('#table-detail-costs tbody');
    tbodyCosts.innerHTML = '';
    const pCosts = db.costs.filter(c => c.participantId === id);
    pCosts.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHTML(c.category)}</td>
            <td>${formatRp(c.price)}</td>
            <td>${c.qty}</td>
            <td><strong>${formatRp(c.total)}</strong></td>
            <td>${escapeHTML(c.notes || '-')}</td>
            <td>
                <button class="btn btn-sm btn-outline-secondary" onclick="openEditCostModal('${c.id}')">Edit</button>
                <button class="btn btn-sm btn-danger ml-5" onclick="deleteCost('${c.id}', true)">&times;</button>
            </td>
        `;
        tbodyCosts.appendChild(tr);
    });
    document.getElementById('detail-sum-costs').textContent = formatRp(stats.totalTagihan);

    const tbodyPays = document.querySelector('#table-detail-payments tbody');
    tbodyPays.innerHTML = '';
    let hasPayment = false;
    db.payments.forEach(pay => {
        if(pay.allocations) {
            const alloc = pay.allocations.find(a => a.participantId === id);
            if(alloc) {
                hasPayment = true;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${formatDate(pay.date)}</td>
                    <td class="text-success text-bold">${formatRp(alloc.amount)}</td>
                    <td>${escapeHTML(pay.method)}</td>
                    <td>${escapeHTML(pay.notes || '-')}</td>
                `;
                tbodyPays.appendChild(tr);
            }
        }
    });
    if(!hasPayment) tbodyPays.innerHTML = '<tr><td colspan="4" class="text-center">Belum ada riwayat pembayaran.</td></tr>';
}

window.openEditCostModal = function(costId) {
    const cost = db.costs.find(c => c.id === costId);
    if(!cost) return;

    const catSelect = document.getElementById('edit-cost-cat');
    catSelect.innerHTML = '';
    db.categories.forEach(cat => {
        catSelect.innerHTML += `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`;
    });

    document.getElementById('edit-cost-id').value = cost.id;
    document.getElementById('edit-cost-cat').value = cost.category;
    document.getElementById('edit-cost-price').value = cost.price;
    document.getElementById('edit-cost-notes').value = cost.notes || '';

    openModal('modal-edit-cost');
};

document.getElementById('form-edit-cost').addEventListener('submit', async (e) => {
    e.preventDefault();
    const costId = document.getElementById('edit-cost-id').value;
    const newCat = document.getElementById('edit-cost-cat').value;
    const newPrice = parseFloat(document.getElementById('edit-cost-price').value) || 0;
    const newNotes = document.getElementById('edit-cost-notes').value.trim();

    const costIndex = db.costs.findIndex(c => c.id === costId);
    if(costIndex > -1) {
        const updatedCost = {
            ...db.costs[costIndex],
            category: newCat,
            price: newPrice,
            total: newPrice * (db.costs[costIndex].qty || 1),
            notes: newNotes
        };

        const { error } = await supabaseClient.from('costs').upsert([updatedCost]);
        if (error) {
            showToast('Gagal memperbarui rincian biaya: ' + error.message, 'danger');
            return;
        }

        db.costs[costIndex] = updatedCost;
        showToast('Rincian biaya berhasil diperbarui.');
        closeModal('modal-edit-cost');
        refreshAll();
    }
});

document.getElementById('btn-add-cost-from-detail').addEventListener('click', () => {
    prepareIndividualCostForm(currentDetailId);
});

// REVISI 1: Penyederhanaan Desain Cetak menjadi Mobile-Friendly (Portrait Card) 100% width
const getPrintStyles = () => `
    <style>
        .print-wrap { width: 100%; max-width: 450px; margin: 0 auto; padding: 15px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #ffffff; color: #334155; box-sizing: border-box; }
        .print-header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px; }
        .print-header h2 { margin: 0; color: #0369a1; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
        .print-header p { margin: 5px 0 0; font-size: 14px; color: #0f172a; font-weight: 700; text-transform: uppercase; }
        .print-info { width: 100%; margin-bottom: 15px; font-size: 13px; }
        .print-info td { padding: 4px 0; vertical-align: top; }
        .print-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px; }
        .print-table th, .print-table td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; }
        .print-table th { background-color: #f1f5f9; font-weight: bold; color: #0f172a; }
        .print-table tr:nth-child(even) { background-color: #f8fafc; }
        .text-right { text-align: right !important; }
        .text-center { text-align: center !important; }
        .text-success { color: #16a34a; font-weight: bold; }
        .text-danger { color: #dc2626; font-weight: bold; }
        .text-info { color: #0284c7; font-weight: bold; }
        .text-bold { font-weight: bold; }
        .print-summary { background: #f8fafc; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; }
        .print-summary p { margin: 4px 0; font-size: 13px; }
        .print-footer { margin-top: 15px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
    </style>
`;

document.getElementById('btn-print-individual').addEventListener('click', () => {
    const p = db.participants.find(x => x.id === currentDetailId);
    const stats = calcParticipantStats(p.id);
    const pCosts = db.costs.filter(c => c.participantId === p.id);
    
    let html = getPrintStyles() + `<div class="print-wrap">`;
    html += `
        <div class="print-header">
            <h2>DAVKA TOUR AND TRAVEL</h2>
            <p>Rincian Biaya Individu</p>
        </div>
        <table class="print-info">
            <tr><td style="width: 100px;"><strong>Peserta</strong></td><td>: ${escapeHTML(p.name)}</td></tr>
            <tr><td><strong>Grup/Klg</strong></td><td>: ${escapeHTML(p.family)}</td></tr>
            <tr><td><strong>Status</strong></td><td>: <strong>${stats.status}</strong></td></tr>
        </table>
        
        <div class="text-bold" style="margin-bottom: 5px; font-size:13px;">A. Rincian Biaya</div>
        <table class="print-table">
            <thead>
                <tr>
                    <th>Item / Kategori</th>
                    <th class="text-right">Biaya (Rp)</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    if(pCosts.length === 0) {
        html += `<tr><td colspan="2" class="text-center text-muted">Belum ada tagihan</td></tr>`;
    } else {
        pCosts.forEach(c => {
            let noteStr = c.notes ? `<br><small style="color:#64748b;">${escapeHTML(c.notes)}</small>` : '';
            html += `<tr>
                <td>${escapeHTML(c.category)} ${c.qty > 1 ? `(${c.qty}x)` : ''}${noteStr}</td>
                <td class="text-right">${formatRp(c.total)}</td>
            </tr>`;
        });
    }
    
    html += `</tbody></table>`;
    html += `<div class="text-bold" style="margin-bottom: 5px; font-size:13px;">B. Pembayaran</div>
        <table class="print-table">
            <thead>
                <tr>
                    <th>Tanggal</th>
                    <th class="text-right">Nominal (Rp)</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    let payCount = 0;
    db.payments.forEach(pay => {
        if(pay.allocations) {
            const alloc = pay.allocations.find(a => a.participantId === p.id);
            if(alloc) {
                html += `<tr>
                    <td>${formatDate(pay.date)}</td>
                    <td class="text-right text-success">${formatRp(alloc.amount)}</td>
                </tr>`;
                payCount++;
            }
        }
    });
    if(payCount === 0) html += `<tr><td colspan="2" class="text-center text-muted">Belum ada pembayaran</td></tr>`;
    html += `</tbody></table>`;
    
    html += `
        <div class="print-summary">
            <p>Total Biaya: <span style="float:right;">${formatRp(stats.totalTagihan)}</span></p>
            <p>Total Dibayar: <span style="float:right;" class="text-success">${formatRp(stats.totalDibayar)}</span></p>
            <hr style="border:0; border-top:1px solid #cbd5e1; margin:8px 0;">
    `;
    
    if(stats.kelebihan > 0) {
        html += `<p class="text-bold">Kelebihan: <span style="float:right;" class="text-info">${formatRp(stats.kelebihan)}</span></p>`;
    } else {
        html += `<p class="text-bold">Sisa Dibayar: <span style="float:right;" class="text-danger">${formatRp(stats.sisa)}</span></p>`;
    }
    
    html += `</div>
        <div class="print-footer">Sistem Manajemen Davka Tour & Travel</div>
    </div>`;

    document.getElementById('ringkasan-print-area').innerHTML = html;
    openModal('modal-ringkasan');
});

document.getElementById('btn-print-family').addEventListener('click', () => {
    const p = db.participants.find(x => x.id === currentDetailId);
    const fStats = calcFamilyStats(p.family);
    
    let html = getPrintStyles() + `<div class="print-wrap">`;
    html += `
        <div class="print-header">
            <h2>DAVKA TOUR AND TRAVEL</h2>
            <p>Rincian Biaya Keluarga</p>
        </div>
        <table class="print-info">
            <tr><td style="width: 100px;"><strong>Keluarga</strong></td><td>: ${escapeHTML(p.family)}</td></tr>
            <tr><td><strong>Anggota</strong></td><td>: ${fStats.members.length} Orang</td></tr>
        </table>
        
        <table class="print-table">
            <thead>
                <tr>
                    <th>Nama & Status</th>
                    <th class="text-right">Biaya (Rp)</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    fStats.members.forEach((m) => {
        const stats = calcParticipantStats(m.id);
        let sisaStr = stats.kelebihan > 0 ? `<span class="text-info">Lebih: ${formatRp(stats.kelebihan)}</span>` : `<span class="text-danger">Sisa: ${formatRp(stats.sisa)}</span>`;
        html += `<tr>
            <td><strong>${escapeHTML(m.name)}</strong><br><small style="color:#64748b;">${stats.status}</small></td>
            <td class="text-right">
                B: ${formatRp(stats.totalTagihan)}<br>
                P: <span class="text-success">${formatRp(stats.totalDibayar)}</span><br>
                ${sisaStr}
            </td>
        </tr>`;
    });
    
    html += `</tbody></table>`;
    html += `
        <div class="print-summary" style="margin-top:15px;">
            <p><strong>REKAP KELUARGA:</strong></p>
            <p>Total Biaya: <span style="float:right;">${formatRp(fStats.totalTagihan)}</span></p>
            <p>Total Dibayar: <span style="float:right;" class="text-success">${formatRp(fStats.totalDibayar)}</span></p>
            <hr style="border:0; border-top:1px solid #cbd5e1; margin:8px 0;">
    `;
    
    if(fStats.kelebihan > 0) {
        html += `<p class="text-bold" style="font-size:14px;">Total Kelebihan: <span style="float:right;" class="text-info">${formatRp(fStats.kelebihan)}</span></p>`;
    } else {
        html += `<p class="text-bold" style="font-size:14px;">TOTAL SISA: <span style="float:right;" class="text-danger">${formatRp(fStats.sisa)}</span></p>`;
    }
    
    html += `</div>
        <div class="print-footer">Sistem Manajemen Davka Tour & Travel</div>
    </div>`;

    document.getElementById('ringkasan-print-area').innerHTML = html;
    openModal('modal-ringkasan');
});

document.getElementById('btn-download-jpeg').addEventListener('click', async () => {
    const btn = document.getElementById('btn-download-jpeg');
    const printArea = document.getElementById('ringkasan-print-area');
    // Cari elemen pembungkus .print-wrap
    const targetEl = printArea.querySelector('.print-wrap') || printArea;

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Memproses...';

    try {
        if (typeof html2canvas === 'function') {
            // REVISI 1: Menyesuaikan setting canvas untuk ukuran Mobile-Friendly
            const canvas = await html2canvas(targetEl, {
                scale: 2, 
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                width: targetEl.offsetWidth, 
                windowWidth: 450, 
                onclone: (clonedDoc) => {
                    const clonedWrap = clonedDoc.querySelector('#ringkasan-print-area .print-wrap');
                    if (clonedWrap) {
                        clonedWrap.style.width = '100%';
                        clonedWrap.style.maxWidth = '450px';
                        clonedWrap.style.margin = '0';
                    }
                }
            });

            const jpegUrl = canvas.toDataURL('image/jpeg', 0.95);
            const link = document.createElement('a');
            link.download = `Ringkasan_Pembayaran_${Date.now()}.jpg`;
            link.href = jpegUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showToast('Berhasil mengunduh gambar JPEG!');
        } else {
            throw new Error('Library html2canvas belum siap.');
        }
    } catch (err) {
        console.error('Download JPEG Error:', err);
        showToast('Gagal memproses gambar.', 'danger');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
});
/* ==========================================================================
   MODUL 5: MANAJEMEN BIAYA & ALOKASI BIAYA
   ========================================================================== */
function renderCostsMaster() {
    renderCategoryTags();
}

function renderCategoryTags() {
    const container = document.getElementById('cost-category-tags');
    container.innerHTML = '';
    db.categories.forEach(cat => {
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.innerHTML = `
            ${escapeHTML(cat)} 
            <button type="button" class="tag-btn-del" onclick="deleteCategory('${escapeHTML(cat)}')">&times;</button>
        `;
        container.appendChild(tag);
    });
    
    const optHtml = db.categories.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
    document.getElementById('cost-shared-category').innerHTML = optHtml;
}

document.getElementById('form-add-category').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('new-category-name');
    const val = input.value.trim();
    if(val && !db.categories.includes(val)) {
        const { error } = await supabaseClient.from('categories').upsert([{ name: val }]);
        if (error) {
            showToast('Gagal menambahkan kategori: ' + error.message, 'danger');
            return;
        }

        db.categories.push(val);
        input.value = '';
        renderCategoryTags();
        saveData();
    }
});

window.deleteCategory = async function(cat) {
    if(confirm(`Hapus kategori "${cat}"?`)) {
        const { error } = await supabaseClient.from('categories').delete().eq('name', cat);
        if (error) {
            showToast('Gagal menghapus kategori: ' + error.message, 'danger');
            return;
        }

        db.categories = db.categories.filter(c => c !== cat);
        renderCategoryTags();
        saveData();
    }
}

document.getElementById('btn-open-cost-individual').addEventListener('click', () => prepareIndividualCostForm(null));

function prepareIndividualCostForm(preselectedId) {
    document.getElementById('form-cost-ind').reset();
    document.getElementById('cost-ind-id').value = '';
    
    const familySelect = document.getElementById('cost-ind-family');
    const partSelect = document.getElementById('cost-ind-participant');
    const dynamicContainer = document.getElementById('cost-ind-dynamic-container');
    
    familySelect.innerHTML = '<option value="">-- Pilih Keluarga --</option>';
    partSelect.innerHTML = '<option value="">-- Pilih Peserta --</option>';
    partSelect.disabled = true;
    
    const activeParticipants = db.participants.filter(p => p.status === 'Aktif');
    const families = [...new Set(activeParticipants.map(p => p.family))].sort();
    
    families.forEach(f => {
        familySelect.innerHTML += `<option value="${escapeHTML(f)}">${escapeHTML(f)}</option>`;
    });

    dynamicContainer.innerHTML = '';
    addCostRow(); 
    calculateIndTotal();
    
    if (preselectedId) {
        const p = activeParticipants.find(x => x.id === preselectedId);
        if (p) {
            familySelect.value = p.family;
            familySelect.dispatchEvent(new Event('change')); 
            partSelect.value = preselectedId;
        }
    }
    openModal('modal-cost-individual');
}

document.getElementById('cost-ind-family').addEventListener('change', function(e) {
    const family = e.target.value;
    const partSelect = document.getElementById('cost-ind-participant');
    partSelect.innerHTML = '<option value="">-- Pilih Peserta --</option>';
    
    if (family) {
        const members = db.participants.filter(p => p.family === family && p.status === 'Aktif')
                                       .sort((a,b) => a.name.localeCompare(b.name));
        members.forEach(m => {
            partSelect.innerHTML += `<option value="${m.id}">${escapeHTML(m.name)}</option>`;
        });
        partSelect.disabled = false;
    } else {
        partSelect.disabled = true;
    }
});

function addCostRow() {
    const container = document.getElementById('cost-ind-dynamic-container');
    const rowId = 'row-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    
    let catOptions = '';
    db.categories.forEach(c => {
        catOptions += `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`;
    });

    const rowHTML = `
        <div class="dynamic-row cost-dynamic-row" id="${rowId}">
            <div class="form-group">
                <label>Kategori Biaya</label>
                <select class="form-control cost-ind-cat-input" required>
                    ${catOptions}
                </select>
            </div>
            <div class="form-group col-price">
                <label>Harga (Rp)</label>
                <input type="number" class="form-control cost-ind-price-input" required step="1" placeholder="0">
            </div>
            <div class="form-group col-action">
                <button type="button" class="btn btn-outline-danger btn-sm w-100" onclick="removeCostRow('${rowId}')">&times; Hapus</button>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', rowHTML);
    
    const newInputs = container.querySelectorAll(`#${rowId} .cost-ind-price-input`);
    newInputs.forEach(inp => {
        inp.addEventListener('input', calculateIndTotal);
    });
}

document.getElementById('btn-add-cost-row').addEventListener('click', addCostRow);

window.removeCostRow = function(rowId) {
    const row = document.getElementById(rowId);
    if(row) row.remove();
    calculateIndTotal();
}

function calculateIndTotal() {
    let sum = 0;
    const inputs = document.querySelectorAll('#cost-ind-dynamic-container .cost-ind-price-input');
    inputs.forEach(inp => {
        sum += parseFloat(inp.value) || 0;
    });
    document.getElementById('cost-ind-total-sum').textContent = formatRp(sum);
}

document.getElementById('form-cost-ind').addEventListener('submit', async (e) => {
    e.preventDefault();
    const familyVal = document.getElementById('cost-ind-family').value;
    const pId = document.getElementById('cost-ind-participant').value;
    
    if(!familyVal || !pId) {
        showToast('Silakan pilih Keluarga dan Peserta terlebih dahulu!', 'warning');
        return;
    }
    
    const rows = document.querySelectorAll('#cost-ind-dynamic-container .dynamic-row');
    if(rows.length === 0) {
        showToast('Minimal harus ada 1 kategori biaya!', 'danger');
        return;
    }
    
    let newCosts = [];
    rows.forEach(row => {
        const catEl = row.querySelector('.cost-ind-cat-input');
        const priceEl = row.querySelector('.cost-ind-price-input');
        if (!catEl || !priceEl) return;

        const cat = catEl.value;
        const price = parseFloat(priceEl.value) || 0;
        
        if (cat && price > 0) {
            newCosts.push({
                id: generateId('CST'),
                participantId: pId,
                category: cat,
                price: price,
                qty: 1, 
                total: price,
                notes: "" 
            });
        }
    });
    
    if (newCosts.length > 0) {
        const { error } = await supabaseClient.from('costs').insert(newCosts);
        if (error) {
            showToast('Gagal menyimpan biaya ke Supabase: ' + error.message, 'danger');
            return;
        }
        db.costs.push(...newCosts);
        showToast(`Berhasil menambahkan ${newCosts.length} rincian biaya ke cloud.`);
        closeModal('modal-cost-individual');
        refreshAll();
    }
});

window.deleteCost = async function(id, isFromDetail = false) {
    confirmAction('Hapus Biaya', 'Hapus komponen tagihan ini dari peserta?', async () => {
        const { error } = await supabaseClient.from('costs').delete().eq('id', id);
        if (error) {
            showToast('Gagal menghapus biaya dari cloud: ' + error.message, 'danger');
            return;
        }

        db.costs = db.costs.filter(c => c.id !== id);
        showToast('Biaya berhasil dihapus.');
        refreshAll();
    });
}

document.getElementById('btn-open-cost-shared').addEventListener('click', () => {
    document.getElementById('form-cost-shared').reset();
    document.getElementById('cost-shared-search').value = '';
    document.getElementById('shared-allocated-sum').textContent = 'Rp0';
    document.getElementById('shared-diff-alert').style.display = 'none';
    
    renderSharedParticipantTable();
    openModal('modal-cost-shared');
});

function renderSharedParticipantTable() {
    const tbody = document.querySelector('#table-shared-participants tbody');
    tbody.innerHTML = '';
    const active = db.participants.filter(p => p.status === 'Aktif');
    
    active.forEach(p => {
        const tr = document.createElement('tr');
        tr.style.display = 'none';
        tr.innerHTML = `
            <td><input type="checkbox" class="chk-shared" data-id="${p.id}" value="${p.id}"></td>
            <td>${escapeHTML(p.name)}</td>
            <td>${escapeHTML(p.family)}</td>
            <td><input type="number" class="form-control input-sm shared-input" data-id="${p.id}" value="0" readonly step="1"></td>
        `;
        tbody.appendChild(tr);
    });
    
    document.getElementById('chk-all-shared').checked = false;
    attachSharedEvents();
}

function attachSharedEvents() {
    document.getElementById('chk-all-shared').addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const visibleRows = document.querySelectorAll('#table-shared-participants tbody tr:not([style*="display: none"]) .chk-shared');
        visibleRows.forEach(chk => { chk.checked = isChecked; });
        calculateSharedSplit();
    });
    
    document.querySelectorAll('.chk-shared').forEach(chk => {
        chk.addEventListener('change', calculateSharedSplit);
    });
    
    document.getElementById('cost-shared-total').addEventListener('input', calculateSharedSplit);
    
    document.getElementById('cost-shared-method').addEventListener('change', (e) => {
        const isManual = e.target.value === 'manual';
        document.querySelectorAll('.shared-input').forEach(input => {
            input.readOnly = !isManual;
        });
        calculateSharedSplit();
    });
    
    document.querySelectorAll('.shared-input').forEach(input => {
        input.addEventListener('input', calculateSharedManualSum);
    });
    
    document.getElementById('cost-shared-search').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const rows = document.querySelectorAll('#table-shared-participants tbody tr');
        rows.forEach(row => {
            const checkbox = row.querySelector('.chk-shared');
            const isChecked = checkbox && checkbox.checked;
            const text = row.children[1].textContent.toLowerCase() + " " + row.children[2].textContent.toLowerCase();
            
            if (isChecked) {
                row.style.display = ''; 
            } else if (term === '') {
                row.style.display = 'none'; 
            } else {
                row.style.display = text.includes(term) ? '' : 'none';
            }
        });
    });
}

function calculateSharedSplit() {
    const method = document.getElementById('cost-shared-method').value;
    if(method === 'manual') {
        calculateSharedManualSum();
        return;
    }
    
    const totalInput = parseFloat(document.getElementById('cost-shared-total').value) || 0;
    const checkedBoxes = Array.from(document.querySelectorAll('.chk-shared:checked'));
    const count = checkedBoxes.length;
    
    document.querySelectorAll('.shared-input').forEach(i => i.value = 0);
    
    if (count > 0 && totalInput > 0) {
        const base = Math.floor(totalInput / count);
        const remainder = totalInput % count;
        
        checkedBoxes.forEach((chk, idx) => {
            const input = document.querySelector(`.shared-input[data-id="${chk.value}"]`);
            input.value = base + (idx < remainder ? 1 : 0); 
        });
    }
    calculateSharedManualSum();
}

function calculateSharedManualSum() {
    let sum = 0;
    document.querySelectorAll('.chk-shared').forEach(chk => {
        const input = document.querySelector(`.shared-input[data-id="${chk.value}"]`);
        if (chk.checked) {
            sum += parseFloat(input.value) || 0;
        } else {
            input.value = 0; 
        }
    });
    
    document.getElementById('shared-allocated-sum').textContent = formatRp(sum);
    const targetTotal = parseFloat(document.getElementById('cost-shared-total').value) || 0;
    const alertBox = document.getElementById('shared-diff-alert');
    
    if (sum !== targetTotal && targetTotal > 0) {
        alertBox.style.display = 'block';
        alertBox.textContent = `Selisih: ${formatRp(Math.abs(targetTotal - sum))} (Harus pas!)`;
    } else {
        alertBox.style.display = 'none';
    }
}

document.getElementById('form-cost-shared').addEventListener('submit', async (e) => {
    e.preventDefault();
    const targetTotal = parseFloat(document.getElementById('cost-shared-total').value) || 0;
    let sum = 0;
    const allocs = [];
    
    document.querySelectorAll('.chk-shared:checked').forEach(chk => {
        const input = document.querySelector(`.shared-input[data-id="${chk.value}"]`);
        const val = parseFloat(input.value) || 0;
        if (val > 0) {
            sum += val;
            allocs.push({ pId: chk.value, amount: val });
        }
    });
    
    if (allocs.length === 0 || sum !== targetTotal) {
        showToast('Total alokasi harus pas dengan Total Biaya!', 'danger');
        return;
    }
    
    const cat = document.getElementById('cost-shared-category').value;
    let newCosts = allocs.map(a => ({
        id: generateId('CST'),
        participantId: a.pId,
        category: cat,
        price: a.amount,
        qty: 1,
        total: a.amount,
        notes: 'Biaya Bersama'
    }));

    const { error } = await supabaseClient.from('costs').insert(newCosts);
    if (error) {
        showToast('Gagal membagi dan menyimpan biaya: ' + error.message, 'danger');
        return;
    }

    db.costs.push(...newCosts);
    showToast(`Berhasil membagi biaya ke ${allocs.length} peserta.`);
    closeModal('modal-cost-shared');
    refreshAll();
});

/* ==========================================================================
   MODUL 6: PEMBAYARAN KAS & ALOKASI
   ========================================================================== */
function renderPayments() {
    const tbody = document.querySelector('#table-payments tbody');
    tbody.innerHTML = '';
    
    const sorted = [...db.payments].sort((a,b) => new Date(b.date) - new Date(a.date));
    
    sorted.forEach(pay => {
        const sumAlloc = pay.allocations ? pay.allocations.reduce((s, a) => s + a.amount, 0) : 0;
        const unalloc = pay.amount - sumAlloc;
        
        const tr = document.createElement('tr');
        if (unalloc > 0) tr.classList.add('bg-warning-light');
        
        tr.innerHTML = `
            <td>${formatDate(pay.date)}</td>
            <td><strong>${escapeHTML(pay.name)}</strong></td>
            <td class="text-success text-bold">${formatRp(pay.amount)}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editPaymentAllocation('${pay.id}')">Edit / Alokasi</button>
                <button class="btn btn-sm btn-danger ml-10" onclick="deletePayment('${pay.id}')">Hapus</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById('filter-payment').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#table-payments tbody tr');
    rows.forEach(row => {
        const text = row.children[1].textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
    });
});

document.getElementById('pay-method').addEventListener('change', function(e) {
    const bankDetails = document.getElementById('pay-bank-details');
    if (this.value === 'Tunai') {
        bankDetails.style.display = 'none';
    } else {
        bankDetails.style.display = '';
    }
});

document.getElementById('btn-add-payment').addEventListener('click', () => {
    document.getElementById('form-payment').reset();
    document.getElementById('pay-id').value = '';
    document.getElementById('pay-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('payment-form-title').textContent = 'Penerimaan Uang Baru';
    
    const families = [...new Set(db.participants.map(p => p.family))].sort();
    const selectName = document.getElementById('pay-name');
    selectName.innerHTML = '<option value="">-- Pilih Keluarga / Grup --</option>';
    families.forEach(f => {
        selectName.innerHTML += `<option value="${escapeHTML(f)}">${escapeHTML(f)}</option>`;
    });

    const selectFilterFamily = document.getElementById('pay-filter-family');
    selectFilterFamily.innerHTML = '<option value="none">None</option>';
    selectFilterFamily.innerHTML += '<option value="">Semua Keluarga</option>';
    families.forEach(f => {
        selectFilterFamily.innerHTML += `<option value="${escapeHTML(f)}">${escapeHTML(f)}</option>`;
    });
    selectFilterFamily.value = 'none';

    document.getElementById('pay-method').dispatchEvent(new Event('change'));
    renderPaymentAllocTable();
    updatePaymentSummary();
    openModal('modal-payment-form');
});

document.getElementById('pay-filter-family').addEventListener('change', (e) => {
    const term = e.target.value;
    const rows = document.querySelectorAll('#table-pay-allocation tbody tr');
    rows.forEach(row => {
        const checkbox = row.querySelector('.chk-alloc');
        const isChecked = checkbox && checkbox.checked;
        const rowFamily = row.getAttribute('data-family');
        
        if (isChecked) {
            row.style.display = ''; 
        } else if (term === 'none') {
            row.style.display = 'none';
        } else if (term === '') {
            row.style.display = '';
        } else {
            row.style.display = (rowFamily === term) ? '' : 'none';
        }
    });
});

function renderPaymentAllocTable(existingAllocations = []) {
    const tbody = document.querySelector('#table-pay-allocation tbody');
    tbody.innerHTML = '';
    
    const active = db.participants.filter(p => p.status === 'Aktif');
    const filterVal = document.getElementById('pay-filter-family').value;
    
    active.forEach(p => {
        const stats = calcParticipantStats(p.id);
        const existing = existingAllocations.find(a => a.participantId === p.id);
        const allocVal = existing ? existing.amount : 0;
        const isChecked = allocVal > 0 ? 'checked' : '';
        
        const tr = document.createElement('tr');
        tr.setAttribute('data-family', p.family);
        
        if (allocVal > 0) {
            tr.style.display = ''; 
        } else if (filterVal === 'none') {
            tr.style.display = 'none';
        } else if (filterVal === '') {
            tr.style.display = '';
        } else {
            tr.style.display = (p.family === filterVal) ? '' : 'none';
        }

        tr.innerHTML = `
            <td><input type="checkbox" class="chk-alloc" data-id="${p.id}" ${isChecked}></td>
            <td>${escapeHTML(p.name)}<br><small class="text-muted">${escapeHTML(p.family)}</small></td>
            <td>${formatRp(stats.rawSisa)}</td>
            <td><input type="number" class="form-control input-sm alloc-input" data-id="${p.id}" value="${allocVal}" readonly step="1"></td>
        `;
        tbody.appendChild(tr);
    });
    attachPaymentEvents();
}

function attachPaymentEvents() {
    document.getElementById('pay-amount').addEventListener('input', () => {
        if(document.getElementById('pay-alloc-method').value === 'rata') calculateAllocSplit();
        updatePaymentSummary();
    });
    
    document.getElementById('chk-all-alloc').addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const visibleRows = document.querySelectorAll('#table-pay-allocation tbody tr:not([style*="display: none"]) .chk-alloc');
        visibleRows.forEach(chk => { chk.checked = isChecked; });
        calculateAllocSplit();
    });
    
    document.querySelectorAll('.chk-alloc').forEach(chk => {
        chk.addEventListener('change', calculateAllocSplit);
    });
    
    document.getElementById('pay-alloc-method').addEventListener('change', (e) => {
        const isManual = e.target.value === 'manual';
        document.querySelectorAll('.alloc-input').forEach(input => {
            input.readOnly = !isManual;
        });
        calculateAllocSplit();
    });
    
    document.querySelectorAll('.alloc-input').forEach(input => {
        input.addEventListener('input', updatePaymentSummary);
    });
}

function calculateAllocSplit() {
    const method = document.getElementById('pay-alloc-method').value;
    if(method === 'manual') {
        updatePaymentSummary();
        return;
    }
    
    const totalReceived = parseFloat(document.getElementById('pay-amount').value) || 0;
    const checkedBoxes = Array.from(document.querySelectorAll('.chk-alloc:checked'));
    const count = checkedBoxes.length;
    
    document.querySelectorAll('.alloc-input').forEach(i => i.value = 0);
    
    if (count > 0 && totalReceived > 0) {
        const base = Math.floor(totalReceived / count);
        const remainder = totalReceived % count;
        
        checkedBoxes.forEach((chk, idx) => {
            const input = document.querySelector(`.alloc-input[data-id="${chk.getAttribute('data-id')}"]`);
            input.value = base + (idx < remainder ? 1 : 0); 
        });
    }
    updatePaymentSummary();
}

function updatePaymentSummary() {
    const received = parseFloat(document.getElementById('pay-amount').value) || 0;
    let allocated = 0;
    
    document.querySelectorAll('.chk-alloc').forEach(chk => {
        const input = document.querySelector(`.alloc-input[data-id="${chk.getAttribute('data-id')}"]`);
        if (chk.checked) {
            allocated += parseFloat(input.value) || 0;
        } else {
            input.value = 0;
        }
    });
    
    const unallocated = received - allocated;
    document.getElementById('summary-pay-received').textContent = formatRp(received);
    document.getElementById('summary-pay-allocated').textContent = formatRp(allocated);
    
    const unallocElem = document.getElementById('summary-pay-unallocated');
    unallocElem.textContent = formatRp(unallocated);
    unallocElem.className = unallocated === 0 ? 'text-success text-bold' : (unallocated > 0 ? 'text-warning text-bold' : 'text-danger text-bold');
    
    const errorBox = document.getElementById('pay-alloc-error');
    if (unallocated < 0) errorBox.style.display = 'block';
    else errorBox.style.display = 'none';
}

document.getElementById('form-payment').addEventListener('submit', async (e) => {
    e.preventDefault();
    const received = parseFloat(document.getElementById('pay-amount').value) || 0;
    
    let allocatedSum = 0;
    const allocs = [];
    document.querySelectorAll('.chk-alloc:checked').forEach(chk => {
        const pId = chk.getAttribute('data-id');
        const val = parseFloat(document.querySelector(`.alloc-input[data-id="${pId}"]`).value) || 0;
        if (val > 0) {
            allocatedSum += val;
            allocs.push({ participantId: pId, amount: val });
        }
    });
    
    if (allocatedSum > received) {
        showToast('Total alokasi melebihi uang diterima!', 'danger');
        return;
    }
    
    const data = {
        date: document.getElementById('pay-date').value,
        name: document.getElementById('pay-name').value.trim(),
        amount: received,
        method: document.getElementById('pay-method').value,
        ref: document.getElementById('pay-bank-name') ? document.getElementById('pay-bank-name').value.trim() : "",
        notes: document.getElementById('pay-bank-acc') ? document.getElementById('pay-bank-acc').value.trim() : "",
        allocations: allocs
    };
    
    const id = document.getElementById('pay-id').value;
    if (id) {
        data.id = id;
        const index = db.payments.findIndex(x => x.id === id);
        
        const { error } = await supabaseClient.from('payments').upsert([data]);
        if (error) {
            showToast('Gagal memperbarui transaksi: ' + error.message, 'danger');
            return;
        }

        db.payments[index] = data;
        showToast('Data pembayaran diperbarui.');
    } else {
        data.id = generateId('PAY');
        
        const { error } = await supabaseClient.from('payments').insert([data]);
        if (error) {
            showToast('Gagal mencatat transaksi kas: ' + error.message, 'danger');
            return;
        }

        db.payments.push(data);
        showToast('Penerimaan kas berhasil dicatat.');
    }
    
    closeModal('modal-payment-form');
    refreshAll();
});

window.editPaymentAllocation = function(id) {
    const pay = db.payments.find(x => x.id === id);
    if(!pay) return;
    
    const families = [...new Set(db.participants.map(p => p.family))].sort();
    const selectName = document.getElementById('pay-name');
    selectName.innerHTML = '<option value="">-- Pilih Keluarga / Grup --</option>';
    families.forEach(f => {
        selectName.innerHTML += `<option value="${escapeHTML(f)}">${escapeHTML(f)}</option>`;
    });

    const selectFilterFamily = document.getElementById('pay-filter-family');
    selectFilterFamily.innerHTML = '<option value="none">None</option>';
    selectFilterFamily.innerHTML += '<option value="">Semua Keluarga</option>';
    families.forEach(f => {
        selectFilterFamily.innerHTML += `<option value="${escapeHTML(f)}">${escapeHTML(f)}</option>`;
    });
    selectFilterFamily.value = '';

    document.getElementById('pay-id').value = pay.id;
    document.getElementById('pay-date').value = pay.date;
    document.getElementById('pay-name').value = pay.name;
    document.getElementById('pay-amount').value = pay.amount;
    document.getElementById('pay-method').value = pay.method;
    document.getElementById('pay-bank-name').value = pay.ref || '';
    document.getElementById('pay-bank-acc').value = pay.notes || '';
    document.getElementById('payment-form-title').textContent = 'Edit Transaksi & Alokasi';
    
    document.getElementById('pay-alloc-method').value = 'manual'; 
    document.getElementById('pay-method').dispatchEvent(new Event('change'));
    
    renderPaymentAllocTable(pay.allocations);
    document.querySelectorAll('.alloc-input').forEach(input => input.readOnly = false);
    updatePaymentSummary();
    openModal('modal-payment-form');
}

window.deletePayment = async function(id) {
    confirmAction('Hapus Transaksi Penerimaan', 'Hapus penerimaan kas ini dari database cloud?', async () => {
        const { error } = await supabaseClient.from('payments').delete().eq('id', id);
        if (error) {
            showToast('Gagal menghapus transaksi: ' + error.message, 'danger');
            return;
        }

        db.payments = db.payments.filter(p => p.id !== id);
        showToast('Transaksi berhasil dihapus.');
        refreshAll();
    });
}

/* ==========================================================================
   MODUL 7: PENGELUARAN OPERASIONAL
   ========================================================================== */
function renderExpenses() {
    const tbody = document.querySelector('#table-expenses tbody');
    tbody.innerHTML = '';
    
    const categories = [...new Set(db.expenses.map(e => e.category))].sort();
    const catSelect = document.getElementById('filter-expense-category');
    catSelect.innerHTML = '<option value="">Semua Kategori</option>';
    categories.forEach(c => catSelect.innerHTML += `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`);
    
    let totalEx = 0;
    const sorted = [...db.expenses].sort((a,b) => new Date(b.date) - new Date(a.date));
    
    sorted.forEach(e => {
        totalEx += e.amount;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(e.date)}</td>
            <td><span class="badge badge-secondary">${escapeHTML(e.category)}</span></td>
            <td>${escapeHTML(e.desc)}</td>
            <td>${escapeHTML(e.vendor)}</td>
            <td class="text-danger text-bold">${formatRp(e.amount)}</td>
            <td>
                <button class="btn btn-sm btn-outline-secondary" onclick="editExpense('${e.id}')">Edit</button>
                <button class="btn btn-sm btn-danger ml-10" onclick="deleteExpense('${e.id}')">&times;</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    document.getElementById('expense-total-display').textContent = formatRp(totalEx);
}

document.getElementById('filter-expense').addEventListener('input', applyExpenseFilter);
document.getElementById('filter-expense-category').addEventListener('change', applyExpenseFilter);

function applyExpenseFilter() {
    const term = document.getElementById('filter-expense').value.toLowerCase();
    const cat = document.getElementById('filter-expense-category').value;
    const rows = document.querySelectorAll('#table-expenses tbody tr');
    let filteredTotal = 0;
    
    rows.forEach(row => {
        const text = row.children[2].textContent.toLowerCase() + " " + row.children[3].textContent.toLowerCase();
        const rowCat = row.children[1].textContent;
        const amountStr = row.children[4].textContent.replace(/[^0-9]/g, '');
        
        const matchText = text.includes(term);
        const matchCat = cat === '' || rowCat === cat;
        
        if (matchText && matchCat) {
            row.style.display = '';
            filteredTotal += parseInt(amountStr) || 0;
        } else {
            row.style.display = 'none';
        }
    });
    document.getElementById('expense-total-display').textContent = formatRp(filteredTotal);
}

document.getElementById('btn-add-expense').addEventListener('click', () => {
    document.getElementById('form-expense').reset();
    document.getElementById('exp-id').value = '';
    document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('expense-form-title').textContent = 'Catat Pengeluaran Baru';
    openModal('modal-expense-form');
});

document.getElementById('form-expense').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        date: document.getElementById('exp-date').value,
        category: document.getElementById('exp-category').value,
        desc: document.getElementById('exp-desc').value.trim(),
        vendor: document.getElementById('exp-vendor').value.trim(),
        amount: parseFloat(document.getElementById('exp-amount').value) || 0,
        method: document.getElementById('exp-method').value,
        ref: "",
        notes: ""
    };
    
    const id = document.getElementById('exp-id').value;
    if (id) {
        data.id = id;
        const index = db.expenses.findIndex(x => x.id === id);
        
        const { error } = await supabaseClient.from('expenses').upsert([data]);
        if (error) {
            showToast('Gagal memperbarui pengeluaran: ' + error.message, 'danger');
            return;
        }

        db.expenses[index] = data;
        showToast('Data pengeluaran diperbarui.');
    } else {
        data.id = generateId('EXP');
        
        const { error } = await supabaseClient.from('expenses').insert([data]);
        if (error) {
            showToast('Gagal mencatat pengeluaran: ' + error.message, 'danger');
            return;
        }

        db.expenses.push(data);
        showToast('Pengeluaran berhasil dicatat.');
    }
    
    closeModal('modal-expense-form');
    refreshAll();
});

window.editExpense = function(id) {
    const e = db.expenses.find(x => x.id === id);
    if(!e) return;
    document.getElementById('exp-id').value = e.id;
    document.getElementById('exp-date').value = e.date;
    document.getElementById('exp-category').value = e.category;
    document.getElementById('exp-desc').value = e.desc;
    document.getElementById('exp-vendor').value = e.vendor;
    document.getElementById('exp-amount').value = e.amount;
    document.getElementById('exp-method').value = e.method;
    
    document.getElementById('expense-form-title').textContent = 'Edit Pengeluaran';
    openModal('modal-expense-form');
}

window.deleteExpense = async function(id) {
    confirmAction('Hapus Pengeluaran', 'Hapus pengeluaran ini dari cloud?', async () => {
        const { error } = await supabaseClient.from('expenses').delete().eq('id', id);
        if (error) {
            showToast('Gagal menghapus pengeluaran: ' + error.message, 'danger');
            return;
        }

        db.expenses = db.expenses.filter(e => e.id !== id);
        showToast('Pengeluaran dihapus.');
        refreshAll();
    });
}

/* ==========================================================================
   MODUL 8: LAPORAN KEUANGAN & PENGATURAN SISTEM
   ========================================================================== */
document.getElementById('btn-generate-report').addEventListener('click', () => {
    const type = document.getElementById('report-type').value;
    
    document.getElementById('report-print-area').style.display = 'block';
    // REVISI 2: Pastikan tombol unduh JPEG muncul saat tabel digenerate
    document.getElementById('btn-print-report').style.display = 'inline-block';
    
    const container = document.getElementById('report-output-container');
    const title = document.getElementById('report-print-title');
    const period = document.getElementById('report-print-period');
    
    period.textContent = 'Periode: Keseluruhan Data';
    
    if (type === 'peserta') {
        title.textContent = 'LAPORAN TAGIHAN PESERTA';
        container.innerHTML = generateReportTablePeserta();
    } else if (type === 'keluarga') {
        title.textContent = 'LAPORAN TAGIHAN PER KELUARGA';
        container.innerHTML = generateReportTableKeluarga();
    } else if (type === 'penerimaan') {
        title.textContent = 'LAPORAN PENERIMAAN KAS';
        container.innerHTML = generateReportTablePenerimaan();
    } else if (type === 'pengeluaran') {
        title.textContent = 'LAPORAN PENGELUARAN OPERASIONAL';
        container.innerHTML = generateReportTablePengeluaran();
    } else if (type === 'buku_kas') {
        title.textContent = 'LAPORAN BUKU KAS (ARUS KAS)';
        container.innerHTML = generateReportTableBukuKas();
    } else {
        title.textContent = 'REKAPITULASI KESELURUHAN PERJALANAN';
        container.innerHTML = generateReportRekapitulasi();
    }
});

// REVISI 2: Mengubah fungsi cetak laporan menjadi Download JPEG via html2canvas
document.getElementById('btn-print-report').addEventListener('click', async () => {
    const btn = document.getElementById('btn-print-report');
    const printArea = document.getElementById('report-print-area');
    
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Memproses...';

    try {
        if (typeof html2canvas === 'function') {
            const canvas = await html2canvas(printArea, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                onclone: (clonedDoc) => {
                    const clonedArea = clonedDoc.getElementById('report-print-area');
                    if (clonedArea) {
                        clonedArea.style.padding = '20px'; // Beri jarak saat dicetak
                        clonedArea.style.border = 'none';
                        clonedArea.style.boxShadow = 'none';
                    }
                }
            });

            const jpegUrl = canvas.toDataURL('image/jpeg', 0.95);
            const link = document.createElement('a');
            link.download = `Laporan_Keuangan_${Date.now()}.jpg`;
            link.href = jpegUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showToast('Berhasil mengunduh Laporan (JPEG)!');
        } else {
            throw new Error('Library html2canvas belum siap.');
        }
    } catch (err) {
        console.error('Download JPEG Error:', err);
        showToast('Gagal memproses gambar.', 'danger');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
});

function generateReportTablePeserta() {
    // REVISI 3: Menghapus <th>ID</th> dari hasil render tabel laporan
    let html = `<table class="table"><thead><tr>
        <th>Nama</th><th>Keluarga</th><th>Total Tagihan</th><th>Telah Dibayar</th><th>Sisa</th><th>Kelebihan</th><th>Status</th>
        </tr></thead><tbody>`;
    db.participants.forEach(p => {
        const s = calcParticipantStats(p.id);
        html += `<tr>
            <td>${escapeHTML(p.name)}</td>
            <td>${escapeHTML(p.family)}</td>
            <td>${formatRp(s.totalTagihan)}</td>
            <td>${formatRp(s.totalDibayar)}</td>
            <td class="text-danger">${formatRp(s.sisa)}</td>
            <td class="text-info">${formatRp(s.kelebihan)}</td>
            <td>${s.status}</td>
        </tr>`;
    });
    return html + `</tbody></table>`;
}

function generateReportTableKeluarga() {
    const families = [...new Set(db.participants.map(p => p.family))].sort();
    let html = '';
    let grandTagihan = 0, grandDibayar = 0, grandSisa = 0;
    
    families.forEach(f => {
        const stats = calcFamilyStats(f);
        grandTagihan += stats.totalTagihan;
        grandDibayar += stats.totalDibayar;
        grandSisa += stats.sisa;
        
        html += `
        <h4 style="margin-top: 20px; background: #f1f5f9; padding: 10px;">Keluarga: ${escapeHTML(f)}</h4>
        <table class="table table-sm">
            <thead><tr><th>Nama Anggota</th><th>Tagihan</th><th>Dibayar</th><th>Sisa</th><th>Status</th></tr></thead>
            <tbody>
        `;
        stats.members.forEach(m => {
            const ms = calcParticipantStats(m.id);
            html += `<tr>
                <td>${escapeHTML(m.name)}</td>
                <td>${formatRp(ms.totalTagihan)}</td>
                <td>${formatRp(ms.totalDibayar)}</td>
                <td>${formatRp(ms.sisa)}</td>
                <td>${ms.status}</td>
            </tr>`;
        });
        html += `<tr style="font-weight:bold; background:#fff">
            <td class="text-right">TOTAL KELUARGA</td>
            <td>${formatRp(stats.totalTagihan)}</td>
            <td class="text-success">${formatRp(stats.totalDibayar)}</td>
            <td class="text-danger">${formatRp(stats.sisa)}</td>
            <td></td>
        </tr></tbody></table>`;
    });
    
    html += `<div style="margin-top:20px; padding:15px; border:2px solid #000;">
        <h3>GRAND TOTAL SELURUH KELUARGA</h3>
        <p>Total Tagihan: <strong>${formatRp(grandTagihan)}</strong></p>
        <p>Total Dibayar: <strong class="text-success">${formatRp(grandDibayar)}</strong></p>
        <p>Total Sisa Tagihan: <strong class="text-danger">${formatRp(grandSisa)}</strong></p>
    </div>`;
    return html;
}

function generateReportTablePenerimaan() {
    let data = db.payments; 
    let total = 0;
    let html = `<table class="table"><thead><tr>
        <th>Tanggal</th><th>Pembayar</th><th>Penerimaan</th><th>Metode</th><th>Catatan</th>
        </tr></thead><tbody>`;
    data.sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(p => {
        total += p.amount;
        html += `<tr>
            <td>${formatDate(p.date)}</td>
            <td>${escapeHTML(p.name)}</td><td class="text-bold text-success">${formatRp(p.amount)}</td>
            <td>${escapeHTML(p.method)}</td><td>${escapeHTML(p.notes)}</td>
        </tr>`;
    });
    html += `<tr style="font-weight:bold"><td colspan="2" class="text-right">TOTAL PENERIMAAN:</td><td colspan="3">${formatRp(total)}</td></tr>`;
    return html + `</tbody></table>`;
}

function generateReportTablePengeluaran() {
    let data = db.expenses;
    let total = 0;
    let html = `<table class="table"><thead><tr>
        <th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th>Vendor</th><th>Pengeluaran</th><th>Metode</th>
        </tr></thead><tbody>`;
    data.sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(e => {
        total += e.amount;
        html += `<tr>
            <td>${formatDate(e.date)}</td><td>${escapeHTML(e.category)}</td>
            <td>${escapeHTML(e.desc)}</td><td>${escapeHTML(e.vendor)}</td>
            <td class="text-bold text-danger">${formatRp(e.amount)}</td><td>${escapeHTML(e.method)}</td>
        </tr>`;
    });
    html += `<tr style="font-weight:bold"><td colspan="4" class="text-right">TOTAL PENGELUARAN:</td><td colspan="2">${formatRp(total)}</td></tr>`;
    return html + `</tbody></table>`;
}

function generateReportTableBukuKas() {
    let transactions = [];
    db.payments.forEach(p => transactions.push({ date: p.date, type: 'IN', ref: p.name, desc: p.notes, amount: p.amount }));
    db.expenses.forEach(e => transactions.push({ date: e.date, type: 'OUT', ref: e.vendor, desc: e.desc, amount: e.amount }));
    
    transactions.sort((a,b) => new Date(a.date) - new Date(b.date));
    
    let saldoAwal = 0;
    let kasMasuk = 0;
    let kasKeluar = 0;
    let htmlRows = '';
    let saldoBerjalan = 0;
    
    transactions.forEach(t => {
        if(t.type === 'IN') {
            kasMasuk += t.amount;
            saldoBerjalan += t.amount;
        } else {
            kasKeluar += t.amount;
            saldoBerjalan -= t.amount;
        }
        
        htmlRows += `<tr>
            <td>${formatDate(t.date)}</td>
            <td>${t.type === 'IN' ? 'Penerimaan Peserta' : 'Pengeluaran Operasional'}</td>
            <td>${escapeHTML(t.ref)} - ${escapeHTML(t.desc)}</td>
            <td class="text-success">${t.type === 'IN' ? formatRp(t.amount) : ''}</td>
            <td class="text-danger">${t.type === 'OUT' ? formatRp(t.amount) : ''}</td>
            <td><strong>${formatRp(saldoBerjalan)}</strong></td>
        </tr>`;
    });

    let html = `
    <div style="display:flex; justify-content:space-between; margin-bottom: 20px; background:#f1f5f9; padding:15px; border-radius:8px;">
        <div><h4>Saldo Awal</h4><h2 class="text-primary">${formatRp(saldoAwal)}</h2></div>
        <div><h4>Total Masuk</h4><h2 class="text-success">+ ${formatRp(kasMasuk)}</h2></div>
        <div><h4>Total Keluar</h4><h2 class="text-danger">- ${formatRp(kasKeluar)}</h2></div>
        <div><h4>Saldo Akhir</h4><h2 class="text-primary">${formatRp(saldoAwal + kasMasuk - kasKeluar)}</h2></div>
    </div>
    <table class="table"><thead><tr>
        <th>Tanggal</th><th>Jenis Transaksi</th><th>Keterangan</th><th>Debet (Masuk)</th><th>Kredit (Keluar)</th><th>Saldo</th>
    </tr></thead><tbody>
        <tr><td colspan="5" class="text-right"><strong>SALDO AWAL:</strong></td><td><strong>${formatRp(saldoAwal)}</strong></td></tr>
        ${htmlRows}
    </tbody></table>`;
    return html;
}

function generateReportRekapitulasi() {
    let sumTagihan = 0, sumPenerimaan = 0, sumPengeluaran = 0, sumTeralokasi = 0, sumSisa = 0, sumKelebihan = 0;
    db.participants.forEach(p => {
        const s = calcParticipantStats(p.id);
        sumTagihan += s.totalTagihan;
        sumTeralokasi += s.totalDibayar;
        sumSisa += s.sisa;
        sumKelebihan += s.kelebihan;
    });
    db.payments.forEach(p => sumPenerimaan += p.amount);
    db.expenses.forEach(e => sumPengeluaran += e.amount);
    
    const danaMenganggur = sumPenerimaan - sumTeralokasi;
    const saldoKas = sumPenerimaan - sumPengeluaran;
    const surplusDefisit = sumTagihan - sumPengeluaran;
    
    return `
    <table style="width:100%; border-collapse:collapse; margin-bottom:30px;">
        <tr><td style="padding:10px; border-bottom:1px solid #ccc;">Total Peserta Terdaftar</td><td class="text-right text-bold">${db.participants.length}</td></tr>
        <tr><td style="padding:10px; border-bottom:1px solid #ccc;">Total Tagihan Peserta</td><td class="text-right text-bold">${formatRp(sumTagihan)}</td></tr>
        <tr><td style="padding:10px; border-bottom:1px solid #ccc;">Total Penerimaan Kas</td><td class="text-right text-bold text-success">${formatRp(sumPenerimaan)}</td></tr>
        <tr><td style="padding:10px; border-bottom:1px solid #ccc;">Dana Telah Dialokasikan</td><td class="text-right text-bold">${formatRp(sumTeralokasi)}</td></tr>
        <tr><td style="padding:10px; border-bottom:1px solid #ccc;">Dana Belum Dialokasikan</td><td class="text-right text-bold text-warning">${formatRp(danaMenganggur)}</td></tr>
        <tr><td style="padding:10px; border-bottom:1px solid #ccc;">Total Sisa Harus Ditagih</td><td class="text-right text-bold text-danger">${formatRp(sumSisa)}</td></tr>
        <tr><td style="padding:10px; border-bottom:1px solid #ccc;">Total Kelebihan Pembayaran</td><td class="text-right text-bold text-info">${formatRp(sumKelebihan)}</td></tr>
        <tr><td style="padding:10px; border-bottom:1px solid #ccc;">Total Pengeluaran Aktual</td><td class="text-right text-bold text-danger">${formatRp(sumPengeluaran)}</td></tr>
        <tr><td style="padding:10px; border-bottom:2px solid #000; background:#f1f5f9;"><strong>SALDO KAS BERJALAN</strong></td><td class="text-right text-bold text-primary" style="background:#f1f5f9;">${formatRp(saldoKas)}</td></tr>
        <tr><td style="padding:10px;">Perkiraan Surplus/Defisit (Tagihan - Pengeluaran)</td><td class="text-right text-bold ${surplusDefisit >= 0 ? 'text-success' : 'text-danger'}">${formatRp(surplusDefisit)}</td></tr>
    </table>
    `;
}

// REVISI 3: Menghapus logika btn-export-csv-report dan downloadCSV

// FACTORY RESET TERHUBUNG KE SUPABASE CLOUD
document.getElementById('btn-delete-all-data').addEventListener('click', () => {
    confirmAction(
        'HAPUS SEMUA DATA PERMANEN', 
        'PERINGATAN KRITIS: Apakah Anda yakin ingin menghapus SELURUH data di server Supabase?', 
        async () => {
            const [res1, res2, res3, res4] = await Promise.all([
                supabaseClient.from('participants').delete().neq('id', '0'),
                supabaseClient.from('costs').delete().neq('id', '0'),
                supabaseClient.from('payments').delete().neq('id', '0'),
                supabaseClient.from('expenses').delete().neq('id', '0')
            ]);
            
            if (res1.error || res2.error || res3.error || res4.error) {
                showToast('Gagal menghapus sebagian/seluruh data dari server. Silakan coba lagi.', 'danger');
                return;
            }

            db = {
                participants: [],
                costs: [],
                payments: [],
                expenses: [],
                categories: [
                    'Tiket Kereta Berangkat', 'Tiket Kereta Pulang', 'Tiket Kereta PP', 'Sewa Bus/Transportasi', 
                    'Penginapan/Hotel', 'Pembelian Kaos', 'Tiket Wisata', 'Konsumsi/Makan Minum', 
                    'Parkir & Tol', 'Administrasi', 'Lain-lain', 'Diskon/Penyesuaian'
                ]
            };
            
            showToast('Seluruh data berhasil dihapus dari Cloud.', 'success');
            setTimeout(() => { location.reload(); }, 1500);
        }
    );
});

/* ==========================================================================
   APP LIFECYCLE (MULAI APLIKASI)
   ========================================================================== */
window.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    // REVISI 4: Menangani initial hash route dari History API jika di-reload
    const hash = window.location.hash.substring(1);
    
    if (hash && document.getElementById(hash) && document.getElementById(hash).classList.contains('view-section')) {
        switchView(hash, true);
    } else if (hash && hash.startsWith('detail-')) {
        currentDetailId = hash.replace('detail-', '');
        switchView('view-participant-detail', true);
        renderDetailParticipant(currentDetailId);
    } else {
        switchView('view-dashboard', true);
    }
});

/* ==========================================================================
   PWA STANDALONE MODE (TANPA SERVICE WORKER)
   ========================================================================== */
(function injectVirtualManifest() {
    const currentPath = window.location.pathname;
    const basePath = currentPath.endsWith('.html') 
        ? currentPath.substring(0, currentPath.lastIndexOf('/') + 1) 
        : (currentPath.endsWith('/') ? currentPath : currentPath + '/');
    const baseUrl = window.location.origin + basePath;
    const iconUrl = baseUrl + "logo.png";

    const manifestJSON = {
        "id": baseUrl,
        "name": "Davka tour",
        "short_name": "Davka tour",
        "description": "Sistem Manajemen Davka Travel",
        "start_url": baseUrl,
        "scope": baseUrl,
        "display": "standalone",
        "orientation": "portrait",
        "background_color": "#ffffff",
        "theme_color": "#0369a1",
        "icons": [
            { "src": iconUrl, "sizes": "192x192", "type": "image/png", "purpose": "any" },
            { "src": iconUrl, "sizes": "512x512", "type": "image/png", "purpose": "any" },
            { "src": iconUrl, "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
        ]
    };

    const stringifiedManifest = JSON.stringify(manifestJSON);
    const blob = new Blob([stringifiedManifest], { type: 'application/manifest+json' });
    const manifestBlobUrl = URL.createObjectURL(blob);

    const linkTag = document.createElement('link');
    linkTag.rel = 'manifest';
    linkTag.href = manifestBlobUrl;
    document.head.appendChild(linkTag);
})();
