package com.xingyun.dukongqi.module.atmosphere.infrastructure.integration.openai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.xingyun.dukongqi.module.atmosphere.api.InsufficientContentException;
import com.xingyun.dukongqi.module.atmosphere.application.port.AtmosphereAnalyzer;
import com.xingyun.dukongqi.module.atmosphere.domain.model.AtmosphereAnalysis;
import com.xingyun.dukongqi.shared.util.StringUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * 评分质量的回归基线：五段固定样本——平和、争论明显、对立明显、骂战激烈各一段，
 * 外加一段无法判断的内容。
 *
 * <p>样本都是自造的：真实页面的评论属于别人，不适合固化进仓库，而且它们会随站点变化过期。
 * 真实样本用于校准（见开发记录），这里留下的是校准之后仍该成立的档位预期。
 *
 * <p>需要真实模型访问，因此默认不参与构建，
 * 手动运行：{@code mvn test -Dgroups=evaluation -Dexcluded.groups=}。
 * 未配置访问密钥时整体跳过，而不是报失败。
 *
 * <p>断言写的是当前校准过的预期区间。有意调整评分口径时，同步更新这些区间；
 * 它们变红才说明评分行为发生了预期之外的变化。
 */
@Tag("evaluation")
@SpringBootTest
class FlameIntensityEvaluationTest {

    private final AtmosphereAnalyzer atmosphereAnalyzer;
    private final OpenAiProperties openAiProperties;

    @Autowired
    FlameIntensityEvaluationTest(
            AtmosphereAnalyzer atmosphereAnalyzer,
            OpenAiProperties openAiProperties) {
        this.atmosphereAnalyzer = atmosphereAnalyzer;
        this.openAiProperties = openAiProperties;
    }

    @BeforeEach
    void requireApiKey() {
        assumeTrue(
                StringUtils.isNotBlank(openAiProperties.apiKey()),
                "未配置 atmosphere.llm.api-key，跳过评测");
    }

    @Test
    @DisplayName("平和讨论：给出低分，而不是判为无法判断")
    void calm_discussion_should_score_low() {
        AtmosphereAnalysis analysis = atmosphereAnalyzer.analyze(CALM_DISCUSSION);

        assertThat(analysis.flameIntensity().value()).isLessThanOrEqualTo(40);
    }

    @Test
    @DisplayName("只有附和的内容：拒绝判断")
    void content_without_substance_should_be_refused() {
        assertThatThrownBy(() -> atmosphereAnalyzer.analyze(AGREEMENT_ONLY))
                .isInstanceOf(InsufficientContentException.class)
                .hasMessage("页面内容不足以分析");
    }

    @Test
    @DisplayName("明显对立的讨论：落入对立档，而不是升级为全面骂战")
    void hostile_discussion_should_score_in_hostile_band() {
        AtmosphereAnalysis analysis = atmosphereAnalyzer.analyze(HOSTILE_DISCUSSION);

        assertThat(analysis.flameIntensity().value()).isBetween(61, 80);
    }

    @Test
    @DisplayName("争论明显的讨论：落入争论档，而不是被推高到对立")
    void debating_discussion_should_score_in_debating_band() {
        AtmosphereAnalysis analysis = atmosphereAnalyzer.analyze(DEBATING_DISCUSSION);

        assertThat(analysis.flameIntensity().value()).isBetween(41, 60);
    }

    @Test
    @DisplayName("已经骂起来的讨论：落入最高档")
    void fierce_discussion_should_score_in_fierce_band() {
        AtmosphereAnalysis analysis = atmosphereAnalyzer.analyze(FIERCE_DISCUSSION);

        assertThat(analysis.flameIntensity().value()).isBetween(81, 100);
    }

    /**
     * 平和讨论：围绕选购互相补充建议，只在产品类型上有过一次礼貌分歧。
     */
    private static final String CALM_DISCUSSION = """
            【求助】想给爸妈换个扫地机器人，有什么要注意的

            楼主：爸妈年纪大了，弯腰扫地不方便，想买个扫地机器人送他们。家里 90 平，没有宠物，地板为主，预算 2000 左右。主要是怕他们不会用，有没有操作简单的推荐？

            3楼：操作简单的话优先看能不能一键启动，别买那种必须连 App 才能用的。我给我妈买的那台可以按机身上的按钮直接扫，她就用这个。

            楼主：谢谢，这个提醒很实用，我确实没想到 App 这层。

            5楼：补充一个，要注意门槛和地毯。我家卫生间有个 3 厘米的门槛，机器人过不去，后来我在门口加了个小坡。

            7楼：2000 这个价位选择挺多的，石头、科沃斯、追觅都有。建议去线下店看实物，主要看机身按键和尘盒好不好拆洗。

            楼主：好的，周末去看看。感谢各位。

            9楼：另外提醒一下，老人可能不太习惯机器人在脚边转，可以先让他们适应几天。我家老人一开始嫌吵，后来发现不用自己扫就接受了。

            5楼：噪音这点确实要注意，别选那种全程大吸力的，选有安静模式的。

            7楼：我个人觉得这个预算不如买个洗地机，扫拖一步到位。

            5楼：洗地机还得自己推着走，老人用起来更累吧。扫地机不用管，我觉得更适合这个场景。

            7楼：也有道理，我是从清洁效果考虑的。看你更看重哪一头了。

            楼主：都记下了，谢谢大家，比我自己瞎买靠谱多了。
            """;

