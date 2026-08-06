/**
 * 后台管理逻辑 (转介绍数据统筹与修改、工人授权管理)
 */

let allUsers = [];
let allWorkers = [];
let allRegions = [];
let currentThreshold = 5;
let currentSelectedRegion = 'ALL';
let currentQrUrl = '';

document.addEventListener('DOMContentLoaded', async () => {
  if (window.db.isAdminAuthenticated()) {
    unlockAdminView();
  } else {
    document.getElementById('adminLoginModal').classList.add('active');
    document.getElementById('adminMainContent').style.display = 'none';
  }
});

async function handleAdminLogin(event) {
  event.preventDefault();
  const passwordInput = document.getElementById('adminPassword');
  const password = passwordInput.value.trim();

  const isOk = await window.db.verifyAdminPassword(password);
  if (isOk) {
    unlockAdminView();
  } else {
    alert('密码错误！');
    passwordInput.value = '';
    passwordInput.focus();
  }
}

async function unlockAdminView() {
  document.getElementById('adminLoginModal').classList.remove('active');
  document.getElementById('adminMainContent').style.display = 'block';
  await loadAdminData();
}

function handleAdminLogout() {
  window.db.adminLogout();
  location.reload();
}

async function loadAdminData() {
  const settings = await window.db.getSettings();
  currentThreshold = parseInt(settings.referral_threshold, 10) || 5;
  document.getElementById('thresholdInput').value = currentThreshold;

  allRegions = await window.db.getRegions();
  allWorkers = await window.db.getWorkers();

  populateRegionFilterOptions();
  allUsers = await window.db.getAllUsers(currentSelectedRegion);

  renderStats();
  renderRegions();
  renderWorkers();
  renderTable(allUsers);
}

function populateRegionFilterOptions() {
  const filterSelect = document.getElementById('regionFilter');
  if (!filterSelect) return;

  const options = [
    `<option value="ALL" ${currentSelectedRegion === 'ALL' ? 'selected' : ''}>🌐 全部区域 (汇总全览)</option>`
  ];

  allRegions.forEach(r => {
    options.push(`<option value="${r.code}" ${currentSelectedRegion === r.code ? 'selected' : ''}>📍 ${escapeHtml(r.name)} (${r.code})</option>`);
  });

  filterSelect.innerHTML = options.join('');
}

async function handleRegionFilterChange() {
  const select = document.getElementById('regionFilter');
  currentSelectedRegion = select.value;
  allUsers = await window.db.getAllUsers(currentSelectedRegion);
  renderStats();
  renderTable(allUsers);
}

function renderStats() {
  const total = allUsers.length;
  const freeCount = allUsers.filter(u => u.is_free).length;
  const completedReferrals = allUsers.filter(u => u.status === '已完工' && u.referrer_id).length;

  document.getElementById('statTotalUsers').innerText = total;
  document.getElementById('statFreeUsers').innerText = freeCount;
  document.getElementById('statReferrals').innerText = completedReferrals;
  document.getElementById('statThreshold').innerText = `${currentThreshold} 人`;
}

// 渲染区域列表卡片
function renderRegions() {
  const container = document.getElementById('regionListContainer');
  if (!container) return;

  if (allRegions.length === 0) {
    container.innerHTML = `<div style="color: #94a3b8; font-size: 15px; padding: 6px 0;">暂无区域，请在上方创建第一个划分区域</div>`;
    return;
  }

  container.innerHTML = allRegions.map(r => `
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid #10b981; padding: 14px 18px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.03); min-width: 260px; flex: 1;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
        <h4 style="font-size: 17px; color: #1e293b; margin: 0;">📍 ${escapeHtml(r.name)}</h4>
        <span style="background: #dcfce7; color: #15803d; font-size: 12px; font-weight: bold; padding: 2px 6px; border-radius: 4px;">${r.code}</span>
      </div>
      <div style="font-size: 14px; color: #64748b; margin-bottom: 10px;">
        👤 负责人: ${escapeHtml(r.manager_name || '未设置')} ${r.manager_phone ? '(' + r.manager_phone + ')' : ''}
      </div>
      <div style="display: flex; gap: 8px;">
        <button onclick="showQrModal('${r.code}', '${escapeHtml(r.name)}')" class="btn btn-primary" style="height: 36px; padding: 0 12px; font-size: 14px; background: #10b981; border-color: #10b981;">
          📷 初始二维码
        </button>
        <button onclick="filterByRegion('${r.code}')" class="btn btn-outline" style="height: 36px; padding: 0 12px; font-size: 14px; color: #0f766e; border-color: #0f766e;">
          🔍 查看本区数据
        </button>
      </div>
    </div>
  `).join('');
}

