/**
 * 个人中心页面 逻辑处理 (默认展示专属推荐二维码，完工核销码默认折叠)
 */

let currentUser = null;
let inviteUrl = '';
let isCompletionQrLoaded = false;

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = window.db.getCurrentUser();
  if (!currentUser || !currentUser.phone) {
    window.location.href = 'index.html';
    return;
  }

  await refreshDashboardData();
});

async function refreshDashboardData() {
  const freshUser = await window.db.getUserById(currentUser.id);
  if (freshUser) {
    currentUser = freshUser;
  }

  const settings = await window.db.getSettings();
  const threshold = parseInt(settings.referral_threshold, 10) || 5;

  // 获取直接转介绍的朋友列表（重点：只有 status === '已完工' 才算成功的有效推荐）
  const { list: referrals, completedCount } = await window.db.getReferralsByUserId(currentUser.id);

  // 渲染基本信息
  document.getElementById('welcomeTitle').innerText = `欢迎您，${currentUser.name}`;
  document.getElementById('userPhoneDisplay').innerText = `手机号：${maskPhone(currentUser.phone)}`;

  const userRegionCode = currentUser.region_code || 'DEFAULT';
  const regionObj = await window.db.getRegionByCode(userRegionCode);
  const regionName = regionObj ? regionObj.name : '默认通用区域';

  const regionEl = document.getElementById('userRegionDisplay');
  if (regionEl) {
    regionEl.innerText = `📍 所属服务区域：${regionName}`;
  }

  // 渲染进度
  document.getElementById('progressText').innerText = `${completedCount} / ${threshold} 人`;
  const percent = Math.min(100, Math.round((completedCount / threshold) * 100));
  document.getElementById('progressBarFill').style.width = `${percent}%`;

  const remaining = Math.max(0, threshold - completedCount);
  document.getElementById('remainingCount').innerText = remaining;

  // 是否享免费
  const isFree = currentUser.is_free || completedCount >= threshold;

  const freeCard = document.getElementById('freeBadgeCard');
  const noticeBox = document.getElementById('progressNotice');

  if (isFree) {
    freeCard.style.display = 'block';
    noticeBox.innerHTML = '🎉 <strong style="color:#16a34a; font-size:22px;">您已达成免费标准！施工人员上门防滑施工全额免费。</strong>';
  } else {
    freeCard.style.display = 'none';
    noticeBox.innerHTML = `再成功转介绍 <strong id="remainingCount" style="color: var(--primary); font-size: 26px;">${remaining}</strong> 位邻居朋友完成防滑施工交付，即可享受全额免费施工！`;
  }

  // 渲染好友推荐列表
  renderReferralList(referrals);

  // 构造专属推荐链接（拼接 region 参数以支持裂变继承）
  const baseUrl = window.location.origin + window.location.pathname.replace('dashboard.html', 'invite.html');
  inviteUrl = `${baseUrl}?ref=${currentUser.referral_code}&region=${userRegionCode}`;
  
  renderInlineQRCode(inviteUrl);
}

