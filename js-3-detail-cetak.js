/* ==========================================================================
   MODUL 4: DETAIL PESERTA, DETAIL KELUARGA & CETAK RINGKASAN (PRINT / BT / JPG)
   ========================================================================== */
let currentDetailId = null;
let currentDetailFamily = null;
let currentRingkasanType = null; // 'individual' atau 'family'

window.openParticipantDetail = function(id) {
    if (!id) return;
    activateViewDOM('view-participant-detail', {
        pushHistory: true,
        detailId: id,
        detailFamily: currentDetailFamily
    });
};

window.openFamilyDetail = function(familyName) {
    if (!familyName) return;
    activateViewDOM('view-family-detail', {
        pushHistory: true,
        detailId: currentDetailId,
        detailFamily: familyName
    });
};

function renderDetailParticipant(id) {
    if(!id) return;
    const p = db.participants.find(x => x.id === id);
    if(!p) return;

    const stats = calcParticipantStats(id);

    document.getElementById('detail-part-name').textContent = p.name;
    document.getElementById('detail-part-family').textContent = p.family;
    
    const badge = document.getElementById('detail-part-status-badge');
    badge.textContent = stats.status;
    badge.className = `badge ${stats.badgeClass}`;

    document.getElementById('detail-total-tagihan').textContent = formatRp(stats.totalTagihan);
    document.getElementById('detail-total-dibayar').textContent = formatRp(stats.totalDibayar);
    
    const sisaEl = document.getElementById('detail-sisa-tagihan');
    const sisaCard = sisaEl ? sisaEl.closest('.summary-card-sisa') : null;
    if (stats.kelebihan > 0) {
        sisaEl.textContent = `+${formatRp(stats.kelebihan)} (Lebih)`;
        sisaEl.className = 'stat-value text-info';
        if (sisaCard) sisaCard.classList.add('is-lebih');
    } else {
        sisaEl.textContent = formatRp(stats.sisa);
        sisaEl.className = 'stat-value text-danger';
        if (sisaCard) sisaCard.classList.remove('is-lebih');
    }

    const tbodyCosts = document.querySelector('#table-detail-costs tbody');
    tbodyCosts.innerHTML = '';
    const pCosts = db.costs.filter(c => c.participantId === id);
    if (pCosts.length === 0) {
        tbodyCosts.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Belum ada rincian biaya.</td></tr>';
    } else {
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
    }
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
    if(!hasPayment) tbodyPays.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Belum ada riwayat pembayaran.</td></tr>';
}

