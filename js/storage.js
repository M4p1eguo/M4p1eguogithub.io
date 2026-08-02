/* 本地存储封装：所有数据保存在浏览器 localStorage，不联网 */
const Store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem('dadDaily.' + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  },
  set(key, val) {
    try {
      localStorage.setItem('dadDaily.' + key, JSON.stringify(val));
    } catch (e) { /* 存储失败时静默 */ }
  },
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }
};
