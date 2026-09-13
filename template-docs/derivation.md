# 派生指南

`Use this template` 创建的是一个新的独立项目，而不是模板仓库的分支。模板提供工程结构、架构约束、AI 编码上下文、示例与开发规则；本指南说明派生之后需要接管哪些内容，以及如何判断接管已经完成。

## 1. 迁移项目标识

模板标识同时出现在源码、构建元数据与运行时配置中，逐类同步：

| 位置 | 模板默认值 |
| --- | --- |
| 根包名与源码目录 | `com.xingyun.template` |
| Maven `groupId` / `artifactId` | `com.xingyun` / `spring-boot-clean-template` |
| Maven `name` / `description` | 模板名称与描述 |
| 运行时应用名（`application.yml` 的 `spring.application.name`） | `spring-boot-clean-template` |

自检：迁移完成后重新检索这些标识，源码、构建元数据与运行时配置中不应有残留。检索时使用完整标识而非包名片段，避免包声明与 import 带来的噪音。`template-docs/` 保留模板原貌，其中的标识不必修改。

## 2. 项目文档接管

`README.md` 替换为项目自身的说明，项目自身的架构与工程事实由项目自有的文档表达，名称、位置与组织方式由项目决定。

`template-docs/` 与示例模块属于模板附带内容，可按需保留或删除——[AGENTS.md](../AGENTS.md) 自足，不依赖仓库中的任何其他文档，删除它们不影响 AI 编码约束的执行。

## 3. 调整目录结构

模板的 Maven 项目默认位于仓库根目录。

如果你希望将 Maven 项目移动到子目录，例如：

```text
my-project/
├── backend/
│   ├── pom.xml
│   └── src/
├── README.md
└── AGENTS.md
```

除了移动文件本身，还需要调整依赖 Maven 项目位置的配置。

重点处理以下内容：

* **CI：** `.github/workflows/ci.yml` 中的 Maven 步骤需要设置新的 `working-directory`，使命令在 `pom.xml` 所在目录执行。例如：

  ```yaml
  - name: 运行全量测试
    working-directory: backend
    run: mvn -B test
  ```

* **开发工具：** Maven 项目移动后，需要让所使用的 IDE 或开发工具重新识别新的 `pom.xml` 位置。以 IntelliJ IDEA 为例，可在 Maven 工具窗口中重新加载或添加新的 `pom.xml`。

* **本地命令：** 原本在仓库根目录执行的 Maven 命令需要改为在新的 Maven 项目目录执行，例如：

  ```bash
  cd backend
  mvn test
  mvn spring-boot:run
  ```

* **文档引用：** 如果文档中存在指向示例代码、资源或其他项目内部路径的引用，移动 Maven 项目后同步更新。

调整完成后，在新的 Maven 项目目录执行：

```bash
mvn clean test
```

并启动应用完成一次基本调用，确认项目可以正常构建和运行。

## 4. 示例与运行设施

模板内置两个用于说明架构的教学模块——`example` 与消费其公开契约的 `comment`，以及支撑它们开箱即跑的 H2。示例用于演示架构边界与各层典型写法，不承载模板使用者的实际业务。

### 示例模块

`module/example/` 覆盖 `api / domain / application / infrastructure` 四层，是完整分层示例。新写某层代码时，阅读该模块对应层的代码仿写即可，文件内的中文注释说明该层的写法要点。

`module/comment/` 演示模块之间如何通过公开契约协作：跨模块只依赖对方的 `api` 包，不访问对方的内部实现与数据表；跨模块引用仅作逻辑关联，不建立物理外键。

示例配套的测试同样按验证责任组织，可作为测试写法的参照：领域单元测试、Web 契约测试，以及位于测试根目录的 `ArchitectureTest`——架构边界的可执行守卫，不引用具体示例模块，移除示例后继续生效。

### 试用示例

启动应用（H2 内存库随应用启动，无需预装数据库）：

```bash
mvn spring-boot:run
```

以下调用依次走通两个模块的主要路径（全新启动的内存库中，首个示例的标识为 1）：

```bash
# 创建示例
curl -X POST localhost:8080/examples \
  -H 'Content-Type: application/json' \
  -d '{"code":"DEMO","name":"第一个示例"}'

# 查询示例
curl localhost:8080/examples/1

# 重命名示例
curl -X PUT localhost:8080/examples/1 \
  -H 'Content-Type: application/json' \
  -d '{"name":"新名称"}'

# 为示例创建评论
curl -X POST localhost:8080/comments \
  -H 'Content-Type: application/json' \
  -d '{"exampleId":1,"content":"一条评论"}'

# 按示例列出评论
curl 'localhost:8080/comments?exampleId=1'
```

