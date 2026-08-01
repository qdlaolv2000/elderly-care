/**
 * 工人完工登记页面逻辑
 */

let currentWorker = null;
let currentTargetUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentWorker = window.db.getCurrentWorker();
  
  if (currentWorker) {
    showWorkerMainView();
  } else {
    showWorkerAuthView();
  }

  // 检查 URL 参数（如果扫码直接携带了 code 或 user_id）
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code') || urlParams.get('ref');
  const userId = urlParams.get('user_id');

  if (code || userId) {
    if (currentWorker) {
      autoLocateCustomer({ code, userId });
    }
  }
});

function showWorkerAuthView() {
  document.getElementById('workerAuthCard').style.display = 'block';
  document.getElementById('workerMainContent').style.display = 'none';
}

function showWorkerMainView() {
  document.getElementById('workerAuthCard').style.display = 'none';
  document.getElementById('workerMainContent').style.display = 'block';
  document.getElementById('displayWorkerInfo').innerText = `${currentWorker.name} (${maskWorkerPhone(currentWorker.phone)})`;
}

function maskWorkerPhone(phone) {
  if (!phone || phone.length < 11) return phone;
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

async function handleWorkerAuth(event) {
  event.preventDefault();
  const name = document.getElementById('workerNameInput').value;
  const phone = document.getElementById('workerPhoneInput').value;

  const result = await window.db.verifyWorker(name, phone);
  if (result.success) {
    currentWorker = result.worker;
    showWorkerMainView();
    
    // 检查是否有挂起的 URL 搜索参数
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code') || urlParams.get('ref');
    const userId = urlParams.get('user_id');
    if (code || userId) {
      autoLocateCustomer({ code, userId });
    }
  } else {
    alert('⚠️ ' + result.error);
  }
}

function handleWorkerLogout() {
  if (confirm('确定要更换登录的施工师傅身份吗？')) {
    window.db.workerLogout();
    currentWorker = null;
    showWorkerAuthView();
  }
}

async function autoLocateCustomer({ code, userId }) {
  let user = null;
  if (userId) {
    user = await window.db.getUserById(userId);
  } else if (code) {
    user = await window.db.getUserByReferralCode(code);
  }

  if (user) {
    renderCustomerResult(user);
  }
}

async function searchCustomer() {
  const query = document.getElementById('searchCustomerInput').value.trim();
  if (!query) {
    alert('请输入老人姓名、手机号或核销码');
    return;
  }

  // 可以在所有用户中查找姓名、手机号、推荐码
  const allUsers = await window.db.getAllUsers();
  const matched = allUsers.find(u => 
    u.name.trim() === query || 
    u.phone.trim() === query || 
    u.referral_code === query.toUpperCase() ||
    u.id === query
  );

  if (matched) {
    renderCustomerResult(matched);
  } else {
    alert('⚠️ 未找到该老人的预约登记记录，请核对手机号或姓名');
    document.getElementById('customerResultCard').style.display = 'none';
  }
}

function renderCustomerResult(user) {
  currentTargetUser = user;
  const resultCard = document.getElementById('customerResultCard');
  resultCard.style.display = 'block';

  document.getElementById('custName').innerText = user.name;
  document.getElementById('custPhone').innerText = `联系电话：${user.phone}`;
  document.getElementById('custReferrer').innerText = user.referrer_name ? `${user.referrer_name} 推荐` : '直接预约 (无推荐人)';
  
  const statusBadge = document.getElementById('custStatusBadge');
  statusBadge.innerText = user.status || '已预约';
  
  if (user.status === '已完工') {
    statusBadge.style.backgroundColor = '#16a34a';
    statusBadge.style.color = '#ffffff';
  } else {
    statusBadge.style.backgroundColor = '#e2e8f0';
    statusBadge.style.color = '#475569';
  }

  const actionArea = document.getElementById('actionArea');
  if (user.status === '已完工') {
    actionArea.innerHTML = `
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; padding: 16px; border-radius: 10px; text-align: center;">
        <div style="font-size: 24px;">✅ 该项目已于完工交付</div>
        <div style="font-size: 15px; color: #166534; margin-top: 4px;">施工人员：${user.worker_name || '现场施工师傅'}</div>
      </div>
    `;
  } else {
    actionArea.innerHTML = `
      <button onclick="confirmCompletion('${user.id}')" class="btn btn-secondary" style="height: 56px; font-size: 20px; width: 100%; font-weight: bold; background-color: #16a34a; box-shadow: 0 4px 14px rgba(22, 163, 74, 0.4);">
        👷 确认防滑施工已完工交付
      </button>
    `;
  }
}

async function confirmCompletion(userId) {
  if (!currentTargetUser || currentTargetUser.id !== userId) return;

  const confirmText = `确认已为【${currentTargetUser.name}】老人家中完成卫生间防滑改造处理？\n\n确认后，系统将为其推荐人正式增加 1 次成功转介绍数据。`;
  
  if (confirm(confirmText)) {
    const workerName = currentWorker ? currentWorker.name : '施工师傅';
    const res = await window.db.markServiceCompleted(userId, workerName);

    if (res.success) {
      alert(`🎉 完工标记成功！\n已被师傅【${workerName}】确认完工交付。`);
      // 重新拉取最新数据并更新渲染
      const freshUser = await window.db.getUserById(userId);
      renderCustomerResult(freshUser);
    } else {
      alert('❌ 操作失败：' + res.error);
    }
  }
}
