# 用 AI 入门 Swift、iOS 和 macOS 开发

核对日期：2026-11-11。适合已经写过 Web 应用、第一次接触 Swift 和 Apple 平台的开发者。

## 起步选择

用 Swift + SwiftUI + Xcode，跟着 Apple 的 [Develop in Swift](https://developer.apple.com/tutorials/develop-in-swift) 做一个离线小应用。没有明确平台偏好时先做 iPhone：教程开头的项目可直接跟做，先在模拟器验证。若目标明确是菜单栏、键盘快捷键或文件处理工具，可以先做 macOS；SwiftUI 的基础相同，之后按需要接触 AppKit 或 UIKit。[SwiftUI 文档](https://developer.apple.com/documentation/swiftui) · [macOS 入门](https://developer.apple.com/macos/get-started/)

从 [Xcode 兼容表](https://developer.apple.com/xcode/system-requirements) 选当前 macOS 能运行的正式版。用 **File → New → Project → iOS → App**，选择 SwiftUI 和 Swift，存储先选 None，选一个 iPhone 模拟器后按 `⌘R`。Preview 适合迭代单个界面，模拟器适合检查整个流程，涉及硬件再上真机。初学无需付费会员；可以用个人 Apple 账户测试自己的设备，Personal Team 的签名配置需要定期续期。[新建项目](https://developer.apple.com/documentation/xcode/creating-an-xcode-project-for-an-app) · [运行和调试](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices) · [Apple 开发者账户](https://developer.apple.com/help/account/basics/about-your-developer-account)

## 用一个项目串起四次练习

例子：做一个「稍后读」清单，第一版手动输入标题，支持添加、标记已读和删除。暂缓登录、云同步、网页抓取和第三方依赖。

| 阶段       | 动手任务                                                                                                                                                                                                                                                                          | 验收                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 跑通 Xcode | 手敲 [Hello, SwiftUI](https://developer.apple.com/tutorials/develop-in-swift/hello-swiftui)，把模板改成自己的静态清单                                                                                                                                                             | 能在 Preview 看到改动，并用 `⌘R` 在模拟器启动                                             |
| 做出交互   | 参考 [Update the UI with state](https://developer.apple.com/tutorials/develop-in-swift/update-the-ui-with-state) 和 [Create dynamic content](https://developer.apple.com/tutorials/develop-in-swift/create-dynamic-content)，用 `List`、`TextField`、`@State` 和 `$` 绑定实现录入 | 能添加、标记和删除；说得出谁持有数据、谁能修改它                                          |
| 保存数据   | 先做 [Save data](https://developer.apple.com/tutorials/develop-in-swift/save-data)，再把清单从内存迁到 SwiftData；想做详情和编辑时继续读 [Create, update, and delete data](https://developer.apple.com/tutorials/develop-in-swift/create-update-and-delete-data)                  | 退出再打开，新增和编辑仍在，删除的条目不会回来                                            |
| 适配 Mac   | 在现有 SwiftUI 项目的 target 设置中，通过 [General → Supported Destinations](https://developer.apple.com/documentation/xcode/configuring-a-multiplatform-app-target) 添加 Mac，选择原生 Mac 目标。复用数据模型和业务逻辑，给 Mac 版加一个菜单快捷键                               | 两端都能完成录入流程；用鼠标、键盘和不同窗口大小检查 Mac 版。代码共享本身不等于设备间同步 |

Swift 随用随学。用 [A Swift Tour](https://docs.swift.org/latest/documentation/the-swift-programming-language/guidedtour/) 查 `let/var`、`struct`、`enum`、Optional、数组和闭包；真正开始请求接口再学 `async/await` 和 `throws`。有 React 经验可以借用「状态变化驱动界面」的直觉，但 SwiftUI 的状态归属和生命周期要按它自己的规则理解。需要让多个界面观察同一个对象时再读 [Managing model data in your app](https://developer.apple.com/documentation/swiftui/managing-model-data-in-your-app)。想用中文找资料，可以看 [Apple 的简体中文 SwiftUI 入门汇总](https://developer.apple.com/cn/swiftui/get-started/)；偏好视频和练习题，可用作者 Paul Hudson 的 [100 Days of SwiftUI](https://www.hackingwithswift.com/100/swiftui) 补基础，按需选章。

Mac 适配建议按 Apple 的 [Designing for macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos/) 检查窗口、菜单和键盘交互；[SwiftUI 菜单与快捷键示例](https://developer.apple.com/documentation/SwiftUI/Building-and-customizing-the-menu-bar-with-SwiftUI) 可直接参考。第一版只做一项 Mac 特有交互就够了。

## 把 AI 用成结对伙伴

第一段最短的教程自己敲一遍，遇到语法就请 AI 用现有的 TypeScript 知识做类比。接下来每次交给 AI 一个能手动验收的改动：说明目标和验收条件，查看 diff，运行，亲手做一个小变体，再提交。出错时把 Xcode 的第一条编译错误和相关代码交给 AI，让它解释根因并做最小修复。

可以直接用熟悉的 AI 编辑代码、在 Xcode 运行。如果想让 agent 直接调用 Xcode 的构建和测试能力，Apple 从 Xcode 26.3 开始提供 Codex 等 agent 的集成；如果当前版本或环境没有该入口，外部编辑器加 Xcode 的流程也够用。[Apple 演示](https://developer.apple.com/videos/play/tech-talks/111428/) · [Xcode 设置文档](https://developer.apple.com/documentation/xcode/setting-up-coding-intelligence)

可复制的提示词：

> 我会 React/TypeScript，刚学 SwiftUI。先阅读当前 Xcode 项目。这一步只做「输入标题，点添加，列表立即出现条目」。数据先放在内存，不加依赖，也不改签名或项目设置。先用三句话说明状态放在哪、输入框如何修改它、列表为什么会刷新，再做最小修改。按项目的 Xcode 版本和最低系统版本选择 API。最后告诉我改了哪些文件、怎么在模拟器验收，并给我一个能自己完成的变体。若无法运行，请明确说明验证到了哪一步。
