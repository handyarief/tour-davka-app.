/* ==========================================================================
   MODUL 1: DASHBOARD & DETAIL KATEGORI BIAYA (DENGAN 3D ICON ENGINE)
   ========================================================================== */
let currentDetailCategory = null;

function getCategoryUnitName(cat) {
    if (!cat) return 'Item';
    const catLower = cat.toLowerCase();
    if (catLower.includes('kaos')) return 'pcs';
    if (catLower.includes('tiket')) return 'tiket';
    if (catLower.includes('penginapan') || catLower.includes('hotel')) return 'kamar';
    if (catLower.includes('bus') || catLower.includes('transportasi')) return 'unit';
    if (catLower.includes('makan') || catLower.includes('konsumsi')) return 'porsi';
    return 'Item';
}

// Helper Visual: Menghasilkan 3D Icon & Tema Warna Selaras Logo Davka berdasarkan Nama Kategori
function getCategory3DMeta(cat) {
    if (!cat) {
        return { icon: '📦', theme: 'icon-3d-blue' };
    }
    const catLower = cat.toLowerCase();
    if (catLower.includes('kereta')) {
        return { icon: '🚆', theme: 'icon-3d-blue' };
    }
    if (catLower.includes('pesawat') || catLower.includes('flight')) {
        return { icon: '✈️', theme: 'icon-3d-cyan' };
    }
    if (catLower.includes('bus') || catLower.includes('transportasi') || catLower.includes('mobil') || catLower.includes('travel')) {
        return { icon: '🚌', theme: 'icon-3d-orange' };
    }
    if (catLower.includes('penginapan') || catLower.includes('hotel') || catLower.includes('villa') || catLower.includes('kamar') || catLower.includes('homestay')) {
        return { icon: '🏨', theme: 'icon-3d-cyan' };
    }
    if (catLower.includes('kaos') || catLower.includes('baju') || catLower.includes('seragam') || catLower.includes('jersey')) {
        return { icon: '👕', theme: 'icon-3d-orange' };
    }
    if (catLower.includes('parkir') || catLower.includes('tol')) {
        return { icon: '🛣️', theme: 'icon-3d-blue' };
    }
    if (catLower.includes('wisata') || catLower.includes('tiket')) {
        return { icon: '🎟️', theme: 'icon-3d-orange' };
    }
    if (catLower.includes('konsumsi') || catLower.includes('makan') || catLower.includes('minum') || catLower.includes('snack') || catLower.includes('resto')) {
        return { icon: '🍱', theme: 'icon-3d-green' };
    }
    if (catLower.includes('admin') || catLower.includes('dokumen') || catLower.includes('asuransi')) {
        return { icon: '📋', theme: 'icon-3d-purple' };
    }
    if (catLower.includes('diskon') || catLower.includes('potongan') || catLower.includes('penyesuaian') || catLower.includes('promo')) {
        return { icon: '🏷️', theme: 'icon-3d-red' };
    }
    return { icon: '💎', theme: 'icon-3d-blue' };
}

window.openCategoryDetail = function(categoryName) {
    if (!categoryName) return;
    activateViewDOM('view-category-detail', {
        pushHistory: true,
        detailId: typeof currentDetailId !== 'undefined' ? currentDetailId : null,
        detailFamily: typeof currentDetailFamily !== 'undefined' ? currentDetailFamily : null,
        detailCategory: categoryName
    });
};

const btnBackCatDash = document.getElementById('btn-back-cat-dashboard');
if (btnBackCatDash) {
    btnBackCatDash.addEventListener('click', () => {
        activateViewDOM('view-dashboard', { pushHistory: true });
    });
}