function renderDetailFamily(familyName) {
    if (!familyName) return;
    const fStats = calcFamilyStats(familyName);

    document.getElementById('detail-fam-name').textContent = familyName;
    document.getElementById('detail-fam-count').textContent = `${fStats.members.length} Orang`;

    const badge = document.getElementById('detail-fam-status-badge');
    badge.textContent = fStats.status;
    badge.className = `badge ${fStats.badgeClass}`;

    document.getElementById('detail-fam-total-tagihan').textContent = formatRp(fStats.totalTagihan);
    document.getElementById('detail-fam-total-dibayar').textContent = formatRp(fStats.totalDibayar);

    const sisaEl = document.getElementById('detail-fam-sisa-tagihan');
    const sisaCard = sisaEl ? sisaEl.closest('.summary-card-sisa') : null;
    if (fStats.sisa === 0 && fStats.kelebihan > 0) {
        sisaEl.textContent = `+${formatRp(fStats.kelebihan)} (Lebih)`;
        sisaEl.className = 'stat-value text-info';
        if (sisaCard) sisaCard.classList.add('is-lebih');
    } else {
        sisaEl.textContent = formatRp(fStats.sisa);
        sisaEl.className = 'stat-value text-danger';
        if (sisaCard) sisaCard.classList.remove('is-lebih');
    }

    // 1. Tabel Daftar Anggota Keluarga
    const tbodyMembers = document.querySelector('#table-detail-fam-members tbody');
    tbodyMembers.innerHTML = '';
    if (fStats.members.length === 0) {
        tbodyMembers.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Belum ada anggota keluarga.</td></tr>';
    } else {
        fStats.members.forEach((m, idx) => {
            const ms = calcParticipantStats(m.id);
            const sisaStr = ms.kelebihan > 0
                ? `<span class="text-info text-bold">+${formatRp(ms.kelebihan)}</span>`
                : `<span class="text-danger text-bold">${formatRp(ms.sisa)}</span>`;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td><strong>${escapeHTML(m.name)}</strong></td>
                <td>${formatRp(ms.totalTagihan)}</td>
                <td class="text-success text-bold">${formatRp(ms.totalDibayar)}</td>
                <td>${sisaStr}</td>
                <td><span class="badge ${ms.badgeClass}">${ms.status}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="openParticipantDetail('${m.id}')">Detail Peserta</button>
                </td>
            `;
            tbodyMembers.appendChild(tr);
        });
    }

    // 2. Tabel Rincian Biaya Keluarga
    const tbodyCosts = document.querySelector('#table-detail-fam-costs tbody');
    tbodyCosts.innerHTML = '';
    const memberIds = fStats.members.map(m => m.id);
    const famCosts = db.costs.filter(c => memberIds.includes(c.participantId));

    if (famCosts.length === 0) {
        tbodyCosts.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Belum ada rincian biaya keluarga.</td></tr>';
    } else {
        famCosts.forEach(c => {
            const memberObj = fStats.members.find(m => m.id === c.participantId);
            const memberName = memberObj ? memberObj.name : '-';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${escapeHTML(memberName)}</strong></td>
                <td>${escapeHTML(c.category)}</td>
                <td>${formatRp(c.price)}</td>
                <td>${c.qty}</td>
                <td><strong>${formatRp(c.total)}</strong></td>
                <td>${escapeHTML(c.notes || '-')}</td>
            `;
            tbodyCosts.appendChild(tr);
        });
    }
    document.getElementById('detail-fam-sum-costs').textContent = formatRp(fStats.totalTagihan);

    // 3. Tabel Riwayat Pembayaran Keluarga (Alokasi)
    const tbodyPays = document.querySelector('#table-detail-fam-payments tbody');
    tbodyPays.innerHTML = '';
    let hasPayment = false;
    db.payments.forEach(pay => {
        if (pay.allocations) {
            pay.allocations.forEach(alloc => {
                if (memberIds.includes(alloc.participantId)) {
                    hasPayment = true;
                    const memberObj = fStats.members.find(m => m.id === alloc.participantId);
                    const memberName = memberObj ? memberObj.name : '-';
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${formatDate(pay.date)}</td>
                        <td><strong>${escapeHTML(memberName)}</strong></td>
                        <td class="text-success text-bold">${formatRp(alloc.amount)}</td>
                        <td>${escapeHTML(pay.method)}</td>
                        <td>${escapeHTML(pay.notes || '-')}</td>
                    `;
                    tbodyPays.appendChild(tr);
                }
            });
        }
    });
    if (!hasPayment) {
        tbodyPays.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Belum ada riwayat pembayaran keluarga.</td></tr>';
    }
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

const getPrintStyles = () => `
    <style>
        .print-wrap { width: 100%; max-width: 720px; margin: 0 auto; padding: 24px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #ffffff; color: #1e293b; box-sizing: border-box; }
        .print-header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
        .print-header h2 { margin: 0; color: #0f172a; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; }
        .print-header p { margin: 4px 0 0; font-size: 13px; font-weight: 600; color: #64748b; letter-spacing: 1px; }
        .print-info { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13.5px; }
        .print-info td { padding: 4px 0; vertical-align: top; color: #1e293b; }
        .print-info td.info-label { width: 155px; font-weight: 700; color: #334155; }
        .print-info td.info-sep { width: 12px; text-align: center; font-weight: 700; }
        .print-section-title { font-weight: 700; font-size: 13.5px; color: #0f172a; margin: 14px 0 6px 0; }
        .print-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px; table-layout: auto; }
        .print-table th, .print-table td { border: 1px solid #cbd5e1; padding: 9px 12px; text-align: left; vertical-align: middle; }
        .print-table th { background-color: #f1f5f9; font-weight: 700; color: #0f172a; white-space: nowrap; }
        .print-table tr:nth-child(even) { background-color: #f8fafc; }
        .print-table td.nowrap, .print-table th.nowrap { white-space: nowrap !important; }
        .print-wrap .text-right { text-align: right !important; }
        .print-wrap .text-center { text-align: center !important; }
        .print-wrap .text-success { color: #16a34a !important; font-weight: 700; }
        .print-wrap .text-danger { color: #dc2626 !important; font-weight: 700; }
        .print-wrap .text-info { color: #0284c7 !important; font-weight: 700; }
        .print-wrap .text-bold { font-weight: 700; }
        .print-summary { background: #f8fafc; padding: 16px 18px; border: 1px solid #cbd5e1; border-radius: 8px; margin-top: 16px; }
        .print-summary-title { font-weight: 800; font-size: 13.5px; color: #0f172a; margin-bottom: 8px; text-transform: uppercase; }
        .print-summary-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 13.5px; color: #334155; }
        .print-summary-row.total-row { border-top: 1px solid #cbd5e1; margin-top: 8px; padding-top: 10px; font-size: 15px; font-weight: 800; color: #0f172a; }
        .print-footer { margin-top: 20px; text-align: center; font-size: 11.5px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
    </style>
`;

document.getElementById('btn-print-individual').addEventListener('click', () => {
    const p = db.participants.find(x => x.id === currentDetailId);
    if (!p) return;
    currentRingkasanType = 'individual';

    const stats = calcParticipantStats(p.id);
    const pCosts = db.costs.filter(c => c.participantId === p.id);
    
    let html = getPrintStyles() + `<div class="print-wrap">`;
    html += `
        <div class="print-header">
            <h2>RINGKASAN BIAYA INDIVIDU</h2>
            <p>TOUR DAVKA TRAVEL</p>
        </div>
        <table class="print-info">
            <tr><td class="info-label">Nama Peserta</td><td class="info-sep">:</td><td><strong>${escapeHTML(p.name)}</strong></td></tr>
            <tr><td class="info-label">Keluarga/Grup</td><td class="info-sep">:</td><td>${escapeHTML(p.family)}</td></tr>
            <tr><td class="info-label">Status</td><td class="info-sep">:</td><td><strong>${stats.status}</strong></td></tr>
        </table>
        
        <div class="print-section-title">A. Rincian Biaya</div>
        <table class="print-table">
            <thead>
                <tr>
                    <th style="width: 40px;" class="text-center">No</th>
                    <th>Deskripsi Kategori</th>
                    <th class="text-right nowrap" style="width: 160px;">Total Biaya (Rp)</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    if(pCosts.length === 0) {
        html += `<tr><td colspan="3" class="text-center text-muted">Belum ada tagihan biaya</td></tr>`;
    } else {
        pCosts.forEach((c, idx) => {
            let noteStr = c.notes ? `<div style="font-size:11.5px; color:#64748b; margin-top:2px;">Catatan: ${escapeHTML(c.notes)}</div>` : '';
            html += `<tr>
                <td class="text-center">${idx + 1}</td>
                <td><strong>${escapeHTML(c.category)}</strong> ${c.qty > 1 ? `(${c.qty}x)` : ''}${noteStr}</td>
                <td class="text-right nowrap text-bold">${formatRp(c.total)}</td>
            </tr>`;
        });
    }
    
    html += `</tbody></table>`;
    html += `<div class="print-section-title">B. Riwayat Pembayaran</div>
        <table class="print-table">
            <thead>
                <tr>
                    <th style="width: 40px;" class="text-center">No</th>
                    <th>Tanggal Pembayaran</th>
                    <th>Metode</th>
                    <th class="text-right nowrap" style="width: 160px;">Nominal (Rp)</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    let payCount = 0;
    db.payments.forEach(pay => {
        if(pay.allocations) {
            const alloc = pay.allocations.find(a => a.participantId === p.id);
            if(alloc) {
                payCount++;
                html += `<tr>
                    <td class="text-center">${payCount}</td>
                    <td class="nowrap">${formatDate(pay.date)}</td>
                    <td>${escapeHTML(pay.method || '-')}</td>
                    <td class="text-right nowrap text-success">${formatRp(alloc.amount)}</td>
                </tr>`;
            }
        }
    });
    if(payCount === 0) html += `<tr><td colspan="4" class="text-center text-muted">Belum ada riwayat pembayaran</td></tr>`;
    html += `</tbody></table>`;
    
    html += `
        <div class="print-summary">
            <div class="print-summary-title">TOTAL RINGKASAN INDIVIDU:</div>
            <div class="print-summary-row">
                <span>Total Tagihan:</span>
                <strong class="nowrap">${formatRp(stats.totalTagihan)}</strong>
            </div>
            <div class="print-summary-row">
                <span>Total Dibayar:</span>
                <strong class="text-success nowrap">${formatRp(stats.totalDibayar)}</strong>
            </div>
    `;
    
    if(stats.kelebihan > 0) {
        html += `
            <div class="print-summary-row total-row">
                <span>TOTAL KELEBIHAN BAYAR:</span>
                <span class="text-info nowrap">+${formatRp(stats.kelebihan)}</span>
            </div>
        `;
    } else {
        html += `
            <div class="print-summary-row total-row">
                <span>TOTAL SISA DIBAYAR:</span>
                <span class="text-danger nowrap">${formatRp(stats.sisa)}</span>
            </div>
        `;
    }
    
    html += `</div>
        <div class="print-footer">Dicetak otomatis oleh Sistem Manajemen Davka Travel</div>
    </div>`;

    document.getElementById('ringkasan-print-area').innerHTML = html;
    openModal('modal-ringkasan');
});

document.getElementById('btn-print-family').addEventListener('click', () => {
    let targetFamily = currentDetailFamily;
    if (!targetFamily && currentDetailId) {
        const p = db.participants.find(x => x.id === currentDetailId);
        if (p) targetFamily = p.family;
    }
    if (!targetFamily) return;
    currentRingkasanType = 'family';

    const fStats = calcFamilyStats(targetFamily);
    
    let html = getPrintStyles() + `<div class="print-wrap">`;
    html += `
        <div class="print-header">
            <h2>RINGKASAN BIAYA KELUARGA</h2>
            <p>TOUR DAVKA TRAVEL</p>
        </div>
        <table class="print-info">
            <tr><td class="info-label">Nama Keluarga/Grup</td><td class="info-sep">:</td><td><strong>${escapeHTML(targetFamily)}</strong></td></tr>
            <tr><td class="info-label">Jumlah Anggota</td><td class="info-sep">:</td><td>${fStats.members.length} Orang</td></tr>
        </table>
        
        <table class="print-table">
            <thead>
                <tr>
                    <th style="width: 40px;" class="text-center">No</th>
                    <th>Nama Peserta</th>
                    <th class="text-right nowrap" style="width: 130px;">Tagihan</th>
                    <th class="text-right nowrap" style="width: 130px;">Dibayar</th>
                    <th class="text-right nowrap" style="width: 130px;">Sisa/Lebih</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    fStats.members.forEach((m, idx) => {
        const stats = calcParticipantStats(m.id);
        let sisaStr = stats.kelebihan > 0 ? `<span class="text-info">+${formatRp(stats.kelebihan)}</span>` : `<span class="text-danger">${formatRp(stats.sisa)}</span>`;
        html += `<tr>
            <td class="text-center">${idx + 1}</td>
            <td><strong>${escapeHTML(m.name)}</strong><div style="font-size:11px; color:#64748b; margin-top:2px;">${stats.status}</div></td>
            <td class="text-right nowrap">${formatRp(stats.totalTagihan)}</td>
            <td class="text-right nowrap text-success">${formatRp(stats.totalDibayar)}</td>
            <td class="text-right nowrap">${sisaStr}</td>
        </tr>`;
    });
    
    html += `</tbody></table>`;
    html += `
        <div class="print-summary">
            <div class="print-summary-title">TOTAL BIAYA KELUARGA:</div>
            <div class="print-summary-row">
                <span>Total Tagihan:</span>
                <strong class="nowrap">${formatRp(fStats.totalTagihan)}</strong>
            </div>
            <div class="print-summary-row">
                <span>Total Dibayar:</span>
                <strong class="text-success nowrap">${formatRp(fStats.totalDibayar)}</strong>
            </div>
    `;
    
    if(fStats.sisa === 0 && fStats.kelebihan > 0) {
        html += `
            <div class="print-summary-row total-row">
                <span>TOTAL KELEBIHAN BAYAR:</span>
                <span class="text-info nowrap">+${formatRp(fStats.kelebihan)}</span>
            </div>
        `;
    } else {
        html += `
            <div class="print-summary-row total-row">
                <span>TOTAL SISA DIBAYAR:</span>
                <span class="text-danger nowrap">${formatRp(fStats.sisa)}</span>
            </div>
        `;
    }
    
    html += `</div>
        <div class="print-footer">Dicetak otomatis oleh Sistem Manajemen Davka Travel</div>
    </div>`;

    document.getElementById('ringkasan-print-area').innerHTML = html;
    openModal('modal-ringkasan');
});

// 1. FUNGSI CETAK (PRINT) WI-FI / LAN / SISTEM PADA MODAL RINGKASAN (INDIVIDU & KELUARGA)
function triggerSystemPrintRingkasan() {
    document.body.classList.add('printing-ringkasan');
    window.print();
    setTimeout(() => {
        document.body.classList.remove('printing-ringkasan');
    }, 500);
}

window.addEventListener('afterprint', () => {
    document.body.classList.remove('printing-ringkasan');
});

const btnPrintRingkasan = document.getElementById('btn-print-ringkasan');
if (btnPrintRingkasan) {
    btnPrintRingkasan.addEventListener('click', () => {
        triggerSystemPrintRingkasan();
    });
}

// 2. FUNGSI CETAK BLUETOOTH (ESC/POS & FALLBACK) PADA MODAL RINGKASAN (INDIVIDU & KELUARGA)
const btnPrintBtRingkasan = document.getElementById('btn-print-bluetooth-ringkasan');
if (btnPrintBtRingkasan) {
    btnPrintBtRingkasan.addEventListener('click', async () => {
        if (!navigator.bluetooth) {
            showToast('Membuka dialog printer sistem (Pilih printer Bluetooth Anda)...', 'warning');
            setTimeout(() => triggerSystemPrintRingkasan(), 600);
            return;
        }

        const originalText = btnPrintBtRingkasan.textContent;
        btnPrintBtRingkasan.disabled = true;
        btnPrintBtRingkasan.textContent = 'Menghubungkan BT...';

        try {
            if (typeof btCharacteristic === 'undefined' || !btCharacteristic) {
                const device = await navigator.bluetooth.requestDevice({
                    acceptAllDevices: true,
                    optionalServices: [
                        '000018f0-0000-1000-8000-00805f9b34fb',
                        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
                        '49535343-fe7d-4ae5-8fa9-9fafd205e455'
                    ]
                });

                const server = await device.gatt.connect();
                const services = await server.getPrimaryServices();
                for (const service of services) {
                    const characteristics = await service.getCharacteristics();
                    for (const char of characteristics) {
                        if (char.properties.write || char.properties.writeWithoutResponse) {
                            btCharacteristic = char;
                            break;
                        }
                    }
                    if (btCharacteristic) break;
                }
            }

            if (!btCharacteristic) {
                throw new Error('Karakteristik tulis printer Bluetooth tidak ditemukan.');
            }

            const receiptText = buildThermalRingkasanText();
            const encoder = new TextEncoder();
            const dataBytes = encoder.encode(receiptText);

            const chunkSize = 100;
            for (let i = 0; i < dataBytes.length; i += chunkSize) {
                const chunk = dataBytes.slice(i, i + chunkSize);
                if (btCharacteristic.properties.writeWithoutResponse) {
                    await btCharacteristic.writeValueWithoutResponse(chunk);
                } else {
                    await btCharacteristic.writeValue(chunk);
                }
            }

            showToast('Berhasil mencetak ke Printer Bluetooth!');
        } catch (err) {
            console.warn('Bluetooth Print Ringkasan Info:', err);
            if (typeof btCharacteristic !== 'undefined') btCharacteristic = null;
            if (err.name !== 'NotFoundError') {
                showToast('Gagal koneksi langsung BT. Membuka dialog cetak sistem...', 'warning');
                setTimeout(() => triggerSystemPrintRingkasan(), 800);
            } else {
                showToast('Pencarian printer Bluetooth dibatalkan.', 'warning');
            }
        } finally {
            btnPrintBtRingkasan.disabled = false;
            btnPrintBtRingkasan.textContent = originalText;
        }
    });
}

function buildThermalRingkasanText() {
    const line = '--------------------------------\n';
    let out = '\x1B\x40'; // Init ESC/POS
    out += '\x1B\x61\x01'; // Align Center

    if (currentRingkasanType === 'individual') {
        const p = db.participants.find(x => x.id === currentDetailId);
        if (!p) return '';
        const stats = calcParticipantStats(p.id);
        const pCosts = db.costs.filter(c => c.participantId === p.id);

        out += 'RINGKASAN BIAYA INDIVIDU\n';
        out += 'TOUR DAVKA TRAVEL\n';
        out += line;
        out += '\x1B\x61\x00'; // Align Left
        out += `Nama     : ${p.name}\n`;
        out += `Keluarga : ${p.family}\n`;
        out += `Status   : ${stats.status}\n`;
        out += line;
        out += 'A. RINCIAN BIAYA:\n';
        if (pCosts.length === 0) {
            out += '- Belum ada tagihan biaya\n';
        } else {
            pCosts.forEach((c, idx) => {
                out += `${idx + 1}. ${c.category}${c.qty > 1 ? ` (${c.qty}x)` : ''}: ${formatRp(c.total)}\n`;
                if (c.notes) out += `   Catatan: ${c.notes}\n`;
            });
        }
        out += line;
        out += 'B. RIWAYAT PEMBAYARAN:\n';
        let payCount = 0;
        db.payments.forEach(pay => {
            if (pay.allocations) {
                const alloc = pay.allocations.find(a => a.participantId === p.id);
                if (alloc) {
                    payCount++;
                    out += `${payCount}. ${formatDate(pay.date)} (${pay.method || '-'}): ${formatRp(alloc.amount)}\n`;
                }
            }
        });
        if (payCount === 0) {
            out += '- Belum ada pembayaran\n';
        }
        out += line;
        out += `Total Tagihan : ${formatRp(stats.totalTagihan)}\n`;
        out += `Total Dibayar : ${formatRp(stats.totalDibayar)}\n`;
        if (stats.kelebihan > 0) {
            out += `Kelebihan Byr : +${formatRp(stats.kelebihan)}\n`;
        } else {
            out += `Total Sisa    : ${formatRp(stats.sisa)}\n`;
        }
    } else {
        let targetFamily = currentDetailFamily;
        if (!targetFamily && currentDetailId) {
            const p = db.participants.find(x => x.id === currentDetailId);
            if (p) targetFamily = p.family;
        }
        if (!targetFamily) return '';
        const fStats = calcFamilyStats(targetFamily);

        out += 'RINGKASAN BIAYA KELUARGA\n';
        out += 'TOUR DAVKA TRAVEL\n';
        out += line;
        out += '\x1B\x61\x00'; // Align Left
        out += `Keluarga : ${targetFamily}\n`;
        out += `Anggota  : ${fStats.members.length} Orang\n`;
        out += line;
        fStats.members.forEach((m, idx) => {
            const ms = calcParticipantStats(m.id);
            const sisaTxt = ms.kelebihan > 0 ? `+${formatRp(ms.kelebihan)}` : formatRp(ms.sisa);
            out += `${idx + 1}. ${m.name} (${ms.status})\n`;
            out += `   Tagihan: ${formatRp(ms.totalTagihan)} | Dibayar: ${formatRp(ms.totalDibayar)}\n`;
            out += `   Sisa/Lebih: ${sisaTxt}\n`;
        });
        out += line;
        out += `Total Tagihan : ${formatRp(fStats.totalTagihan)}\n`;
        out += `Total Dibayar : ${formatRp(fStats.totalDibayar)}\n`;
        if (fStats.sisa === 0 && fStats.kelebihan > 0) {
            out += `Kelebihan Byr : +${formatRp(fStats.kelebihan)}\n`;
        } else {
            out += `Total Sisa    : ${formatRp(fStats.sisa)}\n`;
        }
    }

    out += line;
    out += '\x1B\x61\x01'; // Align Center
    out += 'Dicetak oleh Sistem Davka Travel\n\n\n\n';
    return out;
}

// 3. FUNGSI SIMPAN SEBAGAI JPG PADA MODAL RINGKASAN (INDIVIDU & KELUARGA)
document.getElementById('btn-download-jpeg').addEventListener('click', async () => {
    const btn = document.getElementById('btn-download-jpeg');
    const printArea = document.getElementById('ringkasan-print-area');
    const targetEl = printArea.querySelector('.print-wrap') || printArea;

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Memproses JPG...';

    try {
        if (typeof html2canvas === 'function') {
            const canvas = await html2canvas(targetEl, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                windowWidth: 800,
                onclone: (clonedDoc) => {
                    const clonedWrap = clonedDoc.querySelector('.print-wrap');
                    if (clonedWrap) {
                        clonedWrap.style.width = '720px';
                        clonedWrap.style.maxWidth = '720px';
                        clonedWrap.style.margin = '0';
                        clonedWrap.style.boxShadow = 'none';
                        clonedWrap.style.transform = 'none';
                    }
                }
            });

            const jpegUrl = canvas.toDataURL('image/jpeg', 0.95);
            const link = document.createElement('a');
            link.download = `Ringkasan_Biaya_${Date.now()}.jpg`;
            link.href = jpegUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showToast('Ringkasan berhasil disimpan sebagai JPG!');
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
