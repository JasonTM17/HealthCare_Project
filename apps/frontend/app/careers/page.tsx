"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "../../components/UiIcon";
import { PublicPageShell } from "../../components/PublicPageShell";
import CmsLiveSlot from "../../components/cms/CmsLiveSlot";
import { fetchCareerPositions } from "../../lib/api-client";
import { formatBusinessDate } from "../../lib/business-time";
import type { CmsContent, CmsHeroPayload } from "../../lib/cms-client";
import type { JobPosition } from "../../types/hospital";
import CareerApplicationDialog from "./CareerApplicationDialog";
import styles from "./careers.module.css";

function formatDeadline(value?: string | null): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatBusinessDate(value) : null;
}

const DEFAULT_HERO: CmsHeroPayload = {
  eyebrow: "Cơ hội nghề nghiệp tại HealthCare",
  title: "Làm nghề bằng chuyên môn, đồng hành bằng sự tử tế",
  body: "Mỗi vai trò đều góp phần tạo nên một hành trình chăm sóc an toàn, rõ ràng và tôn trọng người bệnh. Hãy chọn vị trí phù hợp với kinh nghiệm của bạn và gửi hồ sơ trực tiếp tại đây.",
  ctaLabel: "Xem vị trí đang tuyển",
  ctaHref: "#vi-tri-dang-tuyen",
};