// 页面载入即默认渲染专属推荐二维码
function renderInlineQRCode(url) {
  const qrContainer = document.getElementById('qrcodeContainer');
  qrContainer.innerHTML = '';

  if (window.QRCode) {
    new QRCode(qrContainer, {
      text: url,
      width: 200,
      height: 200,
      colorDark: "#1e293b",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
  } else {
    qrContainer.innerHTML = `<p style="font-size: 16px; color: #64748b;">专属推荐链接：<br><a href="${url}" target="_blank">${url}</a></p>`;
  }
}

// 切换完工核销二维码的展开/收起
function toggleCompletionQrCode() {
  const box = document.getElementById('completionQrContainerBox');
  const btn = document.getElementById('toggleQrBtn');

  if (box.style.display === 'none') {
    box.style.display = 'block';
    btn.innerHTML = '📱 收起完工交付核销码';
    btn.style.borderColor = '#2563eb';
    btn.style.color = '#1d4ed8';

    if (!isCompletionQrLoaded) {
      renderCompletionQRCode();
      isCompletionQrLoaded = true;
    }
  } else {
    box.style.display = 'none';
    btn.innerHTML = '📱 展开我的完工交付核销码 (现场施工师傅使用)';
    btn.style.borderColor = '#475569';
    btn.style.color = '#334155';
  }
}

function renderCompletionQRCode() {
  const workerBaseUrl = window.location.origin + window.location.pathname.replace('dashboard.html', 'worker.html');
  const completionUrl = `${workerBaseUrl}?code=${currentUser.referral_code}&user_id=${currentUser.id}`;

  const container = document.getElementById('completionQrCodeContainer');
  container.innerHTML = '';

  if (window.QRCode) {
    new QRCode(container, {
      text: completionUrl,
      width: 180,
      height: 180,
      colorDark: "#0f172a",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
  } else {
    container.innerHTML = `<a href="${completionUrl}">${completionUrl}</a>`;
  }

  document.getElementById('completionCodeText').innerText = `核销服务码：${currentUser.referral_code}`;
}

// 渲染我直接转介绍的朋友列表（精确标注“已完工(已计入免单)”与“待完工施工”）
function renderReferralList(referrals) {
  const container = document.getElementById('referralList');
  document.getElementById('friendCount').innerText = referrals.length;

  if (referrals.length === 0) {
    container.innerHTML = `
      <li style="text-align: center; color: #94a3b8; padding: 20px; font-size: 18px;">
        暂无转介绍记录，出示上方二维码给邻居朋友扫码即可参与！
      </li>
    `;
    return;
  }

  container.innerHTML = referrals.map(item => {
    const isCompleted = item.status === '已完工';
    const statusBadge = isCompleted
      ? `<span class="badge-free" style="font-size: 15px; padding: 4px 10px; background-color: #16a34a;">✅ 已完成防滑交付 (已计入)</span>`
      : `<span class="badge-pending" style="font-size: 15px; padding: 4px 10px; background-color: #f59e0b; color: white;">⏳ 施工预约中 (等待完工)</span>`;

    return `
      <li class="referral-item" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 0; border-bottom: 1px solid #f1f5f9;">
        <div>
          <span class="referral-name" style="font-size: 19px; font-weight: bold; color: #1e293b;">${escapeHtml(item.name)}</span>
          <div style="font-size: 16px; color: #64748b; margin-top: 2px;">${maskPhone(item.phone)}</div>
        </div>
        <div style="text-align: right;">
          ${statusBadge}
          <div class="referral-date" style="font-size: 14px; color: #94a3b8; margin-top: 4px;">登记时间：${formatDate(item.created_at)}</div>
        </div>
      </li>
    `;
  }).join('');
}

function maskPhone(phone) {
  if (!phone || phone.length < 11) return phone;
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
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

async function copyShareLink() {
  const textToCopy = `【适老化关爱工程】您的好友 ${currentUser.name} 推荐您免费预约居家卫生间防滑处理！点击链接极简预约：\n${inviteUrl}`;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(textToCopy);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = textToCopy;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    
    const btn = document.getElementById('copyLinkBtn');
    btn.innerHTML = '<span>✅ 推荐链接已复制！快去粘贴发给微信好友吧</span>';
    btn.style.backgroundColor = '#16a34a';
    
    setTimeout(() => {
      btn.innerHTML = '<span>📋 复制专属推荐链接</span>';
      btn.style.backgroundColor = 'var(--secondary)';
    }, 3000);
  } catch (err) {
    alert('复制失败，请截图二维码或手动复制链接：\n' + inviteUrl);
  }
}

function handleLogout() {
  if (confirm('确定要切换账户或重新登记手机号吗？')) {
    window.db.logout();
    window.location.href = 'index.html';
  }
}