function renderDetailCategory(categoryName) {
    if (!categoryName) return;

    const unitName = getCategoryUnitName(categoryName);
    const activeParticipants = db.participants.filter(p => p.status === 'Aktif');
    const activeMap = {};
    activeParticipants.forEach(p => {
        activeMap[p.id] = p;
    });

    const catCosts = [];
    let totalQty = 0;
    let totalAmount = 0;

    db.costs.forEach(c => {
        if (c.category === categoryName && activeMap[c.participantId]) {
            const p = activeMap[c.participantId];
            const qty = Number(c.qty || 1);
            const price = Number(c.price || 0);
            const total = Number(c.total || 0);

            totalQty += qty;
            totalAmount += total;

            catCosts.push({
                costId: c.id,
                participantId: p.id,
                name: p.name || '',
                family: p.family || 'None',
                shirt: p.shirt || '',
                qty: qty,
                price: price,
                total: total,
                notes: c.notes || ''
            });
        }
    });

    catCosts.sort((a, b) => {
        const famCompare = a.family.localeCompare(b.family, 'id', { sensitivity: 'base' });
        if (famCompare !== 0) return famCompare;
        return a.name.localeCompare(b.name, 'id', { sensitivity: 'base' });
    });

    const titleEl = document.getElementById('detail-cat-name');
    if (titleEl) titleEl.textContent = categoryName;

    const rowsEl = document.getElementById('detail-cat-total-rows');
    if (rowsEl) rowsEl.textContent = `${catCosts.length} Orang`;

    const qtyEl = document.getElementById('detail-cat-total-qty');
    if (qtyEl) qtyEl.textContent = `${totalQty} ${unitName}`;

    const amountEl = document.getElementById('detail-cat-total-amount');
    if (amountEl) amountEl.textContent = formatRp(totalAmount);

    const footerTotalEl = document.getElementById('detail-cat-footer-total');
    if (footerTotalEl) footerTotalEl.textContent = `${formatRp(totalAmount)} (${totalQty} ${unitName})`;

    const tbody = document.querySelector('#table-detail-category tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (catCosts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Belum ada peserta dengan pembelian pada kategori ini.</td></tr>';
        return;
    }

    const isShirtCategory = categoryName.toLowerCase().includes('kaos');

    catCosts.forEach((item, idx) => {
        const tr = document.createElement('tr');
        const shirtBadge = (isShirtCategory && item.shirt)
            ? ` <span class="badge badge-info ml-5">Ukuran: ${escapeHTML(item.shirt)}</span>`
            : '';

        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td><strong>${escapeHTML(item.name)}</strong>${shirtBadge}</td>
            <td>${escapeHTML(item.family)}</td>
            <td class="text-center"><strong>${item.qty} ${unitName}</strong></td>
            <td class="text-right">${formatRp(item.price)}</td>
            <td class="text-right"><strong class="text-primary">${formatRp(item.total)}</strong></td>
        `;
        tbody.appendChild(tr);
    });

    const trTotal = document.createElement('tr');
    trTotal.className = 'fam-cost-grand-row';
    trTotal.innerHTML = `
        <td colspan="3" class="text-right">TOTAL KESELURUHAN</td>
        <td class="text-center">${totalQty} ${unitName}</td>
        <td class="text-right">-</td>
        <td class="text-right">${formatRp(totalAmount)}</td>
    `;
    tbody.appendChild(trTotal);
}

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
        usedCatArray.forEach((cat, idx) => {
            const unitName = getCategoryUnitName(cat);
            const meta3D = getCategory3DMeta(cat);
            const colorTheme = meta3D.theme || (idx % 2 === 0 ? 'icon-3d-blue' : 'icon-3d-orange');

            const itemDiv = document.createElement('div');
            itemDiv.className = 'cat-sum-item';
            itemDiv.setAttribute('role', 'button');
            itemDiv.setAttribute('tabindex', '0');
            itemDiv.innerHTML = `
                <div class="cat-sum-top">
                    <span class="icon-3d icon-3d-sm ${colorTheme}" aria-hidden="true">${meta3D.icon}</span>
                    <div class="cat-sum-title-wrap">
                        <span class="cat-sum-label">${escapeHTML(cat)}</span>
                        <span class="cat-sum-sub">Ketuk untuk rincian &rarr;</span>
                    </div>
                </div>
                <div class="cat-sum-detail mt-5">
                    <span class="cat-sum-qty">${categoryQtys[cat]} ${unitName}</span>
                    <span class="cat-sum-value">${formatRp(categoryTotals[cat])}</span>
                </div>
            `;
            itemDiv.addEventListener('click', () => {
                openCategoryDetail(cat);
            });
            itemDiv.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openCategoryDetail(cat);
                }
            });
            catContainer.appendChild(itemDiv);
        });
    }

    /* ----------------------------------------------------------------------
       1. TABEL STATUS KELUARGA / GRUP
       ---------------------------------------------------------------------- */
    const familyFilterSelect = document.getElementById('dash-filter-status-keluarga');
    if (familyFilterSelect) {
        const currentFamFilterVal = familyFilterSelect.value;
        familyFilterSelect.innerHTML = '<option value="none">None</option>';
        familyFilterSelect.innerHTML += '<option value="">Semua Keluarga</option>';
        families.forEach(f => {
            familyFilterSelect.innerHTML += `<option value="${escapeHTML(f)}">${escapeHTML(f)}</option>`;
        });

        if (!currentFamFilterVal) familyFilterSelect.value = 'none';
        else familyFilterSelect.value = currentFamFilterVal;

        const famTheadTr = document.getElementById('dash-family-table-header');
        let famThHtml = `<th>Nama Keluarga</th><th>Total Peserta</th>`;
        usedCatArray.forEach(cat => {
            famThHtml += `<th>${escapeHTML(cat)}</th>`;
        });
        famThHtml += `<th>Total Biaya</th><th>Aksi</th>`;
        famTheadTr.innerHTML = famThHtml;

        const famTbody = document.querySelector('#table-dash-keluarga tbody');
        famTbody.innerHTML = '';
        const activeFamFilter = familyFilterSelect.value;

        families.forEach(famName => {
            const famMembers = activeParticipants.filter(p => p.family === famName);
            const memberIds = famMembers.map(m => m.id);
            const famCosts = db.costs.filter(c => memberIds.includes(c.participantId));

            let famCatTotals = {};
            let famTotalBiaya = 0;

            famCosts.forEach(c => {
                if (!famCatTotals[c.category]) famCatTotals[c.category] = 0;
                famCatTotals[c.category] += c.total;
                famTotalBiaya += c.total;
            });

            const tr = document.createElement('tr');
            tr.setAttribute('data-family', famName);

            if (activeFamFilter === 'none') tr.style.display = 'none';
            else if (activeFamFilter && activeFamFilter !== famName) tr.style.display = 'none';
            else tr.style.display = '';

            let tdHtml = `
                <td><strong>${escapeHTML(famName)}</strong></td>
                <td>${famMembers.length} Orang</td>
            `;
            usedCatArray.forEach(cat => {
                tdHtml += `<td>${formatRp(famCatTotals[cat] || 0)}</td>`;
            });

            const firstMemberId = famMembers.length > 0 ? famMembers[0].id : '';
            tdHtml += `
                <td><strong>${formatRp(famTotalBiaya)}</strong></td>
                <td><button class="btn btn-sm btn-outline-primary" onclick="openFamilyDetailFromDash('${firstMemberId}')">Detail</button></td>
            `;

            tr.innerHTML = tdHtml;
            famTbody.appendChild(tr);
        });
    }

    /* ----------------------------------------------------------------------
       2. TABEL STATUS PESERTA (PENCARIAN KETIK NAMA PESERTA / KELUARGA)
       ---------------------------------------------------------------------- */
    const searchInput = document.getElementById('dash-search-peserta');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const theadTr = document.getElementById('dash-table-header');
    let thHtml = `<th>Nama</th><th>Keluarga</th>`;
    usedCatArray.forEach(cat => {
        thHtml += `<th>${escapeHTML(cat)}</th>`;
    });
    thHtml += `<th>Total Biaya</th><th>Aksi</th>`;
    theadTr.innerHTML = thHtml;

    const tbody = document.querySelector('#table-dash-peserta tbody');
    tbody.innerHTML = '';

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
        tr.setAttribute('data-name', p.name.toLowerCase());
        tr.setAttribute('data-family', p.family.toLowerCase());
        
        if (!searchTerm) {
            tr.style.display = 'none';
        } else {
            const matchName = p.name.toLowerCase().includes(searchTerm);
            const matchFam = p.family.toLowerCase().includes(searchTerm);
            tr.style.display = (matchName || matchFam) ? '' : 'none';
        }

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

// Event Listener Filter Dropdown pada Status Keluarga / Grup
const dashFamilySelect = document.getElementById('dash-filter-status-keluarga');
if (dashFamilySelect) {
    dashFamilySelect.addEventListener('change', function(e) {
        const family = e.target.value;
        const rows = document.querySelectorAll('#table-dash-keluarga tbody tr');
        
        rows.forEach(row => {
            if (family === 'none') row.style.display = 'none';
            else if (family === '') row.style.display = '';
            else {
                const rowFam = row.getAttribute('data-family');
                row.style.display = (rowFam === family) ? '' : 'none';
            }
        });
    });
}

// Event Listener Pencarian Ketik Nama Peserta / Keluarga pada Status Peserta
const dashSearchPeserta = document.getElementById('dash-search-peserta');
if (dashSearchPeserta) {
    dashSearchPeserta.addEventListener('input', function(e) {
        const term = e.target.value.toLowerCase().trim();
        const rows = document.querySelectorAll('#table-dash-peserta tbody tr');
        
        rows.forEach(row => {
            if (!term) {
                row.style.display = 'none';
            } else {
                const rowName = row.getAttribute('data-name') || '';
                const rowFam = row.getAttribute('data-family') || '';
                row.style.display = (rowName.includes(term) || rowFam.includes(term)) ? '' : 'none';
            }
        });
    });
}

// Fungsi Aksi Tombol Detail pada Tabel Status Keluarga / Grup -> Buka Halaman Detail Keluarga
window.openFamilyDetailFromDash = function(representativeParticipantId) {
    if (!representativeParticipantId) return;
    const p = db.participants.find(x => x.id === representativeParticipantId);
    if (!p) return;
    openFamilyDetail(p.family);
};

/* ==========================================================================
   MODUL 3: PESERTA & KELUARGA (DENGAN SUPABASE SYNC)
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

    db.participants.forEach((p, index) => {
        const tr = document.createElement('tr');
        tr.style.display = 'none';
        tr.innerHTML = `
            <td>${index + 1}</td>
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
        const nameMatch = nameTerm === '' || row.children[1].textContent.toLowerCase().includes(nameTerm);
        const familyMatch = familyTerm === '' || row.children[2].textContent === familyTerm;
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

// SUBMIT PESERTA KE SUPABASE CLOUD (DENGAN ASYNC/AWAIT & ERROR HANDLING)
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