function CareerHero({ content, loading, positionCount }: {
  content: CmsHeroPayload;
  loading: boolean;
  positionCount: number;
}): React.ReactElement {
  return (
    <section className={styles.hero}>
      <div className={`${styles.inner} ${styles.heroGrid}`}>
        <div className={styles.heroCopy}>
          {content.eyebrow ? <span className={styles.eyebrow}>{content.eyebrow}</span> : null}
          <h1>{content.title}</h1>
          {content.body ? <p>{content.body}</p> : null}
          <div className={styles.heroActions}>
            {content.ctaLabel && content.ctaHref ? (
              <a className={styles.primaryButton} href={content.ctaHref}>
                {content.ctaLabel} <Icon name="arrow-right" size={18} />
              </a>
            ) : null}
            <Link className={styles.secondaryButton} href="/about">Tìm hiểu về bệnh viện</Link>
          </div>
        </div>
        <div className={styles.heroVisual} aria-label="Hành trình gia nhập đội ngũ HealthCare">
          <div className={styles.heroBadge}>
            <span>{loading ? "—" : positionCount}</span>
            <p>vị trí đang nhận hồ sơ</p>
          </div>
          <div className={styles.pathCard}>
            <span className={styles.pathIcon}><Icon name="user" size={22} /></span>
            <div><strong>Chọn vị trí</strong><small>Đọc kỹ phạm vi công việc</small></div>
          </div>
          <div className={styles.pathLine} aria-hidden="true" />
          <div className={styles.pathCard}>
            <span className={styles.pathIcon}><Icon name="mail" size={22} /></span>
            <div><strong>Gửi hồ sơ</strong><small>Nhận mã tiếp nhận ngay</small></div>
          </div>
          <div className={styles.pathLine} aria-hidden="true" />
          <div className={styles.pathCard}>
            <span className={styles.pathIcon}><Icon name="heart" size={22} /></span>
            <div><strong>Trao đổi phù hợp</strong><small>Đội ngũ tuyển dụng chủ động liên hệ</small></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CareerCmsBody({ content }: { content: CmsContent }): React.ReactElement {
  const payload = content.payload;
  return (
    <section className={`${styles.inner} ${styles.cmsBody}`} aria-labelledby="career-cms-body-title">
      <div>
        <span className={styles.eyebrow}>Thông tin dành cho ứng viên</span>
        <h2 id="career-cms-body-title">{payload.title}</h2>
        {payload.body ? <p>{payload.body}</p> : null}
      </div>
      {"ctaLabel" in payload && payload.ctaLabel && "ctaHref" in payload && payload.ctaHref ? (
        <a className={styles.secondaryButton} href={payload.ctaHref}>{payload.ctaLabel} <Icon name="arrow-right" size={18} /></a>
      ) : null}
    </section>
  );
}

export default function CareersPage(): React.ReactElement {
  const [positions, setPositions] = useState<JobPosition[]>([]);
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [selectedPosition, setSelectedPosition] = useState<JobPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPositions = useCallback((): void => {
    setLoading(true);
    setError("");
    void fetchCareerPositions()
      .then((page) => setPositions(page.content))
      .catch(() => setError("Chưa thể tải danh sách tuyển dụng. Vui lòng thử lại sau."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchCareerPositions()
      .then((page) => { if (!cancelled) setPositions(page.content); })
      .catch(() => { if (!cancelled) setError("Chưa thể tải danh sách tuyển dụng. Vui lòng thử lại sau."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const departments = useMemo(
    () => Array.from(new Set(positions.map((position) => position.department))).sort((a, b) => a.localeCompare(b, "vi")),
    [positions],
  );
  const locations = useMemo(
    () => Array.from(new Set(positions.map((position) => position.location))).sort((a, b) => a.localeCompare(b, "vi")),
    [positions],
  );
  const visiblePositions = positions.filter((position) => (
    (!department || position.department === department) &&
    (!location || position.location === location)
  ));

  return (
    <PublicPageShell>
      <div className={styles.page}>
        <CmsLiveSlot
          fallback={<CareerHero content={DEFAULT_HERO} loading={loading} positionCount={positions.length} />}
          hideWhenNotFound
          renderContent={(content) => (
            <CareerHero
              content={content.componentType === "HERO" ? content.payload : DEFAULT_HERO}
              loading={loading}
              positionCount={positions.length}
            />
          )}
          showSourceLabel={false}
          slug="careers"
          slotKey="hero"
        />

        <section className={`${styles.inner} ${styles.values}`} aria-labelledby="career-values-title">
          <div className={styles.sectionIntro}>
            <span className={styles.eyebrow}>Cùng một mục tiêu</span>
            <h2 id="career-values-title">Môi trường để bạn làm tốt phần việc của mình</h2>
            <p>Chúng tôi ưu tiên cách làm việc có quy trình, phối hợp liên chuyên môn và tôn trọng từng người trong đội ngũ.</p>
          </div>
          <div className={styles.valueGrid}>
            <article className={styles.valueCard}>
              <Icon name="shield-check" size={27} />
              <h3>An toàn là nền tảng</h3>
              <p>Mỗi quyết định và quy trình đều bắt đầu từ sự an toàn của người bệnh và nhân viên y tế.</p>
            </article>
            <article className={styles.valueCard}>
              <Icon name="layers" size={27} />
              <h3>Phối hợp rõ ràng</h3>
              <p>Thông tin được bàn giao đầy đủ, trách nhiệm được xác định và phản hồi được ghi nhận.</p>
            </article>
            <article className={styles.valueCard}>
              <Icon name="heart" size={27} />
              <h3>Tôn trọng con người</h3>
              <p>Chuyên môn đi cùng lắng nghe, thấu hiểu hoàn cảnh của người bệnh và đồng nghiệp.</p>
            </article>
          </div>
        </section>

        <CmsLiveSlot
          className={styles.cmsLiveSlot}
          hideWhenNotFound
          hideWhileLoading
          renderContent={(content) => <CareerCmsBody content={content} />}
          showSourceLabel={false}
          slug="careers"
          slotKey="body"
        />

        <section className={styles.openings} id="vi-tri-dang-tuyen" aria-labelledby="openings-title">
          <div className={styles.inner}>
            <div className={styles.openingsHeading}>
              <div className={styles.sectionIntro}>
                <span className={styles.eyebrow}>Vị trí đang tuyển</span>
                <h2 id="openings-title">Tìm công việc phù hợp với bạn</h2>
                <p>Các vị trí đang tiếp nhận hồ sơ và thông tin cần biết trước khi bạn ứng tuyển.</p>
              </div>
              <div className={styles.filters} aria-label="Lọc vị trí tuyển dụng">
                <label>
                  <span>Khối chuyên môn</span>
                  <select value={department} onChange={(event) => setDepartment(event.target.value)}>
                    <option value="">Tất cả khối</option>
                    {departments.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label>
                  <span>Nơi làm việc</span>
                  <select value={location} onChange={(event) => setLocation(event.target.value)}>
                    <option value="">Tất cả cơ sở</option>
                    {locations.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
              </div>
            </div>

            {loading ? (
              <div className={styles.jobList} aria-busy="true" aria-label="Đang tải vị trí tuyển dụng">
                {[0, 1, 2].map((item) => <div className={styles.jobSkeleton} key={item} />)}
              </div>
            ) : null}
            {error ? (
              <div className={styles.stateCard} role="alert">
                <Icon name="alert-triangle" size={24} />
                <div><strong>Danh sách chưa tải được</strong><p>{error}</p></div>
                <button className={styles.secondaryButton} onClick={loadPositions} type="button">Thử tải lại</button>
              </div>
            ) : null}
            {!loading && !error && visiblePositions.length === 0 ? (
              <div className={styles.stateCard} role="status">
                <Icon name="search" size={24} />
                <div><strong>Chưa có vị trí phù hợp bộ lọc</strong><p>Hãy chọn lại khối chuyên môn hoặc nơi làm việc.</p></div>
                <button className={styles.secondaryButton} onClick={() => { setDepartment(""); setLocation(""); }} type="button">Xóa bộ lọc</button>
              </div>
            ) : null}

            {!loading && !error && visiblePositions.length > 0 ? (
              <div className={styles.jobList}>
                {visiblePositions.map((position) => {
                  const deadline = formatDeadline(position.deadline);
                  return (
                    <article className={`${styles.jobCard} ${position.featured ? styles.jobCardFeatured : ""}`} key={position.id}>
                      <div className={styles.jobTopline}>
                        <div className={styles.jobTags}>
                          {position.featured ? <span className={styles.featuredTag}>Ưu tiên tuyển</span> : null}
                          <span>{position.department}</span>
                        </div>
                        <span className={styles.typeTag}>{position.employmentTypeLabel}</span>
                      </div>
                      <div className={styles.jobMain}>
                        <div>
                          <h3>{position.title}</h3>
                          <div className={styles.jobMeta}>
                            <span><Icon name="location" size={17} /> {position.location}</span>
                            {deadline ? <span><Icon name="calendar" size={17} /> Nhận hồ sơ đến {deadline}</span> : null}
                          </div>
                          <p>{position.summary}</p>
                        </div>
                        <button className={styles.primaryButton} onClick={() => setSelectedPosition(position)} type="button">
                          Ứng tuyển vị trí này <Icon name="arrow-right" size={18} />
                        </button>
                      </div>
                      <details className={styles.jobDetails}>
                        <summary>Xem mô tả công việc và yêu cầu</summary>
                        <div className={styles.detailGrid}>
                          <div><h4>Công việc chính</h4><ul>{position.responsibilities.map((item) => <li key={item}>{item}</li>)}</ul></div>
                          <div><h4>Yêu cầu</h4><ul>{position.requirements.map((item) => <li key={item}>{item}</li>)}</ul></div>
                          <div><h4>Khi đồng hành</h4><ul>{position.benefits.map((item) => <li key={item}>{item}</li>)}</ul></div>
                        </div>
                      </details>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </div>
        </section>

        <section className={`${styles.inner} ${styles.recruitmentNote}`}>
          <div>
            <span className={styles.noteIcon}><Icon name="shield-check" size={24} /></span>
            <div><strong>Lưu ý khi ứng tuyển</strong><p>Bệnh viện không yêu cầu ứng viên chuyển khoản hoặc đóng phí trong quá trình tiếp nhận hồ sơ.</p></div>
          </div>
          <Link href="/contact">Liên hệ bệnh viện <Icon name="arrow-up-right" size={17} /></Link>
        </section>
      </div>

      {selectedPosition ? (
        <CareerApplicationDialog position={selectedPosition} onClose={() => setSelectedPosition(null)} />
      ) : null}
    </PublicPageShell>
  );
}
