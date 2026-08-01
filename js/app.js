/**
 * 首页/注册页 逻辑处理
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. 获取 URL 中的推荐码
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get('ref');

  // 如果带推荐码，自动跳转到专属推荐注册页
  if (refCode) {
    window.location.href = `invite.html?ref=${encodeURIComponent(refCode)}`;
    return;
  }

  // 2. 检查本地是否已有登录/注册过的老用户
  const currentUser = window.db.getCurrentUser();
  if (currentUser && currentUser.phone) {
    // 自动重定向到个人中心
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

  // 禁用提交按钮防止重复点击
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span>⏳ 正在提交预约...</span>';

  try {
    const res = await window.db.registerUser({ name, phone });
    if (res.success) {
      if (!res.isNew) {
        alert(`欢迎回来，${res.user.name}！已为您载入之前的预约记录。`);
      } else {
        alert('🎉 预约成功！为您自动跳转到您的专属中心。');
      }
      // 跳转至个人中心页
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
