# Spring Boot 整洁架构蓝图

## 1. 架构总则

本项目采用整洁架构（Clean Architecture）、六边形架构（Hexagonal Architecture）与依赖倒置原则（DIP）。

### 分层与依赖方向

```text
Web / Infrastructure
        ↓
    Application
        ↓
      Domain
```

外层依赖内层，源码依赖方向向内收敛：

* Web / Infrastructure 可以依赖 Application 与 Domain。
* Application 可以依赖 Domain。
* Domain 不依赖 Application、Infrastructure、Web 或具体技术框架。
* 模块内部同样遵循依赖向内收敛的原则。

更具体的架构判据、模块封装、模型隔离与工程约束见 `AGENTS.md`。

## 2. 模块与包结构

系统按业务领域划分高层模块。每个模块内部按 `api / domain / application / infrastructure` 组织，`api` 是模块唯一公开面。

```text id="1d1k6y"
com.xingyun.template                    // 模板根包，派生项目以实际包名为准
├── Application.java                    // Spring Boot 启动类，组件扫描覆盖全部模块
│
├── shared
│   ├── domain
│   ├── util
│   ├── integration
│   ├── exception
│   └── web
│
└── module
    └── [domain_name]
        ├── api
        │   ├── XxxApi
        │   ├── XxxCommand
        │   ├── XxxQuery
        │   └── XxxResult
        │
        ├── domain
        │   ├── model
        │   ├── repository
        │   └── service
        │
        ├── application
        │   ├── service
        │   └── port
        │
        └── infrastructure
            ├── persistence
            │   ├── entity
            │   ├── mapper
            │   ├── converter
            │   └── impl
            │
            ├── integration
            │   └── [vendor]
            │
            └── web
                ├── controller
                ├── request
                ├── response
                └── assembler
```

### 各层职责

| 层 / 组件                     | 职责                                        |
|------------------------------|-------------------------------------------|
| `api`                        | 模块公开服务接口、Command、Query、Result 及稳定公开值语义类型  |
| `domain/model`               | 领域模型、聚合根与实体，维护业务状态与不变量                    |
| `domain/repository`          | 领域持久化能力抽象                                 |
| `domain/service`             | 无法归属单一领域模型的跨聚合纯业务规则                       |
| `application/service`        | 应用用例实现、事务控制、用例编排及契约与领域模型之间的转换             |
| `application/port`           | Application 所需的非持久化外部能力抽象                 |
| `infrastructure/persistence` | 数据库访问、PO、Mapper、Converter 与 Repository 实现 |
| `infrastructure/integration` | 外部系统与第三方服务适配                              |
| `infrastructure/web`         | HTTP / REST 协议适配                          |
| `shared`                     | 真正跨模块共享且稳定的非业务能力                          |

具体边界及模型转换规则见 `AGENTS.md`。

## 3. 依赖与边界

模块之间通过 `api` 建立公开契约依赖，模块内部实现不得成为其他模块的依赖对象。

Domain 不承载具体技术语义；数据库、ORM、HTTP、序列化、依赖注入及第三方 SDK 等技术细节由外层适配。

Repository 由 Domain 声明领域持久化能力，Port 由 Application 声明所需的非持久化外部能力；具体实现均位于 Infrastructure。

不同边界使用各自模型，典型流转关系如下：

```text
Request / Response
        ↕
     Assembler
        ↕
Command / Query / Result
        ↕
Application Service
        ↕
    Domain Model
        ↕
     Converter
        ↕
        PO
```

以上为典型模型流转关系，具体用例根据实际边界使用所需模型，不因架构形式而强行引入不必要的转换层。

### 异常边界

业务异常表达业务语义，异常本身不携带 HTTP 等外部协议语义；异常传播到 Web 边界后，业务异常翻译为 HTTP `ProblemDetail`，未预期的技术异常由 Web 边界统一兜底为通用服务器错误响应。异常类型的选择与使用规则见 `AGENTS.md`。

依赖方向保持为：

```text
Domain / Application
        ↓
 BusinessException
        ↓
       Web
        ↓
HTTP ProblemDetail
```

这种边界使业务语义保持独立，避免 HTTP、数据库或第三方技术模型直接塑造 Domain 与模块公开契约。

## 4. 设计取舍

### 4.1 依赖优先考虑可解除性

复用会建立依赖。

因此，共享抽象不以减少重复为唯一目标，而应具有明确语义，并尽量通过公开契约、Port 或其他边界隔离实现变化。直接共享实现细节虽然可以减少代码，却可能使一方的内部变化成为另一方的负担。

因此 `shared` 保持克制，模块通过 `api` 暴露能力，外部技术通过 Repository、Port 与 Adapter 等边界进入系统。

### 4.2 业务模型由业务语义驱动

业务模型承载业务语义，技术设施由消费方声明所需能力。

持久化、远程服务、消息等基础设施不应反向塑造 Domain 或模块公开契约。具体技术通过 Repository、Port、Adapter 等边界提供能力，使业务模型保持独立于技术实现。

### 4.3 优先使用已有语义

自定义抽象用于解决明确的问题，而不是为了形式上的统一。

语言、框架和生态已有成熟语义时，优先直接使用；只有现有语义不足以表达项目需要，或无法提供必要的边界隔离时，才建立项目自己的抽象。

## 5. 示例模块

`module/example/` 是完整分层示例，供开发者和 AI 参考各层标准写法。

`module/comment/` 演示跨模块调用，仅依赖 `example/api` 中公开的契约及其稳定值语义类型。

示例属于参考实现，可以整体删除；介绍、试用与移除方式见 `derivation.md`。
