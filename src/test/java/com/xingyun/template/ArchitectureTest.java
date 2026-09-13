package com.xingyun.template;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RestController;

/**
 * 架构边界守卫：将 AGENTS.md 中的关键架构约束固化为可执行测试。
 *
 * <p>仅分析生产代码，测试代码不纳入架构约束。
 */
@AnalyzeClasses(
        packages = "com.xingyun.template",
        importOptions = ImportOption.DoNotIncludeTests.class
)
class ArchitectureTest {

    private static final String BASE = "com.xingyun.template";
    private static final String MODULES = BASE + ".module";

    /**
     * Rule 1：模块之间不得出现循环依赖。
     *
     * <p>模块之间应形成无环依赖图，避免模块边界逐步退化为相互耦合。
     */
    @ArchTest
    static final ArchRule modules_must_be_free_of_cycles = slices()
            .matching(MODULES + ".(*)..")
            .should().beFreeOfCycles();

    /**
     * Rule 2：Domain 不得依赖 Application / Infrastructure。
     *
     * <p>Domain 可依赖 JDK、共享支撑以及编译期增强，但不得反向依赖应用层或基础设施层。
     */
    @ArchTest
    static final ArchRule domain_must_not_depend_on_outer_layers = noClasses()
            .that().resideInAPackage(MODULES + "..domain..")
            .should().dependOnClassesThat()
            .resideInAnyPackage(
                    MODULES + "..application..",
                    MODULES + "..infrastructure.."
            );

    /**
     * Rule 3：Domain 不得依赖技术框架。
     *
     * <p>锁定明确的 Web、ORM、DI、Validation 等技术边界，
     * 不建立庞大的第三方依赖黑名单。
     */
    @ArchTest
    static final ArchRule domain_must_not_depend_on_technical_frameworks = noClasses()
            .that().resideInAPackage(MODULES + "..domain..")
            .should().dependOnClassesThat()
            .resideInAnyPackage(
                    "org.springframework..",
                    "org.apache.ibatis..",
                    "com.baomidou..",
                    "jakarta.servlet..",
                    "jakarta.validation..",
                    "jakarta.persistence..",
                    "jakarta.ws.rs.."
            );

    /**
     * Rule 4：Application 不得依赖 Infrastructure。
     *
     * <p>Application 可以依赖 Domain、本模块契约、共享支撑以及其他模块的公开契约，
     * 但不得直接依赖 Web、持久化或其他基础设施实现。
     */
    @ArchTest
    static final ArchRule application_must_not_depend_on_infrastructure = noClasses()
            .that().resideInAPackage(MODULES + "..application..")
            .should().dependOnClassesThat()
            .resideInAnyPackage(
                    MODULES + "..infrastructure.."
            );

    /**
     * Rule 5：Repository / Port 不得依赖 Infrastructure。
     *
     * <p>Repository 位于 Domain，Port 位于 Application；它们都是内层抽象，
     * 不得反向依赖 Mapper、PO、Converter、Web 或其他基础设施实现。
     */
    @ArchTest
    static final ArchRule boundaries_must_not_depend_on_infrastructure = noClasses()
            .that().resideInAnyPackage(
                    MODULES + "..domain.repository..",
                    MODULES + "..application.port.."
            )
            .should().dependOnClassesThat()
            .resideInAnyPackage(
                    MODULES + "..infrastructure.."
            );

    /**
     * Rule 6：模块之间只能通过公开契约依赖。
     *
     * <p>其他模块只能依赖目标模块 api 包中的公开契约，
     * 以及这些契约直接引用的稳定值语义类型。
     *
     * <p>当前以 record / enum 作为稳定值类型的机器可判定近似。
     * 例如模块公开接口直接引用本模块的强类型标识时，该标识属于合法公开契约的一部分。
     */
    @ArchTest
    static void cross_module_dependencies_through_public_contract_only(
            JavaClasses classes) {

        classes()
                .that().resideInAPackage(MODULES + "..")
                .should(new CrossModuleThroughPublicContractCondition(classes))
                .check(classes);
    }

    /**
     * Rule 7：API 不得泄漏本模块内部实现。
     *
     * <p>API 可以依赖自身 api 包中的契约，
     * 也可以依赖契约签名所需的稳定值语义类型，
     * 但不得暴露或依赖 Domain Model、Repository、
     * Application Service 实现、Mapper、PO、Converter 等内部实现。
     */
    @ArchTest
    static void api_must_not_depend_on_internal_implementation(
            JavaClasses classes) {

        classes()
                .that().resideInAPackage(MODULES + "..api..")
                .should(new ApiMustNotDependOnInternalImplementationCondition())
                .check(classes);
    }

