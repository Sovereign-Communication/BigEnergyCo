# Draft: Blog Post (site blog / dev.to / 知乎 cross-post)

## Title options

1. 为什么"请求收录"总是 Quota Exceeded —— 新站被 Google 收录的真正路径
2. 我给 70 个城市写了太阳能计算器，结果卡在了 Google 收录上
3. New site stuck at "Quota Exceeded" for days: what I learned about how Google actually indexes pages

Recommendation: #1 — SEO 困惑类内容搜索量稳定，且和站点工具形成互文。

## Post body

最近给 bigenergyco.pages.dev 请求收录，连续好几天都是 "Quota Exceeded"。查了一圈资料才发现，这个报错和大多数人理解的不一样。把踩过的坑记下来。

### 坑 1：Quota Exceeded ≠ 明天再来

Search Console 的"请求收录"配额大约每天 10–20 条，太平洋时间午夜重置。但如果你**根本没提交几条**却连续几天都报 Quota Exceeded——这不是配额问题，是 Google 在委婉地说"这个 URL 优先级很低"。官方论坛里有人卡了两周以上的。

### 坑 2：pages.dev 子域名是收录地狱

裸的 `*.pages.dev` 子域名 + 零外链 = Google 爬虫优先级的最底层。我的站技术 SEO 其实都做对了（canonical、hreflang、JSON-LD、sitemap 全齐），但 on-page 再完美也解决不了 discovery 的问题。

### 真正有用的三件事

1. **提交 sitemap**（Search Console → Sitemaps）——走批量队列，不占单条配额
2. **搞 1–3 条真实外链**——GitHub README、目录站、一篇 Show HN。外链让 Google 主动来爬，直接绕过配额系统
3. **换个正经域名**——pages.dev 子域名的收录速度是出了名的慢

### 时间线预期

提交 sitemap + 第一条外链后：通常 1–2 周内开始收录。只反复点"请求收录"按钮：不可预测，而且被限流时反复点反而更糟。

---

工具本身在这里：https://bigenergyco.pages.dev —— 70 个城市的太阳能回本计算，用 NASA 卫星气象数据，无注册无推销。