async function handleAddRegion() {
  const nameInput = document.getElementById('newRegionName');
  const codeInput = document.getElementById('newRegionCode');
  const managerInput = document.getElementById('newRegionManager');
  const phoneInput = document.getElementById('newRegionPhone');

  const name = nameInput.value.trim();
  const code = codeInput.value.trim().toUpperCase();
  const manager_name = managerInput.value.trim();
  const manager_phone = phoneInput.value.trim();

  if (!name || !code) {
    alert('请输入区域名称和区域代号（例如：HD01）');
    return;
  }

  const res = await window.db.createRegion({ name, code, manager_name, manager_phone });
  if (res.success) {
    nameInput.value = '';
    codeInput.value = '';
    managerInput.value = '';
    phoneInput.value = '';
    await loadAdminData();
    alert(`✅ 已成功划分新区域：${name} (${code})`);
  } else {
    alert('❌ 添加失败：' + res.error);
  }
}

function filterByRegion(regionCode) {
  currentSelectedRegion = regionCode;
  const select = document.getElementById('regionFilter');
  if (select) select.value = regionCode;
  handleRegionFilterChange();
}

function showQrModal(regionCode, regionName) {
  const baseUrl = window.location.href.split('admin.html')[0];
  const url = `${baseUrl}index.html?region=${regionCode}`;
  currentQrUrl = url;

  document.getElementById('qrModalTitle').innerText = `📍 【${regionName}】初始化二维码`;
  document.getElementById('qrUrlText').innerText = url;

  const container = document.getElementById('qrCodeContainer');
  container.innerHTML = '';

  if (window.QRCode) {
    new window.QRCode(container, {
      text: url,
      width: 200,
      height: 200,
      colorDark: '#0f172a',
      colorLight: '#ffffff',
      correctLevel: window.QRCode.CorrectLevel.H
    });
  } else {
    // CDN 未完成下载或离线时的原生 SVG 二维码降级
    container.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}" alt="QR Code" style="width: 200px; height: 200px;" />`;
  }

  document.getElementById('qrModal').classList.add('active');
}

function closeQrModal() {
  document.getElementById('qrModal').classList.remove('active');
}

function copyQrUrl() {
  if (!currentQrUrl) return;
  navigator.clipboard.writeText(currentQrUrl).then(() => {
    alert('📋 区域专属二维码链接已成功复制到剪贴板！');
  }).catch(() => {
    prompt('请手动复制链接：', currentQrUrl);
  });
}

// 渲染授权工人列表芯片卡片
function renderWorkers() {
  const container = document.getElementById('workerListContainer');
  if (allWorkers.length === 0) {
    container.innerHTML = `<div style="color: #94a3b8; font-size: 15px; padding: 6px 0;">暂无授权施工人员，请在上方输入添加</div>`;
    return;
  }

  container.innerHTML = allWorkers.map(w => `
    <div style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px 14px; border-radius: 20px; display: inline-flex; align-items: center; gap: 8px; font-size: 15px;">
      <span>👷 <strong>${escapeHtml(w.name)}</strong> (${w.phone})</span>
      <button onclick="handleDeleteWorker('${w.id}')" style="background: none; border: none; color: #ef4444; font-size: 16px; cursor: pointer; padding: 0 2px;" title="删除授权">
        ✕
      </button>
    </div>
  `).join('');
}

async function handleAddWorker() {
  const nameInput = document.getElementById('newWorkerName');
  const phoneInput = document.getElementById('newWorkerPhone');
  
  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();

  if (!name || !phone || phone.length < 11) {
    alert('请输入正确的工人姓名和11位手机号码');
    return;
  }

  const res = await window.db.addWorker({ name, phone });
  if (res.success) {
    nameInput.value = '';
    phoneInput.value = '';
    await loadAdminData();
    alert(`✅ 已成功授权施工人员：${name}`);
  } else {
    alert('❌ 添加失败：' + res.error);
  }
}

async function handleDeleteWorker(workerId) {
  if (confirm('确定要撤销该施工人员的身份授权吗？撤销后其将无法进行完工登记。')) {
    await window.db.deleteWorker(workerId);
    await loadAdminData();
  }
}

