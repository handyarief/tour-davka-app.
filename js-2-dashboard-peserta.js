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
