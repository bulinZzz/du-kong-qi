-- 示例模块演示表：字段与 ExamplePO 一一对应
CREATE TABLE IF NOT EXISTS t_example (
    id   BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(64) NOT NULL
);

-- 评论模块演示表：字段与 CommentPO 一一对应；example_id 为对示例聚合的跨模块引用（逻辑关联，不建物理外键）
CREATE TABLE IF NOT EXISTS t_comment (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    example_id BIGINT NOT NULL,
    content    VARCHAR(255) NOT NULL
);