function renderTable(users) {
  const tbody = document.getElementById('userTableBody');

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; color: #94a3b8; padding: 40px; font-size: 18px;">
          尚无登记记录。您可点击右上角【🧪 加载测试模拟数据】演练查看效果。
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = users.map(user => {
    const freeBadgeHtml = user.is_free
      ? `<span class="badge-free" style="font-size:15px; padding:3px 8px;">🎉 免单服务</span>`
      : `<span class="badge-pending" style="font-size:15px; padding:3px 8px;">自费待达成</span>`;

    const referrerDisplay = user.referrer_name
      ? `<strong style="color:#1d4ed8;">${user.referrer_name}</strong>`
      : `<span style="color:#94a3b8;">自主扫码</span>`;

    const count = user.referral_count || 0;
    const isThresholdReached = count >= currentThreshold;
    const workerDisplay = user.worker_name ? `👷 ${escapeHtml(user.worker_name)}` : '<span style="color:#94a3b8;">--</span>';
    const regionBadge = `<span style="background: #e0f2fe; color: #0369a1; font-weight: bold; padding: 3px 8px; border-radius: 6px; font-size: 14px;">📍 ${escapeHtml(user.region_name || '默认通用区域')}</span>`;

    return `
      <tr>
        <td style="font-size: 15px; color: #64748b;">${formatDateTime(user.created_at)}</td>
        <td>${regionBadge}</td>
        <td><strong>${escapeHtml(user.name)}</strong></td>
        <td>${user.phone}</td>
        <td>${referrerDisplay}</td>
        <td style="text-align: center;">
          <span style="font-size: 18px; font-weight: bold; color: ${isThresholdReached ? '#16a34a' : '#ea580c'};">
            ${count}
          </span> / ${currentThreshold} 人
        </td>
        <td>${freeBadgeHtml}</td>
        <td style="font-size: 15px;">${workerDisplay}</td>
        <td>
          <select 
            onchange="updateUserStatus('${user.id}', this.value)" 
            style="padding: 4px 8px; font-size: 15px; border-radius: 6px; border: 1px solid #cbd5e1; font-weight: bold; color: ${user.status === '已完工' ? '#16a34a' : '#334155'};"
          >
            <option value="已预约" ${user.status === '已预约' ? 'selected' : ''}>已预约</option>
            <option value="施工中" ${user.status === '施工中' ? 'selected' : ''}>施工中</option>
            <option value="已完工" ${user.status === '已完工' ? 'selected' : ''}>已完工 (交付)</option>
            <option value="已取消" ${user.status === '已取消' ? 'selected' : ''}>已取消</option>
          </select>
        </td>
        <td>
          <button 
            onclick="toggleManualFree('${user.id}', ${!user.is_free})" 
            style="padding: 4px 10px; font-size: 14px; background: ${user.is_free ? '#fee2e2' : '#dcfce7'}; color: ${user.is_free ? '#991b1b' : '#166534'}; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;"
          >
            ${user.is_free ? '取消免费' : '手动免费'}
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function handleSearch() {
  const query = document.getElementById('searchInput').value.toLowerCase().trim();
  if (!query) {
    renderTable(allUsers);
    return;
  }
  const filtered = allUsers.filter(u => 
    u.name.toLowerCase().includes(query) || 
    u.phone.includes(query) ||
    (u.referrer_name && u.referrer_name.toLowerCase().includes(query)) ||
    (u.worker_name && u.worker_name.toLowerCase().includes(query)) ||
    (u.region_name && u.region_name.toLowerCase().includes(query))
  );
  renderTable(filtered);
}

async function saveAdminSettings() {
  const val = parseInt(document.getElementById('thresholdInput').value, 10);
  const newPass = document.getElementById('passwordInput').value.trim();

  if (isNaN(val) || val < 1) {
    alert('请输入正确的免单门槛人数！');
    return;
  }

  const payload = { referral_threshold: val };
  if (newPass) {
    payload.admin_password = newPass;
  }

  const res = await window.db.updateSettings(payload);
  if (res.success) {
    alert('✅ 系统设置保存成功！' + (newPass ? ' 管理员新密码已生效。' : ''));
    document.getElementById('passwordInput').value = '';
    await loadAdminData();
  } else {
    alert('保存失败：' + res.error);
  }
}

async function toggleManualFree(userId, targetFree) {
  const res = await window.db.updateUserStatus(userId, {
    is_free: targetFree,
    manual_free: true
  });
  if (res.success) {
    await loadAdminData();
  }
}

async function updateUserStatus(userId, newStatus) {
  const res = await window.db.updateUserStatus(userId, { 
    status: newStatus,
    worker_name: newStatus === '已完工' ? '后台管理员确认' : undefined
  });
  if (res.success) {
    await loadAdminData();
  }
}

function exportToCSV() {
  if (allUsers.length === 0) {
    alert('暂无可导出数据');
    return;
  }

  const headers = ['登记时间', '所属区域', '姓名', '手机号', '推荐人', '完成防滑完工数', '是否免费', '施工交付工人', '施工交付状态'];
  const rows = allUsers.map(u => [
    formatDateTime(u.created_at),
    u.region_name || '默认通用区域',
    u.name,
    u.phone,
    u.referrer_name || '自主扫码',
    u.referral_count || 0,
    u.is_free ? '免费' : '自费',
    u.worker_name || '--',
    u.status || '已预约'
  ]);

  let csvContent = '\uFEFF' + headers.join(',') + '\n';
  rows.forEach(row => {
    csvContent += row.map(field => `"${field}"`).join(',') + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `适老化防滑改造登记与转介绍表_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function loadDemoData() {
  await window.db.seedDemoData();
  await loadAdminData();
  alert('🎉 已成功载入示例测试数据与默认授权工人！');
}

function formatDateTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, match => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[match]);
}