    /**
     * 只有附和：字数足以通过长度校验，但看不出讨论的是什么，无从判断空气。
     */
    private static final String AGREEMENT_ONLY = """
            3楼：+1，说得太对了。

            7楼：楼上说得对，我也这么觉得。

            9楼：+1

            12楼：确实。

            15楼：这楼说得有道理，支持一下。

            18楼：同感。

            21楼：+1，别的不说，这楼说得对。

            24楼：同意楼上，没什么补充的。

            27楼：+1

            30楼：就是这个理。

            33楼：说得对，我一开始也是这么想的。

            36楼：支持，楼上说得挺清楚了。

            39楼：+1，不用再多说。

            42楼：确实是这样。

            45楼：楼上说得对，我也是这个看法。

            48楼：同感，+1。

            51楼：说得对。

            54楼：+1

            57楼：同感，顶上。

            60楼：同意，说得在理。

            63楼：+1

            66楼：确实，我也是这么想的。

            69楼：支持一下。

            72楼：楼上说得对。

            75楼：+1，同感。

            78楼：说得对，没别的意见。

            81楼：同感，顶。

            84楼：+1
            """;

    /**
     * 明显对立：一人持续人身攻击与扣帽子，多人回击，同时仍有理性建议。
     */
    private static final String HOSTILE_DISCUSSION = """
            【求推荐】3000 块左右想买个拍照好的手机，平时就拍拍孩子

            楼主：预算 3000 上下，不打游戏，主要拍小孩和拍菜，看了一圈有点晕，求各位推荐一下。

            2楼：这预算还想拍照好？醒醒吧，这个价位都是扫码器，别做梦了。

            楼主：扫码器也太夸张了吧，我看评测这个价位主摄也还行啊。

            4楼：评测都是恰饭的，你也信？典型的被 KOL 洗脑，一点判断力都没有。

            5楼：楼上说话这么冲干嘛，人家就是问个问题，你至于吗。

            2楼：我说的是事实，玻璃心就别上网了。预算不够就是不够，穷还要拍好照片，这不搞笑吗。

            7楼：楼主别理他，这人每个帖子都这样。红米、真我这两个系列可以去实体店看看，主要看主摄和算法调校。

            5楼：+1，某些人除了阴阳怪气什么建议都给不出来。

            2楼：你俩一唱一和挺默契啊，是不是收了钱？说个品牌名就开始护，水军现在都这么不专业了吗。

            7楼：又开始扣帽子了。你倒是说说你推荐哪台，别光会喷。

            2楼：我推荐你俩先去补补脑子。连基本常识都没有还在这指点江山，笑死。

            5楼：这就是纯来吵架的吧，管理员不管管？

            9楼：其实这价位 iQOO 也可以看看，拍照调校比想象中好。

            2楼：又来个懂哥，你们仨凑一块儿开个水军大会算了。
            """;

    /**
     * 争论明显：观点对上了，措辞已经带刺、也有人站队，但没有针对个人的持续对线。
     */
    private static final String DEBATING_DISCUSSION = """
            【求助】孩子上初二，非要一部手机，该给吗

            楼主：初二，班里几乎人人有手机，他说没手机跟同学聊不到一起。我担心一给就收不住，成绩往下掉。

            3楼：初二不给，高中再说。这个年纪的自控力就那样，给了就是给自己找事。别拿社交说事，真朋友不会因为没手机就不理他。

            5楼：楼上这种说法就是典型的懒政。全班都有就他没有，被孤立的是孩子。给，但把规则讲清楚。

            3楼：规则是你说定就能执行的？我见过太多家庭，规则定了三天，之后天天为手机吵架。

            6楼：+1，那种"制定规则"的说法听听就好，真能执行的有几个。

            5楼：执行不了是没当回事，别把自己的将就当成普遍规律。

            8楼：这话说得太满了。别人家管不住，不代表这事不能做。

            5楼：我没说不能做，我是说拿"管不住"当理由不给，本质上是偷懒。

            9楼：又开始上价值了，聊个手机能聊到偷懒，服。

            3楼：试出来的是你家的孩子，不是我的。你愿意赌就赌。

            6楼：吵成这样了，楼主的问题谁还管。

            5楼：话我放这儿了，谁不信谁自己试去。

            7楼：两位都说得太满，一个说必掉，一个说必成，中间那些人算什么。

            12楼：我们初三给的，半个学期掉了四十名，后来跟班主任一起盯了两个月才拉回来。给可以，但要付代价。

            13楼：看到这儿我更晕了，到底给还是不给。

            楼主：……我也更晕了。
            """;

    /**
     * 骂战激烈：多轮互相侮辱、扣帽子、约架，几乎不再讨论事情本身，也没有人试图拉回话题。
     */
    private static final String FIERCE_DISCUSSION = """
            【就说一句】这次的视频我看了三遍，别洗了

            楼主：镜头、时间、地点都对得上，还硬说剪辑。护到这个程度，也挺可怜的。

            2楼：你家那位当年干的事你忘了？拿这个出来说事，你脸呢。

            3楼：又开始了，出了事就说是黑子，永远不是自己有问题，标准话术。

            2楼：你是收钱办事的吧，天天蹲这儿，恶心。

            4楼：楼上这种嘴，现实里敢这么说话吗？也就网上横。

            2楼：来，你把地址发出来，看谁怂。

            5楼：一家子都没教养，还教育别人，先照照自己。

            6楼：这评论区烂透了，一群疯狗互相咬。

            2楼：你算什么东西，轮得到你在这儿点评？滚。

            7楼：能不能说点事实。

            2楼：事实就是你这种人也配开口？瞎眼的玩意，回去舔你的主子。

            8楼：有些粉丝真没救，脑子被啃干净了，跟邪教没什么区别。

            9楼：路过，只说一句：难看，两边都难看。

            2楼：你也是来找骂的？一家人一个德行，可怜。

            10楼：都别争了，人家自己都不回应，你们在这儿咬得这么起劲，图什么。

            2楼：闭嘴吧你。谁咬谁啊，先看看你自己什么货色。
            """;
}
