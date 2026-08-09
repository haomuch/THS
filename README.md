# THS 功率分流混动架构模拟器 (THS Power Split Simulator)

这是一个基于 Web 技术构建的 **丰田 THS (Toyota Hybrid System) 功率分流混动架构交互式物理模拟器**。
模拟器精准还原了 THS 系统的**单行星齿轮机构（PSD）运动学关系、转矩平衡方程、能量流状态以及发动机（M20A-FXS）热效率 MAP 图**，帮助开发者、汽车工程爱好者与学生直观理解混动系统的无级变速（e-CVT）、能量回收与功率分流工作原理。

---

## 核心物理原理与数学模型

THS 系统通过行星齿轮机构（Power Split Device, PSD）将发动机（ICE）、电机 1（MG1）和电机 2（MG2/车轮）机械耦合在一起：

- **太阳轮 (Sun Gear)**：连接 **MG1** (主要用于发电机及控制发动机转速)
- **行星架 (Planet Carrier)**：连接 **发动机 (ICE)**
- **外齿圈 (Ring Gear)**：连接 **MG2** 并通过主减速器直接连接 **车轮 (Wheel)**

### 1. 运动学约束方程 (Kinematics)
设定齿圈与太阳轮齿数比 $K = \frac{Z_r}{Z_s} = 2.6$（对应丰田 2.0L 混动架构）：

$$\text{转速关系: } N_{mg1} = (1 + K) \cdot N_{ice} - K \cdot N_{mg2}$$

其中：
- $N_{mg2} = v \times 25.5 \text{ RPM}$ ($v$ 为车速 km/h)
- $N_{ice}$ 为发动机转速 (RPM)
- $N_{mg1}$ 为 MG1 转速 (RPM)，可为正转或反转

### 2. 转矩平衡与分配 (Torque Balance)
行星齿轮受力平衡时，发动机产生的扭矩 $T_{ice}$ 被按比例分流：
- **太阳轮接收扭矩**：$T_{sun\_ice} = T_{ice} \cdot \frac{1}{1 + K}$
- **齿圈接收扭矩**：$T_{ring\_ice} = T_{ice} \cdot \frac{K}{1 + K}$
- **MG1 平衡扭矩**：$T_{mg1} = -T_{sun\_ice}$ (MG1 施加反作用力矩以支撑发动机输出)

车轮端（齿圈）总合成扭矩需平衡行驶负载 $T_{load}$：
$$T_{mg2} = T_{load} - T_{ring\_ice}$$

### 3. 功率流与电池平衡 (Power Balance)
各部件功率计算（单位 kW）：
- 发动机功率：$P_{ice} = \frac{N_{ice} \cdot T_{ice}}{9550}$
- 车轮需求功率：$P_{wheel} = \frac{|N_{mg2}| \cdot T_{load}}{9550}$
- 电池充放电功率：$P_{batt} = P_{mg1} + P_{mg2}$
  - $P_{batt} > 0$：电池处于**放电**状态（提供额外驱动力）
  - $P_{batt} < 0$：电池处于**充电**状态（发动机发电或动能回收）

---

## 界面与功能模块说明

### 1. 驾驶员输入控制区 (Driver Inputs)
控制面板允许实时调节车辆的运行状态参数：
- **车速 (Vehicle Speed)**：范围 `-20 ~ 180 km/h`（支持倒车与高速巡航）。
- **发动机转速 (ICE RPM)**：范围 `0 ~ 6000 RPM`。
- **发动机扭矩 (ICE Torque)**：范围 `0 ~ 188 Nm`。
- **负载扭矩 (Load Torque)**：范围 `-700 ~ 700 Nm`。
  - **正值**：代表爬坡、加速阻力或高速行驶阻力。
  - **负值**：代表下坡或制动回收过程。

