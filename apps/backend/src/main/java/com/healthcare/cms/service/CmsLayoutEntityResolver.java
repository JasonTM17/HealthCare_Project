package com.healthcare.cms.service;

import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.repository.ServiceRepository;
import com.healthcare.hospital.repository.SpecialtyRepository;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Component
public final class CmsLayoutEntityResolver {
    private final BranchRepository branches;
    private final SpecialtyRepository specialties;
    private final DoctorRepository doctors;
    private final ServiceRepository services;
    private final PackageRepository packages;
    private final ArticleRepository articles;

    public CmsLayoutEntityResolver(BranchRepository branches, SpecialtyRepository specialties, DoctorRepository doctors,
            ServiceRepository services, PackageRepository packages, ArticleRepository articles) {
        this.branches = branches;
        this.specialties = specialties;
        this.doctors = doctors;
        this.services = services;
        this.packages = packages;
        this.articles = articles;
    }

    public void requirePublicEntity(CmsPageLayoutManifest.Layout layout) {
        if (layout.entityId() == null) return;
        var id = layout.entityId();
        boolean visible = switch (layout.family()) {
            case "branches" -> branches.findById(id).map(entity -> entity.isActive()).orElse(false);
            case "specialties" -> specialties.findById(id).map(entity -> entity.isActive()).orElse(false);
            case "doctors" -> doctors.findById(id).map(entity -> entity.isActive()).orElse(false);
            case "services" -> services.findById(id).map(entity -> entity.isActive()).orElse(false);
            case "packages" -> packages.findById(id).map(entity -> entity.isActive()).orElse(false);
            case "articles", "benh-pho-bien" -> articles.findById(id)
                .filter(article -> !"benh-pho-bien".equals(layout.family()) || "DISEASE_GUIDE".equals(article.getContentKind()))
                .filter(this::publicArticle).isPresent();
            default -> false;
        };
        if (!visible) throw new ResourceNotFoundException("Public catalogue entity not found for layout");
    }

    private boolean publicArticle(Article article) {
        if ("DISEASE_GUIDE".equals(article.getContentKind())) {
            return articles.findClinicallyEligibleDiseaseGuideBySlug(article.getSlug()).isPresent();
        }
        return articles.findBySlugAndActiveTrueAndReviewStatusAndPublishedAtLessThanEqual(
            article.getSlug(), "APPROVED", OffsetDateTime.now(ZoneOffset.UTC)).isPresent();
    }
}
