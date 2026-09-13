# spring-boot-clean-template

一个面向长期维护与 AI 辅助开发的 Spring Boot 项目模板。

基于 **整洁架构（Clean Architecture）、六边形架构（Hexagonal Architecture）与依赖倒置原则（DIP）**，通过清晰的模块边界与依赖方向，减少业务代码与 Web、数据库、第三方服务等技术细节之间的耦合。

同时提供一套可独立使用的 `AGENTS.md`，用于约束 AI Agent 的编码方式。

## 为什么做这个模板？

Spring Boot 很容易开始，但随着业务增长，代码边界往往会逐渐变得模糊。

AI 可以让代码生成更快，但并不会自动保证架构始终清晰。

这个模板希望提供一个稳定的项目起点，让**人工开发和 AI 辅助开发都遵循同一套边界与约束**。

## 技术栈

Java 25 · Spring Boot 4.1.1 · MyBatis-Plus · H2 · Maven · JUnit 5 · ArchUnit

## 怎么开始？

这个模板有两种使用方式。

### 1. 使用完整模板

适合准备开始一个新的 Spring Boot 项目。

在 GitHub 中点击 **Use this template** 创建项目，然后：

1. 修改项目名称、包名等项目标识
2. 根据实际业务移除模板示例
3. 开始开发

模板中的示例模块可以帮助你快速理解基本的项目组织方式。

创建项目后的具体清理与派生步骤：

[`template-docs/derivation.md`](./template-docs/derivation.md)

### 2. 只使用 `AGENTS.md`

适合已经存在 Spring Boot 项目，只希望引入一套 AI 编码规范的情况。

直接复制：

[`AGENTS.md`](./AGENTS.md)

它不依赖本仓库的其他文件，可以独立放入新的项目中使用。

## 文档导航

| 文档                                                                                   | 说明                  |
| ------------------------------------------------------------------------------------ | ------------------- |
| [`AGENTS.md`](./AGENTS.md)                                                           | AI Agent 的工作规则与工程约束 |
| [`template-docs/TEMPLATE-ARCHITECTURE.md`](./template-docs/TEMPLATE-ARCHITECTURE.md) | 模板的架构蓝图与结构说明        |
| [`template-docs/derivation.md`](./template-docs/derivation.md)                       | 使用模板创建新项目后的派生指南     |
