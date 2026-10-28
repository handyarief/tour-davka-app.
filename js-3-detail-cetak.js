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
    const rawAllocCount = db.payments.reduce((cnt, pay) => {
        if (pay.allocations && pay.allocations.some(a => a.participantId === id && a.amount > 0)) return cnt + 1;
        return cnt;
    }, 0);

    db.payments.forEach(pay => {
        if(pay.allocations) {
            const alloc = pay.allocations.find(a => a.participantId === id && a.amount > 0);
            if(alloc) {
                hasPayment = true;
                // Jika sinkron keluarga (bukan manual) dan hanya 1 pembayaran yang menutup lunas tagihan, tampilkan nilai yang sinkron dengan tagihan peserta
                const displayAmount = (!stats.isManualPayment && stats.isSyncedWithFamily && stats.status === 'LUNAS' && rawAllocCount === 1)
                    ? stats.totalDibayar
                    : alloc.amount;
                const modeNote = (!stats.isManualPayment && stats.isSyncedWithFamily)
                    ? (pay.notes ? `${pay.notes} (Kolektif Keluarga)` : 'Alokasi Kolektif Keluarga')
                    : (pay.notes || '-');
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${formatDate(pay.date)}</td>
                    <td class="text-success text-bold">${formatRp(displayAmount)}</td>
                    <td>${escapeHTML(pay.method)}</td>
                    <td>${escapeHTML(modeNote)}</td>
                `;
                tbodyPays.appendChild(tr);
            }
        }
    });
    if(!hasPayment) tbodyPays.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Belum ada riwayat pembayaran.</td></tr>';
}

// Helper untuk membangun data matriks biaya keluarga per kategori
function buildFamilyCostMatrix(members) {
    const sortedMembers = members.slice().sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', 'id', { sensitivity: 'base' })
    );
    const memberIds = sortedMembers.map(m => m.id);
    const famCosts = db.costs.filter(c => memberIds.includes(c.participantId));

    const usedCategoriesSet = new Set();
    famCosts.forEach(c => {
        if (c.category) usedCategoriesSet.add(c.category);
    });
    const usedCategories = Array.from(usedCategoriesSet).sort((a, b) =>
        a.localeCompare(b, 'id', { sensitivity: 'base' })
    );

    const categoryTotals = {};
    usedCategories.forEach(cat => { categoryTotals[cat] = 0; });

    let grandTotal = 0;
    const memberRows = sortedMembers.map(m => {
        const mCosts = famCosts.filter(c => c.participantId === m.id);
        const catMap = {};
        usedCategories.forEach(cat => { catMap[cat] = 0; });

        let rowTotal = 0;
        mCosts.forEach(c => {
            if (c.category) {
                catMap[c.category] = (catMap[c.category] || 0) + c.total;
                categoryTotals[c.category] = (categoryTotals[c.category] || 0) + c.total;
                rowTotal += c.total;
            }
        });
        grandTotal += rowTotal;

        return {
            member: m,
            catMap,
            rowTotal
        };
    });

    return {
        sortedMembers,
        memberIds,
        famCosts,
        usedCategories,
        categoryTotals,
        grandTotal,
        memberRows
    };
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

    // 2. Tabel Rincian Biaya Keluarga (Tabel Matriks: Nama | Per Kategori | Total + Total per Kategori & Total Semua)
    const tableCosts = document.getElementById('table-detail-fam-costs');
    const theadCosts = tableCosts.querySelector('thead');
    const tbodyCosts = tableCosts.querySelector('tbody');
    tbodyCosts.innerHTML = '';

    const matrix = buildFamilyCostMatrix(fStats.members);

    if (matrix.famCosts.length === 0) {
        theadCosts.innerHTML = `
            <tr>
                <th style="width: 45px;">No</th>
                <th>Nama Peserta</th>
                <th class="text-right">Total</th>
            </tr>
        `;
        tbodyCosts.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Belum ada rincian biaya keluarga.</td></tr>';
    } else {
        let thHtml = `<tr><th style="width: 45px;">No</th><th>Nama Peserta</th>`;
        matrix.usedCategories.forEach(cat => {
            thHtml += `<th class="text-right">${escapeHTML(cat)}</th>`;
        });
        thHtml += `<th class="text-right">Total</th></tr>`;
        theadCosts.innerHTML = thHtml;

        matrix.memberRows.forEach((row, idx) => {
            const tr = document.createElement('tr');
            let tdHtml = `
                <td>${idx + 1}</td>
                <td><strong>${escapeHTML(row.member.name)}</strong></td>
            `;
            matrix.usedCategories.forEach(cat => {
                const val = row.catMap[cat] || 0;
                tdHtml += `<td class="text-right">${val > 0 ? formatRp(val) : '-'}</td>`;
            });
            tdHtml += `<td class="text-right"><strong>${formatRp(row.rowTotal)}</strong></td>`;
            tr.innerHTML = tdHtml;
            tbodyCosts.appendChild(tr);
        });

        // Baris Total per Kategori
        const trCatTotal = document.createElement('tr');
        trCatTotal.className = 'fam-cost-summary-row';
        let catTotalHtml = `<td colspan="2" class="text-right">TOTAL PER KATEGORI</td>`;
        matrix.usedCategories.forEach(cat => {
            catTotalHtml += `<td class="text-right">${formatRp(matrix.categoryTotals[cat] || 0)}</td>`;
        });
        catTotalHtml += `<td class="text-right">${formatRp(matrix.grandTotal)}</td>`;
        trCatTotal.innerHTML = catTotalHtml;
        tbodyCosts.appendChild(trCatTotal);

        // Baris Total Semua
        const trGrandTotal = document.createElement('tr');
        trGrandTotal.className = 'fam-cost-grand-row';
        const colSpanCount = 2 + matrix.usedCategories.length;
        trGrandTotal.innerHTML = `
            <td colspan="${colSpanCount}" class="text-right">TOTAL SEMUA BIAYA KELUARGA</td>
            <td class="text-right">${formatRp(matrix.grandTotal)}</td>
        `;
        tbodyCosts.appendChild(trGrandTotal);
    }
    document.getElementById('detail-fam-sum-costs').textContent = formatRp(fStats.totalTagihan);

    // 3. Tabel Riwayat Pembayaran Keluarga (Alokasi)
    const tbodyPays = document.querySelector('#table-detail-fam-payments tbody');
    tbodyPays.innerHTML = '';
    const memberIds = fStats.members.map(m => m.id);
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

// Style injeksi CSS print dilengkapi Watermark Resmi Davka Tour
const getPrintStyles = () => `
    <style>
        .print-wrap { position: relative; overflow: hidden; width: 100%; max-width: 720px; margin: 0 auto; padding: 24px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #ffffff; color: #1e293b; box-sizing: border-box; }
        .print-wrap.print-wrap-wide { max-width: 100%; }
        .print-header, .print-info, .print-section-title, .print-table, .print-summary, .print-footer { position: relative; z-index: 1; }
        .print-header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
        .print-header h2 { margin: 0; color: #0f172a; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; }
        .print-header p { margin: 4px 0 0; font-size: 13px; font-weight: 600; color: #64748b; letter-spacing: 1px; }
        .print-info { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13.5px; }
        .print-info td { padding: 4px 0; vertical-align: top; color: #1e293b; }
        .print-info td.info-label { width: 155px; font-weight: 700; color: #334155; }
        .print-info td.info-sep { width: 12px; text-align: center; font-weight: 700; }
        .print-section-title { font-weight: 700; font-size: 13.5px; color: #0f172a; margin: 16px 0 8px 0; text-transform: uppercase; letter-spacing: 0.3px; }
        .print-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12.5px; table-layout: auto; }
        .print-table th, .print-table td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; vertical-align: middle; }
        .print-table th { background-color: rgba(241, 245, 249, 0.92); font-weight: 700; color: #0f172a; white-space: normal; line-height: 1.3; }
        .print-table tr:nth-child(even) { background-color: rgba(248, 250, 252, 0.88); }
        .print-table tr.matrix-total-row td { background-color: rgba(241, 245, 249, 0.94) !important; font-weight: 700; color: #0f172a; border-top: 2px solid #94a3b8; }
        .print-table tr.matrix-grand-row td { background-color: rgba(224, 242, 254, 0.94) !important; font-weight: 800; color: #0369a1; font-size: 13.5px; border-top: 1px solid #94a3b8; }
        .print-table td.nowrap, .print-table th.nowrap { white-space: nowrap !important; }
        .print-table th.cat-header { min-width: 85px; max-width: 130px; word-wrap: break-word; }
        .print-wrap .text-right { text-align: right !important; }
        .print-wrap .text-center { text-align: center !important; }
        .print-wrap .text-success { color: #16a34a !important; font-weight: 700; }
        .print-wrap .text-danger { color: #dc2626 !important; font-weight: 700; }
        .print-wrap .text-info { color: #0284c7 !important; font-weight: 700; }
        .print-wrap .text-bold { font-weight: 700; }
        .print-summary { background: rgba(248, 250, 252, 0.92); padding: 16px 18px; border: 1px solid #cbd5e1; border-radius: 8px; margin-top: 16px; }
        .print-summary-title { font-weight: 800; font-size: 13.5px; color: #0f172a; margin-bottom: 8px; text-transform: uppercase; }
        .print-summary-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 13.5px; color: #334155; }
        .print-summary-row.total-row { border-top: 1px solid #cbd5e1; margin-top: 8px; padding-top: 10px; font-size: 15px; font-weight: 800; color: #0f172a; }
        .print-footer { margin-top: 20px; text-align: center; font-size: 11.5px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
        .nota-watermark-layer { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; user-select: none; z-index: 3; overflow: hidden; }
        .nota-watermark-inner { display: flex; flex-direction: column; align-items: center; justify-content: center; transform: rotate(-22deg); opacity: 0.085; text-align: center; padding: 18px 28px; border: 2.5px dashed #0369a1; border-radius: 16px; }
        .nota-watermark-inner.watermark-lg { transform: rotate(-20deg) scale(1.12); }
        .nota-watermark-logo { width: 240px; height: auto; object-fit: contain; display: block; margin-bottom: 6px; }
        .nota-watermark-stamp { font-size: 13px; font-weight: 800; letter-spacing: 3px; color: #0369a1; text-transform: uppercase; border-top: 1.5px solid #0369a1; padding-top: 4px; margin-top: 2px; white-space: nowrap; }
    </style>
`;

document.getElementById('btn-print-individual').addEventListener('click', () => {
    const p = db.participants.find(x => x.id === currentDetailId);
    if (!p) return;
    currentRingkasanType = 'individual';

    const stats = calcParticipantStats(p.id);
    const pCosts = db.costs.filter(c => c.participantId === p.id);
    
    let html = getPrintStyles() + `<div class="print-wrap">`;
    html += getWatermarkHTML(false);
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
    
    const individualPayEntries = [];
    db.payments.forEach(pay => {
        if(pay.allocations) {
            const alloc = pay.allocations.find(a => a.participantId === p.id && a.amount > 0);
            if(alloc) {
                individualPayEntries.push({ pay, alloc });
            }
        }
    });

    if(individualPayEntries.length === 0) {
        html += `<tr><td colspan="4" class="text-center text-muted">Belum ada riwayat pembayaran</td></tr>`;
    } else {
        individualPayEntries.forEach((entry, idx) => {
            // Jika alokasi berasal dari pembayaran kolektif/bagi rata keluarga (bukan manual) dan keluarga sudah lunas,
            // sinkronkan nominal tampil agar sesuai dengan tagihan individu peserta
            let shownAmount = entry.alloc.amount;
            if (!stats.isManualPayment && stats.isSyncedWithFamily && stats.status === 'LUNAS' && individualPayEntries.length === 1) {
                shownAmount = stats.totalDibayar;
            }
            html += `<tr>
                <td class="text-center">${idx + 1}</td>
                <td class="nowrap">${formatDate(entry.pay.date)}</td>
                <td>${escapeHTML(entry.pay.method || '-')}</td>
                <td class="text-right nowrap text-success">${formatRp(shownAmount)}</td>
            </tr>`;
        });
    }
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
    
    // Sisa Tagihan atau Kelebihan Bayar pada Nota Individu HANYA muncul jika diinput Manual per Peserta
    // atau jika memang masih ada sisa tagihan yang belum terbayar
    if (stats.isManualPayment) {
        if(stats.kelebihan > 0) {
            html += `
                <div class="print-summary-row total-row">
                    <span>TOTAL KELEBIHAN BAYAR:</span>
                    <span class="text-info nowrap">+${formatRp(stats.kelebihan)}</span>
                </div>
            `;
        } else if (stats.sisa > 0) {
            html += `
                <div class="print-summary-row total-row">
                    <span>TOTAL SISA DIBAYAR:</span>
                    <span class="text-danger nowrap">${formatRp(stats.sisa)}</span>
                </div>
            `;
        } else {
            html += `
                <div class="print-summary-row total-row">
                    <span>STATUS PEMBAYARAN:</span>
                    <span class="text-success nowrap">LUNAS</span>
                </div>
            `;
        }
    } else {
        if (stats.sisa > 0) {
            html += `
                <div class="print-summary-row total-row">
                    <span>TOTAL SISA DIBAYAR:</span>
                    <span class="text-danger nowrap">${formatRp(stats.sisa)}</span>
                </div>
            `;
        } else {
            html += `
                <div class="print-summary-row total-row">
                    <span>STATUS PEMBAYARAN:</span>
                    <span class="text-success nowrap">LUNAS (SINKRON KELUARGA)</span>
                </div>
            `;
        }
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
    const matrix = buildFamilyCostMatrix(fStats.members);
    const isWideMatrix = matrix.usedCategories.length >= 3;

    let html = getPrintStyles() + `<div class="print-wrap ${isWideMatrix ? 'print-wrap-wide' : ''}">`;
    html += getWatermarkHTML(isWideMatrix);
    html += `
        <div class="print-header">
            <h2>RINGKASAN BIAYA & PEMBAYARAN KELUARGA</h2>
            <p>TOUR DAVKA TRAVEL</p>
        </div>
        <table class="print-info">
            <tr><td class="info-label">Nama Keluarga/Grup</td><td class="info-sep">:</td><td><strong>${escapeHTML(targetFamily)}</strong></td></tr>
            <tr><td class="info-label">Jumlah Anggota</td><td class="info-sep">:</td><td>${fStats.members.length} Orang</td></tr>
            <tr><td class="info-label">Status Pembayaran</td><td class="info-sep">:</td><td><strong>${fStats.status}</strong></td></tr>
        </table>
    `;

    // A. TABEL MATRIKS RINCIAN BIAYA PER KATEGORI
    html += `<div class="print-section-title">A. Rincian Biaya Keluarga per Kategori</div>`;
    if (matrix.famCosts.length === 0) {
        html += `
            <table class="print-table">
                <thead>
                    <tr>
                        <th style="width: 40px;" class="text-center">No</th>
                        <th>Nama Peserta</th>
                        <th class="text-right nowrap">Total Biaya</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td colspan="3" class="text-center text-muted">Belum ada rincian biaya keluarga</td></tr>
                </tbody>
            </table>
        `;
    } else {
        html += `<table class="print-table"><thead><tr>
            <th style="width: 38px;" class="text-center">No</th>
            <th>Nama Peserta</th>`;
        matrix.usedCategories.forEach(cat => {
            html += `<th class="text-right cat-header">${escapeHTML(cat)}</th>`;
        });
        html += `<th class="text-right nowrap">Total</th></tr></thead><tbody>`;

        matrix.memberRows.forEach((row, idx) => {
            html += `<tr>
                <td class="text-center">${idx + 1}</td>
                <td class="nowrap"><strong>${escapeHTML(row.member.name)}</strong></td>`;
            matrix.usedCategories.forEach(cat => {
                const val = row.catMap[cat] || 0;
                html += `<td class="text-right nowrap">${val > 0 ? formatRp(val) : '-'}</td>`;
            });
            html += `<td class="text-right nowrap text-bold">${formatRp(row.rowTotal)}</td></tr>`;
        });

        // Baris Total per Kategori
        html += `<tr class="matrix-total-row">
            <td colspan="2" class="text-right nowrap">TOTAL PER KATEGORI</td>`;
        matrix.usedCategories.forEach(cat => {
            html += `<td class="text-right nowrap">${formatRp(matrix.categoryTotals[cat] || 0)}</td>`;
        });
        html += `<td class="text-right nowrap">${formatRp(matrix.grandTotal)}</td></tr>`;

        // Baris Total Semua
        const colSpanAll = 2 + matrix.usedCategories.length;
        html += `<tr class="matrix-grand-row">
            <td colspan="${colSpanAll}" class="text-right nowrap">TOTAL SEMUA BIAYA KELUARGA</td>
            <td class="text-right nowrap">${formatRp(matrix.grandTotal)}</td>
        </tr>`;

        html += `</tbody></table>`;
    }

    // REVISI POIN 1: Bagian "Ringkasan Tagihan & Pembayaran Anggota" dihapus dari Nota Keluarga.
    // Bagian Riwayat Pembayaran menjadi "B. Rincian Riwayat Pembayaran Keluarga"
    html += `
        <div class="print-section-title">B. Rincian Riwayat Pembayaran Keluarga</div>
        <table class="print-table">
            <thead>
                <tr>
                    <th style="width: 38px;" class="text-center">No</th>
                    <th style="width: 115px;">Tanggal</th>
                    <th>Nama Peserta (Alokasi)</th>
                    <th style="width: 120px;">Metode</th>
                    <th>Catatan / Ref</th>
                    <th class="text-right nowrap" style="width: 140px;">Nominal (Rp)</th>
                </tr>
            </thead>
            <tbody>
    `;

    const familyPaymentRows = [];
    const sortedPayments = [...db.payments].sort((a, b) => new Date(a.date) - new Date(b.date));
    sortedPayments.forEach(pay => {
        if (pay.allocations) {
            pay.allocations.forEach(alloc => {
                if (matrix.memberIds.includes(alloc.participantId) && alloc.amount > 0) {
                    const memberObj = matrix.sortedMembers.find(m => m.id === alloc.participantId);
                    const infoParts = [];
                    if (pay.ref) infoParts.push(pay.ref);
                    if (pay.notes) infoParts.push(pay.notes);
                    familyPaymentRows.push({
                        date: pay.date,
                        memberName: memberObj ? memberObj.name : '-',
                        method: pay.method || '-',
                        notes: infoParts.length > 0 ? infoParts.join(' - ') : '-',
                        amount: alloc.amount
                    });
                }
            });
        }
    });

    if (familyPaymentRows.length === 0) {
        html += `<tr><td colspan="6" class="text-center text-muted">Belum ada riwayat pembayaran untuk keluarga ini</td></tr>`;
    } else {
        familyPaymentRows.forEach((item, idx) => {
            html += `<tr>
                <td class="text-center">${idx + 1}</td>
                <td class="nowrap">${formatDate(item.date)}</td>
                <td class="nowrap"><strong>${escapeHTML(item.memberName)}</strong></td>
                <td class="nowrap">${escapeHTML(item.method)}</td>
                <td>${escapeHTML(item.notes)}</td>
                <td class="text-right nowrap text-success">${formatRp(item.amount)}</td>
            </tr>`;
        });
        html += `<tr class="matrix-total-row">
            <td colspan="5" class="text-right nowrap">TOTAL PEMBAYARAN DITERIMA KELUARGA</td>
            <td class="text-right nowrap text-success">${formatRp(fStats.totalDibayar)}</td>
        </tr>`;
    }
    html += `</tbody></table>`;

    // RINGKASAN AKHIR KELUARGA
    html += `
        <div class="print-summary">
            <div class="print-summary-title">TOTAL RINGKASAN BIAYA & PEMBAYARAN KELUARGA:</div>
            <div class="print-summary-row">
                <span>Total Biaya / Tagihan Keluarga:</span>
                <strong class="nowrap">${formatRp(fStats.totalTagihan)}</strong>
            </div>
            <div class="print-summary-row">
                <span>Total Sudah Dibayar:</span>
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
                <span>TOTAL SISA TAGIHAN:</span>
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
function cleanupPrintRingkasanClass() {
    document.body.classList.remove('printing-ringkasan');
}

function triggerSystemPrintRingkasan() {
    document.body.classList.add('printing-ringkasan');
    window.print();
}

window.addEventListener('afterprint', cleanupPrintRingkasanClass);

window.addEventListener('focus', () => {
    if (document.body.classList.contains('printing-ringkasan')) {
        setTimeout(cleanupPrintRingkasanClass, 300);
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && document.body.classList.contains('printing-ringkasan')) {
        setTimeout(cleanupPrintRingkasanClass, 300);
    }
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
        const individualPayEntries = [];
        db.payments.forEach(pay => {
            if (pay.allocations) {
                const alloc = pay.allocations.find(a => a.participantId === p.id && a.amount > 0);
                if (alloc) {
                    individualPayEntries.push({ pay, alloc });
                }
            }
        });
        if (individualPayEntries.length === 0) {
            out += '- Belum ada pembayaran\n';
        } else {
            individualPayEntries.forEach((entry, idx) => {
                let shownAmount = entry.alloc.amount;
                if (!stats.isManualPayment && stats.isSyncedWithFamily && stats.status === 'LUNAS' && individualPayEntries.length === 1) {
                    shownAmount = stats.totalDibayar;
                }
                out += `${idx + 1}. ${formatDate(entry.pay.date)} (${entry.pay.method || '-'}): ${formatRp(shownAmount)}\n`;
            });
        }
        out += line;
        out += `Total Tagihan : ${formatRp(stats.totalTagihan)}\n`;
        out += `Total Dibayar : ${formatRp(stats.totalDibayar)}\n`;
        if (stats.isManualPayment) {
            if (stats.kelebihan > 0) {
                out += `Kelebihan Byr : +${formatRp(stats.kelebihan)}\n`;
            } else if (stats.sisa > 0) {
                out += `Total Sisa    : ${formatRp(stats.sisa)}\n`;
            } else {
                out += `Status        : LUNAS\n`;
            }
        } else {
            if (stats.sisa > 0) {
                out += `Total Sisa    : ${formatRp(stats.sisa)}\n`;
            } else {
                out += `Status        : LUNAS (SINKRON KELUARGA)\n`;
            }
        }
    } else {
        let targetFamily = currentDetailFamily;
        if (!targetFamily && currentDetailId) {
            const p = db.participants.find(x => x.id === currentDetailId);
            if (p) targetFamily = p.family;
        }
        if (!targetFamily) return '';
        const fStats = calcFamilyStats(targetFamily);
        const matrix = buildFamilyCostMatrix(fStats.members);

        out += 'RINGKASAN BIAYA KELUARGA\n';
        out += 'TOUR DAVKA TRAVEL\n';
        out += line;
        out += '\x1B\x61\x00'; // Align Left
        out += `Keluarga : ${targetFamily}\n`;
        out += `Anggota  : ${fStats.members.length} Orang\n`;
        out += `Status   : ${fStats.status}\n`;
        out += line;

        out += 'A. RINCIAN BIAYA ANGGOTA:\n';
        matrix.memberRows.forEach((row, idx) => {
            out += `${idx + 1}. ${row.member.name}\n`;
            matrix.usedCategories.forEach(cat => {
                const val = row.catMap[cat] || 0;
                if (val > 0) {
                    out += `   - ${cat}: ${formatRp(val)}\n`;
                }
            });
            out += `   Subtotal: ${formatRp(row.rowTotal)}\n`;
        });
        out += line;

        out += 'TOTAL PER KATEGORI:\n';
        if (matrix.usedCategories.length === 0) {
            out += '- Belum ada kategori biaya\n';
        } else {
            matrix.usedCategories.forEach(cat => {
                out += `- ${cat}: ${formatRp(matrix.categoryTotals[cat] || 0)}\n`;
            });
        }
        out += `TOTAL SEMUA: ${formatRp(matrix.grandTotal)}\n`;
        out += line;

        // REVISI POIN 1: Bagian Status per Anggota dihapus, langsung ke B. Riwayat Pembayaran Keluarga
        out += 'B. RIWAYAT PEMBAYARAN KELUARGA:\n';
        let famPayCount = 0;
        const sortedPayments = [...db.payments].sort((a, b) => new Date(a.date) - new Date(b.date));
        sortedPayments.forEach(pay => {
            if (pay.allocations) {
                pay.allocations.forEach(alloc => {
                    if (matrix.memberIds.includes(alloc.participantId) && alloc.amount > 0) {
                        famPayCount++;
                        const memberObj = matrix.sortedMembers.find(m => m.id === alloc.participantId);
                        const memberName = memberObj ? memberObj.name : '-';
                        out += `${famPayCount}. ${formatDate(pay.date)} - ${memberName}\n`;
                        out += `   ${pay.method || '-'}: ${formatRp(alloc.amount)}\n`;
                    }
                });
            }
        });
        if (famPayCount === 0) {
            out += '- Belum ada pembayaran\n';
        }
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
    out += 'DOKUMEN ASLI - DAVKA TRAVEL\n\n\n\n';
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
            const requiredWidth = Math.max(targetEl.scrollWidth + 48, 720); 

            const canvas = await html2canvas(targetEl, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                windowWidth: requiredWidth + 80,
                onclone: (clonedDoc) => {
                    const clonedWrap = clonedDoc.querySelector('.print-wrap');
                    if (clonedWrap) {
                        clonedWrap.style.width = `${requiredWidth}px`;
                        clonedWrap.style.maxWidth = `${requiredWidth}px`;
                        clonedWrap.style.margin = '0';
                        clonedWrap.style.boxShadow = 'none';
                        clonedWrap.style.transform = 'none';
                        clonedWrap.style.position = 'relative';
                        clonedWrap.style.overflow = 'hidden';
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