### 2. ICE 热效率 MAP 图 (M20A-FXS Engine Map)
模拟丰田 2.0L M20A-FXS 自然吸气发动机的热效率分布（最高热效率可达 41%）：
- **彩色高效区**：深绿 (40%+), 浅绿 (38-40%), 黄色 (35-38%), 红色 (<35%)。
- **动态工作点**：实心圆点指示当前发动机（RPM, Torque）运行位置。
- **边界线**：虚线表示发动机外特性（最大扭矩曲线），超限时将提示“超出扭矩边界”。

### 3. THS 杠杆图 (Nomograph Visualizer)
经典混动杠杆图（三轴杠杆）：
- **X 轴**：按 $1 : K$ 的几何比例排列 MG1(太阳轮)、ICE(行星架)、MG2(齿圈)。
- **Y 轴**：表示各轴转速，倾斜直线清晰展示三者转速约束关系。
- **动态矢量箭头**：实时展示各轴上的扭矩方向与大小（包含 MG1 支撑力矩、ICE 驱动力矩、MG2 电力补充力矩与 Load 负载力矩）。

### 4. PSD 行星齿轮动画 (Planetary Gear 2D Canvas)
- **实时动画**：高帧率 Canvas 渲染太阳轮、3个行星轮、行星架及外齿圈的相对旋转。
- **物理运动学准确**：行星轮自转与公转角速度基于 $N_{planet\_rel} = (N_{mg1} - N_{ice}) \cdot \frac{-2}{K-1}$ 精确计算。

### 5. 功率流与状态指示 (Power Status & Gauges)
- **发动机功率柱状图**：展示 ICE 实际输出功率。
- **车轮功率双向柱状图**：右侧为驱动功率（正值），左侧为制动回收功率（负值）。
- **电池功率双向柱状图**：右侧为放电功率（紫色），左侧为充电功率（绿色）。
- **电机工作状态卡片**：
  - **MG1 / MG2 状态**：动态识别 `Idle (空闲)`, `Motoring (驱动)`, `Generating (发电)` 模式。
  - **负载率提示**：显示实时功率输出及额定功率占比，超出额定值时提示 `Overload`。

---

## 代码架构与目录结构

```text
/
├── index.html          # 主界面结构 (Semantic Layout & Tailwind CSS)
├── style.css           # 全局样式与自定义控件样式
├── js/
│   ├── app.js          # 主控制器（DOM 缓存、事件响应、RAF 渲染循环）
│   ├── physics.js      # 核心物理与运动学方程（完全无 UI 依赖纯函数）
│   ├── ice-map.js      # 发动机热效率 MAP 计算与 Canvas 离屏预渲染
│   ├── nomograph.js    # 杠杆图矢量与轴线渲染器
│   └── psd.js          # 行星齿轮几何 Path 预建与 2D 轮廓绘制
├── service-worker.js   # PWA 离屏静态资源缓存
├── server.js           # Express 静态 HTTP 服务器
└── package.json        # 项目配置与启动脚本
```

---

## 本地运行指南

本项目完全由原生 HTML5、CSS 与 ES Modules 编写，**无需安装 npm 依赖或构建流程**，即可直接在任何现代浏览器中运行：

### 方式一：使用静态 Server 打开（推荐）
因为项目使用了 ES Modules (`import/export`)，通过本地 HTTP 服务器打开可避免跨域文件限制：
- **VS Code Live Server**：在 VS Code 中右键 `index.html`，选择 **Open with Live Server**。
- **Python 内置服务器**：在项目根目录运行：
  ```bash
  python -m http.server 3000
  ```
  然后访问 `http://localhost:3000`

### 方式二：使用 Node.js / npm (可选)
如果环境已安装 Node.js，也可以直接运行项目自带的静态服务器：
```bash
npm start
```
然后在浏览器打开 `http://localhost:3000` 即可使用。

---

## 作者与致谢

- **作者**：Fox-Hulio
- **Bilibili 主页**：[https://space.bilibili.com/396029763](https://space.bilibili.com/396029763)
