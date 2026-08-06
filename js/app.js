let activeRegionCode = null;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. 动态获取数据库/系统设置的免费门槛人数
  try {
    const settings = await window.db.getSettings();
    const threshold = parseInt(settings.referral_threshold, 10) || 5;
    const thresholdEl = document.getElementById('benefitThreshold');
    if (thresholdEl) {
      thresholdEl.innerText = `${threshold}位邻居好友`;
    }
  } catch (err) {
    console.warn('获取系统免单门槛设置提示:', err);
  }

  // 2. 解析 URL 参数
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get('ref');
  const regionCode = urlParams.get('region');

  if (regionCode) {
    activeRegionCode = regionCode.trim().toUpperCase();
    sessionStorage.setItem('scan_region_code', activeRegionCode);

    // 查询并展示区域名称 Banner
    const regionObj = await window.db.getRegionByCode(activeRegionCode);
    if (regionObj) {
      const banner = document.getElementById('regionBanner');
      const nameText = document.getElementById('regionNameText');
      if (banner && nameText) {
        nameText.innerText = regionObj.name;
        banner.style.display = 'inline-block';
      }
    }
  } else {
    // 尝试读取本地缓存中的扫码区域代码
    activeRegionCode = sessionStorage.getItem('scan_region_code');
  }

  // 如果带推荐码，跳转到带区域参数的推荐页
  if (refCode) {
    let inviteUrl = `invite.html?ref=${encodeURIComponent(refCode)}`;
    if (activeRegionCode) {
      inviteUrl += `&region=${encodeURIComponent(activeRegionCode)}`;
    }
    window.location.href = inviteUrl;
    return;
  }

  // 3. 检查本地是否有账号
  const currentUser = window.db.getCurrentUser();
  if (currentUser && currentUser.phone) {
    window.location.href = 'dashboard.html';
    return;
  }
});

// 处理表单提交
async function handleRegister(event) {
  event.preventDefault();
  
  const submitBtn = document.getElementById('submitBtn');
  const nameInput = document.getElementById('userName');
  const phoneInput = document.getElementById('userPhone');

  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();

  if (!name) {
    alert('请输入您的姓名！');
    nameInput.focus();
    return;
  }

  if (!phone || !/^1\d{10}$/.test(phone)) {
    alert('请输入正确的11位手机号码！');
    phoneInput.focus();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span>⏳ 正在提交预约...</span>';

  try {
    const res = await window.db.registerUser({ 
      name, 
      phone,
      regionCode: activeRegionCode
    });
    if (res.success) {
      if (!res.isNew) {
        alert(`欢迎回来，${res.user.name}！已为您载入之前的预约记录。`);
      } else {
        alert('🎉 预约成功！为您自动跳转到您的专属中心。');
      }
      window.location.href = 'dashboard.html';
    } else {
      alert('预约失败：' + (res.error || '系统繁忙，请重试'));
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>📝 立即免费预约登记</span>';
    }
  } catch (err) {
    console.error(err);
    alert('网络或数据异常，请重试');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>📝 立即免费预约登记</span>';
  }
}