H2 Web 控制台默认关闭。将 `application.yml` 中的 `spring.h2.console.enabled` 改为 `true` 并重启，访问 `http://localhost:8080/h2-console`；登录页 JDBC URL 填写 `jdbc:h2:mem:example`，用户名与密码与 `spring.datasource` 配置一致（默认 `sa` / 空密码）。连接后可查看 `T_EXAMPLE`、`T_COMMENT` 两张表，接口调用产生的数据即时可见。

### H2 运行时存储

示例的仓储链路需要真实数据库才能跑通，而模板不预设使用者的数据库环境，因此内置 H2 并以内存模式运行：应用启动时建库，停止后数据消失，无需安装与配置。H2 是示例的运行期与开发期设施，不代表生产环境的数据库选型。

其构成如下：

- 依赖：`com.h2database:h2`（runtime 作用域的 JDBC 驱动）与 `org.springframework.boot:spring-boot-h2console`（H2 控制台自动配置；Spring Boot 4.x 中已独立为单独模块，缺它则控制台开关不生效）。
- 数据源：`application.yml` 的 `spring.datasource` 指向内存库；URL 中的 `DB_CLOSE_DELAY=-1` 保证全部连接关闭后，库在应用运行期间不被销毁。
- 建表脚本：`src/main/resources/schema.sql` 定义 `t_example`、`t_comment` 两张表；位于 classpath 根目录，Spring Boot 对内嵌库在启动时自动执行。

内存模式下数据只存在于当前应用进程：重启后数据重建，停止后消失；IDEA、DBeaver 等外部工具无法连接应用进程内的内存库，在另一个 JVM 中使用相同 JDBC URL 只会得到另一个独立的同名内存库。因此不应将它当作开发期的长期数据存储。

### 示例的去留

示例是参考实现，既不属于模板使用者的业务代码，也不需要派生后立即删除。

下列情况可以继续保留：

* 仍需通过示例理解各层写法与架构边界
* 项目尚未出现同类真实实现

出现下列任一情况，继续保留的收益已经不大：

* 项目已有对应的真实实现，示例不再提供新的信息
* 开发者不再查阅示例即可按约定编写代码
* 示例与业务代码开始混淆，难以区分归属
* 保留示例带来的测试与维护成本超过其参考价值
* 示例已无法反映模板推荐的实践

确认不再需要后，整体删除：

1. 删除两个模块的主代码与测试代码：`src/main/java` 与 `src/test/java` 下的 `module/example/`、`module/comment/` 目录（实际路径以当前根包为准）。
2. 删除 `src/main/resources/schema.sql`——该脚本只服务示例的两张表。

`ArchitectureTest` 与 `shared/` 下的通用设施不引用具体示例模块，无需改动。清理后执行 `mvn test` 确认构建通过。

### 替换或移除 H2

项目接入真实数据库时：

1. 替换依赖：移除 `com.h2database:h2` 与 `spring-boot-h2console`，加入实际数据库的 JDBC 驱动；若同时不再使用 MyBatis-Plus，一并移除 `mybatis-plus-spring-boot4-starter`。
2. 替换配置：将 `application.yml` 中的 `spring.datasource` 改为实际数据库连接，并删除 `spring.h2.console` 配置；项目不再需要持久化时删除整个数据源配置。
3. 接管建表：生产环境的库结构应交由 Flyway、Liquibase 或 DBA 发布流程管理，不再依赖 `schema.sql` 自动建表。
4. 主键策略：示例 PO 使用 `IdType.AUTO`（数据库自增主键）；沿用这一映射时，真实数据库的主键需采用对应的自增策略。

> 类路径上存在持久化 starter 却没有可用数据源配置时，应用可能无法正常启动。

## 5. 验证派生完成

构建与测试是派生完成的第一层判据：

```bash
mvn test               # 运行测试
mvn clean package      # 执行完整构建
```

测试通过不等于应用可以按真实方式运行。启动应用并确认启动成功，再执行一次真实调用核对结果；需要启动级验证的变更范围见 [AGENTS.md](../AGENTS.md) §6.4。

完成以上步骤后，仓库即是一个可以独立开发的项目。