    /**
     * Rule 8：Controller 必须位于 Infrastructure Web。
     *
     * <p>HTTP Controller 属于 Web 适配器，只能位于
     * {@code infrastructure.web.controller}。
     */
    @ArchTest
    static final ArchRule controllers_must_reside_in_web_controller = classes()
            .that()
            .areAnnotatedWith(Controller.class)
            .or()
            .areAnnotatedWith(RestController.class)
            .should()
            .resideInAnyPackage(
                    MODULES + "..infrastructure.web.controller.."
            );

    /**
     * 检查跨模块依赖是否只落在目标模块公开契约范围内。
     */
    private static final class CrossModuleThroughPublicContractCondition
            extends ArchCondition<JavaClass> {

        private final Map<String, Set<String>> publicContractByModule;

        private CrossModuleThroughPublicContractCondition(JavaClasses classes) {
            super(
                    "只通过对方模块的公开契约"
                            + "（api 包 + 契约直接引用的稳定值类型）"
                            + "依赖其他模块"
            );
            this.publicContractByModule = computePublicContracts(classes);
        }

        @Override
        public void check(JavaClass javaClass, ConditionEvents events) {
            String sourceModule = moduleOf(javaClass).orElse(null);

            if (sourceModule == null) {
                return;
            }

            for (Dependency dependency : javaClass.getDirectDependenciesFromSelf()) {
                JavaClass target = dependency.getTargetClass();
                String targetModule = moduleOf(target).orElse(null);

                if (targetModule == null || targetModule.equals(sourceModule)) {
                    continue;
                }

                Set<String> targetContract =
                        publicContractByModule.getOrDefault(targetModule, Set.of());

                if (!targetContract.contains(target.getName())) {
                    events.add(SimpleConditionEvent.violated(
                            javaClass,
                            javaClass.getName()
                                    + " 依赖了 "
                                    + target.getName()
                                    + "，该类不属于模块 "
                                    + targetModule
                                    + " 的公开契约"
                    ));
                }
            }
        }

        private static Map<String, Set<String>> computePublicContracts(
                JavaClasses classes) {

            Map<String, Set<String>> contracts = new HashMap<>();

            for (JavaClass candidate : classes) {
                Optional<String> moduleOpt = moduleOf(candidate);

                if (moduleOpt.isEmpty()) {
                    continue;
                }

                String module = moduleOpt.get();
                String apiPackage = MODULES + "." + module + ".api";

                if (!isInPackage(candidate, apiPackage)) {
                    continue;
                }

                Set<String> contract =
                        contracts.computeIfAbsent(module, key -> new HashSet<>());

                contract.add(candidate.getName());

                for (Dependency dependency : candidate.getDirectDependenciesFromSelf()) {
                    JavaClass referenced = dependency.getTargetClass();

                    if (isStableValueType(referenced)
                            && module.equals(moduleOf(referenced).orElse(null))) {
                        contract.add(referenced.getName());
                    }
                }
            }

            return contracts;
        }
    }

    /**
     * 检查 API 是否依赖本模块内部实现。
     */
    private static final class ApiMustNotDependOnInternalImplementationCondition
            extends ArchCondition<JavaClass> {

        private ApiMustNotDependOnInternalImplementationCondition() {
            super("不得依赖本模块 api 之外的内部实现类型");
        }

        @Override
        public void check(JavaClass javaClass, ConditionEvents events) {
            String sourceModule = moduleOf(javaClass).orElse(null);

            if (sourceModule == null) {
                return;
            }

            String sourceApiPackage = MODULES + "." + sourceModule + ".api";

            for (Dependency dependency : javaClass.getDirectDependenciesFromSelf()) {
                JavaClass target = dependency.getTargetClass();
                String targetModule = moduleOf(target).orElse(null);

                // JDK、Spring、shared 等非模块类不属于本规则的检查范围。
                if (targetModule == null) {
                    continue;
                }

                // API 内部类型可以互相引用。
                if (isInPackage(target, sourceApiPackage)) {
                    continue;
                }

                // API 可以依赖自身契约所需的稳定值语义类型。
                if (targetModule.equals(sourceModule)
                        && isStableValueType(target)) {
                    continue;
                }

                events.add(SimpleConditionEvent.violated(
                        javaClass,
                        javaClass.getName()
                                + " 依赖了本模块内部类型 "
                                + target.getName()
                ));
            }
        }
    }

    private static Optional<String> moduleOf(JavaClass javaClass) {
        String packageName = javaClass.getPackageName();
        String prefix = MODULES + ".";

        if (!packageName.startsWith(prefix)) {
            return Optional.empty();
        }

        String rest = packageName.substring(prefix.length());
        int dot = rest.indexOf('.');

        return Optional.of(
                dot > 0 ? rest.substring(0, dot) : rest
        );
    }

    private static boolean isInPackage(
            JavaClass javaClass,
            String packageName) {

        String actualPackage = javaClass.getPackageName();

        return actualPackage.equals(packageName)
                || actualPackage.startsWith(packageName + ".");
    }

    private static boolean isStableValueType(JavaClass javaClass) {
        return javaClass.isEnum() || javaClass.isRecord();
    }
}
