/**
 * 被推荐人登记页面 逻辑处理
 */

let refCode = null;
let referrerUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. 获取 URL 中的推荐码
  const urlParams = new URLSearchParams(window.location.search);
  refCode = urlParams.get('ref');

  if (refCode) {
    referrerUser = await window.db.getUserByReferralCode(refCode);
    if (referrerUser) {
      document.getElementById('referrerGreeting').innerText = `🤝 您的好友【${referrerUser.name}】邀请您体验`;
    }
  }

  // 2. 检查本地是否已有账号
  const currentUser = window.db.getCurrentUser();
  if (currentUser && currentUser.phone) {
    // 若已登录且不是新推荐，直接跳转个人中心
    window.location.href = 'dashboard.html';
  }
});

async function handleInviteRegister(event) {
  event.preventDefault();

  const submitBtn = document.getElementById('inviteSubmitBtn');
  const nameInput = document.getElementById('inviteUserName');
  const phoneInput = document.getElementById('inviteUserPhone');

  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();

  if (!name) {
    alert('请输入您的姓名');
    nameInput.focus();
    return;
  }

  if (!phone || !/^1\d{10}$/.test(phone)) {
    alert('请输入正确的11位手机号码');
    phoneInput.focus();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span>⏳ 正在提交预约...</span>';

  try {
    const res = await window.db.registerUser({
      name,
      phone,
      referralCode: refCode
    });

    if (res.success) {
      let msg = '🎉 预约成功！';
      if (referrerUser) {
        msg += ` 已成功记录为好友【${referrerUser.name}】推荐。`;
      }
      alert(msg);
      window.location.href = 'dashboard.html';
    } else {
      alert('预约失败：' + (res.error || '系统繁忙'));
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>✅ 接受邀请，立即免费预约</span>';
    }
  } catch (err) {
    console.error(err);
    alert('预约提交异常，请稍后重试');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>✅ 接受邀请，立即免费预约</span>';
  }
}
