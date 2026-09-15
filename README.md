# THS 功率分流混动架构模拟器

基于原生 HTML5、CSS 与 ES Modules 构建的**丰田 THS (Toyota Hybrid System) 功率分流混动架构交互式模拟器**。它以可视化方式还原单行星齿轮机构（PSD）的**运动学关系、转矩平衡、功率流与能量回收**，并内置 **M20A-FXS 发动机热效率 MAP**，帮助理解 e-CVT 无级变速与功率分流的工作原理。

---

## 界面与功能模块

### 驾驶员输入 (Driver Inputs)

| 参数 | 范围 | 说明 |
| --- | --- | --- |
| 车速 (Vehicle Speed) | -20 ~ 180 km/h | 支持倒车与高速巡航 |
| 发动机转速 (ICE RPM) | 0 ~ 6000 rpm | |
| 发动机扭矩 (ICE Torque) | 0 ~ 188 N·m | |
| 负载扭矩 (Load Torque) | -700 ~ 700 N·m | **齿圈处的负载扭矩**：正值 = 爬坡 / 加速阻力；负值 = 下坡 / 制动回收 |

### ICE 热效率 MAP (M20A-FXS)

- 模拟 2.0L 自然吸气发动机，峰值热效率约 **41%**
- 分区配色：深绿 ≥ 40%、浅绿 38–40%、黄色 35–38%、红色 < 35%
- 工作点：实心圆点指示当前 (转速, 扭矩)；超出发动机外特性（虚线）时置灰并提示

### THS 杠杆图 (Nomograph)

- 三轴间距按【太阳轮–行星架 : 行星架–齿圈 = $K$ : 1】排布
- 倾斜直线直观展示 MG1 / ICE / MG2 的转速约束关系
- 实时箭头展示各轴扭矩方向与大小（MG1 支撑力矩、ICE 驱动力矩、MG2 补充力矩、Load 负载力矩）

### PSD 行星齿轮动画

- Canvas 实时渲染太阳轮、3 个行星轮、行星架与外齿圈
- 动画转速按 **1/100** 缩放以便观察

### 功率流与状态指示

- **发动机 / 车轮 / 电池功率**条形图：车轮与电池为双向显示（驱动为正、回收 / 充电为负）
- **MG1 / MG2 状态卡**：自动识别 `Idle`、`Motoring (驱动)`、`Generating (发电)`，并显示峰值功率占比与 `Overload` 提示

---

## 核心物理模型

行星齿轮机构（Power Split Device, PSD）将三个动力源机械耦合：

| 构件 | 连接对象 | 主要作用 |
| --- | --- | --- |
| 太阳轮 (Sun) | **MG1** | 发电 / 调节发动机转速 |
| 行星架 (Carrier) | **发动机 (ICE)** | 动力输入 |
| 齿圈 (Ring) | **MG2 → 车轮** | 驱动 / 能量回收 |

### 符号约定

| 符号 | 含义 | 单位 |
| --- | --- | --- |
| $v$ | 车速 | km/h |
| $N_{\text{ICE}}$ | 发动机（行星架）转速 | rpm |
| $N_{\text{MG1}}$ | MG1（太阳轮）转速 | rpm |
| $N_{\text{MG2}}$ | MG2（齿圈）转速，与车速成正比 | rpm |
| $T_{\text{ICE}}$ | 发动机扭矩 | N·m |
| $T_{\text{load}}$ | 齿圈负载扭矩（折算值） | N·m |
| $K$ | 齿圈与太阳轮齿数比 $Z_r / Z_s$ | — |

### 1. 运动学约束 (Kinematics)

三轴转速由行星排方程约束，在杠杆图上表现为一条直线：

$$N_{\text{MG1}} = (1 + K)\,N_{\text{ICE}} - K\,N_{\text{MG2}}, \qquad K = \frac{Z_r}{Z_s} = 2.6$$

- $N_{\text{MG2}} = 25.5\,v$，车速（km/h）换算为齿圈转速（rpm）
- $N_{\text{MG1}} > 0$ 为正转；$N_{\text{MG1}} < 0$ 为反转

### 2. 转矩平衡 (Torque Balance)

发动机扭矩 $T_{\text{ICE}}$ 按杠杆比例分流至太阳轮与齿圈：

$$T_{\text{sun}} = \frac{T_{\text{ICE}}}{1 + K}, \qquad T_{\text{ring}} = \frac{K}{1 + K}\,T_{\text{ICE}}$$

MG1 施加反作用力矩以支撑发动机输出，MG2 补偿剩余的行驶负载：

$$T_{\text{MG1}} = -T_{\text{sun}}, \qquad T_{\text{MG2}} = T_{\text{load}} - T_{\text{ring}}$$

> **注意**：$T_{\text{load}}$ 是**折算到齿圈（Ring）侧**的负载扭矩，与杠杆图 Ring 轴上的 `Load` 箭头对应，**不是车轮终端扭矩**。二者差一个主减速比 $i_f$：车轮端扭矩 $= i_f\,T_{\text{load}}$，而 $i_f$ 已隐含在 $N_{\text{MG2}} = 25.5\,v$ 的车速换算中。

### 3. 功率与电池平衡 (Power Balance)

由转速与扭矩换算功率（$N$ 为 rpm、$T$ 为 N·m、$P$ 为 kW）：

$$P_{\text{ICE}} = \frac{N_{\text{ICE}}\,T_{\text{ICE}}}{9550}, \quad P_{\text{wheel}} = \frac{|N_{\text{MG2}}|\,T_{\text{load}}}{9550}, \quad P_{\text{batt}} = P_{\text{MG1}} + P_{\text{MG2}}$$

- 因为扭矩与转速取自同一根轴（齿圈），$P_{\text{wheel}}$ 即**齿圈侧输出功率**；忽略传动损耗时它等于车轮端功率（功率经主减速比不变，变的只是扭矩）
- $P_{\text{batt}} > 0$：电池处于**放电**状态，电机补充驱动力
- $P_{\text{batt}} < 0$：电池处于**充电**状态，发动机多余功率发电或制动能量回收

---

## 项目结构

```text
/
├── index.html          # 主界面结构（语义化布局 + Tailwind CSS）
├── style.css           # 全局样式与自定义控件
├── js/
│   ├── app.js          # 主控制器：DOM 缓存、事件响应、rAF 渲染循环
│   ├── physics.js      # 核心物理与运动学纯函数（无 UI 依赖）
│   ├── ice-map.js      # 发动机热效率 MAP 计算与离屏预渲染
│   ├── nomograph.js    # 杠杆图矢量与轴线渲染
│   └── psd.js          # 行星齿轮几何 Path 预建与 2D 绘制
├── service-worker.js   # PWA 离线静态资源缓存
└── package.json        # 项目元信息与脚本
```

---

## 作者与致谢

- **作者**：Fox-Hulio
- **Bilibili 主页**：[https://space.bilibili.com/396029763](https://space.bilibili.com/396029763)
