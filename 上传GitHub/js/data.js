/* =====================================================
 * 我的生活记录 - 默认数据与文案配置
 * 想改默认文案/示例数据，直接改这里即可；
 * 已保存过的数据会存在浏览器本地，改这里不影响已保存内容。
 * ===================================================== */
const DEFAULTS = {
  settings: {
    appName: '我的生活记录',
    greeting: '记得喝水',
    payday: 30,       // 每月发薪日
    luckyMax: 99      // 今日幸运数范围 0-99
  },
  hotTopics: {
    uc: [
      { title: '全国多地持续高温，注意防暑降温', hot: '845万' },
      { title: '暑期出行热度攀升，这些城市最受欢迎', hot: '762万' },
      { title: '新一批便民政策落地，涉及医保养老', hot: '690万' },
      { title: '健康提醒：夏季补水要适量，不要等渴了才喝', hot: '512万' }
    ],
    douyin: [
      { title: '夏日清凉小妙招合集', views: '1210万' },
      { title: '手工达人教你做夏日冰饮', views: '986万' },
      { title: '萌宠日常：天热也要记得喝水', views: '873万' },
      { title: '街头美食探店：本地人爱吃的馆子', views: '755万' }
    ]
  },
  categories: ['餐饮', '交通', '购物', '日用', '娱乐', '医疗', '其他'],
  mealTypes: ['早餐', '午餐', '晚餐', '加餐'],
  exerciseTypes: ['跑步', '散步', '力量', '骑行', '球类', '其他']
};

/* 需要全局同步（发布到 GitHub）的内容键；热点 Tab 和登录信息不在此列 */
const CONTENT_KEYS = [
  'settings', 'tasks', 'ledger', 'memos', 'importantDates',
  'waist', 'meals', 'water', 'exercise', 'health', 'reviews', 'hotTopics'
];
