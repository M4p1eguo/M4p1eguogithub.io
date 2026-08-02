# 我的生活记录 · GitHub 部署说明

这是一个手机端「工作台」网页：左侧一栏列出全部功能（计划、记账、备忘录、重要日期、腰围、饮食、运动、健康、复盘、幸运数），点哪个功能，右侧中间的操作区就切换成哪个页面；右侧上区固定显示日期、问候语、今日计划和发薪倒计时，下区固定显示每日热点。

## 上传步骤（第一次）

1. 打开 [github.com](https://github.com)，注册或登录你的账号。
2. 点右上角 **+ → New repository**：
   - Repository name 填：`dad-daily`
   - 选 **Public**（公开，才能免费生成网址）
   - 其他不填，点 **Create repository**
3. 进入仓库后点 **Add file → Upload files**：
   - 把本文件夹（上传GitHub）里的**所有文件**拖进去：
     `index.html`、`css` 文件夹、`js` 文件夹、`图片` 文件夹、`.nojekyll`、`README.md`
   - 点 **Commit changes**
4. 开启网页（GitHub Pages）：
   - 仓库页面点 **Settings → Pages**
   - Source 选 **Deploy from a branch**
   - Branch 选 **main**，目录选 **/ (root)**，点 **Save**
   - 等 1~2 分钟，页面顶部会出现网址：
     `https://你的用户名.github.io/dad-daily/`
5. 用手机浏览器打开这个网址，就是「我的生活记录」工作台。

## 设置后台（只有你能修改内容）

1. 打开网址后，**快速连续点 5 下**左上角的「我的生活记录」四个字 → 进入后台。
2. 第一次进入会让你**设置管理员密码**（密码只存在你自己手机的浏览器里）。
3. 在「GitHub 连接」里填：
   - 仓库地址：`你的用户名/dad-daily`
   - Token：见下面的 Token 创建方法
4. 点「保存连接」，然后点「**发布到云端**」。
   - 发布后，网站会生成一个 content.json 存到你的仓库，
     之后**所有人访问看到的都是同一份内容**。

## 以后每次修改内容

进入后台 → 正常增删改 → 点「**发布到云端**」→ 所有人都能看到新内容。

## 创建 Token 的方法（重要）

Token 相当于一把"钥匙"，只在你自己浏览器里，不会上传到网站。

1. GitHub 右上角头像 → **Settings → Developer settings**
2. 左侧 **Personal access tokens → Fine-grained tokens → Generate new token**
3. Token name 随便填（如 dad-daily）；Expiration 选 90 天或更长
4. **Repository access** 选 **Only select repositories** → 勾选 `dad-daily`
5. **Permissions → Repository permissions → Contents** 选 **Read and write**
6. 点 Generate token，复制生成的 `github_pat_` 开头的字符串，粘贴到后台

> 提示：Token 只在创建时显示一次，丢了就重新生成一个。

## 访客能做什么

- 访客打开网址可以**正常使用全部功能**：每日计划、记账、备忘录、重要日期、
  每日腰围、饮食记录、运动打卡、健康记录（体重/睡眠）、业务复盘、今日幸运数、每日热点。
- 访客可以**点头像换自己的头像**、记录自己的数据（体重、账目、任务等）。
- 每个人的记录只存在**自己设备的浏览器**里，互不干扰、互不可见。
- 访客**看不到、进不了「程序后台」**：设置、热点编辑、GitHub 发布都需要管理员密码。
  后台入口是快速点 5 下左上角「我的生活记录」。

## 手机端体验

- 页面按手机屏幕设计，全部内容都可以直接手指点击操作。
- 你发布到云端的「公共配置」（应用名、问候语、发薪日、幸运数范围、每日热点）
  会作为新访客打开时的初始内容。
- 你换新手机/新浏览器时：进后台 → 拉取云端内容，就能把你之前发布的内容恢复到这台设备。
